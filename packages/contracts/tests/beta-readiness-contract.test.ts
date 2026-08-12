import { describe, expect, it } from 'vitest';
import {
  betaReadinessAuthorityFixture,
  betaReadinessBoundaryKinds,
  betaReadinessGapKeys,
  betaReadinessGapStatuses,
  betaReadinessNoAuthorityConsequences,
  m7BetaReadinessGapInventoryV1
} from '../src/beta-readiness.js';

describe('M7-WP-01 beta readiness contracts', () => {
  it('freezes the bounded Beta readiness vocabulary', () => {
    expect(betaReadinessGapStatuses).toEqual([
      'SATISFIED_BY_EXISTING_EVIDENCE',
      'REMAINS_M7_IMPLEMENTATION'
    ]);
    expect(betaReadinessBoundaryKinds).toEqual([
      'PRODUCT_CONVERSION_METRIC',
      'SEEDED_DEMO_RECORD',
      'DEPLOYMENT_REHEARSAL',
      'BETA_RELEASE_CANDIDATE',
      'AUTOMATED_GATE'
    ]);
    expect(betaReadinessGapKeys).toContain('CONTENT_OPPORTUNITY_CONVERSION_ANALYTICS');
    expect(betaReadinessGapKeys).toContain('DETERMINISTIC_SEEDED_BETA_SCENARIO');
    expect(betaReadinessGapKeys).toContain('THREE_LOOP_BETA_ACCEPTANCE_GRAPH');
    expect(betaReadinessGapKeys).toContain('DEPLOYMENT_REHEARSAL_RECOVERY');
    expect(betaReadinessGapKeys).toContain('EXACT_HEAD_BETA_RC_QUALIFICATION');
  });

  it('records which Week 4 objectives are complete and which remain M7 work', () => {
    const statusByKey = new Map(
      m7BetaReadinessGapInventoryV1.map((entry) => [entry.key, entry.status])
    );

    expect(statusByKey.get('CAPABILITY_PRIVATE_LEARNING')).toBe('SATISFIED_BY_EXISTING_EVIDENCE');
    expect(statusByKey.get('LIFECYCLE_RECOMMENDED_ACTION_PATH')).toBe(
      'SATISFIED_BY_EXISTING_EVIDENCE'
    );
    expect(statusByKey.get('RELIABILITY_RECOVERY_BASELINE')).toBe('SATISFIED_BY_EXISTING_EVIDENCE');
    expect(statusByKey.get('CONTENT_OPPORTUNITY_CONVERSION_ANALYTICS')).toBe(
      'REMAINS_M7_IMPLEMENTATION'
    );
    expect(statusByKey.get('DETERMINISTIC_SEEDED_BETA_SCENARIO')).toBe('REMAINS_M7_IMPLEMENTATION');
    expect(statusByKey.get('THREE_LOOP_BETA_ACCEPTANCE_GRAPH')).toBe('REMAINS_M7_IMPLEMENTATION');
    expect(statusByKey.get('DEPLOYMENT_REHEARSAL_RECOVERY')).toBe('REMAINS_M7_IMPLEMENTATION');
    expect(statusByKey.get('EXACT_HEAD_BETA_RC_QUALIFICATION')).toBe('REMAINS_M7_IMPLEMENTATION');
  });

  it('keeps every readiness artifact non-authoritative', () => {
    for (const boundary of betaReadinessAuthorityFixture.boundaries) {
      expect(boundary.authority).toEqual(betaReadinessNoAuthorityConsequences);
      expect(Object.values(boundary.authority).every((value) => value === false)).toBe(true);
    }

    for (const gap of m7BetaReadinessGapInventoryV1) {
      expect(gap.authority).toEqual(betaReadinessNoAuthorityConsequences);
    }
  });

  it('keeps Product metrics observational and non-mutating', () => {
    const metric = betaReadinessAuthorityFixture.boundaries.find(
      (boundary) => boundary.kind === 'PRODUCT_CONVERSION_METRIC'
    );

    expect(metric).toMatchObject({
      observationalOnly: true,
      mutatesBusinessState: false
    });
    expect(metric?.authority.businessAuthorityGranted).toBe(false);
    expect(metric?.authority.protectedActionAuthorized).toBe(false);
  });

  it('keeps seeded demo evidence isolated from customer, provider and official truth', () => {
    const seed = betaReadinessAuthorityFixture.boundaries.find(
      (boundary) => boundary.kind === 'SEEDED_DEMO_RECORD'
    );

    expect(seed).toMatchObject({
      environment: 'REHEARSAL',
      nonProduction: true,
      customerTruth: false,
      providerTruth: false,
      officialTruth: false
    });
  });

  it('keeps deployment rehearsal, release candidate and green gates separate from Owner release authority', () => {
    const rehearsal = betaReadinessAuthorityFixture.boundaries.find(
      (boundary) => boundary.kind === 'DEPLOYMENT_REHEARSAL'
    );
    const candidate = betaReadinessAuthorityFixture.boundaries.find(
      (boundary) => boundary.kind === 'BETA_RELEASE_CANDIDATE'
    );
    const gate = betaReadinessAuthorityFixture.boundaries.find(
      (boundary) => boundary.kind === 'AUTOMATED_GATE'
    );

    expect(rehearsal).toMatchObject({
      nonProduction: true,
      productionTrafficCutover: false
    });
    expect(candidate).toMatchObject({ released: false, ownerAuthorizationRequired: true });
    expect(gate).toMatchObject({
      greenGateAuthorizesRelease: false,
      ownerAuthorizationRequired: true
    });

    expect(candidate?.authority.productionDeploymentAuthorized).toBe(false);
    expect(candidate?.authority.betaReleased).toBe(false);
    expect(candidate?.authority.ownerReleaseAuthorized).toBe(false);
  });
});
