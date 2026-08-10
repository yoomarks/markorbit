import { createHash } from 'node:crypto';
import type { CoreIntakeRequest, CoreIntakeStatus } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';

export interface KnowledgeIntake {
  intakeId: string;
  idempotencyKey: string;
  request: CoreIntakeRequest;
  requestSha256: string;
  status: CoreIntakeStatus;
  receivedAt: string;
}

export interface KnowledgeIntakeRepository {
  createOrFind(intake: KnowledgeIntake): Promise<{ intake: KnowledgeIntake; created: boolean }>;
}

const keysExactly = (value: Record<string, unknown>, expected: string[]) => {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
};
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export function parseCoreIntakeRequest(value: unknown): CoreIntakeRequest | null {
  if (
    !record(value) ||
    !keysExactly(value, ['readyPackageId', 'workspaceId', 'digest', 'evidence', 'submittedAt'])
  )
    return null;
  const evidence = value.evidence;
  if (
    !record(evidence) ||
    !keysExactly(evidence, ['artifactIds', 'stagingDocumentId']) ||
    !Array.isArray(evidence.artifactIds) ||
    !evidence.artifactIds.every(nonEmpty) ||
    !nonEmpty(evidence.stagingDocumentId) ||
    !nonEmpty(value.readyPackageId) ||
    !nonEmpty(value.workspaceId) ||
    !nonEmpty(value.digest) ||
    !nonEmpty(value.submittedAt) ||
    !Number.isFinite(Date.parse(value.submittedAt))
  )
    return null;
  return {
    readyPackageId: value.readyPackageId,
    workspaceId: value.workspaceId,
    digest: value.digest,
    evidence: {
      artifactIds: [...evidence.artifactIds] as string[],
      stagingDocumentId: evidence.stagingDocumentId
    },
    submittedAt: value.submittedAt
  };
}

export const serializeCoreIntakeRequest = (request: CoreIntakeRequest) => JSON.stringify(request);
export const fingerprintCoreIntakeRequest = (request: CoreIntakeRequest) =>
  createHash('sha256').update(serializeCoreIntakeRequest(request), 'utf8').digest('hex');

const clone = <T>(value: T): T => structuredClone(value);
export class MemoryKnowledgeIntakeRepository implements KnowledgeIntakeRepository {
  private readonly rows = new Map<string, KnowledgeIntake>();
  async createOrFind(candidate: KnowledgeIntake) {
    await Promise.resolve();
    const existing = this.rows.get(candidate.idempotencyKey);
    if (existing) return { intake: clone(existing), created: false };
    this.rows.set(candidate.idempotencyKey, clone(candidate));
    return { intake: clone(candidate), created: true };
  }
  count() {
    return this.rows.size;
  }
}

type Row = Record<string, unknown>;
const mapRow = (row: Row): KnowledgeIntake => ({
  intakeId: row.intake_id as string,
  idempotencyKey: row.idempotency_key as string,
  request: row.request_json as CoreIntakeRequest,
  requestSha256: row.request_sha256 as string,
  status: row.status as CoreIntakeStatus,
  receivedAt: (row.received_at as Date).toISOString()
});

export class PostgresKnowledgeIntakeRepository implements KnowledgeIntakeRepository {
  constructor(private readonly query: QueryClient) {}
  async createOrFind(candidate: KnowledgeIntake) {
    const request = candidate.request;
    const result = await this.query.query(
      `INSERT INTO knowledge_intakes(
        intake_id,idempotency_key,ready_package_id,workspace_id,ready_package_digest,
        staging_document_id,artifact_ids,submitted_at,received_at,request_sha256,request_json,status
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
      ON CONFLICT (idempotency_key) DO UPDATE
        SET idempotency_key=knowledge_intakes.idempotency_key
      RETURNING *, (xmax = 0) AS created`,
      [
        candidate.intakeId,
        candidate.idempotencyKey,
        request.readyPackageId,
        request.workspaceId,
        request.digest,
        request.evidence.stagingDocumentId,
        request.evidence.artifactIds,
        request.submittedAt,
        candidate.receivedAt,
        candidate.requestSha256,
        serializeCoreIntakeRequest(request),
        candidate.status
      ]
    );
    const row = result.rows[0] as Row & { created: boolean };
    return { intake: mapRow(row), created: row.created };
  }
}
