import type { ManagedDatabase, QueryClient } from '@markorbit/persistence';
import {
  OFFICIAL_FEE_PILOT_OPERATION,
  OfficialFeeReferenceStoreError,
  prepareOfficialFeeMaterialization,
  type OfficialFeeMaterializationInputV1,
  type OfficialFeeReferenceId,
  type OfficialFeeReferenceV1,
  type OfficialFeeResolutionQueryV1
} from './official-fee-reference-store.js';

type ReferenceRow = { reference_json: unknown };
type ReplayRow = {
  reference_id: string;
  materialization_fingerprint_sha256: string;
  reference_json: unknown;
};

function pgCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function persistenceFailure(error: unknown): never {
  if (error instanceof OfficialFeeReferenceStoreError) throw error;
  if (pgCode(error) === '23505')
    throw new OfficialFeeReferenceStoreError('CONFLICT', 'Official fee reference already exists.');
  throw new OfficialFeeReferenceStoreError(
    'PERSISTENCE_UNAVAILABLE',
    'Official fee reference persistence is unavailable.'
  );
}

function stored(value: unknown): OfficialFeeReferenceV1 {
  const row = value as OfficialFeeReferenceV1;
  if (
    !row ||
    row.schemaVersion !== 1 ||
    !row.referenceId?.startsWith('official-fee-ref_') ||
    row.operation !== OFFICIAL_FEE_PILOT_OPERATION ||
    row.jurisdiction !== 'US' ||
    row.authority !== 'USPTO' ||
    (row.status !== 'CURRENT' && row.status !== 'STALE')
  )
    throw new OfficialFeeReferenceStoreError(
      'PERSISTENCE_UNAVAILABLE',
      'Stored official fee reference is invalid.'
    );
  return structuredClone(row);
}

async function lock(client: QueryClient): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('core:official-fee-pilot', 0))");
}

export class PostgresOfficialFeeReferenceStore {
  constructor(private readonly database: ManagedDatabase) {}

  async materialize(
    input: Readonly<OfficialFeeMaterializationInputV1>
  ): Promise<Readonly<OfficialFeeReferenceV1>> {
    const prepared = prepareOfficialFeeMaterialization(input);
    try {
      return await this.database.transact(async (client) => {
        await lock(client);
        const replay = await client.query<ReplayRow>(
          `SELECT reference_id,materialization_fingerprint_sha256,reference_json
             FROM official_fee_references
            WHERE replay_identity_fingerprint_sha256=$1
            LIMIT 1`,
          [prepared.replayIdentityFingerprintSha256]
        );
        const existing = replay.rows[0];
        if (existing) {
          if (
            existing.materialization_fingerprint_sha256 !==
            prepared.reference.materializationFingerprintSha256
          )
            throw new OfficialFeeReferenceStoreError(
              'CONFLICT',
              'The same source/method replay identity produced a different fee payload.',
              { referenceId: existing.reference_id }
            );
          return stored(existing.reference_json);
        }

        await client.query(
          `UPDATE official_fee_references
              SET status='STALE',
                  reference_json=jsonb_set(reference_json,'{status}','"STALE"'::jsonb,false)
            WHERE operation=$1 AND jurisdiction='US' AND authority='USPTO' AND status='CURRENT'`,
          [OFFICIAL_FEE_PILOT_OPERATION]
        );
        const reference = prepared.reference;
        await client.query(
          `INSERT INTO official_fee_references(
             reference_id,operation,jurisdiction,authority,status,effective_from,effective_to,
             package_id,method_id,method_version_id,source_identity_fingerprint_sha256,
             replay_identity_fingerprint_sha256,materialization_fingerprint_sha256,reference_json,
             materialized_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)`,
          [
            reference.referenceId,
            reference.operation,
            reference.jurisdiction,
            reference.authority,
            reference.status,
            reference.effectiveFrom,
            reference.effectiveTo ?? null,
            reference.packageId,
            reference.methodId,
            reference.methodVersionId,
            reference.sourceIdentityFingerprintSha256,
            prepared.replayIdentityFingerprintSha256,
            reference.materializationFingerprintSha256,
            JSON.stringify(reference),
            reference.materializedAt
          ]
        );
        return structuredClone(reference);
      });
    } catch (error) {
      persistenceFailure(error);
    }
  }

  async get(referenceId: OfficialFeeReferenceId): Promise<Readonly<OfficialFeeReferenceV1> | undefined> {
    try {
      const result = await this.database
        .getPool()
        .query<ReferenceRow>('SELECT reference_json FROM official_fee_references WHERE reference_id=$1', [
          referenceId
        ]);
      return result.rows[0] ? stored(result.rows[0].reference_json) : undefined;
    } catch (error) {
      persistenceFailure(error);
    }
  }

  async resolveCurrent(
    query: Readonly<OfficialFeeResolutionQueryV1>
  ): Promise<Readonly<OfficialFeeReferenceV1>> {
    if (
      query.operation !== OFFICIAL_FEE_PILOT_OPERATION ||
      query.jurisdiction !== 'US' ||
      query.authority !== 'USPTO'
    )
      throw new OfficialFeeReferenceStoreError(
        'NO_CURRENT_REFERENCE',
        'Resolution query is outside the frozen official-fee pilot scope.'
      );
    if (Number.isNaN(Date.parse(query.asOf)))
      throw new OfficialFeeReferenceStoreError('INVALID_INPUT', 'asOf must be an ISO date/time.');
    try {
      const result = await this.database.getPool().query<ReferenceRow>(
        `SELECT reference_json
           FROM official_fee_references
          WHERE operation=$1 AND jurisdiction='US' AND authority='USPTO' AND status='CURRENT'
            AND effective_from <= $2
            AND (effective_to IS NULL OR $2 < effective_to)
          ORDER BY materialized_at DESC`,
        [OFFICIAL_FEE_PILOT_OPERATION, query.asOf]
      );
      if (!result.rows.length)
        throw new OfficialFeeReferenceStoreError(
          'NO_CURRENT_REFERENCE',
          'No CURRENT official fee reference is effective for the requested time.'
        );
      if (result.rows.length > 1)
        throw new OfficialFeeReferenceStoreError(
          'AMBIGUOUS_CURRENT_REFERENCE',
          'Multiple CURRENT official fee references are effective for the requested time.'
        );
      return stored(result.rows[0]!.reference_json);
    } catch (error) {
      persistenceFailure(error);
    }
  }
}
