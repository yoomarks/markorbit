import { createHash } from 'node:crypto';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type {
  CapabilityRequestV2,
  ImplementationProfile
} from '@markorbit/contracts/capability-runtime';
import type { QueryClient } from '@markorbit/persistence';
import type {
  GovernedImplementationSelection,
  ImplementationProfileSelector
} from './capability-runtime.js';
import {
  GovernedImplementationProfileSelectorV1,
  ImplementationProfileRegistryError,
  InMemoryImplementationProfileRegistryV1,
  normalizeImplementationProfileV1,
  type GovernedImplementationSelectionPolicyV1
} from './implementation-profile-registry.js';

const PROFILE_ID = /^implementation-profile_[A-Za-z0-9][A-Za-z0-9._:-]*$/u;

type Row = Record<string, unknown>;

export type DurableImplementationProfileRegistryErrorCode =
  'PERSISTENCE_UNAVAILABLE' | 'INVALID_PERSISTED_PROFILE';

export class DurableImplementationProfileRegistryError extends Error {
  constructor(
    readonly code: DurableImplementationProfileRegistryErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'DurableImplementationProfileRegistryError';
  }
}

export interface ImplementationProfileRegistryTransactionHostV1 {
  transact<T>(callback: (client: QueryClient) => Promise<T>): Promise<T>;
}

export interface DurableImplementationProfileRegistryV1 {
  register(value: unknown): Promise<Readonly<ImplementationProfile>>;
  findCurrent(
    implementationProfileId: string
  ): Promise<Readonly<ImplementationProfile> | undefined>;
  findVersion(
    implementationProfileId: string,
    version: number
  ): Promise<Readonly<ImplementationProfile> | undefined>;
  listCurrent(capabilityId?: string): Promise<readonly Readonly<ImplementationProfile>[]>;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(profile: Readonly<ImplementationProfile>): string {
  return createHash('sha256').update(stableSerialize(profile)).digest('hex');
}

function profileId(value: unknown): string {
  if (typeof value !== 'string')
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      'implementationProfileId must be a string.',
      422
    );
  const cleaned = value.trim();
  if (!PROFILE_ID.test(cleaned))
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      'implementationProfileId is invalid.',
      422
    );
  return cleaned;
}

function capabilityId(value: unknown): string {
  if (typeof value !== 'string')
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      'capabilityId must be a string.',
      422
    );
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > 300)
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      'capabilityId must contain 1 to 300 characters.',
      422
    );
  return cleaned;
}

function exactVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000)
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      'Implementation Profile version must be a positive safe integer not exceeding 1000000.',
      422
    );
  return value;
}

function persistedProfile(row: Row | undefined): Readonly<ImplementationProfile> | undefined {
  if (!row) return undefined;
  const document = row.document_json;
  const persistedFingerprint = row.document_fingerprint_sha256;
  if (
    typeof document !== 'object' ||
    document === null ||
    Array.isArray(document) ||
    typeof persistedFingerprint !== 'string'
  )
    throw new DurableImplementationProfileRegistryError(
      'INVALID_PERSISTED_PROFILE',
      'Persisted Implementation Profile document is invalid.'
    );
  try {
    const profile = normalizeImplementationProfileV1(document);
    if (fingerprint(profile) !== persistedFingerprint)
      throw new DurableImplementationProfileRegistryError(
        'INVALID_PERSISTED_PROFILE',
        'Persisted Implementation Profile fingerprint does not match its governed document.'
      );
    return structuredClone(profile);
  } catch (error) {
    if (error instanceof DurableImplementationProfileRegistryError) throw error;
    throw new DurableImplementationProfileRegistryError(
      'INVALID_PERSISTED_PROFILE',
      'Persisted Implementation Profile failed governed validation.',
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

function sameIdentityLineage(row: Row, profile: Readonly<ImplementationProfile>): boolean {
  return (
    row.implementation_profile_id === profile.implementationProfileId &&
    row.implementation_key === profile.implementationKey &&
    row.capability_id === profile.capabilityId &&
    row.capability_version === profile.capabilityVersion &&
    row.kind === profile.kind &&
    row.input_schema_id === profile.inputSchemaId &&
    row.output_schema_id === profile.outputSchemaId
  );
}

export class PostgresImplementationProfileRegistryV1 implements DurableImplementationProfileRegistryV1 {
  constructor(
    private readonly database: ImplementationProfileRegistryTransactionHostV1,
    private readonly query: QueryClient
  ) {}

  async register(value: unknown): Promise<Readonly<ImplementationProfile>> {
    const profile = normalizeImplementationProfileV1(value);
    const documentFingerprintSha256 = fingerprint(profile);
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `implementation-profile:${profile.implementationProfileId}`
        ]);
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          `implementation-key:${profile.implementationKey}`
        ]);

        const keyOwnerResult = await client.query(
          `SELECT implementation_profile_id
             FROM capability_implementation_profile_identities
            WHERE implementation_key=$1`,
          [profile.implementationKey]
        );
        const keyOwner = keyOwnerResult.rows[0] as Row | undefined;
        if (keyOwner && keyOwner.implementation_profile_id !== profile.implementationProfileId)
          throw new ImplementationProfileRegistryError(
            'IMPLEMENTATION_KEY_CONFLICT',
            'An implementation key can belong to only one Implementation Profile lineage.'
          );

        const identityResult = await client.query(
          `SELECT implementation_profile_id,implementation_key,capability_id,capability_version,
                  kind,input_schema_id,output_schema_id
             FROM capability_implementation_profile_identities
            WHERE implementation_profile_id=$1
            FOR UPDATE`,
          [profile.implementationProfileId]
        );
        const identity = identityResult.rows[0] as Row | undefined;
        if (identity && !sameIdentityLineage(identity, profile))
          throw new ImplementationProfileRegistryError(
            'PROFILE_LINEAGE_CONFLICT',
            'Implementation Profile versions cannot change capability, implementation key, kind, or schema lineage.'
          );

        const exactResult = await client.query(
          `SELECT document_json,document_fingerprint_sha256
             FROM capability_implementation_profile_versions
            WHERE implementation_profile_id=$1 AND version=$2`,
          [profile.implementationProfileId, profile.version]
        );
        const exactRow = exactResult.rows[0] as Row | undefined;
        if (exactRow) {
          if (exactRow.document_fingerprint_sha256 !== documentFingerprintSha256)
            throw new ImplementationProfileRegistryError(
              'PROFILE_VERSION_CONFLICT',
              'Implementation Profile version is immutable and conflicts with the registered document.'
            );
          const replay = persistedProfile(exactRow);
          if (!replay)
            throw new DurableImplementationProfileRegistryError(
              'INVALID_PERSISTED_PROFILE',
              'Persisted Implementation Profile replay disappeared unexpectedly.'
            );
          return replay;
        }

        const currentResult = await client.query(
          `SELECT version
             FROM capability_implementation_profile_versions
            WHERE implementation_profile_id=$1
            ORDER BY version DESC
            LIMIT 1`,
          [profile.implementationProfileId]
        );
        const currentRow = currentResult.rows[0] as Row | undefined;
        if (currentRow && Number(currentRow.version) >= profile.version)
          throw new ImplementationProfileRegistryError(
            'PROFILE_VERSION_CONFLICT',
            'A new Implementation Profile version must advance the current immutable version line.'
          );

        if (!identity)
          await client.query(
            `INSERT INTO capability_implementation_profile_identities (
               implementation_profile_id,implementation_key,capability_id,capability_version,
               kind,input_schema_id,output_schema_id,created_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              profile.implementationProfileId,
              profile.implementationKey,
              profile.capabilityId,
              profile.capabilityVersion,
              profile.kind,
              profile.inputSchemaId,
              profile.outputSchemaId,
              profile.createdAt
            ]
          );

        await client.query(
          `INSERT INTO capability_implementation_profile_versions (
             implementation_profile_id,version,status,document_fingerprint_sha256,document_json,created_at
           ) VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
          [
            profile.implementationProfileId,
            profile.version,
            profile.status,
            documentFingerprintSha256,
            JSON.stringify(profile),
            profile.createdAt
          ]
        );
        return structuredClone(profile);
      });
    } catch (error) {
      if (
        error instanceof ImplementationProfileRegistryError ||
        error instanceof DurableImplementationProfileRegistryError
      )
        throw error;
      throw new DurableImplementationProfileRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Implementation Profile registry persistence is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async findCurrent(
    implementationProfileIdValue: string
  ): Promise<Readonly<ImplementationProfile> | undefined> {
    const implementationProfileId = profileId(implementationProfileIdValue);
    try {
      const result = await this.query.query(
        `SELECT document_json,document_fingerprint_sha256
           FROM capability_implementation_profile_versions
          WHERE implementation_profile_id=$1
          ORDER BY version DESC
          LIMIT 1`,
        [implementationProfileId]
      );
      return persistedProfile(result.rows[0] as Row | undefined);
    } catch (error) {
      if (
        error instanceof ImplementationProfileRegistryError ||
        error instanceof DurableImplementationProfileRegistryError
      )
        throw error;
      throw new DurableImplementationProfileRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Implementation Profile current-version lookup is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async findVersion(
    implementationProfileIdValue: string,
    versionValue: number
  ): Promise<Readonly<ImplementationProfile> | undefined> {
    const implementationProfileId = profileId(implementationProfileIdValue);
    const version = exactVersion(versionValue);
    try {
      const result = await this.query.query(
        `SELECT document_json,document_fingerprint_sha256
           FROM capability_implementation_profile_versions
          WHERE implementation_profile_id=$1 AND version=$2`,
        [implementationProfileId, version]
      );
      return persistedProfile(result.rows[0] as Row | undefined);
    } catch (error) {
      if (
        error instanceof ImplementationProfileRegistryError ||
        error instanceof DurableImplementationProfileRegistryError
      )
        throw error;
      throw new DurableImplementationProfileRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Implementation Profile exact-version lookup is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async listCurrent(
    capabilityIdValue?: string
  ): Promise<readonly Readonly<ImplementationProfile>[]> {
    const selectedCapabilityId =
      capabilityIdValue === undefined ? undefined : capabilityId(capabilityIdValue);
    try {
      const result = selectedCapabilityId
        ? await this.query.query(
            `SELECT DISTINCT ON (versions.implementation_profile_id)
                    versions.implementation_profile_id,versions.document_json,
                    versions.document_fingerprint_sha256
               FROM capability_implementation_profile_versions AS versions
               JOIN capability_implementation_profile_identities AS identities
                 ON identities.implementation_profile_id=versions.implementation_profile_id
              WHERE identities.capability_id=$1
              ORDER BY versions.implementation_profile_id,versions.version DESC`,
            [selectedCapabilityId]
          )
        : await this.query.query(
            `SELECT DISTINCT ON (implementation_profile_id)
                    implementation_profile_id,document_json,document_fingerprint_sha256
               FROM capability_implementation_profile_versions
              ORDER BY implementation_profile_id,version DESC`
          );
      return result.rows
        .map((row) => persistedProfile(row as Row))
        .filter((profile): profile is Readonly<ImplementationProfile> => profile !== undefined)
        .sort((left, right) =>
          left.implementationProfileId.localeCompare(right.implementationProfileId)
        );
    } catch (error) {
      if (
        error instanceof ImplementationProfileRegistryError ||
        error instanceof DurableImplementationProfileRegistryError
      )
        throw error;
      throw new DurableImplementationProfileRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Implementation Profile current-version listing is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}

export class PostgresGovernedImplementationProfileSelectorV1 implements ImplementationProfileSelector {
  private readonly policy: Readonly<GovernedImplementationSelectionPolicyV1>;

  constructor(
    private readonly registry: Readonly<DurableImplementationProfileRegistryV1>,
    policy: Readonly<GovernedImplementationSelectionPolicyV1>
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
    const selector = new GovernedImplementationProfileSelectorV1(snapshot, this.policy);
    return selector.select(request, definition);
  }
}
