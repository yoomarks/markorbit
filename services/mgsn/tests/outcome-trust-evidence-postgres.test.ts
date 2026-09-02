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
import { OutcomeTrustEvidenceService } from '../src/outcome-trust-evidence.js';
import { PostgresOutcomeTrustEvidenceRepository } from '../src/outcome-trust-evidence-postgres.js';
import { resetAndMigrateMgsnTestDatabase } from './support/mgsn-postgres-test-database.js';

const url = process.env.MGSN_TEST_DATABASE_URL;
const required = process.env.MGSN_OUTCOME_TRUST_EVIDENCE_POSTGRES_REQUIRED === '1';
if (required && !url) {
  throw new Error(
    'MGSN_TEST_DATABASE_URL is required when MGSN_OUTCOME_TRUST_EVIDENCE_POSTGRES_REQUIRED=1.'
  );
}
const suite = url ? describe : describe.skip;
const now = outcomeTrustEvidenceFixtureAtV1;
const providerId = outcomeTrustEvidenceFixtureProviderIdV1;
const hash = (digit: string) => digit.repeat(64);

function providerClaimItem(
  overrides: Partial<TrustEvidenceItemV1> = {}
): TrustEvidenceItemV1 {
  const base = {
    schemaVersion: 1 as const,
    version: 1,
    providerId,
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

function projection(items: TrustEvidenceItemV1[]): TrustEvidenceVisibilityProjectionV1 {
  const base: Omit<
    TrustEvidenceVisibilityProjectionV1,
    'trustEvidenceVisibilityProjectionId' | 'projectionFingerprintSha256' | 'createdAt'
  > = {
    schemaVersion: 1,
    providerId,
    purpose: 'PROVIDER_DISCOVERY_TRUST_EXPLANATION',
    audience: { kind: 'BOUNDED_NETWORK' },
    contextFingerprintSha256: outcomeTrustEvidenceFixtureContextV1.contextFingerprintSha256,
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
  const namespace = 'mgsn_outcome_trust_evidence_633_test';
  const database = new ManagedDatabase({
    connection: { url: url! },
    applicationName: namespace,
    poolMaximum: 8,
    connectionTimeoutMs: 2000,
    idleTimeoutMs: 2000,
    statementTimeoutMs: 5000,
    sslMode: 'disable',
    migrationNamespace: namespace
  });

  const repository = () =>
    new PostgresOutcomeTrustEvidenceRepository(database, database.getPool());
  const service = () =>
    new OutcomeTrustEvidenceService(
      repository(),
      {
        evaluateCurrentAuthority: () =>
          Promise.resolve({
            authorityAvailable: true,
            participationActive: true,
            visibilityAuthorized: true,
            relationshipAuthorityCurrent: true,
            sourceAuthoritiesCurrent: true,
            contextMatches: true,
            executorAttributionCurrent: true,
            authorityReferences: ['authority:trust:633']
          })
      },
      () => now
    );

  async function auditCount() {
    const result = await database
      .getPool()
      .query('SELECT count(*)::int AS count FROM mgsn_trust_evidence_owner_audit_events');
    return Number(result.rows[0]?.count ?? 0);
  }

  async function seedProvider() {
    await database.getPool().query(
      `INSERT INTO mgsn_providers(
         provider_id,provider_workspace_id,display_name,operational_status,version,provider_record,
         created_by,updated_by,created_at,updated_at
       ) VALUES($1,$2,'Trust Evidence Provider 633','ACTIVE',1,$3::jsonb,$4,$4,$5,$5)`,
      [
        providerId,
        '11111111-1111-4111-8111-111111111633',
        JSON.stringify({ providerId }),
        'user_trust_633',
        now
      ]
    );
  }

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
         mgsn_providers
       RESTART IDENTITY CASCADE`
    );
    await seedProvider();
  });

  afterAll(() => database.close());

  it('persists exact evidence, projection and explanation across repository restart with singular audit replay', async () => {
    const first = service();
    const item = providerClaimItem();
    const savedItem = await first.recordEvidenceItem(item);
    const savedProjection = await first.recordVisibilityProjection(projection([item]));
    const savedExplanation = await first.explain(
      savedProjection.trustEvidenceVisibilityProjectionId
    );

    expect(savedExplanation.result).toBe('EVIDENCE_AVAILABLE');
    expect(savedExplanation.limitations).toContainEqual(
      expect.objectContaining({ code: 'CLAIM_NOT_VERIFIED_OUTCOME' })
    );
    expect(await auditCount()).toBe(3);

    const restarted = repository();
    expect(await restarted.findEvidenceItem(reference(item))).toEqual(savedItem);
    expect(
      await restarted.findProjection(savedProjection.trustEvidenceVisibilityProjectionId)
    ).toEqual(savedProjection);
    expect(await restarted.findExplanation(savedExplanation.trustExplanationId)).toEqual(
      savedExplanation
    );

    await restarted.putEvidenceItem(savedItem);
    await restarted.putProjection(savedProjection);
    await restarted.putExplanation(savedExplanation);
    expect(await auditCount()).toBe(3);
  });

  it('durably represents an empty projection as insufficient evidence instead of negative Provider truth', async () => {
    const runtime = service();
    const savedProjection = await runtime.recordVisibilityProjection(projection([]));
    const explanation = await runtime.explain(savedProjection.trustEvidenceVisibilityProjectionId);

    expect(explanation.result).toBe('INSUFFICIENT_EVIDENCE');
    expect(explanation.evidenceItems).toEqual([]);
    expect(explanation.summary).toContain('no negative Provider inference');
    expect(explanation.authorityConsequences).toEqual(noTrustEvidenceAuthorityConsequences);

    const restarted = repository();
    expect(await restarted.findExplanation(explanation.trustExplanationId)).toEqual(explanation);
  });

  it('keeps durable production composition fail-closed when current exposure authority is not configured', async () => {
    const services = createDurableMgsnServices({
      database,
      coreUrl: 'http://127.0.0.1:1',
      executionUrl: 'http://127.0.0.1:1',
      internalServiceSecret: 'x'.repeat(32)
    });
    const savedProjection = await services.outcomeTrustEvidence.recordVisibilityProjection(
      projection([])
    );
    const validation = await services.outcomeTrustEvidence.validateCurrentExposure(
      savedProjection.trustEvidenceVisibilityProjectionId
    );

    expect(validation).toMatchObject({
      decision: 'DENY',
      reason: 'AUTHORITY_UNAVAILABLE',
      artifactAccessAuthorized: false,
      authorityConsequences: noTrustEvidenceAuthorityConsequences
    });
  });

  it('relies on append-only database guards and refuses mutation or deletion of canonical evidence', async () => {
    const item = providerClaimItem();
    await service().recordEvidenceItem(item);

    await expect(
      database
        .getPool()
        .query(
          `UPDATE mgsn_trust_evidence_items SET lifecycle_state='DISPUTED'
           WHERE trust_evidence_item_id=$1 AND version=$2`,
          [item.trustEvidenceItemId, item.version]
        )
    ).rejects.toThrow(/append-only/u);
    await expect(
      database
        .getPool()
        .query(
          'DELETE FROM mgsn_trust_evidence_items WHERE trust_evidence_item_id=$1 AND version=$2',
          [item.trustEvidenceItemId, item.version]
        )
    ).rejects.toThrow(/append-only/u);
  });
});
