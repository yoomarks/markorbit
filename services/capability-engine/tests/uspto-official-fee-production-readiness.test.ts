import { describe, expect, it } from 'vitest';

import {
  evaluateUsptoOfficialFeeProductionPromotionReadinessV1,
  type UsptoOfficialFeeProductionPromotionReadinessInputV1,
  type UsptoOfficialFeeProductionPromotionReadinessStatusV1
} from '../src/uspto-official-fee-production-readiness.js';

function ready(
  overrides: Partial<UsptoOfficialFeeProductionPromotionReadinessInputV1> = {}
): UsptoOfficialFeeProductionPromotionReadinessInputV1 {
  return {
    schemaVersion: 1,
    governanceActivation: 'APPROVED',
    runtimeBinding: 'CURRENT',
    methodCurrentness: 'CURRENT',
    referenceCurrentness: 'CURRENT',
    sourceUse: 'CURRENT',
    producerEvidence: 'VALID',
    evidenceRefs: ['github:issue/659'],
    ...overrides
  };
}

const blockers: ReadonlyArray<
  readonly [
    UsptoOfficialFeeProductionPromotionReadinessStatusV1,
    Partial<UsptoOfficialFeeProductionPromotionReadinessInputV1>
  ]
> = [
  ['BLOCKED_BY_GOVERNANCE_ACTIVATION', { governanceActivation: 'MISSING' }],
  ['BLOCKED_BY_METHOD_CURRENTNESS', { methodCurrentness: 'NOT_CURRENT' }],
  ['BLOCKED_BY_REFERENCE_CURRENTNESS', { referenceCurrentness: 'NOT_CURRENT' }],
  ['BLOCKED_BY_SOURCE_USE_POLICY', { sourceUse: 'INVALID' }],
  ['BLOCKED_BY_RUNTIME_BINDING', { runtimeBinding: 'MISMATCH' }],
  ['BLOCKED_BY_PRODUCER_EVIDENCE', { producerEvidence: 'INVALID' }],
  ['DEPENDENCY_UNAVAILABLE', { methodCurrentness: 'UNAVAILABLE' }]
];

describe('USPTO official-fee production promotion readiness V1', () => {
  it('authorizes only the source-policy promotion when every producer prerequisite is exact/current', () => {
    const result = evaluateUsptoOfficialFeeProductionPromotionReadinessV1(ready());
    expect(result.status).toBe('READY_FOR_POLICY_PROMOTION');
    expect(result.policyPromotionAuthorized).toBe(true);
    expect(Object.values(result.downstreamAuthority).every((value) => value === false)).toBe(true);
  });

  it.each(blockers)('fails closed as %s', (status, overrides) => {
    const result = evaluateUsptoOfficialFeeProductionPromotionReadinessV1(ready(overrides));
    expect(result.status).toBe(status);
    expect(result.policyPromotionAuthorized).toBe(false);
    expect(Object.values(result.downstreamAuthority).every((value) => value === false)).toBe(true);
  });

  it('is deterministic and preserves evidence references without sharing the input array', () => {
    const input = ready();
    const first = evaluateUsptoOfficialFeeProductionPromotionReadinessV1(input);
    const replay = evaluateUsptoOfficialFeeProductionPromotionReadinessV1(input);
    expect(first).toEqual(replay);
    expect(first.evidenceRefs).toEqual(input.evidenceRefs);
    expect(first.evidenceRefs).not.toBe(input.evidenceRefs);
  });
});
