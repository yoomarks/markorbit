import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { CapabilityRequestV2 } from '@markorbit/contracts/capability-runtime';
import type { QueryClient } from '@markorbit/persistence';
import type {
  GovernedImplementationSelection,
  ImplementationProfileSelector
} from './capability-runtime.js';
import type { DurableImplementationProfileRegistryV1 } from './implementation-profile-registry-postgres.js';
import {
  GovernedImplementationProfileSelectorV1,
  InMemoryImplementationProfileRegistryV1,
  type GovernedImplementationSelectionPolicyV1,
  type GovernedWorkspaceImplementationPreferenceV1,
  type WorkspaceImplementationPreferenceContextV1,
  type WorkspaceImplementationPreferenceResolverV1
} from './implementation-profile-registry.js';
import {
  governedWorkspaceImplementationPreferenceV1,
  normalizeWorkspaceImplementationPreferenceContextV1,
  normalizeWorkspaceImplementationPreferenceV1,
  workspaceImplementationPreferenceFingerprintSha256V1,
  WorkspaceImplementationPreferenceError,
  type WorkspaceImplementationPreferenceV1
} from './workspace-implementation-preference.js';

type Row = Record<string, unknown>;

export interface WorkspaceImplementationPreferenceTransactionHostV1 {
  transact<T>(callback: (client: QueryClient) => Promise<T>): Promise<T>;
}

export interface DurableWorkspaceImplementationPreferenceStoreV1 {
  register(value: unknown): Promise<Readonly<WorkspaceImplementationPreferenceV1>>;
  findCurrent(
    context: Readonly<WorkspaceImplementationPreferenceContextV1>
  ): Promise<Readonly<WorkspaceImplementationPreferenceV1> | undefined>;
  findVersion(
    context: Readonly<WorkspaceImplementationPreferenceContextV1>,
    version: number
  ): Promise<Readonly<WorkspaceImplementationPreferenceV1> | undefined>;
}

function exactVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000)
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PREFERENCE',
      'Preference version must be a positive safe integer not exceeding 1000000.',
      422
    );
  return value;
}

function persistedPreference(
  row: Row | undefined
): Readonly<WorkspaceImplementationPreferenceV1> | undefined {
  if (!row) return undefined;
  const document = row.document_json;
  const persistedFingerprint = row.document_fingerprint_sha256;
  if (
    typeof document !== 'object' ||
    document === null ||
    Array.isArray(document) ||
    typeof persistedFingerprint !== 'string'
  )
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PERSISTED_PREFERENCE',
      'Persisted Workspace implementation preference is invalid.',
      500
    );
  try {
    const preference = normalizeWorkspaceImplementationPreferenceV1(document);
    if (workspaceImplementationPreferenceFingerprintSha256V1(preference) !== persistedFingerprint)
      throw new WorkspaceImplementationPreferenceError(
        'INVALID_PERSISTED_PREFERENCE',
        'Persisted Workspace implementation preference fingerprint does not match its document.',
        500
      );
    return structuredClone(preference);
  } catch (error) {
    if (error instanceof WorkspaceImplementationPreferenceError) throw error;
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PERSISTED_PREFERENCE',
      'Persisted Workspace implementation preference failed governed validation.',
      500,
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

export class PostgresWorkspaceImplementationPreferenceStoreV1
  implements
    DurableWorkspaceImplementationPreferenceStoreV1,
    WorkspaceImplementationPreferenceResolverV1
{
  constructor(
    private readonly database: WorkspaceImplementationPreferenceTransactionHostV1,
    private readonly query: QueryClient
  ) {}

  async register(value: unknown): Promise<Readonly<WorkspaceImplementationPreferenceV1>> {
    const preference = normalizeWorkspaceImplementationPreferenceV1(value);
    const fingerprint = workspaceImplementationPreferenceFingerprintSha256V1(preference);
    const scope = `${preference.workspaceId}:${preference.capabilityId}:${preference.capabilityVersion}`;
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `workspace-implementation-preference:${scope}`
        ]);
        const exactResult = await client.query(
          `SELECT document_json,document_fingerprint_sha256
             FROM capability_workspace_implementation_preferences
            WHERE workspace_id=$1 AND capability_id=$2 AND capability_version=$3 AND version=$4`,
          [
            preference.workspaceId,
            preference.capabilityId,
            preference.capabilityVersion,
            preference.version
          ]
        );
        const exact = exactResult.rows[0] as Row | undefined;
        if (exact) {
          if (exact.document_fingerprint_sha256 !== fingerprint)
            throw new WorkspaceImplementationPreferenceError(
              'PREFERENCE_VERSION_CONFLICT',
              'Workspace implementation preference version is immutable and conflicts with the persisted document.'
            );
          const replay = persistedPreference(exact);
          if (!replay)
            throw new WorkspaceImplementationPreferenceError(
              'INVALID_PERSISTED_PREFERENCE',
              'Persisted Workspace implementation preference replay disappeared unexpectedly.',
              500
            );
          return replay;
        }

        const currentResult = await client.query(
          `SELECT version
             FROM capability_workspace_implementation_preferences
            WHERE workspace_id=$1 AND capability_id=$2 AND capability_version=$3
            ORDER BY version DESC
            LIMIT 1`,
          [preference.workspaceId, preference.capabilityId, preference.capabilityVersion]
        );
        const current = currentResult.rows[0] as Row | undefined;
        if (current && Number(current.version) >= preference.version)
          throw new WorkspaceImplementationPreferenceError(
            'PREFERENCE_VERSION_CONFLICT',
            'A new Workspace implementation preference must advance the current immutable version line.'
          );

        await client.query(
          `INSERT INTO capability_workspace_implementation_preferences (
             workspace_id,capability_id,capability_version,version,status,
             document_fingerprint_sha256,document_json,created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
          [
            preference.workspaceId,
            preference.capabilityId,
            preference.capabilityVersion,
            preference.version,
            preference.status,
            fingerprint,
            JSON.stringify(preference),
            preference.createdAt
          ]
        );
        return structuredClone(preference);
      });
    } catch (error) {
      if (error instanceof WorkspaceImplementationPreferenceError) throw error;
      throw new WorkspaceImplementationPreferenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Workspace implementation preference persistence is unavailable.',
        503,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async findCurrent(
    contextValue: Readonly<WorkspaceImplementationPreferenceContextV1>
  ): Promise<Readonly<WorkspaceImplementationPreferenceV1> | undefined> {
    const context = normalizeWorkspaceImplementationPreferenceContextV1(contextValue);
    try {
      const result = await this.query.query(
        `SELECT document_json,document_fingerprint_sha256
           FROM capability_workspace_implementation_preferences
          WHERE workspace_id=$1 AND capability_id=$2 AND capability_version=$3
          ORDER BY version DESC
          LIMIT 1`,
        [context.workspaceId, context.capabilityId, context.capabilityVersion]
      );
      return persistedPreference(result.rows[0] as Row | undefined);
    } catch (error) {
      if (error instanceof WorkspaceImplementationPreferenceError) throw error;
      throw new WorkspaceImplementationPreferenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Workspace implementation preference current-version lookup is unavailable.',
        503,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async findVersion(
    contextValue: Readonly<WorkspaceImplementationPreferenceContextV1>,
    versionValue: number
  ): Promise<Readonly<WorkspaceImplementationPreferenceV1> | undefined> {
    const context = normalizeWorkspaceImplementationPreferenceContextV1(contextValue);
    const version = exactVersion(versionValue);
    try {
      const result = await this.query.query(
        `SELECT document_json,document_fingerprint_sha256
           FROM capability_workspace_implementation_preferences
          WHERE workspace_id=$1 AND capability_id=$2 AND capability_version=$3 AND version=$4`,
        [context.workspaceId, context.capabilityId, context.capabilityVersion, version]
      );
      return persistedPreference(result.rows[0] as Row | undefined);
    } catch (error) {
      if (error instanceof WorkspaceImplementationPreferenceError) throw error;
      throw new WorkspaceImplementationPreferenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Workspace implementation preference exact-version lookup is unavailable.',
        503,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async resolve(
    context: Readonly<WorkspaceImplementationPreferenceContextV1>
  ): Promise<Readonly<GovernedWorkspaceImplementationPreferenceV1> | undefined> {
    const current = await this.findCurrent(context);
    return current ? governedWorkspaceImplementationPreferenceV1(current) : undefined;
  }
}

export class PostgresWorkspaceAwareImplementationProfileSelectorV1 implements ImplementationProfileSelector {
  private readonly policy: Readonly<GovernedImplementationSelectionPolicyV1>;

  constructor(
    private readonly registry: Readonly<DurableImplementationProfileRegistryV1>,
    policy: Readonly<GovernedImplementationSelectionPolicyV1>,
    private readonly workspacePreferences?: Readonly<WorkspaceImplementationPreferenceResolverV1>
  ) {
    this.policy = structuredClone(policy);
  }

  async select(
    request: Readonly<CapabilityRequestV2>,
    definition: Readonly<RuntimeCapabilityDefinition>
  ): Promise<GovernedImplementationSelection | undefined> {
    const snapshot = new InMemoryImplementationProfileRegistryV1(
      await this.registry.listCurrent(definition.capabilityId)
    );
    const selector = new GovernedImplementationProfileSelectorV1(
      snapshot,
      this.policy,
      this.workspacePreferences
    );
    return selector.select(request, definition);
  }
}
