import { createHash, randomUUID } from 'node:crypto';
import type { BusinessAttributionReferenceV1 } from '@markorbit/contracts/business-attribution';
import {
  noPartnerCandidateAuthorityConsequencesV1,
  noPartnerQualificationAuthorityConsequencesV1,
  parsePartnerCandidateV1,
  parsePartnerQualificationDecisionV1,
  partnerCandidateFingerprintSha256V1,
  partnerQualificationFingerprintSha256V1,
  type PartnerBriefV1,
  type PartnerCandidateIdV1,
  type PartnerCandidateV1,
  type PartnerQualificationDecisionV1,
  type PartnerQualificationOutcomeV1
} from '@markorbit/contracts/partner-intelligence';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

export type PartnerIntelligenceStoreErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE';

export class PartnerIntelligenceStoreError extends Error {
  constructor(
    readonly code: PartnerIntelligenceStoreErrorCode,
    message: string,
    readonly status = 409,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'PartnerIntelligenceStoreError';
  }
}

export interface CreatePartnerCandidateCommand {
  workspaceId: string;
  evidenceRefs: readonly Readonly<BusinessAttributionReferenceV1>[];
  brief: Readonly<PartnerBriefV1>;
  admittedByPrincipalId: string;
  idempotencyKey: string;
}

export interface QualifyPartnerCandidateCommand {
  workspaceId: string;
  candidate: Readonly<{ id: PartnerCandidateIdV1; version: 1; fingerprintSha256: string }>;
  outcome: PartnerQualificationOutcomeV1;
  rationale: string;
  decidedByPrincipalId: string;
  idempotencyKey: string;
}

type Row = Record<string, unknown>;
type CommandType = 'CREATE_PARTNER_CANDIDATE' | 'QUALIFY_PARTNER_CANDIDATE';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA = /^[0-9a-f]{64}$/u;
const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([, item]) => item !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, stable(item)])
        )
      : value;
const digest = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
const workspace = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!UUID.test(normalized))
    throw new PartnerIntelligenceStoreError('INVALID_INPUT', 'workspaceId must be a UUID.', 422);
  return normalized;
};
const text = (value: string, field: string, maximum = 1000): string => {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum)
    throw new PartnerIntelligenceStoreError('INVALID_INPUT', `${field} is invalid.`, 422);
  return normalized;
};
const sha = (value: string, field: string): string => {
  const normalized = text(value, field, 64);
  if (!SHA.test(normalized))
    throw new PartnerIntelligenceStoreError(
      'INVALID_INPUT',
      `${field} must be lowercase SHA-256.`,
      422
    );
  return normalized;
};

export class PostgresPartnerIntelligenceStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly id: () => string = () => randomUUID().replaceAll('-', '')
  ) {}

  async createCandidate(
    command: Readonly<CreatePartnerCandidateCommand>
  ): Promise<PartnerCandidateV1> {
    const workspaceId = workspace(command.workspaceId);
    const key = text(command.idempotencyKey, 'idempotencyKey', 500);
    const requestFingerprint = digest({ ...command, workspaceId, idempotencyKey: undefined });
    return this.run(
      workspaceId,
      key,
      'CREATE_PARTNER_CANDIDATE',
      requestFingerprint,
      parsePartnerCandidateV1,
      async (client) => {
        const partnerCandidateId: PartnerCandidateIdV1 = `partner-candidate_${this.id()}`;
        const base = {
          schemaVersion: 1 as const,
          partnerCandidateId,
          workspaceId,
          version: 1 as const,
          status: 'OPEN_FOR_HUMAN_QUALIFICATION' as const,
          evidenceRefs: command.evidenceRefs,
          brief: command.brief,
          admittedByPrincipalId: text(command.admittedByPrincipalId, 'admittedByPrincipalId', 240),
          admittedAt: new Date(this.now()).toISOString(),
          authorityConsequences: noPartnerCandidateAuthorityConsequencesV1
        };
        const value = parsePartnerCandidateV1({
          ...base,
          partnerCandidateFingerprintSha256: partnerCandidateFingerprintSha256V1(base)
        });
        await client.query(
          `INSERT INTO lite_partner_candidates(workspace_id,partner_candidate_id,version,status,fingerprint_sha256,document_json,admitted_at)
         VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
          [
            workspaceId,
            value.partnerCandidateId,
            value.version,
            value.status,
            value.partnerCandidateFingerprintSha256,
            JSON.stringify(value),
            value.admittedAt
          ]
        );
        return value;
      }
    );
  }

  async qualify(
    command: Readonly<QualifyPartnerCandidateCommand>
  ): Promise<PartnerQualificationDecisionV1> {
    const workspaceId = workspace(command.workspaceId);
    const key = text(command.idempotencyKey, 'idempotencyKey', 500);
    const requestFingerprint = digest({ ...command, workspaceId, idempotencyKey: undefined });
    return this.run(
      workspaceId,
      key,
      'QUALIFY_PARTNER_CANDIDATE',
      requestFingerprint,
      parsePartnerQualificationDecisionV1,
      async (client) => {
        await this.lock(client, `${workspaceId}:partner:${command.candidate.id}`);
        const candidate = await this.candidateFrom(client, workspaceId, command.candidate.id);
        if (!candidate)
          throw new PartnerIntelligenceStoreError(
            'NOT_FOUND',
            'Partner Candidate was not found.',
            404
          );
        if (
          candidate.version !== command.candidate.version ||
          candidate.partnerCandidateFingerprintSha256 !==
            sha(command.candidate.fingerprintSha256, 'candidate.fingerprintSha256')
        )
          throw new PartnerIntelligenceStoreError(
            'VERSION_CONFLICT',
            'Partner Candidate evidence is stale.'
          );
        const existing = await client.query(
          'SELECT 1 FROM lite_partner_qualification_decisions WHERE workspace_id=$1 AND partner_candidate_id=$2',
          [workspaceId, candidate.partnerCandidateId]
        );
        if (existing.rows[0])
          throw new PartnerIntelligenceStoreError(
            'INVALID_TRANSITION',
            'Partner Candidate already has a human qualification decision.'
          );
        const base = {
          schemaVersion: 1 as const,
          partnerQualificationDecisionId: `partner-qualification_${this.id()}` as const,
          workspaceId,
          version: 1 as const,
          partnerCandidateId: candidate.partnerCandidateId,
          partnerCandidateVersion: 1 as const,
          partnerCandidateFingerprintSha256: candidate.partnerCandidateFingerprintSha256,
          outcome: command.outcome,
          rationale: text(command.rationale, 'rationale', 3000),
          decidedByPrincipalId: text(command.decidedByPrincipalId, 'decidedByPrincipalId', 240),
          decidedAt: new Date(this.now()).toISOString(),
          authorityConsequences: noPartnerQualificationAuthorityConsequencesV1
        };
        const value = parsePartnerQualificationDecisionV1({
          ...base,
          partnerQualificationFingerprintSha256: partnerQualificationFingerprintSha256V1(base)
        });
        await client.query(
          `INSERT INTO lite_partner_qualification_decisions(workspace_id,partner_qualification_decision_id,version,partner_candidate_id,partner_candidate_version,outcome,fingerprint_sha256,document_json,decided_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
          [
            workspaceId,
            value.partnerQualificationDecisionId,
            value.version,
            value.partnerCandidateId,
            value.partnerCandidateVersion,
            value.outcome,
            value.partnerQualificationFingerprintSha256,
            JSON.stringify(value),
            value.decidedAt
          ]
        );
        return value;
      }
    );
  }

  async findCandidate(
    workspaceIdValue: string,
    id: PartnerCandidateIdV1
  ): Promise<PartnerCandidateV1 | undefined> {
    const workspaceId = workspace(workspaceIdValue);
    try {
      return await this.candidateFrom(this.query, workspaceId, id);
    } catch (cause) {
      if (cause instanceof PartnerIntelligenceStoreError) throw cause;
      throw new PartnerIntelligenceStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Partner Candidate persistence is unavailable.',
        503,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  async findQualification(
    workspaceIdValue: string,
    id: PartnerCandidateIdV1
  ): Promise<PartnerQualificationDecisionV1 | undefined> {
    const workspaceId = workspace(workspaceIdValue);
    try {
      const result = await this.query.query<Row>(
        'SELECT document_json FROM lite_partner_qualification_decisions WHERE workspace_id=$1 AND partner_candidate_id=$2',
        [workspaceId, id]
      );
      return result.rows[0]
        ? parsePartnerQualificationDecisionV1(result.rows[0].document_json)
        : undefined;
    } catch (cause) {
      if (cause instanceof PartnerIntelligenceStoreError) throw cause;
      throw new PartnerIntelligenceStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Partner Qualification persistence is unavailable.',
        503,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  private async candidateFrom(query: QueryClient, workspaceId: string, id: PartnerCandidateIdV1) {
    const result = await query.query<Row>(
      'SELECT document_json FROM lite_partner_candidates WHERE workspace_id=$1 AND partner_candidate_id=$2 AND version=1',
      [workspaceId, id]
    );
    return result.rows[0] ? parsePartnerCandidateV1(result.rows[0].document_json) : undefined;
  }

  private async run<T>(
    workspaceId: string,
    key: string,
    type: CommandType,
    requestFingerprint: string,
    parse: (value: unknown) => T,
    write: (client: QueryClient) => Promise<T>
  ): Promise<T> {
    try {
      return await this.database.transact(async (client) => {
        await this.lock(client, `${workspaceId}:partner-idempotency:${key}`);
        const replay = await client.query<Row>(
          'SELECT command_type,request_fingerprint_sha256,result_json FROM lite_partner_intelligence_commands WHERE workspace_id=$1 AND idempotency_key=$2',
          [workspaceId, key]
        );
        const prior = replay.rows[0];
        if (prior) {
          if (
            prior.command_type !== type ||
            prior.request_fingerprint_sha256 !== requestFingerprint
          )
            throw new PartnerIntelligenceStoreError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key is bound to another Partner Intelligence command.'
            );
          return parse(prior.result_json);
        }
        const result = await write(client);
        await client.query(
          `INSERT INTO lite_partner_intelligence_commands(workspace_id,idempotency_key,command_type,request_fingerprint_sha256,result_json,created_at)
           VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
          [
            workspaceId,
            key,
            type,
            requestFingerprint,
            JSON.stringify(result),
            new Date(this.now()).toISOString()
          ]
        );
        return structuredClone(result);
      });
    } catch (cause) {
      if (cause instanceof PartnerIntelligenceStoreError) throw cause;
      throw new PartnerIntelligenceStoreError(
        'PERSISTENCE_UNAVAILABLE',
        'Partner Intelligence persistence is unavailable.',
        503,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  private async lock(client: QueryClient, key: string) {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
  }
}
