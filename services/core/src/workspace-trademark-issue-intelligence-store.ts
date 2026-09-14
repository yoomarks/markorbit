import { createHash } from 'node:crypto';
import {
  parseWorkspaceTrademarkIssueIntelligenceV1,
  type BrainIntelligenceId,
  type WorkspaceTrademarkIssueIntelligenceV1
} from '@markorbit/contracts/brain-workspace-intelligence';
import type { ManagedDatabase, QueryClient } from '@markorbit/persistence';

export type WorkspaceTrademarkIssueIntelligenceStoreErrorCode =
  | 'INVALID_INPUT'
  | 'IDENTITY_CONFLICT'
  | 'PERSISTENCE_INTEGRITY_FAILURE'
  | 'PERSISTENCE_UNAVAILABLE';

export class WorkspaceTrademarkIssueIntelligenceStoreError extends Error {
  constructor(
    readonly code: WorkspaceTrademarkIssueIntelligenceStoreErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'WorkspaceTrademarkIssueIntelligenceStoreError';
  }
}

export interface WorkspaceTrademarkIssueIntelligenceStoreDisposition {
  intelligence: Readonly<WorkspaceTrademarkIssueIntelligenceV1>;
  replayed: boolean;
}

export interface WorkspaceTrademarkIssueIntelligenceRepository {
  record(value: unknown): Promise<WorkspaceTrademarkIssueIntelligenceStoreDisposition>;
  find(
    workspaceId: string,
    intelligenceId: BrainIntelligenceId
  ): Promise<Readonly<WorkspaceTrademarkIssueIntelligenceV1> | undefined>;
}

interface StoredIntelligence {
  snapshotSha256: string;
  intelligence: WorkspaceTrademarkIssueIntelligenceV1;
}

type IntelligenceRow = {
  workspace_id: string;
  intelligence_id: string;
  schema_version: number;
  task: string;
  status: string;
  snapshot_sha256: string;
  intelligence_json: unknown;
  generated_at: Date | string;
};

const CORE_WORKSPACE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const INTELLIGENCE_ID = /^brain-intelligence_[0-9a-f]{64}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function snapshotSha256(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function cleanWorkspaceId(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!CORE_WORKSPACE_UUID.test(cleaned)) {
    throw new WorkspaceTrademarkIssueIntelligenceStoreError(
      'INVALID_INPUT',
      'workspaceId must be a canonical Core Workspace UUID.'
    );
  }
  return cleaned;
}

function cleanIntelligenceId(value: string): BrainIntelligenceId {
  const cleaned = value.trim();
  if (!INTELLIGENCE_ID.test(cleaned)) {
    throw new WorkspaceTrademarkIssueIntelligenceStoreError(
      'INVALID_INPUT',
      'intelligenceId must be a deterministic Brain intelligence identifier.'
    );
  }
  return cleaned as BrainIntelligenceId;
}

function parseIncoming(value: unknown): WorkspaceTrademarkIssueIntelligenceV1 {
  try {
    const parsed = parseWorkspaceTrademarkIssueIntelligenceV1(value);
    cleanIntelligenceId(parsed.intelligenceId);
    return parsed;
  } catch (cause) {
    if (cause instanceof WorkspaceTrademarkIssueIntelligenceStoreError) throw cause;
    throw new WorkspaceTrademarkIssueIntelligenceStoreError(
      'INVALID_INPUT',
      'Workspace trademark issue intelligence is outside the accepted contract.',
      cause instanceof Error ? { cause: cause.message } : undefined
    );
  }
}

function normalizeStoredInstant(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new WorkspaceTrademarkIssueIntelligenceStoreError(
      'PERSISTENCE_INTEGRITY_FAILURE',
      'Stored intelligence generatedAt is invalid.'
    );
  }
  return parsed.toISOString();
}

function parseStored(
  row: Readonly<IntelligenceRow>,
  expectedWorkspaceId: string,
  expectedIntelligenceId: BrainIntelligenceId
): WorkspaceTrademarkIssueIntelligenceV1 {
  if (!SHA256.test(row.snapshot_sha256)) {
    throw new WorkspaceTrademarkIssueIntelligenceStoreError(
      'PERSISTENCE_INTEGRITY_FAILURE',
      'Stored intelligence fingerprint is invalid.'
    );
  }
  let intelligence: WorkspaceTrademarkIssueIntelligenceV1;
  try {
    intelligence = parseWorkspaceTrademarkIssueIntelligenceV1(row.intelligence_json);
  } catch (cause) {
    throw new WorkspaceTrademarkIssueIntelligenceStoreError(
      'PERSISTENCE_INTEGRITY_FAILURE',
      'Stored intelligence is outside the accepted contract.',
      cause instanceof Error ? { cause: cause.message } : undefined
    );
  }
  if (
    row.workspace_id.toLowerCase() !== expectedWorkspaceId ||
    intelligence.workspaceId !== expectedWorkspaceId ||
    row.intelligence_id !== expectedIntelligenceId ||
    intelligence.intelligenceId !== expectedIntelligenceId ||
    row.schema_version !== intelligence.schemaVersion ||
    row.task !== intelligence.task ||
    row.status !== intelligence.status ||
    normalizeStoredInstant(row.generated_at) !== normalizeStoredInstant(intelligence.generatedAt)
  ) {
    throw new WorkspaceTrademarkIssueIntelligenceStoreError(
      'PERSISTENCE_INTEGRITY_FAILURE',
      'Stored intelligence identity does not match its persistence key.'
    );
  }
  const actualSha256 = snapshotSha256(intelligence);
  if (actualSha256 !== row.snapshot_sha256) {
    throw new WorkspaceTrademarkIssueIntelligenceStoreError(
      'PERSISTENCE_INTEGRITY_FAILURE',
      'Stored intelligence fingerprint does not match its structured snapshot.'
    );
  }
  return intelligence;
}

function persistenceFailure(cause: unknown): never {
  if (cause instanceof WorkspaceTrademarkIssueIntelligenceStoreError) throw cause;
  throw new WorkspaceTrademarkIssueIntelligenceStoreError(
    'PERSISTENCE_UNAVAILABLE',
    'Workspace trademark issue intelligence persistence is unavailable.',
    cause instanceof Error ? { cause: cause.message } : undefined
  );
}

function storageKey(workspaceId: string, intelligenceId: BrainIntelligenceId): string {
  return `${workspaceId}:${intelligenceId}`;
}

export class MemoryWorkspaceTrademarkIssueIntelligenceRepository implements WorkspaceTrademarkIssueIntelligenceRepository {
  private readonly values = new Map<string, StoredIntelligence>();

  record(value: unknown): Promise<WorkspaceTrademarkIssueIntelligenceStoreDisposition> {
    return Promise.resolve().then(() => {
      const intelligence = parseIncoming(value);
      const key = storageKey(intelligence.workspaceId, intelligence.intelligenceId);
      const fingerprint = snapshotSha256(intelligence);
      const existing = this.values.get(key);
      if (existing) {
        if (existing.snapshotSha256 !== fingerprint) {
          throw new WorkspaceTrademarkIssueIntelligenceStoreError(
            'IDENTITY_CONFLICT',
            'intelligenceId cannot be replayed with a materially different snapshot.'
          );
        }
        return { intelligence: structuredClone(existing.intelligence), replayed: true };
      }
      this.values.set(key, {
        snapshotSha256: fingerprint,
        intelligence: structuredClone(intelligence)
      });
      return { intelligence: structuredClone(intelligence), replayed: false };
    });
  }

  find(
    workspaceId: string,
    intelligenceId: BrainIntelligenceId
  ): Promise<Readonly<WorkspaceTrademarkIssueIntelligenceV1> | undefined> {
    return Promise.resolve().then(() => {
      const cleanWorkspace = cleanWorkspaceId(workspaceId);
      const cleanId = cleanIntelligenceId(intelligenceId);
      const existing = this.values.get(storageKey(cleanWorkspace, cleanId));
      return existing ? structuredClone(existing.intelligence) : undefined;
    });
  }
}

async function lock(client: QueryClient, workspaceId: string, intelligenceId: string) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    `workspace-trademark-issue-intelligence:${workspaceId}:${intelligenceId}`
  ]);
}

export class PostgresWorkspaceTrademarkIssueIntelligenceRepository implements WorkspaceTrademarkIssueIntelligenceRepository {
  constructor(private readonly database: ManagedDatabase) {}

  async record(value: unknown): Promise<WorkspaceTrademarkIssueIntelligenceStoreDisposition> {
    const intelligence = parseIncoming(value);
    const fingerprint = snapshotSha256(intelligence);
    try {
      return await this.database.transact(async (client) => {
        await lock(client, intelligence.workspaceId, intelligence.intelligenceId);
        const existing = await client.query<IntelligenceRow>(
          `SELECT workspace_id,intelligence_id,schema_version,task,status,snapshot_sha256,intelligence_json,generated_at
             FROM core_workspace_trademark_issue_intelligence
            WHERE workspace_id=$1 AND intelligence_id=$2`,
          [intelligence.workspaceId, intelligence.intelligenceId]
        );
        const row = existing.rows[0];
        if (row) {
          const stored = parseStored(row, intelligence.workspaceId, intelligence.intelligenceId);
          if (row.snapshot_sha256 !== fingerprint) {
            throw new WorkspaceTrademarkIssueIntelligenceStoreError(
              'IDENTITY_CONFLICT',
              'intelligenceId cannot be replayed with a materially different snapshot.'
            );
          }
          return { intelligence: structuredClone(stored), replayed: true };
        }
        await client.query(
          `INSERT INTO core_workspace_trademark_issue_intelligence(
             workspace_id,intelligence_id,schema_version,task,status,
             snapshot_sha256,intelligence_json,generated_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
          [
            intelligence.workspaceId,
            intelligence.intelligenceId,
            intelligence.schemaVersion,
            intelligence.task,
            intelligence.status,
            fingerprint,
            JSON.stringify(intelligence),
            intelligence.generatedAt
          ]
        );
        return { intelligence: structuredClone(intelligence), replayed: false };
      });
    } catch (cause) {
      persistenceFailure(cause);
    }
  }

  async find(
    workspaceId: string,
    intelligenceId: BrainIntelligenceId
  ): Promise<Readonly<WorkspaceTrademarkIssueIntelligenceV1> | undefined> {
    const cleanWorkspace = cleanWorkspaceId(workspaceId);
    const cleanId = cleanIntelligenceId(intelligenceId);
    try {
      const result = await this.database.getPool().query<IntelligenceRow>(
        `SELECT workspace_id,intelligence_id,schema_version,task,status,snapshot_sha256,intelligence_json,generated_at
           FROM core_workspace_trademark_issue_intelligence
          WHERE workspace_id=$1 AND intelligence_id=$2`,
        [cleanWorkspace, cleanId]
      );
      const row = result.rows[0];
      if (!row) return undefined;
      return structuredClone(parseStored(row, cleanWorkspace, cleanId));
    } catch (cause) {
      persistenceFailure(cause);
    }
  }
}
