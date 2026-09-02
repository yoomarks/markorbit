import type {
  ProviderSelectionId,
  ProviderSelectionMutationResultV1,
  ProviderSelectionV1
} from '@markorbit/contracts/provider-selection';
import type { QueryClient } from '@markorbit/persistence';
import {
  ProviderSelectionError,
  type ProviderSelectionAuditEvent,
  type ProviderSelectionCommit,
  type ProviderSelectionReplayRecord,
  type ProviderSelectionRepository,
  type ProviderSelectionScopeState
} from './provider-selection.js';

type Row = Record<string, unknown>;

export interface ProviderSelectionTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

function record(value: unknown): value is Row {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function versionValue(value: unknown): number | string {
  if (positiveInteger(value)) return value;
  if (nonEmptyString(value)) return value;
  throw new Error('Persisted Selection version value is malformed.');
}

function iso(value: unknown): string {
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.valueOf())) throw new Error('Persisted Selection timestamp is malformed.');
  return date.toISOString();
}

function canonicalSelection(value: unknown): ProviderSelectionV1 {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    !nonEmptyString(value.providerSelectionId) ||
    !value.providerSelectionId.startsWith('provider-selection_') ||
    !nonEmptyString(value.requesterWorkspaceId) ||
    !record(value.scope) ||
    !positiveInteger(value.scopeVersion) ||
    !record(value.sourceLineage) ||
    !record(value.trustedHumanAuthority) ||
    !record(value.acknowledgement) ||
    !nonEmptyString(value.selectedAt) ||
    !positiveInteger(value.version) ||
    !nonEmptyString(value.correlationId) ||
    !record(value.authorityConsequences) ||
    !nonEmptyString(value.status) ||
    !['CURRENT', 'SUPERSEDED', 'REVOKED'].includes(value.status)
  ) {
    throw new Error('Persisted Human Provider Selection canonical record is malformed.');
  }
  versionValue(value.scope.version);
  if (!nonEmptyString(value.scope.owner) || !nonEmptyString(value.scope.reference)) {
    throw new Error('Persisted Human Provider Selection scope is malformed.');
  }
  iso(value.selectedAt);
  if (value.revokedAt !== null && value.revokedAt !== undefined) iso(value.revokedAt);
  return structuredClone(value) as ProviderSelectionV1;
}

function canonicalReplay(value: unknown): ProviderSelectionMutationResultV1 {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    !nonEmptyString(value.mutation) ||
    !['CREATED', 'REPLACED', 'REVOKED'].includes(value.mutation) ||
    !record(value.selection) ||
    typeof value.replayed !== 'boolean' ||
    value.replayDoesNotEstablishCurrentUsability !== true ||
    !nonEmptyString(value.correlationId)
  ) {
    throw new Error('Persisted Human Provider Selection replay is malformed.');
  }
  canonicalSelection(value.selection);
  return structuredClone(value) as ProviderSelectionMutationResultV1;
}

function sameReference(
  left: { providerSelectionId: string; version: number; scopeVersion: number } | null,
  right: { providerSelectionId: string; version: number; scopeVersion: number } | null
): boolean {
  return (
    left?.providerSelectionId === right?.providerSelectionId &&
    left?.version === right?.version &&
    left?.scopeVersion === right?.scopeVersion
  );
}

export class PostgresProviderSelectionRepository implements ProviderSelectionRepository {
  constructor(
    private readonly database: ProviderSelectionTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findScopeState(scopeKey: string): Promise<ProviderSelectionScopeState> {
    try {
      return await this.readScopeState(this.query, scopeKey);
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findLatestSelection(providerSelectionId: ProviderSelectionId) {
    try {
      const result = await this.query.query(
        `SELECT * FROM mgsn_provider_selection_versions
         WHERE provider_selection_id=$1
         ORDER BY version DESC LIMIT 1`,
        [providerSelectionId]
      );
      return result.rows[0] ? this.selectionFromRow(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findReplay(scopeKey: string, idempotencyKey: string) {
    try {
      return await this.readReplay(this.query, scopeKey, idempotencyKey);
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async commit(mutation: ProviderSelectionCommit): Promise<ProviderSelectionReplayRecord | undefined> {
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [mutation.scopeKey]);

        const existingReplay = await this.readReplay(
          client,
          mutation.replay.scopeKey,
          mutation.replay.idempotencyKey
        );
        if (existingReplay) {
          if (
            existingReplay.effectiveCommandFingerprintSha256 !==
              mutation.replay.effectiveCommandFingerprintSha256 ||
            existingReplay.mutation !== mutation.replay.mutation
          ) {
            throw new ProviderSelectionError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has a different trusted context or command payload.',
              409
            );
          }
          return existingReplay;
        }

        const state = await this.readScopeState(client, mutation.scopeKey, true);
        const currentReference = state.current
          ? {
              providerSelectionId: state.current.providerSelectionId,
              version: state.current.version,
              scopeVersion: state.current.scopeVersion
            }
          : null;
        if (
          state.scopeVersion !== mutation.expectedScopeVersion ||
          !sameReference(currentReference, mutation.expectedCurrent)
        ) {
          throw new ProviderSelectionError(
            'STALE_SELECTION',
            'Human Provider Selection changed; reload the exact current scope version.',
            409
          );
        }
        if (mutation.newScopeVersion !== state.scopeVersion + 1) {
          throw new ProviderSelectionError(
            'STALE_SELECTION',
            'Selection scope history is not appendable at the requested version.',
            409
          );
        }

        for (const selection of mutation.appendedSelections) {
          await this.ensureIdentity(client, selection);
          await this.insertSelection(client, selection);
        }

        const head = mutation.newCurrent ?? mutation.appendedSelections.at(-1);
        if (!head) {
          throw new ProviderSelectionError('INVALID_INPUT', 'Selection commit has no durable head.', 422);
        }
        await this.writeScopeState(client, mutation, head);
        await this.insertReplay(client, mutation.replay);
        await this.insertAudit(client, mutation.audit, mutation.replay.response.selection);
        return undefined;
      });
    } catch (cause) {
      if (cause instanceof ProviderSelectionError) throw cause;
      throw this.unavailable(cause);
    }
  }

  async listSelectionHistory(providerSelectionId: ProviderSelectionId) {
    try {
      const result = await this.query.query(
        `SELECT * FROM mgsn_provider_selection_versions
         WHERE provider_selection_id=$1 ORDER BY version ASC`,
        [providerSelectionId]
      );
      return result.rows.map((row) => this.selectionFromRow(row as Row));
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async listAuditHistory(scopeKey: string): Promise<ProviderSelectionAuditEvent[]> {
    try {
      const result = await this.query.query(
        `SELECT * FROM mgsn_provider_selection_owner_audit_events
         WHERE scope_key=$1 ORDER BY occurred_at ASC,audit_id ASC`,
        [scopeKey]
      );
      return result.rows.map((row) => {
        const value = row as Row;
        const previous = value.previous_provider_selection_id
          ? {
              providerSelectionId: String(value.previous_provider_selection_id) as ProviderSelectionId,
              version: Number(value.previous_selection_version),
              scopeVersion: Number(value.previous_scope_version)
            }
          : undefined;
        return {
          scopeKey: String(value.scope_key),
          requesterWorkspaceId: String(value.requester_workspace_id),
          action: value.action as ProviderSelectionAuditEvent['action'],
          actorId: String(value.actor_id),
          selectionAuthorityReference: String(value.selection_authority_reference),
          commandFingerprintSha256: String(value.command_fingerprint_sha256),
          ...(previous ? { previousSelection: previous } : {}),
          selection: {
            providerSelectionId: String(value.provider_selection_id) as ProviderSelectionId,
            version: Number(value.selection_version),
            scopeVersion: Number(value.selection_scope_version)
          },
          occurredAt: iso(value.occurred_at),
          correlationId: String(value.correlation_id)
        };
      });
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  private async readScopeState(
    client: QueryClient,
    scopeKey: string,
    lock = false
  ): Promise<ProviderSelectionScopeState> {
    const result = await client.query(
      `SELECT * FROM mgsn_provider_selection_scope_state WHERE scope_key=$1${lock ? ' FOR UPDATE' : ''}`,
      [scopeKey]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row) return { scopeVersion: 0 };
    const scopeVersion = Number(row.scope_version);
    if (!positiveInteger(scopeVersion)) throw new Error('Persisted Selection scope version is malformed.');
    if (!row.current_provider_selection_id) return { scopeVersion };
    const current = await client.query(
      `SELECT * FROM mgsn_provider_selection_versions
       WHERE provider_selection_id=$1 AND version=$2 AND scope_version=$3`,
      [row.current_provider_selection_id, row.current_selection_version, row.current_selection_scope_version]
    );
    if (!current.rows[0]) throw new Error('Persisted Selection current pointer is dangling.');
    const selection = this.selectionFromRow(current.rows[0] as Row);
    if (selection.status !== 'CURRENT' || selection.scopeVersion !== scopeVersion) {
      throw new Error('Persisted Selection current pointer contradicts canonical lifecycle.');
    }
    return { scopeVersion, current: selection };
  }

  private async readReplay(client: QueryClient, scopeKey: string, idempotencyKey: string) {
    const result = await client.query(
      `SELECT * FROM mgsn_provider_selection_command_replays
       WHERE scope_key=$1 AND idempotency_key=$2`,
      [scopeKey, idempotencyKey]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row) return undefined;
    const response = canonicalReplay(row.response_record);
    if (
      response.selection.providerSelectionId !== row.response_provider_selection_id ||
      response.selection.version !== Number(row.response_selection_version) ||
      response.selection.scopeVersion !== Number(row.response_scope_version) ||
      response.mutation !== row.mutation
    ) {
      throw new Error('Persisted Selection replay contradicts normalized lineage.');
    }
    return {
      scopeKey: String(row.scope_key),
      idempotencyKey: String(row.idempotency_key),
      effectiveCommandFingerprintSha256: String(row.effective_command_fingerprint_sha256),
      mutation: row.mutation as ProviderSelectionReplayRecord['mutation'],
      response
    };
  }

  private selectionFromRow(row: Row): ProviderSelectionV1 {
    const selection = canonicalSelection(row.selection_record);
    const scopeVersion = Number(row.scope_version);
    if (
      selection.providerSelectionId !== row.provider_selection_id ||
      selection.version !== Number(row.version) ||
      selection.scopeVersion !== scopeVersion ||
      selection.status !== row.status ||
      selection.requesterWorkspaceId.toLowerCase() !== String(row.requester_workspace_id).toLowerCase() ||
      selection.scope.owner !== row.scope_owner ||
      selection.scope.reference !== row.scope_reference ||
      selection.scope.fingerprintSha256 !== row.scope_fingerprint_sha256 ||
      selection.sourceLineage.discoveryCandidate.providerDiscoveryCandidateId !== row.discovery_candidate_id ||
      selection.sourceLineage.discoveryCandidate.candidateFingerprintSha256 !==
        row.discovery_candidate_fingerprint_sha256 ||
      selection.sourceLineage.provider.providerId !== row.provider_id ||
      selection.sourceLineage.provider.providerWorkspaceId.toLowerCase() !==
        String(row.provider_workspace_id).toLowerCase()
    ) {
      throw new Error('Persisted Human Provider Selection normalized lineage is contradictory.');
    }
    return selection;
  }

  private async ensureIdentity(client: QueryClient, selection: ProviderSelectionV1) {
    await client.query(
      `INSERT INTO mgsn_provider_selection_identities(
         provider_selection_id,requester_workspace_id,scope_owner,scope_reference,created_at
       ) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (provider_selection_id) DO NOTHING`,
      [
        selection.providerSelectionId,
        selection.requesterWorkspaceId,
        selection.scope.owner,
        selection.scope.reference,
        selection.selectedAt
      ]
    );
  }

  private async insertSelection(client: QueryClient, selection: ProviderSelectionV1) {
    const lineage = selection.sourceLineage;
    const authority = selection.trustedHumanAuthority;
    const acknowledgement = selection.acknowledgement;
    await client.query(
      `INSERT INTO mgsn_provider_selection_versions(
        provider_selection_id,version,requester_workspace_id,scope_owner,scope_reference,
        scope_reference_version,scope_fingerprint_sha256,scope_version,status,
        discovery_request_id,discovery_request_fingerprint_sha256,discovery_need_reference,
        discovery_need_version,discovery_need_fingerprint_sha256,discovery_purpose,
        discovery_context_reference,discovery_result_fingerprint_sha256,discovery_result_evaluated_at,
        discovery_candidate_id,discovery_candidate_fingerprint_sha256,discovery_candidate_generated_at,
        discovery_evaluation_policy_version,provider_id,provider_workspace_id,
        provider_supply_capability_id,provider_supply_capability_version,
        provider_supply_capability_fingerprint_sha256,visibility_network_participation_id,
        visibility_participation_version,visibility_policy_version,visibility_evaluated_at,
        visibility_current_authority_revalidation_required_before_serve,historical_source_versions,
        direct_executor_disclosure_state,direct_executor_evidence_references,
        current_authority_revalidation_required_before_selection_commit,
        current_authority_revalidation_required_before_downstream_use,trusted_authority_source,
        selecting_actor_id,principal_reference,workspace_membership_reference,
        selection_authority_reference,selection_authority_version,authenticated_at,
        affirmative_human_action_evidence_reference,payload_identity_authoritative,
        acknowledgement_affirmative_human_action,acknowledgement_code,
        acknowledgement_text_version,acknowledgement_reviewed_candidate_id,
        acknowledgement_reviewed_candidate_fingerprint_sha256,
        acknowledgement_reviewed_scope_fingerprint_sha256,acknowledgement_reviewed_at,
        acknowledgement_reason_code,acknowledgement_rationale,
        acknowledgement_contains_customer_documents,acknowledgement_contains_raw_evidence_artifacts,
        acknowledgement_contains_end_client_relationship_information,
        acknowledgement_contains_applicant_owner_official_data,
        acknowledgement_contains_commercial_margin_or_profit,selected_at,
        superseded_by_provider_selection_id,superseded_by_version,superseded_by_scope_version,
        revoked_at,revocation_reason_code,correlation_id,selection_record,created_at
      ) VALUES(
        $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33::jsonb,$34,$35::jsonb,$36,$37,$38,$39,
        $40,$41,$42,$43::jsonb,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,$56,$57,$58,$59,
        $60,$61,$62,$63,$64,$65,$66,$67,$68,$69,$70::jsonb,$71
      )`,
      [
        selection.providerSelectionId,
        selection.version,
        selection.requesterWorkspaceId,
        selection.scope.owner,
        selection.scope.reference,
        JSON.stringify(selection.scope.version),
        selection.scope.fingerprintSha256,
        selection.scopeVersion,
        selection.status,
        lineage.discoveryRequest.providerDiscoveryRequestId,
        lineage.discoveryRequest.requestFingerprintSha256,
        lineage.discoveryRequest.needReference,
        JSON.stringify(lineage.discoveryRequest.needVersion),
        lineage.discoveryRequest.needFingerprintSha256,
        lineage.discoveryRequest.purpose,
        lineage.discoveryRequest.contextReference,
        lineage.discoveryResult.resultFingerprintSha256,
        lineage.discoveryResult.evaluatedAt,
        lineage.discoveryCandidate.providerDiscoveryCandidateId,
        lineage.discoveryCandidate.candidateFingerprintSha256,
        lineage.discoveryCandidate.generatedAt,
        lineage.discoveryCandidate.evaluationPolicyVersion,
        lineage.provider.providerId,
        lineage.provider.providerWorkspaceId,
        lineage.providerSupplyCapability.id,
        lineage.providerSupplyCapability.version,
        lineage.providerSupplyCapability.fingerprintSha256,
        lineage.visibilityAuthorizationAtReview.networkParticipationId,
        lineage.visibilityAuthorizationAtReview.participationVersion,
        lineage.visibilityAuthorizationAtReview.visibilityPolicyVersion,
        lineage.visibilityAuthorizationAtReview.evaluatedAt,
        lineage.visibilityAuthorizationAtReview.currentAuthorityRevalidationRequiredBeforeServe,
        JSON.stringify(lineage.historicalSourceVersions),
        lineage.directExecutorDisclosureAtReview.state,
        JSON.stringify(lineage.directExecutorDisclosureAtReview.evidenceReferences),
        lineage.currentAuthorityRevalidationRequiredBeforeSelectionCommit,
        lineage.currentAuthorityRevalidationRequiredBeforeDownstreamUse,
        authority.source,
        authority.selectingActorId,
        authority.principalReference,
        authority.workspaceMembershipReference,
        authority.selectionAuthorityReference,
        JSON.stringify(authority.selectionAuthorityVersion),
        authority.authenticatedAt,
        authority.affirmativeHumanActionEvidenceReference,
        authority.payloadIdentityAuthoritative,
        acknowledgement.affirmativeHumanAction,
        acknowledgement.acknowledgementCode,
        acknowledgement.acknowledgementTextVersion,
        acknowledgement.reviewedCandidateId,
        acknowledgement.reviewedCandidateFingerprintSha256,
        acknowledgement.reviewedScopeFingerprintSha256,
        acknowledgement.reviewedAt,
        acknowledgement.reasonCode,
        acknowledgement.rationale ?? null,
        acknowledgement.containsCustomerDocuments,
        acknowledgement.containsRawEvidenceArtifacts,
        acknowledgement.containsEndClientRelationshipInformation,
        acknowledgement.containsApplicantOwnerOfficialData,
        acknowledgement.containsCommercialMarginOrProfit,
        selection.selectedAt,
        selection.supersededBy?.providerSelectionId ?? null,
        selection.supersededBy?.version ?? null,
        selection.supersededBy?.scopeVersion ?? null,
        selection.revokedAt ?? null,
        selection.revocationReasonCode ?? null,
        selection.correlationId,
        JSON.stringify(selection),
        selection.selectedAt
      ]
    );
  }

  private async writeScopeState(
    client: QueryClient,
    mutation: ProviderSelectionCommit,
    head: ProviderSelectionV1
  ) {
    const current = mutation.newCurrent;
    if (mutation.expectedScopeVersion === 0) {
      await client.query(
        `INSERT INTO mgsn_provider_selection_scope_state(
          scope_key,requester_workspace_id,scope_owner,scope_reference,scope_version,
          head_provider_selection_id,head_selection_version,head_selection_scope_version,
          current_provider_selection_id,current_selection_version,current_selection_scope_version,
          set_by,correlation_id,updated_at
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          mutation.scopeKey,
          head.requesterWorkspaceId,
          head.scope.owner,
          head.scope.reference,
          mutation.newScopeVersion,
          head.providerSelectionId,
          head.version,
          head.scopeVersion,
          current?.providerSelectionId ?? null,
          current?.version ?? null,
          current?.scopeVersion ?? null,
          mutation.audit.actorId,
          mutation.audit.correlationId,
          mutation.audit.occurredAt
        ]
      );
      return;
    }
    const updated = await client.query(
      `UPDATE mgsn_provider_selection_scope_state SET
        scope_version=$2,head_provider_selection_id=$3,head_selection_version=$4,
        head_selection_scope_version=$5,current_provider_selection_id=$6,
        current_selection_version=$7,current_selection_scope_version=$8,set_by=$9,
        correlation_id=$10,updated_at=$11
       WHERE scope_key=$1 AND scope_version=$12`,
      [
        mutation.scopeKey,
        mutation.newScopeVersion,
        head.providerSelectionId,
        head.version,
        head.scopeVersion,
        current?.providerSelectionId ?? null,
        current?.version ?? null,
        current?.scopeVersion ?? null,
        mutation.audit.actorId,
        mutation.audit.correlationId,
        mutation.audit.occurredAt,
        mutation.expectedScopeVersion
      ]
    );
    if (!updated.rowCount) {
      throw new ProviderSelectionError(
        'STALE_SELECTION',
        'Human Provider Selection changed; reload the exact current scope version.',
        409
      );
    }
  }

  private async insertReplay(client: QueryClient, replay: ProviderSelectionReplayRecord) {
    const selection = replay.response.selection;
    const authority = selection.trustedHumanAuthority;
    await client.query(
      `INSERT INTO mgsn_provider_selection_command_replays(
        scope_key,idempotency_key,effective_command_fingerprint_sha256,mutation,
        requester_workspace_id,selecting_actor_id,principal_reference,
        workspace_membership_reference,selection_authority_reference,selection_authority_version,
        affirmative_human_action_evidence_reference,response_provider_selection_id,
        response_selection_version,response_scope_version,response_record,correlation_id,created_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15::jsonb,$16,$17)`,
      [
        replay.scopeKey,
        replay.idempotencyKey,
        replay.effectiveCommandFingerprintSha256,
        replay.mutation,
        selection.requesterWorkspaceId,
        authority.selectingActorId,
        authority.principalReference,
        authority.workspaceMembershipReference,
        authority.selectionAuthorityReference,
        JSON.stringify(authority.selectionAuthorityVersion),
        authority.affirmativeHumanActionEvidenceReference,
        selection.providerSelectionId,
        selection.version,
        selection.scopeVersion,
        JSON.stringify(replay.response),
        replay.response.correlationId,
        selection.selectedAt
      ]
    );
  }

  private async insertAudit(
    client: QueryClient,
    audit: ProviderSelectionAuditEvent,
    selection: ProviderSelectionV1
  ) {
    const authority = selection.trustedHumanAuthority;
    await client.query(
      `INSERT INTO mgsn_provider_selection_owner_audit_events(
        scope_key,requester_workspace_id,action,actor_id,principal_reference,
        workspace_membership_reference,selection_authority_reference,selection_authority_version,
        affirmative_human_action_evidence_reference,command_fingerprint_sha256,
        previous_provider_selection_id,previous_selection_version,previous_scope_version,
        provider_selection_id,selection_version,selection_scope_version,correlation_id,
        occurred_at,created_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)`,
      [
        audit.scopeKey,
        audit.requesterWorkspaceId,
        audit.action,
        audit.actorId,
        authority.principalReference,
        authority.workspaceMembershipReference,
        audit.selectionAuthorityReference,
        JSON.stringify(authority.selectionAuthorityVersion),
        authority.affirmativeHumanActionEvidenceReference,
        audit.commandFingerprintSha256,
        audit.previousSelection?.providerSelectionId ?? null,
        audit.previousSelection?.version ?? null,
        audit.previousSelection?.scopeVersion ?? null,
        audit.selection.providerSelectionId,
        audit.selection.version,
        audit.selection.scopeVersion,
        audit.correlationId,
        audit.occurredAt
      ]
    );
  }

  private unavailable(cause: unknown): ProviderSelectionError {
    if (cause instanceof ProviderSelectionError) return cause;
    return new ProviderSelectionError(
      'AUTHORITY_UNAVAILABLE',
      'Durable Human Provider Selection state is unavailable.',
      503
    );
  }
}
