import type {
  ControlledHandoffEnvelopeV1,
  ControlledHandoffId,
  ControlledHandoffMutationResultV1
} from '@markorbit/contracts/controlled-privacy-handoff';
import type { QueryClient } from '@markorbit/persistence';
import {
  ControlledHandoffError,
  type ControlledHandoffRepository
} from './controlled-privacy-handoff.js';

type Row = Record<string, unknown>;
type HandoffCommit = Parameters<ControlledHandoffRepository['commit']>[0];
type HandoffReplay = Awaited<ReturnType<ControlledHandoffRepository['findReplay']>>;
type HandoffSlotState = Awaited<ReturnType<ControlledHandoffRepository['findSlotState']>>;

export interface ControlledHandoffTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

function record(value: unknown): value is Row {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function iso(value: unknown): string {
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.valueOf()))
    throw new Error('Persisted Controlled Handoff timestamp is malformed.');
  return date.toISOString();
}

function versionValue(value: unknown): number | string {
  if (positiveInteger(value)) return Number(value);
  if (nonEmpty(value)) return value;
  throw new Error('Persisted Controlled Handoff authority version is malformed.');
}

function canonicalEnvelope(value: unknown): ControlledHandoffEnvelopeV1 {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    !nonEmpty(value.controlledHandoffId) ||
    !value.controlledHandoffId.startsWith('controlled-handoff_') ||
    !nonEmpty(value.originatingWorkspaceId) ||
    !record(value.recipient) ||
    !record(value.purpose) ||
    !record(value.authorizedProjection) ||
    !record(value.sourceLineage) ||
    !record(value.trustedHumanAuthority) ||
    !record(value.privacyPreviewAcknowledgement) ||
    !record(value.authorityConsequences) ||
    !positiveInteger(value.version) ||
    !nonEmpty(value.envelopeFingerprintSha256) ||
    !nonEmpty(value.correlationId) ||
    !['AUTHORIZED', 'REVOKED'].includes(String(value.status))
  ) {
    throw new Error('Persisted Controlled Handoff canonical envelope is malformed.');
  }
  if (
    value.recipient.role !== 'FINAL_EXECUTION_PROVIDER' ||
    !nonEmpty(value.recipient.providerId) ||
    !nonEmpty(value.recipient.providerWorkspaceId) ||
    !nonEmpty(value.purpose.contextReference) ||
    value.purpose.unrestrictedPurposeAllowed !== false ||
    value.authorizedProjection.fieldValuesEmbeddedInEnvelope !== false ||
    value.authorizedProjection.wildcardAllowed !== false ||
    value.authorizedProjection.wholeRecordAllowed !== false ||
    value.authorizedProjection.implicitFieldExpansionAllowed !== false ||
    value.sourceLineage.currentAuthorityRevalidationRequiredBeforeAuthorize !== true ||
    value.sourceLineage.currentAuthorityRevalidationRequiredBeforeConsumption !== true ||
    value.sourceLineage.evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval !== true ||
    value.authorityConsequences.controlledPrivacyHandoffAuthorized !== true ||
    Object.entries(value.authorityConsequences).some(
      ([key, consequence]) => key !== 'controlledPrivacyHandoffAuthorized' && consequence !== false
    )
  ) {
    throw new Error('Persisted Controlled Handoff privacy or authority boundary is malformed.');
  }
  iso(value.authorizedAt);
  iso(value.validFrom);
  iso(value.validUntil);
  if (value.status === 'AUTHORIZED' && value.revokedAt !== null) {
    throw new Error('Persisted AUTHORIZED Handoff cannot be revoked.');
  }
  if (value.status === 'REVOKED') {
    if (!nonEmpty(value.revokedAt) || !nonEmpty(value.revocationReasonCode)) {
      throw new Error('Persisted REVOKED Handoff lacks terminal lineage.');
    }
    iso(value.revokedAt);
  }
  return structuredClone(value) as ControlledHandoffEnvelopeV1;
}

function canonicalResult(value: unknown): ControlledHandoffMutationResultV1 {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    !['AUTHORIZED', 'REPLACED', 'REVOKED'].includes(String(value.mutation)) ||
    !record(value.envelope) ||
    typeof value.replayed !== 'boolean' ||
    value.replayDoesNotEstablishCurrentUsability !== true ||
    !nonEmpty(value.correlationId)
  ) {
    throw new Error('Persisted Controlled Handoff replay result is malformed.');
  }
  canonicalEnvelope(value.envelope);
  return structuredClone(value) as unknown as ControlledHandoffMutationResultV1;
}

function sameCurrent(
  current: ControlledHandoffEnvelopeV1 | undefined,
  expected: HandoffCommit['expectedCurrent']
): boolean {
  if (expected.kind === 'ABSENT') return current === undefined;
  return (
    current?.controlledHandoffId === expected.controlledHandoffId &&
    current.version === expected.version &&
    current.status === 'AUTHORIZED'
  );
}

function actionFor(mutation: HandoffCommit): 'AUTHORIZED' | 'REPLACED' | 'REVOKED' {
  if (mutation.next.status === 'REVOKED') return 'REVOKED';
  return mutation.previous ? 'REPLACED' : 'AUTHORIZED';
}

export class PostgresControlledHandoffRepository implements ControlledHandoffRepository {
  constructor(
    private readonly database: ControlledHandoffTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findSlotState(slotKey: string): Promise<HandoffSlotState> {
    try {
      return await this.readSlotState(this.query, slotKey);
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findLatest(controlledHandoffId: ControlledHandoffId) {
    try {
      const result = await this.query.query(
        `SELECT * FROM mgsn_controlled_handoff_versions
         WHERE controlled_handoff_id=$1 ORDER BY version DESC LIMIT 1`,
        [controlledHandoffId]
      );
      return result.rows[0] ? this.envelopeFromRow(result.rows[0] as Row) : undefined;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findReplay(slotKey: string, idempotencyKey: string): Promise<HandoffReplay> {
    try {
      return await this.readReplay(this.query, slotKey, idempotencyKey);
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async commit(mutation: HandoffCommit): Promise<void> {
    try {
      await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          mutation.slotKey
        ]);

        const replay = await this.readReplay(client, mutation.slotKey, mutation.replayKey);
        if (replay) {
          if (
            replay.fingerprint === mutation.replay.fingerprint &&
            replay.actorId === mutation.replay.actorId &&
            replay.principalReference === mutation.replay.principalReference
          ) {
            return;
          }
          throw new ControlledHandoffError(
            'IDEMPOTENCY_CONFLICT',
            409,
            'Controlled Handoff idempotency key was already committed with another authority or fingerprint.'
          );
        }

        const state = await this.readSlotState(client, mutation.slotKey, true);
        if (!sameCurrent(state.current, mutation.expectedCurrent)) {
          throw new ControlledHandoffError(
            'STALE_HANDOFF',
            409,
            'Expected current Handoff is stale.'
          );
        }
        if (
          mutation.previous &&
          (!state.current ||
            state.current.controlledHandoffId !== mutation.previous.controlledHandoffId ||
            state.current.version !== mutation.previous.version)
        ) {
          throw new ControlledHandoffError(
            'STALE_HANDOFF',
            409,
            'Controlled Handoff changed before commit.'
          );
        }
        if (!mutation.previous && mutation.next.version !== 1) {
          throw new ControlledHandoffError(
            'STALE_HANDOFF',
            409,
            'Fresh Handoff identity must begin at version 1.'
          );
        }
        if (
          mutation.previous &&
          (mutation.next.controlledHandoffId !== mutation.previous.controlledHandoffId ||
            mutation.next.version !== mutation.previous.version + 1)
        ) {
          throw new ControlledHandoffError(
            'STALE_HANDOFF',
            409,
            'Handoff history is not appendable.'
          );
        }

        await this.ensureIdentity(client, mutation.slotKey, mutation.next);
        await this.insertEnvelope(client, mutation.slotKey, mutation.next);
        await this.writeSlotState(client, mutation, state.version);
        await this.insertReplay(client, mutation);
        await this.insertAudit(client, mutation);
      });
    } catch (cause) {
      if (cause instanceof ControlledHandoffError) throw cause;
      throw this.unavailable(cause);
    }
  }

  async listHistory(
    controlledHandoffId: ControlledHandoffId
  ): Promise<ControlledHandoffEnvelopeV1[]> {
    try {
      const result = await this.query.query(
        `SELECT * FROM mgsn_controlled_handoff_versions
         WHERE controlled_handoff_id=$1 ORDER BY version ASC`,
        [controlledHandoffId]
      );
      return result.rows.map((row) => this.envelopeFromRow(row as Row));
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  private async readSlotState(
    client: QueryClient,
    slotKey: string,
    lock = false
  ): Promise<HandoffSlotState> {
    const result = await client.query(
      `SELECT * FROM mgsn_controlled_handoff_slot_state WHERE slot_key=$1${lock ? ' FOR UPDATE' : ''}`,
      [slotKey]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row) return { current: undefined, version: 0 };
    const revision = Number(row.slot_revision);
    if (!positiveInteger(revision))
      throw new Error('Persisted Controlled Handoff slot revision is malformed.');

    const headResult = await client.query(
      `SELECT * FROM mgsn_controlled_handoff_versions
       WHERE controlled_handoff_id=$1 AND version=$2 AND originating_workspace_id=$3 AND slot_key=$4`,
      [row.head_controlled_handoff_id, row.head_version, row.originating_workspace_id, slotKey]
    );
    if (!headResult.rows[0]) throw new Error('Persisted Controlled Handoff slot head is dangling.');
    const head = this.envelopeFromRow(headResult.rows[0] as Row);

    if (!row.current_controlled_handoff_id) {
      if (head.status !== 'REVOKED' || row.current_version !== null) {
        throw new Error('Persisted Controlled Handoff revoked slot contradicts canonical history.');
      }
      return { current: undefined, version: revision };
    }
    if (
      row.current_controlled_handoff_id !== row.head_controlled_handoff_id ||
      Number(row.current_version) !== Number(row.head_version)
    ) {
      throw new Error('Persisted Controlled Handoff current pointer differs from slot head.');
    }
    if (head.status !== 'AUTHORIZED') {
      throw new Error(
        'Persisted Controlled Handoff current pointer references non-authorized history.'
      );
    }
    return { current: head, version: revision };
  }

  private async readReplay(
    client: QueryClient,
    slotKey: string,
    idempotencyKey: string
  ): Promise<HandoffReplay> {
    const result = await client.query(
      `SELECT * FROM mgsn_controlled_handoff_command_replays
       WHERE slot_key=$1 AND idempotency_key=$2`,
      [slotKey, idempotencyKey]
    );
    const row = result.rows[0] as Row | undefined;
    if (!row) return undefined;
    const response = canonicalResult(row.response_result);
    if (
      response.envelope.controlledHandoffId !== row.response_controlled_handoff_id ||
      response.envelope.version !== Number(row.response_version) ||
      response.envelope.envelopeFingerprintSha256 !== row.response_envelope_fingerprint_sha256 ||
      response.mutation !== row.mutation
    ) {
      throw new Error('Persisted Controlled Handoff replay contradicts normalized lineage.');
    }
    return {
      fingerprint: String(row.command_fingerprint_sha256),
      actorId: String(row.authorizing_actor_id),
      principalReference: String(row.principal_reference),
      result: response
    };
  }

  private envelopeFromRow(row: Row): ControlledHandoffEnvelopeV1 {
    const envelope = canonicalEnvelope(row.envelope_record);
    const selection = envelope.sourceLineage.selectionLineage;
    const direct = envelope.sourceLineage.directExecutorAuthority;
    const authority = envelope.trustedHumanAuthority;
    const preview = envelope.privacyPreviewAcknowledgement;
    if (
      envelope.controlledHandoffId !== row.controlled_handoff_id ||
      envelope.version !== Number(row.version) ||
      envelope.originatingWorkspaceId.toLowerCase() !==
        String(row.originating_workspace_id).toLowerCase() ||
      envelope.recipient.providerId !== row.recipient_provider_id ||
      envelope.recipient.providerWorkspaceId.toLowerCase() !==
        String(row.recipient_provider_workspace_id).toLowerCase() ||
      envelope.recipient.role !== row.recipient_role ||
      envelope.purpose.code !== row.purpose_code ||
      envelope.purpose.contextReference !== row.purpose_context_reference ||
      envelope.purpose.instructionReference !== row.purpose_instruction_reference ||
      envelope.purpose.purposeFingerprintSha256 !== row.purpose_fingerprint_sha256 ||
      envelope.authorizedProjection.projectionFingerprintSha256 !==
        row.projection_fingerprint_sha256 ||
      envelope.authorizedProjection.sourceSetFingerprintSha256 !==
        row.source_set_fingerprint_sha256 ||
      selection.selection.providerSelectionId !== row.selection_provider_selection_id ||
      selection.selection.version !== Number(row.selection_version) ||
      selection.selection.scopeVersion !== Number(row.selection_scope_version) ||
      selection.selectionScope.owner !== row.selection_scope_owner ||
      selection.selectionScope.reference !== row.selection_scope_reference ||
      selection.selectionScope.fingerprintSha256 !== row.selection_scope_fingerprint_sha256 ||
      selection.selectionFingerprintSha256 !== row.selection_fingerprint_sha256 ||
      selection.currentSelectionValidation.purpose !== row.selection_validation_purpose ||
      selection.currentSelectionValidation.decision !== row.selection_validation_decision ||
      direct.disclosureState !== row.direct_executor_disclosure_state ||
      direct.finalExecutionProviderId !== row.final_execution_provider_id ||
      direct.finalExecutionProviderWorkspaceId.toLowerCase() !==
        String(row.final_execution_provider_workspace_id).toLowerCase() ||
      direct.authorityReference !== row.direct_executor_authority_reference ||
      authority.source !== row.trusted_authority_source ||
      authority.authorizingActorId !== row.authorizing_actor_id ||
      authority.principalReference !== row.principal_reference ||
      authority.workspaceMembershipReference !== row.workspace_membership_reference ||
      authority.handoffAuthorityReference !== row.handoff_authority_reference ||
      preview.previewFingerprintSha256 !== row.preview_fingerprint_sha256 ||
      envelope.status !== row.status ||
      envelope.envelopeFingerprintSha256 !== row.envelope_fingerprint_sha256 ||
      envelope.correlationId !== row.correlation_id ||
      iso(envelope.authorizedAt) !== iso(row.authorized_at) ||
      iso(envelope.validFrom) !== iso(row.valid_from) ||
      iso(envelope.validUntil) !== iso(row.valid_until)
    ) {
      throw new Error(
        'Persisted Controlled Handoff normalized lineage contradicts canonical envelope.'
      );
    }
    if (
      JSON.stringify(selection.selectionScope.version) !==
      JSON.stringify(versionValue(row.selection_scope_reference_version))
    ) {
      throw new Error('Persisted Controlled Handoff Selection scope version is contradictory.');
    }
    if (
      JSON.stringify(direct.authorityVersion) !==
      JSON.stringify(versionValue(row.direct_executor_authority_version))
    ) {
      throw new Error(
        'Persisted Controlled Handoff Direct Executor authority version is contradictory.'
      );
    }
    if (
      JSON.stringify(authority.handoffAuthorityVersion) !==
      JSON.stringify(versionValue(row.handoff_authority_version))
    ) {
      throw new Error('Persisted Controlled Handoff human authority version is contradictory.');
    }
    return envelope;
  }

  private async ensureIdentity(
    client: QueryClient,
    slotKey: string,
    envelope: ControlledHandoffEnvelopeV1
  ) {
    await client.query(
      `INSERT INTO mgsn_controlled_handoff_identities(
         controlled_handoff_id,originating_workspace_id,slot_key,recipient_provider_id,
         recipient_provider_workspace_id,purpose_context_reference,created_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (controlled_handoff_id) DO NOTHING`,
      [
        envelope.controlledHandoffId,
        envelope.originatingWorkspaceId,
        slotKey,
        envelope.recipient.providerId,
        envelope.recipient.providerWorkspaceId,
        envelope.purpose.contextReference,
        envelope.authorizedAt
      ]
    );
  }

  private async insertEnvelope(
    client: QueryClient,
    slotKey: string,
    envelope: ControlledHandoffEnvelopeV1
  ) {
    const json = JSON.stringify(envelope);
    await client.query(
      `INSERT INTO mgsn_controlled_handoff_versions(
        controlled_handoff_id,version,originating_workspace_id,slot_key,
        recipient_provider_id,recipient_provider_workspace_id,recipient_role,
        purpose_code,purpose_context_reference,purpose_instruction_reference,purpose_fingerprint_sha256,
        unrestricted_purpose_allowed,projection_fingerprint_sha256,source_set_fingerprint_sha256,
        selection_provider_selection_id,selection_version,selection_scope_version,selection_scope_owner,
        selection_scope_reference,selection_scope_reference_version,selection_scope_fingerprint_sha256,
        selection_fingerprint_sha256,selection_validation_purpose,selection_validation_decision,
        selection_currently_usable,selection_evaluated_at,selection_validation_policy_version,
        direct_executor_disclosure_state,direct_executor_established,final_execution_provider_id,
        final_execution_provider_workspace_id,direct_executor_authority_reference,direct_executor_authority_version,
        direct_executor_evidence_references,direct_executor_checked_at,hidden_intermediary_allowed,
        onward_recipient_authorization,current_authority_revalidation_required_before_authorize,
        current_authority_revalidation_required_before_consumption,
        evidence_reference_visibility_does_not_grant_artifact_retrieval,trusted_authority_source,
        authorizing_actor_id,principal_reference,workspace_membership_reference,handoff_authority_reference,
        handoff_authority_version,authenticated_at,affirmative_human_action_evidence_reference,
        payload_identity_authoritative,preview_affirmative_human_action,preview_acknowledgement_code,
        preview_acknowledgement_text_version,preview_fingerprint_sha256,preview_reviewed_at,authorized_at,
        valid_from,valid_until,status,revoked_at,revocation_reason_code,envelope_fingerprint_sha256,
        correlation_id,envelope_record,created_at
      ) SELECT
        $1,$2,$3,$4,
        j#>>'{recipient,providerId}',(j#>>'{recipient,providerWorkspaceId}')::uuid,j#>>'{recipient,role}',
        j#>>'{purpose,code}',j#>>'{purpose,contextReference}',j#>>'{purpose,instructionReference}',
        j#>>'{purpose,purposeFingerprintSha256}',(j#>>'{purpose,unrestrictedPurposeAllowed}')::boolean,
        j#>>'{authorizedProjection,projectionFingerprintSha256}',j#>>'{authorizedProjection,sourceSetFingerprintSha256}',
        j#>>'{sourceLineage,selectionLineage,selection,providerSelectionId}',
        (j#>>'{sourceLineage,selectionLineage,selection,version}')::integer,
        (j#>>'{sourceLineage,selectionLineage,selection,scopeVersion}')::integer,
        j#>>'{sourceLineage,selectionLineage,selectionScope,owner}',
        j#>>'{sourceLineage,selectionLineage,selectionScope,reference}',
        j#>'{sourceLineage,selectionLineage,selectionScope,version}',
        j#>>'{sourceLineage,selectionLineage,selectionScope,fingerprintSha256}',
        j#>>'{sourceLineage,selectionLineage,selectionFingerprintSha256}',
        j#>>'{sourceLineage,selectionLineage,currentSelectionValidation,purpose}',
        j#>>'{sourceLineage,selectionLineage,currentSelectionValidation,decision}',
        (j#>>'{sourceLineage,selectionLineage,currentSelectionValidation,currentlyUsable}')::boolean,
        (j#>>'{sourceLineage,selectionLineage,currentSelectionValidation,evaluatedAt}')::timestamptz,
        j#>>'{sourceLineage,selectionLineage,currentSelectionValidation,validationPolicyVersion}',
        j#>>'{sourceLineage,directExecutorAuthority,disclosureState}',
        (j#>>'{sourceLineage,directExecutorAuthority,directExecutorEstablished}')::boolean,
        j#>>'{sourceLineage,directExecutorAuthority,finalExecutionProviderId}',
        (j#>>'{sourceLineage,directExecutorAuthority,finalExecutionProviderWorkspaceId}')::uuid,
        j#>>'{sourceLineage,directExecutorAuthority,authorityReference}',
        j#>'{sourceLineage,directExecutorAuthority,authorityVersion}',
        j#>'{sourceLineage,directExecutorAuthority,evidenceReferences}',
        (j#>>'{sourceLineage,directExecutorAuthority,checkedAt}')::timestamptz,
        (j#>>'{sourceLineage,directExecutorAuthority,hiddenIntermediaryAllowed}')::boolean,
        j#>>'{sourceLineage,directExecutorAuthority,onwardRecipientAuthorization}',
        (j#>>'{sourceLineage,currentAuthorityRevalidationRequiredBeforeAuthorize}')::boolean,
        (j#>>'{sourceLineage,currentAuthorityRevalidationRequiredBeforeConsumption}')::boolean,
        (j#>>'{sourceLineage,evidenceReferenceVisibilityDoesNotGrantArtifactRetrieval}')::boolean,
        j#>>'{trustedHumanAuthority,source}',j#>>'{trustedHumanAuthority,authorizingActorId}',
        j#>>'{trustedHumanAuthority,principalReference}',j#>>'{trustedHumanAuthority,workspaceMembershipReference}',
        j#>>'{trustedHumanAuthority,handoffAuthorityReference}',j#>'{trustedHumanAuthority,handoffAuthorityVersion}',
        (j#>>'{trustedHumanAuthority,authenticatedAt}')::timestamptz,
        j#>>'{trustedHumanAuthority,affirmativeHumanActionEvidenceReference}',
        (j#>>'{trustedHumanAuthority,payloadIdentityAuthoritative}')::boolean,
        (j#>>'{privacyPreviewAcknowledgement,affirmativeHumanAction}')::boolean,
        j#>>'{privacyPreviewAcknowledgement,acknowledgementCode}',
        j#>>'{privacyPreviewAcknowledgement,acknowledgementTextVersion}',
        j#>>'{privacyPreviewAcknowledgement,previewFingerprintSha256}',
        (j#>>'{privacyPreviewAcknowledgement,reviewedAt}')::timestamptz,
        (j#>>'{authorizedAt}')::timestamptz,(j#>>'{validFrom}')::timestamptz,(j#>>'{validUntil}')::timestamptz,
        j#>>'{status}',NULLIF(j#>>'{revokedAt}','')::timestamptz,j#>>'{revocationReasonCode}',
        j#>>'{envelopeFingerprintSha256}',j#>>'{correlationId}',j,(j#>>'{authorizedAt}')::timestamptz
      FROM (SELECT $5::jsonb AS j) s`,
      [
        envelope.controlledHandoffId,
        envelope.version,
        envelope.originatingWorkspaceId,
        slotKey,
        json
      ]
    );
  }

  private async writeSlotState(
    client: QueryClient,
    mutation: HandoffCommit,
    previousRevision: number
  ) {
    const next = mutation.next;
    const revision = previousRevision + 1;
    const at = next.status === 'REVOKED' ? next.revokedAt : next.authorizedAt;
    const values = [
      mutation.slotKey,
      next.originatingWorkspaceId,
      revision,
      next.controlledHandoffId,
      next.version,
      next.status === 'AUTHORIZED' ? next.controlledHandoffId : null,
      next.status === 'AUTHORIZED' ? next.version : null,
      mutation.replay.principalReference,
      next.correlationId,
      at
    ];
    if (previousRevision === 0) {
      await client.query(
        `INSERT INTO mgsn_controlled_handoff_slot_state(
           slot_key,originating_workspace_id,slot_revision,head_controlled_handoff_id,head_version,
           current_controlled_handoff_id,current_version,set_by_principal_reference,correlation_id,updated_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        values
      );
      return;
    }

    const updated = await client.query(
      `UPDATE mgsn_controlled_handoff_slot_state SET
         slot_revision=$3,
         head_controlled_handoff_id=$4,
         head_version=$5,
         current_controlled_handoff_id=$6,
         current_version=$7,
         set_by_principal_reference=$8,
         correlation_id=$9,
         updated_at=$10
       WHERE slot_key=$1 AND originating_workspace_id=$2 AND slot_revision=$11`,
      [...values, previousRevision]
    );
    if (updated.rowCount !== 1) {
      throw new ControlledHandoffError(
        'STALE_HANDOFF',
        409,
        'Controlled Handoff slot revision changed before commit.'
      );
    }
  }

  private async insertReplay(client: QueryClient, mutation: HandoffCommit) {
    const next = mutation.next;
    const authority = next.trustedHumanAuthority;
    const action = actionFor(mutation);
    await client.query(
      `INSERT INTO mgsn_controlled_handoff_command_replays(
        slot_key,idempotency_key,command_fingerprint_sha256,mutation,originating_workspace_id,
        authorizing_actor_id,principal_reference,workspace_membership_reference,handoff_authority_reference,
        handoff_authority_version,affirmative_human_action_evidence_reference,response_controlled_handoff_id,
        response_version,response_envelope_fingerprint_sha256,response_result,correlation_id,created_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15::jsonb,$16,$17)`,
      [
        mutation.slotKey,
        mutation.replayKey,
        mutation.replay.fingerprint,
        action,
        next.originatingWorkspaceId,
        mutation.replay.actorId,
        mutation.replay.principalReference,
        authority.workspaceMembershipReference,
        authority.handoffAuthorityReference,
        JSON.stringify(authority.handoffAuthorityVersion),
        authority.affirmativeHumanActionEvidenceReference,
        next.controlledHandoffId,
        next.version,
        next.envelopeFingerprintSha256,
        JSON.stringify(mutation.replay.result),
        next.correlationId,
        next.status === 'REVOKED' ? next.revokedAt : next.authorizedAt
      ]
    );
  }

  private async insertAudit(client: QueryClient, mutation: HandoffCommit) {
    const next = mutation.next;
    await client.query(
      `INSERT INTO mgsn_controlled_handoff_owner_audit_events(
        controlled_handoff_id,originating_workspace_id,slot_key,previous_version,new_version,action,
        authorizing_actor_id,principal_reference,command_fingerprint_sha256,correlation_id,occurred_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        next.controlledHandoffId,
        next.originatingWorkspaceId,
        mutation.slotKey,
        mutation.previous?.version ?? null,
        next.version,
        actionFor(mutation),
        mutation.replay.actorId,
        mutation.replay.principalReference,
        mutation.replay.fingerprint,
        next.correlationId,
        next.status === 'REVOKED' ? next.revokedAt : next.authorizedAt
      ]
    );
  }

  private unavailable(cause: unknown): ControlledHandoffError {
    if (cause instanceof ControlledHandoffError) return cause;
    return new ControlledHandoffError(
      'AUTHORITY_UNAVAILABLE',
      503,
      'Controlled Handoff durable source is unavailable.',
      'AUTHORITY_UNAVAILABLE'
    );
  }
}
