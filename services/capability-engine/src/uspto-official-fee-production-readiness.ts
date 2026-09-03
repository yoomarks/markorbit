export type UsptoOfficialFeeProductionPromotionReadinessStatusV1 =
  | 'READY_FOR_POLICY_PROMOTION'
  | 'BLOCKED_BY_GOVERNANCE_ACTIVATION'
  | 'BLOCKED_BY_METHOD_CURRENTNESS'
  | 'BLOCKED_BY_REFERENCE_CURRENTNESS'
  | 'BLOCKED_BY_SOURCE_USE_POLICY'
  | 'BLOCKED_BY_RUNTIME_BINDING'
  | 'BLOCKED_BY_PRODUCER_EVIDENCE'
  | 'DEPENDENCY_UNAVAILABLE';

export interface UsptoOfficialFeeProductionPromotionReadinessInputV1 {
  readonly schemaVersion: 1;
  readonly governanceActivation: 'APPROVED' | 'MISSING' | 'REJECTED' | 'UNAVAILABLE';
  readonly runtimeBinding: 'CURRENT' | 'MISMATCH' | 'UNAVAILABLE';
  readonly methodCurrentness: 'CURRENT' | 'NOT_CURRENT' | 'UNAVAILABLE';
  readonly referenceCurrentness: 'CURRENT' | 'NOT_CURRENT' | 'UNAVAILABLE';
  readonly sourceUse: 'CURRENT' | 'INVALID' | 'UNAVAILABLE';
  readonly producerEvidence: 'VALID' | 'INVALID' | 'UNAVAILABLE';
  readonly evidenceRefs: readonly string[];
}

export interface UsptoOfficialFeeProductionPromotionReadinessV1 {
  readonly schemaVersion: 1;
  readonly status: UsptoOfficialFeeProductionPromotionReadinessStatusV1;
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
  readonly policyPromotionAuthorized: boolean;
  readonly downstreamAuthority: Readonly<{
    recommendation: false;
    quote: false;
    filing: false;
    payment: false;
    providerAction: false;
    officialTruth: false;
  }>;
}

const noDownstreamAuthority = Object.freeze({
  recommendation: false,
  quote: false,
  filing: false,
  payment: false,
  providerAction: false,
  officialTruth: false
});

function result(
  input: Readonly<UsptoOfficialFeeProductionPromotionReadinessInputV1>,
  status: UsptoOfficialFeeProductionPromotionReadinessStatusV1,
  reason: string,
  policyPromotionAuthorized = false
): Readonly<UsptoOfficialFeeProductionPromotionReadinessV1> {
  return Object.freeze({
    schemaVersion: 1,
    status,
    reason,
    evidenceRefs: [...input.evidenceRefs],
    policyPromotionAuthorized,
    downstreamAuthority: noDownstreamAuthority
  });
}

/**
 * Deterministic owner-local gate for the exact USPTO source-policy promotion.
 * This projection never creates governance approval or downstream business authority.
 */
export function evaluateUsptoOfficialFeeProductionPromotionReadinessV1(
  input: Readonly<UsptoOfficialFeeProductionPromotionReadinessInputV1>
): Readonly<UsptoOfficialFeeProductionPromotionReadinessV1> {
  if (input.schemaVersion !== 1) {
    return result(input, 'DEPENDENCY_UNAVAILABLE', 'Unsupported readiness input version.');
  }

  if (
    input.governanceActivation === 'UNAVAILABLE' ||
    input.runtimeBinding === 'UNAVAILABLE' ||
    input.methodCurrentness === 'UNAVAILABLE' ||
    input.referenceCurrentness === 'UNAVAILABLE' ||
    input.sourceUse === 'UNAVAILABLE' ||
    input.producerEvidence === 'UNAVAILABLE'
  ) {
    return result(
      input,
      'DEPENDENCY_UNAVAILABLE',
      'At least one required governed producer dependency is unavailable.'
    );
  }

  if (input.governanceActivation !== 'APPROVED') {
    return result(
      input,
      'BLOCKED_BY_GOVERNANCE_ACTIVATION',
      `Canonical BRAIN_GOVERNANCE activation is ${input.governanceActivation}.`
    );
  }
  if (input.runtimeBinding !== 'CURRENT') {
    return result(
      input,
      'BLOCKED_BY_RUNTIME_BINDING',
      'Current Runtime Capability or Implementation Profile binding does not match the exact USPTO Resolver applicability.'
    );
  }
  if (input.methodCurrentness !== 'CURRENT') {
    return result(
      input,
      'BLOCKED_BY_METHOD_CURRENTNESS',
      'The exact governed USPTO Method is not current.'
    );
  }
  if (input.referenceCurrentness !== 'CURRENT') {
    return result(
      input,
      'BLOCKED_BY_REFERENCE_CURRENTNESS',
      'The exact accepted USPTO fee Reference is not current.'
    );
  }
  if (input.sourceUse !== 'CURRENT') {
    return result(
      input,
      'BLOCKED_BY_SOURCE_USE_POLICY',
      'The exact USPTO source-use context is not current and valid.'
    );
  }
  if (input.producerEvidence !== 'VALID') {
    return result(
      input,
      'BLOCKED_BY_PRODUCER_EVIDENCE',
      'The exact successful governed USPTO producer execution/evidence is not valid.'
    );
  }

  return result(
    input,
    'READY_FOR_POLICY_PROMOTION',
    'All exact producer prerequisites are current; only the versioned USPTO source-admission policy promotion is authorized.',
    true
  );
}
