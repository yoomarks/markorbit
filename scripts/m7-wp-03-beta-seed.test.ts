import { describe, expect, it } from 'vitest';
import { readM7Wp03BetaSeedConfig, resetAndSeedM7Wp03BetaScenario } from './m7-wp-03-beta-seed.js';

const visibleSeedUrls = {
  MARKORBIT_BETA_SEED_CORE_DATABASE_URL:
    'postgresql://seed:seed@127.0.0.1:5432/markorbit_wp03_core',
  MARKORBIT_BETA_SEED_LITE_DATABASE_URL:
    'postgresql://seed:seed@127.0.0.1:5432/markorbit_wp03_lite',
  MARKORBIT_BETA_SEED_MARKREG_DATABASE_URL:
    'postgresql://seed:seed@127.0.0.1:5432/markorbit_wp03_markreg',
  MARKORBIT_BETA_SEED_EXECUTION_DATABASE_URL:
    'postgresql://seed:seed@127.0.0.1:5432/markorbit_wp03_execution',
  MARKORBIT_BETA_SEED_CAPABILITY_DATABASE_URL:
    'postgresql://seed:seed@127.0.0.1:5432/markorbit_wp03_capability'
} as const;

function syntheticEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    MARKORBIT_BETA_SEED_ENABLED: '1',
    MARKORBIT_BETA_SEED_ENVIRONMENT: 'TEST',
    NODE_ENV: 'test',
    ...visibleSeedUrls,
    ...overrides
  };
}

describe('M7-WP-03 deterministic Beta seed guards', () => {
  it('fails closed without explicit enablement', () => {
    expect(() =>
      readM7Wp03BetaSeedConfig(syntheticEnv({ MARKORBIT_BETA_SEED_ENABLED: undefined }))
    ).toThrow(/disabled/iu);
  });

  it('refuses production even when explicitly enabled', () => {
    expect(() => readM7Wp03BetaSeedConfig(syntheticEnv({ NODE_ENV: 'production' }))).toThrow(
      /production/iu
    );
  });

  it('accepts only TEST or REHEARSAL', () => {
    expect(() =>
      readM7Wp03BetaSeedConfig(syntheticEnv({ MARKORBIT_BETA_SEED_ENVIRONMENT: 'development' }))
    ).toThrow(/TEST or REHEARSAL/iu);
  });

  it('refuses databases that are not visibly non-production', () => {
    expect(() =>
      readM7Wp03BetaSeedConfig(
        syntheticEnv({
          MARKORBIT_BETA_SEED_CORE_DATABASE_URL: 'postgresql://seed:seed@127.0.0.1:5432/markorbit'
        })
      )
    ).toThrow(/visibly non-production/iu);
  });

  it('requires database-per-owner isolation', () => {
    expect(() =>
      readM7Wp03BetaSeedConfig(
        syntheticEnv({
          MARKORBIT_BETA_SEED_LITE_DATABASE_URL:
            visibleSeedUrls.MARKORBIT_BETA_SEED_CORE_DATABASE_URL
        })
      )
    ).toThrow(/distinct PostgreSQL database/iu);
  });
});

const integrationConfigured = [
  'MARKORBIT_BETA_SEED_CORE_DATABASE_URL',
  'MARKORBIT_BETA_SEED_LITE_DATABASE_URL',
  'MARKORBIT_BETA_SEED_MARKREG_DATABASE_URL',
  'MARKORBIT_BETA_SEED_EXECUTION_DATABASE_URL',
  'MARKORBIT_BETA_SEED_CAPABILITY_DATABASE_URL'
].every((key) => Boolean(process.env[key]));

const integration = integrationConfigured ? it : it.skip;

describe('M7-WP-03 real PostgreSQL reset and reseed', () => {
  integration('recreates an identical bounded scenario on replay', async () => {
    const config = readM7Wp03BetaSeedConfig(process.env);
    const first = await resetAndSeedM7Wp03BetaScenario(config);
    const second = await resetAndSeedM7Wp03BetaScenario(config);

    expect(second).toEqual(first);
    expect(first.owners).toHaveLength(5);
    expect(first.owners.every((owner) => owner.databaseSeparated)).toBe(true);
    expect(first.owners.every((owner) => owner.resetBeforeSeed)).toBe(true);
    expect(first.boundary).toMatchObject({
      kind: 'SEEDED_DEMO_RECORD',
      nonProduction: true,
      customerTruth: false,
      providerTruth: false,
      officialTruth: false
    });
    expect(first.records.content.externalUseVerified).toBe(false);
    expect(first.records.opportunity).toMatchObject({
      qualificationOutcome: 'QUALIFIED_FOR_MARKREG',
      formalOpportunityStatus: 'HANDED_OFF_TO_INTAKE',
      intakeHandoffPrepared: true,
      intakeCreated: false,
      matterCreated: false,
      filingSubmitted: false
    });
    expect(first.records.capability).toMatchObject({
      reflectionStatus: 'PENDING',
      capabilityVerified: false,
      canonicalTruthCreated: false
    });
    expect(first.safeguards).toEqual({
      realCustomerCredentialsUsed: false,
      realProviderCredentialsUsed: false,
      externalActionsExecuted: false,
      crossServiceSqlPerformed: false,
      productionDeploymentAuthorized: false,
      betaReleased: false
    });
    expect(first.scenarioFingerprintSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(Object.values(first.authority).every((value) => value === false)).toBe(true);
  });
});
