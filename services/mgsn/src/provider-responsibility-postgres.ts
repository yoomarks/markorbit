import { isDeepStrictEqual } from 'node:util';
import { noProviderResponsibilityAuthorityConsequences } from '@markorbit/contracts/provider-responsibility';
import type {
  ProviderResponsibilityEvidenceReferenceV1,
  ProviderResponsibilityExecutionTeamReferenceV1,
  ProviderResponsibilityProfileId,
  ProviderResponsibilityProfileV1
} from '@markorbit/contracts/provider-responsibility';
import type { ProviderId } from '@markorbit/contracts/provider-execution';
import type { QueryClient } from '@markorbit/persistence';
import {
  ProviderResponsibilityError,
  type ProviderResponsibilityAuditAction,
  type ProviderResponsibilityAuditEvent,
  type ProviderResponsibilityCommandType,
  type ProviderResponsibilityCommit,
  type ProviderResponsibilityReplayRecord,
  type ProviderResponsibilityRepository
} from './provider-responsibility.js';

type Row = Record<string, unknown>;

export interface ProviderResponsibilityTransactionHost {
  transact<T>(work: (client: QueryClient) => Promise<T>): Promise<T>;
}

const profileColumns = `
  provider_responsibility_profile_id,
  version,
  provider_id,
  provider_workspace_id::text AS provider_workspace_id,
  status,
  final_executor_status,
  direct_responsibility_status,
  no_rebrokering_commitment_state,
  intermediary_disclosure_state,
  signer_kind,
  signer_reference,
  signer_identity_authority_reference,
  signer_legal_basis_reference,
  signer_jurisdiction,
  signer_function,
  signer_transparently_disclosed,
  signer_receives_handoff_data_by_default,
  signer_does_not_replace_final_execution_provider,
  authority_state,
  effective_from,
  effective_until,
  checked_at,
  profile_fingerprint_sha256,
  profile_record,
  correlation_id,
  created_by,
  created_at`;

export class PostgresProviderResponsibilityRepository implements ProviderResponsibilityRepository {
  constructor(
    private readonly database: ProviderResponsibilityTransactionHost,
    private readonly query: QueryClient
  ) {}

  async findCurrentProfile(providerId: ProviderId, providerWorkspaceId: string) {
    try {
      const result = await this.query.query(
        `SELECT provider_responsibility_profile_id, profile_version
           FROM mgsn_provider_responsibility_current
          WHERE provider_id=$1 AND provider_workspace_id=$2`,
        [providerId, providerWorkspaceId]
      );
      if (!result.rowCount) return undefined;
      const row = result.rows[0] as Row;
      return await this.requireProfile(
        this.query,
        String(row.provider_responsibility_profile_id) as ProviderResponsibilityProfileId,
        Number(row.profile_version)
      );
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findLatestProfile(providerResponsibilityProfileId: ProviderResponsibilityProfileId) {
    try {
      const result = await this.query.query(
        `SELECT version
           FROM mgsn_provider_responsibility_profiles
          WHERE provider_responsibility_profile_id=$1
          ORDER BY version DESC
          LIMIT 1`,
        [providerResponsibilityProfileId]
      );
      if (!result.rowCount) return undefined;
      return await this.requireProfile(
        this.query,
        providerResponsibilityProfileId,
        Number((result.rows[0] as Row).version)
      );
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async findReplay(scopeKey: string, idempotencyKey: string) {
    try {
      return await this.readReplay(this.query, scopeKey, idempotencyKey, false);
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async commit(mutation: ProviderResponsibilityCommit) {
    try {
      return await this.database.transact(async (client) => {
        await this.lockProviderBinding(client, mutation.providerId, mutation.providerWorkspaceId);

        const replay = await this.readReplay(
          client,
          mutation.replay.scopeKey,
          mutation.replay.idempotencyKey,
          true
        );
        if (replay) {
          if (
            replay.requestFingerprintSha256 !== mutation.replay.requestFingerprintSha256 ||
            replay.commandType !== mutation.replay.commandType
          ) {
            throw new ProviderResponsibilityError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has a different trusted context or command payload.',
              409
            );
          }
          return replay;
        }

        const current = await this.lockCurrent(
          client,
          mutation.providerId,
          mutation.providerWorkspaceId
        );
        const currentId = current?.profileId ?? null;
        const currentVersion = current?.version ?? null;
        if (
          currentId !== mutation.expectedCurrentProfileId ||
          currentVersion !== mutation.expectedCurrentProfileVersion
        ) {
          throw new ProviderResponsibilityError(
            'STALE_PROFILE',
            'Provider Responsibility changed; reload the exact current profile version.',
            409
          );
        }

        this.assertCommitConsistency(mutation);
        const previous = await this.lockLatestProfileRow(
          client,
          mutation.profile.providerResponsibilityProfileId
        );
        if (previous) {
          if (String(previous.status) === 'REVOKED') {
            throw new ProviderResponsibilityError(
              'PROFILE_REVOKED',
              'Revoked Provider Responsibility cannot be revived; create a fresh profile.',
              409
            );
          }
          if (mutation.profile.version !== Number(previous.version) + 1) {
            throw new ProviderResponsibilityError(
              'STALE_PROFILE',
              'Provider Responsibility history is not appendable at the requested version.',
              409
            );
          }
          if (
            String(previous.provider_id) !== mutation.providerId ||
            String(previous.provider_workspace_id).toLowerCase() !==
              mutation.providerWorkspaceId.toLowerCase()
          ) {
            throw new ProviderResponsibilityError(
              'INVALID_INPUT',
              'Provider Responsibility identity binding is immutable.',
              422
            );
          }
        } else {
          if (mutation.profile.version !== 1) {
            throw new ProviderResponsibilityError(
              'STALE_PROFILE',
              'A fresh Provider Responsibility profile must start at version 1.',
              409
            );
          }
          const identity = await client.query(
            `SELECT provider_id, provider_workspace_id::text AS provider_workspace_id
               FROM mgsn_provider_responsibility_profile_identities
              WHERE provider_responsibility_profile_id=$1
              FOR UPDATE`,
            [mutation.profile.providerResponsibilityProfileId]
          );
          if (identity.rowCount) {
            throw new ProviderResponsibilityError(
              'PERSISTENCE_UNAVAILABLE',
              'Provider Responsibility identity exists without appendable profile history.',
              503
            );
          }
          await client.query(
            `INSERT INTO mgsn_provider_responsibility_profile_identities(
               provider_responsibility_profile_id,provider_id,provider_workspace_id,created_at
             ) VALUES($1,$2,$3,$4)`,
            [
              mutation.profile.providerResponsibilityProfileId,
              mutation.providerId,
              mutation.providerWorkspaceId,
              mutation.audit.occurredAt
            ]
          );
        }

        await this.insertProfile(
          client,
          mutation.profile,
          mutation.audit.actorReference,
          mutation.audit.occurredAt
        );
        await this.insertTeamReferences(client, mutation.profile, mutation.audit.occurredAt);
        await this.insertEvidenceReferences(client, mutation.profile, mutation.audit.occurredAt);
        await this.setCurrentPointer(client, mutation);
        await this.insertOwnerAudit(client, mutation);
        await this.insertReplay(client, mutation);
        return undefined;
      });
    } catch (cause) {
      if (cause instanceof ProviderResponsibilityError) throw cause;
      throw this.unavailable(cause);
    }
  }

  async listProfileHistory(providerResponsibilityProfileId: ProviderResponsibilityProfileId) {
    try {
      const result = await this.query.query(
        `SELECT version
           FROM mgsn_provider_responsibility_profiles
          WHERE provider_responsibility_profile_id=$1
          ORDER BY version ASC`,
        [providerResponsibilityProfileId]
      );
      const history: ProviderResponsibilityProfileV1[] = [];
      for (const row of result.rows as Row[]) {
        history.push(
          await this.requireProfile(
            this.query,
            providerResponsibilityProfileId,
            Number(row.version)
          )
        );
      }
      return history;
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  async listAuditHistory(providerResponsibilityProfileId: ProviderResponsibilityProfileId) {
    try {
      const result = await this.query.query(
        `SELECT provider_responsibility_profile_id,provider_id,
                provider_workspace_id::text AS provider_workspace_id,
                previous_version,new_version,action,actor_reference,
                request_fingerprint_sha256,occurred_at
           FROM mgsn_provider_responsibility_owner_audit_events
          WHERE provider_responsibility_profile_id=$1
          ORDER BY audit_id ASC`,
        [providerResponsibilityProfileId]
      );
      return result.rows.map((row) => this.mapAudit(row as Row));
    } catch (cause) {
      throw this.unavailable(cause);
    }
  }

  private async lockProviderBinding(
    client: QueryClient,
    providerId: ProviderId,
    providerWorkspaceId: string
  ) {
    const result = await client.query(
      `SELECT provider_id
         FROM mgsn_providers
        WHERE provider_id=$1 AND provider_workspace_id=$2
        FOR UPDATE`,
      [providerId, providerWorkspaceId]
    );
    if (!result.rowCount) {
      throw new ProviderResponsibilityError(
        'PROVIDER_NOT_FOUND',
        'Provider binding is unavailable.',
        404
      );
    }
  }

  private async readReplay(
    client: QueryClient,
    scopeKey: string,
    idempotencyKey: string,
    lock: boolean
  ): Promise<ProviderResponsibilityReplayRecord | undefined> {
    const result = await client.query(
      `SELECT scope_key,idempotency_key,request_fingerprint_sha256,command_type,
              provider_id,provider_workspace_id::text AS provider_workspace_id,
              response_provider_responsibility_profile_id,response_profile_version,response_record
         FROM mgsn_provider_responsibility_command_replays
        WHERE scope_key=$1 AND idempotency_key=$2${lock ? ' FOR UPDATE' : ''}`,
      [scopeKey, idempotencyKey]
    );
    if (!result.rowCount) return undefined;
    const row = result.rows[0] as Row;
    const response = this.profileRecord(row.response_record);
    if (
      response.providerResponsibilityProfileId !==
        String(row.response_provider_responsibility_profile_id) ||
      response.version !== Number(row.response_profile_version) ||
      response.providerId !== String(row.provider_id) ||
      response.providerWorkspaceId.toLowerCase() !== String(row.provider_workspace_id).toLowerCase()
    ) {
      throw new ProviderResponsibilityError(
        'PERSISTENCE_UNAVAILABLE',
        'Provider Responsibility replay is inconsistent with normalized durable lineage.',
        503
      );
    }
    const persisted = await this.requireProfile(
      client,
      response.providerResponsibilityProfileId,
      response.version
    );
    if (JSON.stringify(response) !== JSON.stringify(persisted)) {
      throw new ProviderResponsibilityError(
        'PERSISTENCE_UNAVAILABLE',
        'Provider Responsibility replay response conflicts with persisted canonical profile truth.',
        503
      );
    }
    return {
      scopeKey: String(row.scope_key),
      idempotencyKey: String(row.idempotency_key),
      requestFingerprintSha256: String(row.request_fingerprint_sha256),
      commandType: String(row.command_type) as ProviderResponsibilityCommandType,
      response
    };
  }

  private async lockCurrent(
    client: QueryClient,
    providerId: ProviderId,
    providerWorkspaceId: string
  ) {
    const result = await client.query(
      `SELECT provider_responsibility_profile_id,profile_version
         FROM mgsn_provider_responsibility_current
        WHERE provider_id=$1 AND provider_workspace_id=$2
        FOR UPDATE`,
      [providerId, providerWorkspaceId]
    );
    if (!result.rowCount) return undefined;
    const row = result.rows[0] as Row;
    return {
      profileId: String(row.provider_responsibility_profile_id) as ProviderResponsibilityProfileId,
      version: Number(row.profile_version)
    };
  }

  private async lockLatestProfileRow(
    client: QueryClient,
    providerResponsibilityProfileId: ProviderResponsibilityProfileId
  ) {
    const result = await client.query(
      `SELECT version,status,provider_id,provider_workspace_id::text AS provider_workspace_id
         FROM mgsn_provider_responsibility_profiles
        WHERE provider_responsibility_profile_id=$1
        ORDER BY version DESC
        LIMIT 1
        FOR UPDATE`,
      [providerResponsibilityProfileId]
    );
    return result.rowCount ? (result.rows[0] as Row) : undefined;
  }

  private assertCommitConsistency(mutation: ProviderResponsibilityCommit) {
    if (
      mutation.profile.providerId !== mutation.providerId ||
      mutation.profile.providerWorkspaceId.toLowerCase() !==
        mutation.providerWorkspaceId.toLowerCase() ||
      mutation.replay.response.providerResponsibilityProfileId !==
        mutation.profile.providerResponsibilityProfileId ||
      mutation.replay.response.version !== mutation.profile.version ||
      mutation.audit.providerResponsibilityProfileId !==
        mutation.profile.providerResponsibilityProfileId ||
      mutation.audit.providerId !== mutation.providerId ||
      mutation.audit.providerWorkspaceId.toLowerCase() !==
        mutation.providerWorkspaceId.toLowerCase() ||
      mutation.audit.newVersion !== mutation.profile.version
    ) {
      throw new ProviderResponsibilityError(
        'INVALID_INPUT',
        'Provider Responsibility commit lineage is inconsistent.',
        422
      );
    }
  }

  private async insertProfile(
    client: QueryClient,
    profile: ProviderResponsibilityProfileV1,
    actorReference: string,
    occurredAt: string
  ) {
    const signer = profile.legallyRequiredDistinctSigner;
    await client.query(
      `INSERT INTO mgsn_provider_responsibility_profiles(
         provider_responsibility_profile_id,version,provider_id,provider_workspace_id,status,
         final_executor_status,direct_responsibility_status,no_rebrokering_commitment_state,
         intermediary_disclosure_state,signer_kind,signer_reference,
         signer_identity_authority_reference,signer_legal_basis_reference,signer_jurisdiction,
         signer_function,signer_transparently_disclosed,signer_receives_handoff_data_by_default,
         signer_does_not_replace_final_execution_provider,authority_state,effective_from,effective_until,
         checked_at,profile_fingerprint_sha256,profile_record,correlation_id,created_by,created_at
       ) VALUES(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25,$26,$27
       )`,
      [
        profile.providerResponsibilityProfileId,
        profile.version,
        profile.providerId,
        profile.providerWorkspaceId,
        profile.status,
        profile.finalExecutorStatus,
        profile.directResponsibilityStatus,
        profile.noRebrokeringCommitmentState,
        profile.intermediaryDisclosureState,
        signer.kind,
        signer.kind === 'REQUIRED' ? signer.signerReference : null,
        signer.kind === 'REQUIRED' ? signer.signerIdentityAuthorityReference : null,
        signer.kind === 'REQUIRED' ? signer.legalBasisReference : null,
        signer.kind === 'REQUIRED' ? signer.jurisdiction : null,
        signer.kind === 'REQUIRED' ? signer.function : null,
        signer.kind === 'REQUIRED' ? signer.transparentlyDisclosed : null,
        signer.kind === 'REQUIRED' ? signer.receivesHandoffDataByDefault : null,
        signer.kind === 'REQUIRED' ? signer.doesNotReplaceFinalExecutionProvider : null,
        profile.authorityState,
        profile.effectiveFrom,
        profile.effectiveUntil ?? null,
        profile.checkedAt,
        profile.profileFingerprintSha256,
        JSON.stringify(profile),
        profile.correlationId,
        actorReference,
        occurredAt
      ]
    );
  }

  private async insertTeamReferences(
    client: QueryClient,
    profile: ProviderResponsibilityProfileV1,
    occurredAt: string
  ) {
    for (const [ordinal, reference] of profile.executionTeamReferences.entries()) {
      await client.query(
        `INSERT INTO mgsn_provider_responsibility_execution_team_references(
           provider_responsibility_profile_id,profile_version,team_ordinal,team_reference,
           role_reference,identity_authority_reference,contact_data_embedded,created_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          profile.providerResponsibilityProfileId,
          profile.version,
          ordinal,
          reference.teamReference,
          reference.roleReference,
          reference.identityAuthorityReference,
          reference.contactDataEmbedded,
          occurredAt
        ]
      );
    }
  }

  private async insertEvidenceReferences(
    client: QueryClient,
    profile: ProviderResponsibilityProfileV1,
    occurredAt: string
  ) {
    for (const [ordinal, reference] of profile.evidenceReferences.entries()) {
      await client.query(
        `INSERT INTO mgsn_provider_responsibility_evidence_references(
           provider_responsibility_profile_id,profile_version,evidence_ordinal,evidence_reference,
           source_owner,source_type,source_id,source_version,source_fingerprint_sha256,authority_class,
           verification_state,observed_at,effective_from,effective_until,artifact_access_authorized,created_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          profile.providerResponsibilityProfileId,
          profile.version,
          ordinal,
          reference.evidenceReference,
          reference.sourceOwner,
          reference.sourceType,
          reference.sourceId,
          JSON.stringify(reference.sourceVersion),
          reference.sourceFingerprintSha256,
          reference.authorityClass,
          reference.verificationState,
          reference.observedAt,
          reference.effectiveFrom ?? null,
          reference.effectiveUntil ?? null,
          reference.artifactAccessAuthorized,
          occurredAt
        ]
      );
    }
  }

  private async setCurrentPointer(client: QueryClient, mutation: ProviderResponsibilityCommit) {
    const values = [
      mutation.providerId,
      mutation.providerWorkspaceId,
      mutation.profile.providerResponsibilityProfileId,
      mutation.profile.version,
      mutation.audit.actorReference,
      mutation.profile.correlationId,
      mutation.audit.occurredAt
    ];
    if (mutation.expectedCurrentProfileId !== null) {
      const updated = await client.query(
        `UPDATE mgsn_provider_responsibility_current
            SET provider_responsibility_profile_id=$3,profile_version=$4,set_by=$5,correlation_id=$6,set_at=$7
          WHERE provider_id=$1 AND provider_workspace_id=$2`,
        values
      );
      if (!updated.rowCount) {
        throw new ProviderResponsibilityError(
          'PERSISTENCE_UNAVAILABLE',
          'Locked Provider Responsibility current pointer disappeared during mutation.',
          503
        );
      }
    } else {
      await client.query(
        `INSERT INTO mgsn_provider_responsibility_current(
           provider_id,provider_workspace_id,provider_responsibility_profile_id,profile_version,
           set_by,correlation_id,set_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        values
      );
    }
  }

  private async insertOwnerAudit(client: QueryClient, mutation: ProviderResponsibilityCommit) {
    await client.query(
      `INSERT INTO mgsn_provider_responsibility_owner_audit_events(
         provider_responsibility_profile_id,provider_id,provider_workspace_id,previous_version,new_version,
         action,actor_reference,request_fingerprint_sha256,correlation_id,occurred_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        mutation.audit.providerResponsibilityProfileId,
        mutation.audit.providerId,
        mutation.audit.providerWorkspaceId,
        mutation.audit.previousVersion,
        mutation.audit.newVersion,
        mutation.audit.action,
        mutation.audit.actorReference,
        mutation.audit.requestFingerprintSha256,
        mutation.profile.correlationId,
        mutation.audit.occurredAt
      ]
    );
  }

  private async insertReplay(client: QueryClient, mutation: ProviderResponsibilityCommit) {
    await client.query(
      `INSERT INTO mgsn_provider_responsibility_command_replays(
         scope_key,idempotency_key,request_fingerprint_sha256,command_type,provider_id,
         provider_workspace_id,response_provider_responsibility_profile_id,response_profile_version,
         response_record,actor_reference,correlation_id,created_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)`,
      [
        mutation.replay.scopeKey,
        mutation.replay.idempotencyKey,
        mutation.replay.requestFingerprintSha256,
        mutation.replay.commandType,
        mutation.providerId,
        mutation.providerWorkspaceId,
        mutation.replay.response.providerResponsibilityProfileId,
        mutation.replay.response.version,
        JSON.stringify(mutation.replay.response),
        mutation.audit.actorReference,
        mutation.profile.correlationId,
        mutation.audit.occurredAt
      ]
    );
  }

  private async requireProfile(
    client: QueryClient,
    providerResponsibilityProfileId: ProviderResponsibilityProfileId,
    version: number
  ) {
    const result = await client.query(
      `SELECT ${profileColumns}
         FROM mgsn_provider_responsibility_profiles
        WHERE provider_responsibility_profile_id=$1 AND version=$2`,
      [providerResponsibilityProfileId, version]
    );
    if (!result.rowCount) {
      throw new ProviderResponsibilityError(
        'PERSISTENCE_UNAVAILABLE',
        'Provider Responsibility profile referenced by durable state is unavailable.',
        503
      );
    }
    const row = result.rows[0] as Row;
    const profile = this.profileRecord(row.profile_record);
    this.assertNormalizedProfile(row, profile);

    const identityResult = await client.query(
      `SELECT provider_id,provider_workspace_id::text AS provider_workspace_id
         FROM mgsn_provider_responsibility_profile_identities
        WHERE provider_responsibility_profile_id=$1`,
      [providerResponsibilityProfileId]
    );
    if (
      identityResult.rowCount !== 1 ||
      String((identityResult.rows[0] as Row).provider_id) !== profile.providerId ||
      String((identityResult.rows[0] as Row).provider_workspace_id).toLowerCase() !==
        profile.providerWorkspaceId.toLowerCase()
    ) {
      throw new ProviderResponsibilityError(
        'PERSISTENCE_UNAVAILABLE',
        'Provider Responsibility immutable identity conflicts with canonical profile lineage.',
        503
      );
    }

    const teamResult = await client.query(
      `SELECT team_reference,role_reference,identity_authority_reference,contact_data_embedded
         FROM mgsn_provider_responsibility_execution_team_references
        WHERE provider_responsibility_profile_id=$1 AND profile_version=$2
        ORDER BY team_ordinal ASC`,
      [providerResponsibilityProfileId, version]
    );
    const teams = (teamResult.rows as Row[]).map(
      (team): ProviderResponsibilityExecutionTeamReferenceV1 => {
        if (team.contact_data_embedded !== false) {
          throw new ProviderResponsibilityError(
            'PERSISTENCE_UNAVAILABLE',
            'Provider Responsibility team history contains forbidden embedded contact data.',
            503
          );
        }
        return {
          teamReference: String(team.team_reference),
          roleReference: String(team.role_reference),
          identityAuthorityReference: String(team.identity_authority_reference),
          contactDataEmbedded: false
        };
      }
    );

    const evidenceResult = await client.query(
      `SELECT evidence_reference,source_owner,source_type,source_id,source_version,
              source_fingerprint_sha256,authority_class,verification_state,observed_at,
              effective_from,effective_until,artifact_access_authorized
         FROM mgsn_provider_responsibility_evidence_references
        WHERE provider_responsibility_profile_id=$1 AND profile_version=$2
        ORDER BY evidence_ordinal ASC`,
      [providerResponsibilityProfileId, version]
    );
    const evidence = (evidenceResult.rows as Row[]).map(
      (item): ProviderResponsibilityEvidenceReferenceV1 => {
        if (item.artifact_access_authorized !== false) {
          throw new ProviderResponsibilityError(
            'PERSISTENCE_UNAVAILABLE',
            'Provider Responsibility evidence history contains forbidden artifact access authority.',
            503
          );
        }
        return {
          evidenceReference: String(item.evidence_reference),
          sourceOwner: String(
            item.source_owner
          ) as ProviderResponsibilityEvidenceReferenceV1['sourceOwner'],
          sourceType: String(item.source_type),
          sourceId: String(item.source_id),
          sourceVersion: item.source_version as number | string,
          sourceFingerprintSha256: String(item.source_fingerprint_sha256),
          authorityClass: String(
            item.authority_class
          ) as ProviderResponsibilityEvidenceReferenceV1['authorityClass'],
          verificationState: String(
            item.verification_state
          ) as ProviderResponsibilityEvidenceReferenceV1['verificationState'],
          observedAt: this.timestamp(item.observed_at),
          ...(item.effective_from == null
            ? {}
            : { effectiveFrom: this.timestamp(item.effective_from) }),
          ...(item.effective_until == null
            ? {}
            : { effectiveUntil: this.timestamp(item.effective_until) }),
          artifactAccessAuthorized: false
        };
      }
    );

    if (
      !isDeepStrictEqual(teams, profile.executionTeamReferences) ||
      !isDeepStrictEqual(evidence, profile.evidenceReferences)
    ) {
      throw new ProviderResponsibilityError(
        'PERSISTENCE_UNAVAILABLE',
        'Provider Responsibility child history is inconsistent with canonical profile record.',
        503
      );
    }
    return profile;
  }

  private assertNormalizedProfile(row: Row, profile: ProviderResponsibilityProfileV1) {
    const signer = profile.legallyRequiredDistinctSigner;
    const expectedConsequenceKeys = Object.keys(
      noProviderResponsibilityAuthorityConsequences
    ).sort();
    const actualConsequenceKeys = Object.keys(profile.authorityConsequences).sort();
    const authorityConsequencesMatch =
      JSON.stringify(expectedConsequenceKeys) === JSON.stringify(actualConsequenceKeys) &&
      actualConsequenceKeys.every(
        (key) =>
          profile.authorityConsequences[key as keyof typeof profile.authorityConsequences] === false
      );
    const signerMatches =
      signer.kind === 'NONE'
        ? String(row.signer_kind) === 'NONE' &&
          row.signer_reference == null &&
          row.signer_identity_authority_reference == null &&
          row.signer_legal_basis_reference == null &&
          row.signer_jurisdiction == null &&
          row.signer_function == null &&
          row.signer_transparently_disclosed == null &&
          row.signer_receives_handoff_data_by_default == null &&
          row.signer_does_not_replace_final_execution_provider == null
        : String(row.signer_kind) === 'REQUIRED' &&
          String(row.signer_reference) === signer.signerReference &&
          String(row.signer_identity_authority_reference) ===
            signer.signerIdentityAuthorityReference &&
          String(row.signer_legal_basis_reference) === signer.legalBasisReference &&
          String(row.signer_jurisdiction) === signer.jurisdiction &&
          String(row.signer_function) === signer.function &&
          row.signer_transparently_disclosed === signer.transparentlyDisclosed &&
          row.signer_receives_handoff_data_by_default === signer.receivesHandoffDataByDefault &&
          row.signer_does_not_replace_final_execution_provider ===
            signer.doesNotReplaceFinalExecutionProvider;

    if (
      profile.providerResponsibilityProfileId !== String(row.provider_responsibility_profile_id) ||
      profile.version !== Number(row.version) ||
      profile.providerId !== String(row.provider_id) ||
      profile.providerWorkspaceId.toLowerCase() !==
        String(row.provider_workspace_id).toLowerCase() ||
      profile.status !== String(row.status) ||
      profile.finalExecutorStatus !== String(row.final_executor_status) ||
      profile.directResponsibilityStatus !== String(row.direct_responsibility_status) ||
      profile.noRebrokeringCommitmentState !== String(row.no_rebrokering_commitment_state) ||
      profile.intermediaryDisclosureState !== String(row.intermediary_disclosure_state) ||
      profile.authorityState !== String(row.authority_state) ||
      profile.effectiveFrom !== this.timestamp(row.effective_from) ||
      (profile.effectiveUntil ?? null) !==
        (row.effective_until == null ? null : this.timestamp(row.effective_until)) ||
      profile.checkedAt !== this.timestamp(row.checked_at) ||
      profile.profileFingerprintSha256 !== String(row.profile_fingerprint_sha256) ||
      profile.correlationId !== String(row.correlation_id) ||
      !signerMatches ||
      !authorityConsequencesMatch
    ) {
      throw new ProviderResponsibilityError(
        'PERSISTENCE_UNAVAILABLE',
        'Provider Responsibility normalized state conflicts with canonical profile record.',
        503
      );
    }
  }

  private profileRecord(value: unknown): ProviderResponsibilityProfileV1 {
    if (!value || typeof value !== 'object') {
      throw new ProviderResponsibilityError(
        'PERSISTENCE_UNAVAILABLE',
        'Provider Responsibility canonical profile record is malformed.',
        503
      );
    }
    const profile = value as ProviderResponsibilityProfileV1;
    if (
      profile.schemaVersion !== 1 ||
      typeof profile.providerResponsibilityProfileId !== 'string' ||
      typeof profile.providerId !== 'string' ||
      typeof profile.providerWorkspaceId !== 'string' ||
      !Number.isInteger(profile.version) ||
      !Array.isArray(profile.executionTeamReferences) ||
      !Array.isArray(profile.evidenceReferences) ||
      !profile.authorityConsequences ||
      typeof profile.authorityConsequences !== 'object'
    ) {
      throw new ProviderResponsibilityError(
        'PERSISTENCE_UNAVAILABLE',
        'Provider Responsibility canonical profile record is malformed.',
        503
      );
    }
    return profile;
  }

  private mapAudit(row: Row): ProviderResponsibilityAuditEvent {
    return {
      providerResponsibilityProfileId: String(
        row.provider_responsibility_profile_id
      ) as ProviderResponsibilityProfileId,
      providerId: String(row.provider_id) as ProviderId,
      providerWorkspaceId: String(row.provider_workspace_id),
      previousVersion: row.previous_version == null ? null : Number(row.previous_version),
      newVersion: Number(row.new_version),
      action: String(row.action) as ProviderResponsibilityAuditAction,
      actorReference: String(row.actor_reference),
      requestFingerprintSha256: String(row.request_fingerprint_sha256),
      occurredAt: this.timestamp(row.occurred_at)
    };
  }

  private timestamp(value: unknown) {
    return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
  }

  private unavailable(cause: unknown) {
    if (cause instanceof ProviderResponsibilityError) return cause;
    return new ProviderResponsibilityError(
      'PERSISTENCE_UNAVAILABLE',
      'Provider Responsibility PostgreSQL persistence is unavailable.',
      503
    );
  }
}
