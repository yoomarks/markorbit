import { createHash, randomUUID } from 'node:crypto';
import type {
  CreateFormalMatterCommand,
  FormalMatter,
  FormalMatterId,
  FormalMatterSourceSnapshot,
  Permission,
  WorkspacePrincipal
} from '@markorbit/contracts';
import type { CustomerConfirmationRepository } from './customer-confirmation.js';
import type { MatterDraftRepository } from './matter-draft.js';
import type { QueryClient } from '@markorbit/persistence';

export type FormalMatterErrorCode =
  | 'FORMAL_MATTER_NOT_FOUND'
  | 'SOURCE_NOT_FOUND'
  | 'STALE_SOURCE'
  | 'SOURCE_INELIGIBLE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'DUPLICATE_SOURCE'
  | 'WORKSPACE_MISMATCH'
  | 'PERMISSION_DENIED'
  | 'AUTHENTICATION_REQUIRED'
  | 'PERSISTENCE_UNAVAILABLE';
export class FormalMatterError extends Error {
  constructor(
    readonly code: FormalMatterErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'FormalMatterError';
  }
}
export interface MatterAuditRecord {
  workspaceId: string;
  formalMatterId: FormalMatterId;
  action: 'FORMAL_MATTER_CREATED';
  actorId: string;
  correlationId?: string;
  createdAt: string;
}
type Creation = { fingerprint: string; matter: FormalMatter };
export interface FormalMatterRepository {
  createAtomically(
    value: FormalMatter,
    key: string,
    fingerprint: string,
    audit: MatterAuditRecord
  ): Promise<FormalMatter>;
  findById(workspaceId: string, id: string): Promise<FormalMatter | null>;
  findByIdempotencyKey(workspaceId: string, key: string): Promise<Creation | null>;
}
const clone = <T>(v: T): T => structuredClone(v);
export class InMemoryFormalMatterRepository implements FormalMatterRepository {
  private matters = new Map<string, FormalMatter>();
  private keys = new Map<string, Creation>();
  private sources = new Map<string, string>();
  private audits: MatterAuditRecord[] = [];
  private chain: Promise<void> = Promise.resolve();
  async createAtomically(v: FormalMatter, key: string, fp: string, audit: MatterAuditRecord) {
    let result!: FormalMatter;
    const work = this.chain.then(() => {
      const keyed = this.keys.get(`${v.workspaceId}:${key}`);
      if (keyed) {
        if (keyed.fingerprint !== fp)
          throw new FormalMatterError(
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key has conflicting input.'
          );
        result = clone(keyed.matter);
        return;
      }
      const source = `${v.workspaceId}:${v.sourceMatterDraftId}:${v.sourceMatterDraftVersion}`;
      if (this.sources.has(source))
        throw new FormalMatterError(
          'DUPLICATE_SOURCE',
          'The exact Matter Draft version already created a Formal Matter.'
        );
      this.matters.set(v.formalMatterId, clone(v));
      this.sources.set(source, v.formalMatterId);
      this.keys.set(`${v.workspaceId}:${key}`, { fingerprint: fp, matter: clone(v) });
      this.audits.push(clone(audit));
      result = clone(v);
    });
    this.chain = work.then(
      () => undefined,
      () => undefined
    );
    await work;
    return result;
  }
  findById(w: string, id: string) {
    const v = this.matters.get(id);
    return Promise.resolve(v?.workspaceId === w ? clone(v) : null);
  }
  findByIdempotencyKey(w: string, k: string) {
    return Promise.resolve(clone(this.keys.get(`${w}:${k}`) ?? null));
  }
  evidence() {
    return { matters: this.matters.size, idempotency: this.keys.size, audits: this.audits.length };
  }
}
export interface TransactionHost {
  transact<T>(
    work: (client: QueryClient) => Promise<T>,
    options?: { isolation?: 'SERIALIZABLE' }
  ): Promise<T>;
}
type Row = Record<string, unknown>;
export class PostgresFormalMatterRepository implements FormalMatterRepository {
  constructor(
    private readonly database: TransactionHost,
    private readonly query: QueryClient
  ) {}
  async createAtomically(v: FormalMatter, key: string, fp: string, audit: MatterAuditRecord) {
    try {
      return await this.database.transact(
        async (c) => {
          const prior = await c.query(
            'SELECT request_fingerprint, formal_matter_id FROM formal_matter_commands WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE',
            [v.workspaceId, key]
          );
          if (prior.rowCount) {
            if ((prior.rows[0] as Row).request_fingerprint !== fp)
              throw new FormalMatterError(
                'IDEMPOTENCY_CONFLICT',
                'Idempotency key has conflicting input.'
              );
            const found = await c.query(
              'SELECT * FROM formal_matters WHERE workspace_id=$1 AND formal_matter_id=$2',
              [v.workspaceId, (prior.rows[0] as Row).formal_matter_id]
            );
            return this.map(priorMatter(found.rows[0] as Row));
          }
          await c.query(
            'INSERT INTO formal_matters (formal_matter_id,workspace_id,kind,status,version,source_customer_confirmation_id,source_customer_confirmation_version,source_matter_draft_id,source_matter_draft_version,source_quote_id,source_quote_version,source_snapshot,snapshot_schema_version,snapshot_sha256,created_by_user_id,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17)',
            [
              v.formalMatterId,
              v.workspaceId,
              v.kind,
              v.status,
              v.version,
              v.sourceCustomerConfirmationId,
              v.sourceCustomerConfirmationVersion,
              v.sourceMatterDraftId,
              v.sourceMatterDraftVersion,
              v.sourceQuoteId,
              v.sourceQuoteVersion,
              JSON.stringify(v.sourceSnapshot),
              v.snapshotSchemaVersion,
              v.snapshotSha256,
              v.createdByUserId,
              v.createdAt,
              v.updatedAt
            ]
          );
          await c.query(
            'INSERT INTO formal_matter_commands (workspace_id,idempotency_key,request_fingerprint,formal_matter_id,created_at) VALUES ($1,$2,$3,$4,$5)',
            [v.workspaceId, key, fp, v.formalMatterId, v.createdAt]
          );
          await c.query(
            'INSERT INTO formal_matter_audit (workspace_id,formal_matter_id,action,actor_id,correlation_id,created_at) VALUES ($1,$2,$3,$4,$5,$6)',
            [
              audit.workspaceId,
              audit.formalMatterId,
              audit.action,
              audit.actorId,
              audit.correlationId ?? null,
              audit.createdAt
            ]
          );
          return clone(v);
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof FormalMatterError) throw cause;
      const code = (cause as { code?: string }).code;
      if (code === '23505' || code === '40001') {
        // A concurrent identical command can lose either the unique-key race or the
        // serializable transaction race. The winner is durable before PostgreSQL
        // reports either error, so resolve the approved replay semantics here.
        const replay = await this.findByIdempotencyKey(v.workspaceId, key);
        if (replay) {
          if (replay.fingerprint !== fp)
            throw new FormalMatterError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has conflicting input.'
            );
          return replay.matter;
        }
        throw new FormalMatterError(
          'DUPLICATE_SOURCE',
          'The exact Matter Draft version already created a Formal Matter.'
        );
      }
      throw new FormalMatterError(
        'PERSISTENCE_UNAVAILABLE',
        'Formal Matter persistence is unavailable.',
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }
  async findById(w: string, id: string) {
    try {
      const r = await this.query.query(
        'SELECT * FROM formal_matters WHERE workspace_id=$1 AND formal_matter_id=$2',
        [w, id]
      );
      return r.rowCount ? this.map(priorMatter(r.rows[0] as Row)) : null;
    } catch (cause) {
      throw new FormalMatterError(
        'PERSISTENCE_UNAVAILABLE',
        'Formal Matter persistence is unavailable.',
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }
  async findByIdempotencyKey(w: string, key: string) {
    const r = await this.query.query(
      'SELECT c.request_fingerprint,m.* FROM formal_matter_commands c JOIN formal_matters m ON m.formal_matter_id=c.formal_matter_id WHERE c.workspace_id=$1 AND c.idempotency_key=$2',
      [w, key]
    );
    return r.rowCount
      ? {
          fingerprint: String((r.rows[0] as Row).request_fingerprint),
          matter: this.map(priorMatter(r.rows[0] as Row))
        }
      : null;
  }
  private map(r: Row): FormalMatter {
    return {
      schemaVersion: 1,
      formalMatterId: String(r.formal_matter_id) as FormalMatterId,
      workspaceId: String(r.workspace_id),
      kind: 'TRADEMARK_REGISTRATION',
      status: 'OPEN',
      version: 1,
      sourceCustomerConfirmationId: String(r.source_customer_confirmation_id) as never,
      sourceCustomerConfirmationVersion: Number(r.source_customer_confirmation_version),
      sourceMatterDraftId: String(r.source_matter_draft_id) as never,
      sourceMatterDraftVersion: Number(r.source_matter_draft_version),
      sourceQuoteId: String(r.source_quote_id) as never,
      sourceQuoteVersion: String(r.source_quote_version),
      sourceSnapshot: clone(r.source_snapshot as FormalMatterSourceSnapshot),
      snapshotSchemaVersion: 1,
      snapshotSha256: String(r.snapshot_sha256),
      createdByUserId: String(r.created_by_user_id) as never,
      createdAt: new Date(r.created_at as string).toISOString(),
      updatedAt: new Date(r.updated_at as string).toISOString()
    };
  }
}
const priorMatter = (r: Row) => r;
export function canonicalFormalMatterSnapshot(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalFormalMatterSnapshot).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalFormalMatterSnapshot(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
const canonical = canonicalFormalMatterSnapshot;
function authorize(p: WorkspacePrincipal, w: string, permission: Permission) {
  if (p.kind !== 'WORKSPACE')
    throw new FormalMatterError('AUTHENTICATION_REQUIRED', 'A Workspace Principal is required.');
  if (p.workspaceId !== w)
    throw new FormalMatterError('WORKSPACE_MISMATCH', 'Workspace context does not match.');
  if (!p.permissions.includes(permission))
    throw new FormalMatterError('PERMISSION_DENIED', `${permission} permission is required.`);
}
export class FormalMatterService {
  constructor(
    private repo: FormalMatterRepository,
    private confirmations: CustomerConfirmationRepository,
    private drafts: MatterDraftRepository,
    private now = () => new Date().toISOString()
  ) {}
  async create(p: WorkspacePrincipal, c: CreateFormalMatterCommand, correlationId?: string) {
    authorize(p, c.workspaceId, 'matter:create');
    const fp = createHash('sha256')
      .update(canonical({ ...c, idempotencyKey: undefined }))
      .digest('hex');
    const replay = await this.repo.findByIdempotencyKey(c.workspaceId, c.idempotencyKey);
    if (replay) {
      if (replay.fingerprint !== fp)
        throw new FormalMatterError(
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key has conflicting input.'
        );
      return replay.matter;
    }
    const confirmation = await this.confirmations.findById(c.workspaceId, c.customerConfirmationId);
    const draft = await this.drafts.findById(c.workspaceId, c.matterDraftId);
    if (!confirmation || !draft)
      throw new FormalMatterError('SOURCE_NOT_FOUND', 'Source was not found in this Workspace.');
    if (
      confirmation.version !== c.expectedCustomerConfirmationVersion ||
      draft.version !== c.expectedMatterDraftVersion
    )
      throw new FormalMatterError('STALE_SOURCE', 'An exact source version is stale.');
    if (confirmation.status !== 'CONFIRMED')
      throw new FormalMatterError(
        'SOURCE_INELIGIBLE',
        'Customer Confirmation is not currently confirmed.'
      );
    if (
      draft.customerConfirmationId !== confirmation.confirmationId ||
      draft.customerConfirmationVersion !== confirmation.version ||
      draft.sourceQuoteId !== confirmation.sourceSnapshot.quoteId ||
      draft.sourceQuoteVersion !== confirmation.sourceSnapshot.quoteVersion
    )
      throw new FormalMatterError('SOURCE_INELIGIBLE', 'Source lineage is inconsistent.');
    if (
      draft.status !== 'READY_FOR_PROFESSIONAL_REVIEW' ||
      !draft.readiness.readyForProfessionalReview ||
      draft.readiness.checks.some((x) => x.blocking && x.status !== 'PASS')
    )
      throw new FormalMatterError('SOURCE_INELIGIBLE', 'Matter Draft does not satisfy READY.');
    const snapshot: FormalMatterSourceSnapshot = {
      schemaVersion: 1,
      customerConfirmation: {
        id: confirmation.confirmationId as never,
        version: confirmation.version,
        status: 'CONFIRMED'
      },
      quote: {
        id: confirmation.sourceSnapshot.quoteId as never,
        version: confirmation.sourceSnapshot.quoteVersion,
        currency: confirmation.sourceSnapshot.currency,
        totalMinor: confirmation.sourceSnapshot.totalMinor
      },
      matterDraft: {
        id: draft.matterDraftId as never,
        version: draft.version,
        status: 'READY_FOR_PROFESSIONAL_REVIEW',
        readiness: clone(draft.readiness)
      },
      preparation: clone(draft.preparation)
    };
    const at = this.now();
    const id = `formal-matter_${randomUUID()}` as FormalMatterId;
    const value: FormalMatter = {
      schemaVersion: 1,
      formalMatterId: id,
      workspaceId: c.workspaceId,
      kind: 'TRADEMARK_REGISTRATION',
      status: 'OPEN',
      version: 1,
      sourceCustomerConfirmationId: confirmation.confirmationId as never,
      sourceCustomerConfirmationVersion: confirmation.version,
      sourceMatterDraftId: draft.matterDraftId as never,
      sourceMatterDraftVersion: draft.version,
      sourceQuoteId: draft.sourceQuoteId as never,
      sourceQuoteVersion: draft.sourceQuoteVersion,
      sourceSnapshot: snapshot,
      snapshotSchemaVersion: 1,
      snapshotSha256: createHash('sha256').update(canonical(snapshot)).digest('hex'),
      createdByUserId: p.userId as FormalMatter['createdByUserId'],
      createdAt: at,
      updatedAt: at
    };
    return this.repo.createAtomically(value, c.idempotencyKey, fp, {
      workspaceId: c.workspaceId,
      formalMatterId: id,
      action: 'FORMAL_MATTER_CREATED',
      actorId: p.userId,
      ...(correlationId ? { correlationId } : {}),
      createdAt: at
    });
  }
  async get(p: WorkspacePrincipal, workspaceId: string, id: string) {
    authorize(p, workspaceId, 'matter:read');
    const v = await this.repo.findById(workspaceId, id);
    if (!v) throw new FormalMatterError('FORMAL_MATTER_NOT_FOUND', 'Formal Matter was not found.');
    return v;
  }
}
