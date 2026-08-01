import type { QueryClient } from '@markorbit/persistence';

export const MARKREG_DENIAL_REASONS = [
  'PERMISSION_DENIED',
  'CROSS_WORKSPACE_ACCESS',
  'ORIGIN_REJECTED',
  'CSRF_REJECTED',
  'IDEMPOTENCY_KEY_REUSE',
  'STALE_VERSION',
  'TERMINAL_STATE_MUTATION',
  'SOURCE_LINEAGE_CONFLICT'
] as const;
export type MarkRegDenialReason = (typeof MARKREG_DENIAL_REASONS)[number];
export const MARKREG_AUDIT_OPERATIONS = [
  'FORMAL_MATTER_CREATE',
  'DOCUMENT_PACKAGE_CREATE',
  'DOCUMENT_PACKAGE_UPDATE_DRAFT',
  'DOCUMENT_EVIDENCE_UPSERT',
  'INSTRUCTION_APPEND',
  'INSTRUCTION_SUPERSEDE',
  'DOCUMENT_PACKAGE_MARK_READY'
] as const;
export type MarkRegAuditOperation = (typeof MARKREG_AUDIT_OPERATIONS)[number];
export const MARKREG_AUDIT_TARGETS = [
  'FORMAL_MATTER',
  'DOCUMENT_PACKAGE',
  'DOCUMENT_EVIDENCE',
  'INSTRUCTION_LEDGER'
] as const;
export type MarkRegAuditTarget = (typeof MARKREG_AUDIT_TARGETS)[number];

export interface AppendMarkRegDenial {
  workspaceId: string;
  actorId: string;
  actorMembershipId?: string;
  operation: MarkRegAuditOperation;
  targetType: MarkRegAuditTarget;
  targetId?: string;
  reasonCode: MarkRegDenialReason;
  correlationId?: string;
  idempotencyKeySha256?: string;
  sourceCommandFingerprint?: string;
  occurredAt: string;
}
export interface MarkRegAuditRecord {
  auditId: string;
  workspaceId: string;
  kind: 'SUCCESS' | 'DENIAL';
  targetType: MarkRegAuditTarget;
  targetId: string | null;
  operation: string;
  actorId: string;
  decision: 'SUCCEEDED' | 'DENIED';
  reasonCode: MarkRegDenialReason | null;
  correlationId: string | null;
  occurredAt: string;
}
export interface MarkRegAuditQuery {
  kind?: 'SUCCESS' | 'DENIAL';
  targetType?: MarkRegAuditTarget;
  targetId?: string;
  reasonCode?: MarkRegDenialReason;
  cursor?: string;
  limit?: number;
}
export interface MarkRegAuditPage {
  records: readonly Readonly<MarkRegAuditRecord>[];
  nextCursor: string | null;
}
export class MarkRegAuditError extends Error {
  constructor(
    readonly code: 'INVALID_AUDIT_QUERY' | 'PERSISTENCE_UNAVAILABLE',
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'MarkRegAuditError';
  }
}
type Row = Record<string, unknown>;
const bounded = (value: string | undefined) => value === undefined || value.length <= 200;
const sha = (value: string | undefined) => value === undefined || /^[0-9a-f]{64}$/u.test(value);
const cloneRecord = (record: MarkRegAuditRecord): Readonly<MarkRegAuditRecord> =>
  Object.freeze(structuredClone(record));

export class PostgresMarkRegAuditRepository {
  static readonly MAX_PAGE_SIZE = 100;
  constructor(private readonly query: QueryClient) {}

  async appendDenial(input: AppendMarkRegDenial): Promise<Readonly<MarkRegAuditRecord>> {
    if (
      !MARKREG_AUDIT_OPERATIONS.includes(input.operation) ||
      !MARKREG_AUDIT_TARGETS.includes(input.targetType) ||
      !MARKREG_DENIAL_REASONS.includes(input.reasonCode) ||
      !bounded(input.actorId) ||
      !bounded(input.actorMembershipId) ||
      !bounded(input.targetId) ||
      !bounded(input.correlationId) ||
      !sha(input.idempotencyKeySha256) ||
      !sha(input.sourceCommandFingerprint) ||
      !Number.isFinite(Date.parse(input.occurredAt))
    )
      throw new MarkRegAuditError('INVALID_AUDIT_QUERY', 'Denial audit input is invalid.');
    try {
      const result = await this.query.query(
        'INSERT INTO markreg_denial_audit (workspace_id,actor_id,actor_membership_id,operation,target_type,target_id,reason_code,correlation_id,idempotency_key_sha256,source_command_fingerprint,occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
        [
          input.workspaceId,
          input.actorId,
          input.actorMembershipId ?? null,
          input.operation,
          input.targetType,
          input.targetId ?? null,
          input.reasonCode,
          input.correlationId ?? null,
          input.idempotencyKeySha256 ?? null,
          input.sourceCommandFingerprint ?? null,
          input.occurredAt
        ]
      );
      return cloneRecord(this.denial(result.rows[0] as Row));
    } catch (cause) {
      if (cause instanceof MarkRegAuditError) throw cause;
      throw new MarkRegAuditError(
        'PERSISTENCE_UNAVAILABLE',
        'MarkReg audit persistence is unavailable.',
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  async list(workspaceId: string, query: MarkRegAuditQuery = {}): Promise<MarkRegAuditPage> {
    const limit = query.limit ?? 50;
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > PostgresMarkRegAuditRepository.MAX_PAGE_SIZE ||
      (query.kind !== undefined && !['SUCCESS', 'DENIAL'].includes(query.kind)) ||
      (query.targetType !== undefined && !MARKREG_AUDIT_TARGETS.includes(query.targetType)) ||
      (query.reasonCode !== undefined && !MARKREG_DENIAL_REASONS.includes(query.reasonCode)) ||
      !bounded(query.targetId)
    )
      throw new MarkRegAuditError('INVALID_AUDIT_QUERY', 'Audit query is invalid.');
    const cursor = this.decodeCursor(query.cursor);
    try {
      const result = await this.query.query(
        `SELECT * FROM (
          SELECT 'formal-matter:' || audit_id::text audit_id, workspace_id, 'SUCCESS' kind,
            'FORMAL_MATTER' target_type, formal_matter_id target_id, action operation,
            actor_id, 'SUCCEEDED' decision, NULL::text reason_code, correlation_id, created_at occurred_at
          FROM formal_matter_audit
          UNION ALL
          SELECT 'document-package:' || audit_id::text, workspace_id, 'SUCCESS',
            'DOCUMENT_PACKAGE', document_package_id, action, actor_id, 'SUCCEEDED', NULL::text,
            correlation_id, created_at
          FROM document_package_audit
          UNION ALL
          SELECT 'denial:' || audit_id::text, workspace_id, 'DENIAL', target_type, target_id,
            operation, actor_id, decision, reason_code, correlation_id, occurred_at
          FROM markreg_denial_audit
        ) audit
        WHERE workspace_id=$1
          AND ($2::text IS NULL OR kind=$2)
          AND ($3::text IS NULL OR target_type=$3)
          AND ($4::text IS NULL OR target_id=$4)
          AND ($5::text IS NULL OR reason_code=$5)
          AND ($6::timestamptz IS NULL OR (occurred_at, audit_id) < ($6::timestamptz, $7::text))
        ORDER BY occurred_at DESC, audit_id DESC LIMIT $8`,
        [
          workspaceId,
          query.kind ?? null,
          query.targetType ?? null,
          query.targetId ?? null,
          query.reasonCode ?? null,
          cursor?.occurredAt ?? null,
          cursor?.auditId ?? null,
          limit + 1
        ]
      );
      const all = result.rows.map((row) => cloneRecord(this.map(row as Row)));
      const records = Object.freeze(all.slice(0, limit));
      const last = records.at(-1);
      return Object.freeze({
        records,
        nextCursor:
          all.length > limit && last
            ? Buffer.from(
                JSON.stringify({ auditId: last.auditId, occurredAt: last.occurredAt }),
                'utf8'
              ).toString('base64url')
            : null
      });
    } catch (cause) {
      if (cause instanceof MarkRegAuditError) throw cause;
      throw new MarkRegAuditError(
        'PERSISTENCE_UNAVAILABLE',
        'MarkReg audit persistence is unavailable.',
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }

  private decodeCursor(value: string | undefined) {
    if (!value) return null;
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Row;
      if (
        typeof parsed.auditId !== 'string' ||
        typeof parsed.occurredAt !== 'string' ||
        !Number.isFinite(Date.parse(parsed.occurredAt))
      )
        throw new Error('invalid');
      return { auditId: parsed.auditId, occurredAt: parsed.occurredAt };
    } catch {
      throw new MarkRegAuditError('INVALID_AUDIT_QUERY', 'Audit cursor is invalid.');
    }
  }
  private denial(row: Row): MarkRegAuditRecord {
    return this.map({
      ...row,
      audit_id: `denial:${String(row.audit_id)}`,
      kind: 'DENIAL'
    });
  }
  private map(row: Row): MarkRegAuditRecord {
    return {
      auditId: String(row.audit_id),
      workspaceId: String(row.workspace_id),
      kind: String(row.kind) as MarkRegAuditRecord['kind'],
      targetType: String(row.target_type) as MarkRegAuditTarget,
      targetId: typeof row.target_id === 'string' ? row.target_id : null,
      operation: String(row.operation),
      actorId: String(row.actor_id),
      decision: String(row.decision) as MarkRegAuditRecord['decision'],
      reasonCode:
        typeof row.reason_code === 'string' ? (row.reason_code as MarkRegDenialReason) : null,
      correlationId: typeof row.correlation_id === 'string' ? row.correlation_id : null,
      occurredAt: new Date(row.occurred_at as string).toISOString()
    };
  }
}
