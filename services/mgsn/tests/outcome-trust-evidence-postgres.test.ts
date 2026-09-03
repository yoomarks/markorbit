import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  noTrustEvidenceAuthorityConsequences,
  outcomeTrustEvidenceFixtureAtV1,
  outcomeTrustEvidenceFixtureContextV1,
  outcomeTrustEvidenceFixtureProviderIdV1,
  trustEvidenceItemFingerprintV1,
  trustEvidenceVisibilityProjectionFingerprintV1,
  type TrustEvidenceItemV1,
  type TrustEvidenceVisibilityProjectionV1
} from '@markorbit/contracts/outcome-trust-evidence';
import { ManagedDatabase } from '@markorbit/persistence';
import { createDurableMgsnServices } from '../src/durable-runtime.js';
import { PostgresOutcomeTrustEvidenceRepository } from '../src/outcome-trust-evidence-postgres.js';
import {
  OutcomeTrustEvidenceRuntimeError,
  OutcomeTrustEvidenceService,
  type TrustEvidenceCurrentAuthoritySnapshot
} from '../src/outcome-trust-evidence.js';
import { resetAndMigrateMgsnTestDatabase } from './support/mgsn-postgres-test-database.js';

const url = process.env.MGSN_TEST_DATABASE_URL;
const required = process.env.MGSN_OUTCOME_TRUST_POSTGRES_REQUIRED === '1';
if (required && !url)
  throw new Error(
    'MGSN_TEST_DATABASE_URL is required when MGSN_OUTCOME_TRUST_POSTGRES_REQUIRED=1.'
  );
const suite = url ? describe : describe.skip;
const now = outcomeTrustEvidenceFixtureAtV1;
const hash = (digit: string) => digit.repeat(64);

function authority(
  overrides: Partial<TrustEvidenceCurrentAuthoritySnapshot> = {}
): TrustEvidenceCurrentAuthoritySnapshot {
  return {
    authorityAvailable: true,
    participationActive: true,
    visibilityAuthorized: true,
    relationshipAuthorityCurrent: true,
    sourceAuthoritiesCurrent: true,
    contextMatches: true,
    executorAttributionCurrent: true,
    authorityReferences: ['authority:trust:current'],
    ...overrides
  };
}

function providerClaimItem(overrides: Partial<TrustEvidenceItemV1> = {}): TrustEvidenceItemV1 {
  const base = {
    schemaVersion: 1 as const,
    version: 1,
    providerId: outcomeTrustEvidenceFixtureProviderIdV1,
    lifecycleState: 'CURRENT' as const,
    context: outcomeTrustEvidenceFixtureContextV1,
    source: {
      kind: 'PROVIDER_CLAIM' as const,
      owner: 'MGSN' as const,
      providerReturnId: 'provider-return_fixture-trust-633' as const,
      providerReturnVersion: 1,
      providerReturnFingerprintSha256: hash('1'),
      providerReturnStatus: 'CURRENT' as const,
      claimKind: 'STRUCTURED_ASSERTION' as const,
      claimReference: 'provider-claim:fixture-633',
      submittedAt: now,
      verifiedOutcomeEstablished: false as const,
      officialTruthEstablished: false as const
    },
    sourceAuthority: {
      sourceClass: 'PROVIDER_CLAIM' as const,
      authorityState: 'CURRENT' as const,
      checkedAt: now,
      currentSourceRevalidationRequiredBeforeUse: true as const,
      historicalSourceDoesNotEstablishCurrentSuitability: true as const,
      universalPerformanceInferenceAuthorized: false as const
    },
    evidenceReferences: [],
    freshness: {
      state: 'CURRENT_FOR_CONTEXT' as const,
      policyVersion: 'trust-freshness-v1',
      checkedAt: now,
      currentSuitabilityEstablished: false as const
    },
    lineage: [],
    contradictions: [],
    limitations: [],
    currentExposureAuthorizationRequired: true as const,
    authorityConsequences: noTrustEvidenceAuthorityConsequences
  };
  const merged = { ...base, ...overrides } as Omit<
    TrustEvidenceItemV1,
    'trustEvidenceItemId' | 'trustEvidenceItemFingerprintSha256' | 'createdAt'
  >;
  const fingerprint = trustEvidenceItemFingerprintV1(merged);
  return {
    ...merged,
    trustEvidenceItemId: `trust-evidence-item_${fingerprint}`,
    trustEvidenceItemFingerprintSha256: fingerprint,
    createdAt: now
  };
}

function reference(item: TrustEvidenceItemV1) {
  return {
    trustEvidenceItemId: item.trustEvidenceItemId,
    version: item.version,
    trustEvidenceItemFingerprintSha256: item.trustEvidenceItemFingerprintSha256
  };
}

function projection(
  items: TrustEvidenceItemV1[],
  contextFingerprintSha256 = outcomeTrustEvidenceFixtureContextV1.contextFingerprintSha256
): TrustEvidenceVisibilityProjectionV1 {
  const base: Omit<
    TrustEvidenceVisibilityProjectionV1,
    'trustEvidenceVisibilityProjectionId' | 'projectionFingerprintSha256' | 'createdAt'
  > = {
    schemaVersion: 1,
    providerId: outcomeTrustEvidenceFixtureProviderIdV1,
    purpose: 'PROVIDER_DISCOVERY_TRUST_EXPLANATION',
    audience: { kind: 'BOUNDED_NETWORK' },
    contextFingerprintSha256,
    evidenceItems: items.map(reference),
    projectedFields: [
      'CONTEXT',
      'SOURCE_CLASS',
      'SOURCE_AUTHORITY_STATE',
      'FRESHNESS',
      'LIMITATIONS',
      'CONTRADICTION_STATE',
      'EXECUTOR_ATTRIBUTION_STATE'
    ],
    historicalAuthorization: {
      kind: 'NETWORK_VISIBILITY',
      networkParticipationId: 'network-participation_fixture-trust-633',
      participationVersion: 1,
      visibilityPolicyVersion: 1,
      visibilityAuthorizationReference: 'visibility:fixture-633',
      networkPurpose: 'PROVIDER_DISCOVERY',
      trustProjectionAuthorizationReference: 'trust-projection:fixture-633',
      evaluatedAt: now,
      currentAuthorityRevalidationRequiredBeforeServe: true
    },
    artifactAccessAuthorized: false,
    rawEvidenceDisclosureAuthorized: false,
    relationshipGraphDisclosureAuthorized: false,
    clientDataDisclosureAuthorized: false,
    commercialDataDisclosureAuthorized: false,
    currentAuthorityRevalidationRequiredBeforeServe: true,
    authorityConsequences: noTrustEvidenceAuthorityConsequences
  };
  const fingerprint = trustEvidenceVisibilityProjectionFingerprintV1(base);
  return {
    ...base,
    trustEvidenceVisibilityProjectionId: `trust-evidence-projection_${fingerprint}`,
    projectionFingerprintSha256: fingerprint,
    createdAt: now
  };
}

suite('MGSN P0 #633 durable Outcome & Trust Evidence', () => {
  const namespace = 'mgsn_outcome_trust_633_test';
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: namespace,
    poolMaximum: 12,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: namespace
  });
  const repository = () => new PostgresOutcomeTrustEvidenceRepository(database, database.getPool());
  const service = (snapshot = authority()) =>
    new OutcomeTrustEvidenceService(
      repository(),
      { evaluateCurrentAuthority: () => Promise.resolve(snapshot) },
      () => now
    );

  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMgsnTestDatabase({
      pool: database.getPool(),
      namespace,
      migrationsDirectory: path.resolve('../../infrastructure/persistence/migrations'),
      migrationOwners: path.resolve('../../infrastructure/persistence/migration-owners.json')
    });
  });

  beforeEach(async () => {
    await database.getPool().query(
      `TRUNCATE
        mgsn_trust_evidence_owner_audit_events,
        mgsn_trust_explanations,
        mgsn_trust_evidence_visibility_projections,
        mgsn_trust_evidence_items,
        mgsn_provider_registry_audit,
        mgsn_provider_registry_commands,
        mgsn_provider_supply_capabilities,
        mgsn_providers
       RESTART IDENTITY CASCADE`
    );
    await database.getPool().query(
      `INSERT INTO mgsn_providers(
         provider_id,provider_workspace_id,display_name,operational_status,version,provider_record,
         created_by,updated_by,created_at,updated_at
       ) VALUES($1,$2,'Trust Provider 633','ACTIVE',1,$3::jsonb,$4,$4,$5,$5)`,
      [
        outcomeTrustEvidenceFixtureProviderIdV1,
        '63300000-0000-4000-8000-000000000001',
        JSON.stringify({ providerId: outcomeTrustEvidenceFixtureProviderIdV1 }),
        'actor:trust-633',
        now
      ]
    );
  });

  afterAll(() => database.close());

  it('round-trips exact evidence, projection and explanation across repository restart with idempotent audit', async () => {
    const runtime = service();
    const item = providerClaimItem();
    const projected = projection([item]);
    await runtime.recordEvidenceItem(item);
    await runtime.recordVisibilityProjection(projected);
    const explanation = await runtime.explain(projected.trustEvidenceVisibilityProjectionId);

    const restarted = repository();
    await expect(restarted.findEvidenceItem(reference(item))).resolves.toEqual(item);
    await expect(
      restarted.findProjection(projected.trustEvidenceVisibilityProjectionId)
    ).resolves.toEqual(projected);
    await expect(restarted.findExplanation(explanation.trustExplanationId)).resolves.toEqual(
      explanation
    );

    await restarted.putEvidenceItem(item);
    await restarted.putProjection(projected);
    await restarted.putExplanation(explanation);
    const audits = await database
      .getPool()
      .query(
        'SELECT object_type,action FROM mgsn_trust_evidence_owner_audit_events ORDER BY audit_id'
      );
    expect(audits.rows).toEqual([
      { object_type: 'EVIDENCE_ITEM', action: 'EVIDENCE_ITEM_RECORDED' },
      { object_type: 'VISIBILITY_PROJECTION', action: 'VISIBILITY_PROJECTION_RECORDED' },
      { object_type: 'TRUST_EXPLANATION', action: 'TRUST_EXPLANATION_RECORDED' }
    ]);
  });

  it('preserves an empty projection as durable INSUFFICIENT_EVIDENCE without negative Provider inference', async () => {
    const runtime = service();
    const projected = projection([]);
    await runtime.recordVisibilityProjection(projected);
    const explanation = await runtime.explain(projected.trustEvidenceVisibilityProjectionId);

    expect(explanation.result).toBe('INSUFFICIENT_EVIDENCE');
    expect(explanation.evidenceItems).toEqual([]);
    expect(explanation.summary).toContain('no negative Provider inference');
    await expect(repository().findExplanation(explanation.trustExplanationId)).resolves.toEqual(
      explanation
    );
  });

  it('keeps disputed evidence representable without score, rank or winner', async () => {
    const runtime = service();
    const item = providerClaimItem({ lifecycleState: 'DISPUTED' });
    const projected = projection([item]);
    await runtime.recordEvidenceItem(item);
    await runtime.recordVisibilityProjection(projected);
    const explanation = await runtime.explain(projected.trustEvidenceVisibilityProjectionId);

    expect(explanation).toMatchObject({
      result: 'DISPUTED_EVIDENCE',
      universalScoreCreated: false,
      rankCreated: false,
      winnerCreated: false,
      authorityConsequences: noTrustEvidenceAuthorityConsequences
    });
  });

  it('rejects divergent immutable writes and all append-only UPDATE/DELETE mutation attempts', async () => {
    const item = providerClaimItem();
    await repository().putEvidenceItem(item);
    const divergent = {
      ...item,
      createdAt: '2026-08-26T10:01:00.000Z'
    };
    await expect(repository().putEvidenceItem(divergent)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      status: 409
    });

    for (const statement of [
      'UPDATE mgsn_trust_evidence_items SET created_at=created_at',
      'DELETE FROM mgsn_trust_evidence_items',
      'UPDATE mgsn_trust_evidence_owner_audit_events SET occurred_at=occurred_at',
      'DELETE FROM mgsn_trust_evidence_owner_audit_events'
    ]) {
      await expect(database.getPool().query(statement)).rejects.toThrow(/append-only/u);
    }
  });

  it('enforces exact same-Provider/context projection lineage and exact audit target integrity', async () => {
    const item = providerClaimItem();
    await repository().putEvidenceItem(item);
    const wrongContext = projection([item], hash('9'));
    await expect(service().recordVisibilityProjection(wrongContext)).rejects.toBeInstanceOf(
      OutcomeTrustEvidenceRuntimeError
    );

    await expect(
      database.getPool().query(
        `INSERT INTO mgsn_trust_evidence_owner_audit_events(
           object_type,target_id,target_version,target_fingerprint_sha256,provider_id,action,occurred_at
         ) VALUES('EVIDENCE_ITEM','trust-evidence-item_missing',1,$1,$2,'EVIDENCE_ITEM_RECORDED',$3)`,
        [hash('f'), outcomeTrustEvidenceFixtureProviderIdV1, now]
      )
    ).rejects.toThrow(/exact persisted evidence item/u);
  });

  it('fails closed when persisted canonical explanation is malformed despite normalized lineage remaining intact', async () => {
    const runtime = service();
    const item = providerClaimItem();
    const projected = projection([item]);
    await runtime.recordEvidenceItem(item);
    await runtime.recordVisibilityProjection(projected);
    const explanation = await runtime.explain(projected.trustEvidenceVisibilityProjectionId);

    await database
      .getPool()
      .query(
        'ALTER TABLE mgsn_trust_explanations DISABLE TRIGGER mgsn_trust_explanations_append_only'
      );
    try {
      await database.getPool().query(
        `UPDATE mgsn_trust_explanations
         SET explanation_record=jsonb_set(explanation_record,'{summary}','""'::jsonb)
         WHERE trust_explanation_id=$1`,
        [explanation.trustExplanationId]
      );
    } finally {
      await database
        .getPool()
        .query(
          'ALTER TABLE mgsn_trust_explanations ENABLE TRIGGER mgsn_trust_explanations_append_only'
        );
    }

    await expect(
      repository().findExplanation(explanation.trustExplanationId)
    ).rejects.toMatchObject({
      code: 'AUTHORITY_UNAVAILABLE',
      status: 503
    });
  });

  it('durable runtime revalidates current exposure and never treats persisted history as serving authority', async () => {
    const durable = createDurableMgsnServices({
      database,
      coreUrl: 'http://core.invalid',
      executionUrl: 'http://execution.invalid',
      internalServiceSecret: 'test-only'
    });
    const item = providerClaimItem();
    const projected = projection([item]);
    await durable.outcomeTrustEvidence.recordEvidenceItem(item);
    await durable.outcomeTrustEvidence.recordVisibilityProjection(projected);

    await expect(
      durable.outcomeTrustEvidence.validateCurrentExposure(
        projected.trustEvidenceVisibilityProjectionId
      )
    ).resolves.toMatchObject({
      decision: 'DENY',
      reason: 'PARTICIPATION_NOT_ACTIVE',
      artifactAccessAuthorized: false,
      authorityConsequences: noTrustEvidenceAuthorityConsequences
    });
  });
});
