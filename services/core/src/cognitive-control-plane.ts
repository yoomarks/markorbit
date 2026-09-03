export type CognitiveControlPlaneStateV1 =
  | 'READY'
  | 'PILOT'
  | 'BLOCKED_BY_GOVERNANCE'
  | 'BLOCKED_BY_SOURCE_CURRENTNESS'
  | 'BLOCKED_BY_REFERENCE'
  | 'BLOCKED_BY_METHOD'
  | 'COVERAGE_GAP'
  | 'RESEARCH_IN_PROGRESS'
  | 'CANDIDATE_AVAILABLE'
  | 'AUDIT_UNAVAILABLE';

export interface CognitiveControlPlaneProofRefV1 {
  kind: string;
  id: string;
  fingerprintSha256: string;
}

export interface CognitiveControlPlaneInputV1 {
  schemaVersion: 1;
  audit: 'AVAILABLE' | 'UNAVAILABLE';
  governance: 'APPROVED' | 'PENDING' | 'DENIED' | 'NOT_REQUIRED';
  method: 'CURRENT' | 'MISSING' | 'STALE' | 'AMBIGUOUS';
  reference: 'CURRENT' | 'MISSING' | 'STALE' | 'AMBIGUOUS' | 'NOT_REQUIRED';
  sourceCurrentness: 'CURRENT' | 'STALE' | 'AMBIGUOUS' | 'NOT_REQUIRED';
  admission: 'PRODUCTION_ADMISSIBLE' | 'PILOT' | 'NOT_ADMITTED';
  improvement: 'NONE' | 'COVERAGE_GAP' | 'RESEARCH_IN_PROGRESS' | 'CANDIDATE_AVAILABLE';
  proofs: readonly CognitiveControlPlaneProofRefV1[];
}

export interface CognitiveControlPlaneAuthorityV1 {
  recommendationAuthorized: false;
  officialTruthCreated: false;
  productStateCreated: false;
  filingAuthorized: false;
  paymentAuthorized: false;
  providerActionAuthorized: false;
  runtimeCapabilityCreated: false;
  implementationApproved: false;
  methodActivated: false;
}

export interface CognitiveControlPlaneProjectionV1 {
  schemaVersion: 1;
  state: CognitiveControlPlaneStateV1;
  blockerReason: string | null;
  nextGovernedTransition: string | null;
  proofs: readonly CognitiveControlPlaneProofRefV1[];
  authority: CognitiveControlPlaneAuthorityV1;
}

const SHA256 = /^[0-9a-f]{64}$/u;
const noAuthority: CognitiveControlPlaneAuthorityV1 = Object.freeze({
  recommendationAuthorized: false,
  officialTruthCreated: false,
  productStateCreated: false,
  filingAuthorized: false,
  paymentAuthorized: false,
  providerActionAuthorized: false,
  runtimeCapabilityCreated: false,
  implementationApproved: false,
  methodActivated: false
});

function validText(value: string): boolean {
  return value.trim().length > 0 && value === value.trim();
}

function validProofs(proofs: readonly CognitiveControlPlaneProofRefV1[]): boolean {
  if (proofs.length === 0) return false;
  const identities = new Map<string, string>();
  for (const proof of proofs) {
    if (!validText(proof.kind) || !validText(proof.id) || !SHA256.test(proof.fingerprintSha256)) {
      return false;
    }
    const key = `${proof.kind}:${proof.id}`;
    const existing = identities.get(key);
    if (existing !== undefined && existing !== proof.fingerprintSha256) return false;
    identities.set(key, proof.fingerprintSha256);
  }
  return true;
}

function projection(
  input: Readonly<CognitiveControlPlaneInputV1>,
  state: CognitiveControlPlaneStateV1,
  blockerReason: string | null,
  nextGovernedTransition: string | null
): Readonly<CognitiveControlPlaneProjectionV1> {
  return Object.freeze({
    schemaVersion: 1,
    state,
    blockerReason,
    nextGovernedTransition,
    proofs: structuredClone(input.proofs),
    authority: structuredClone(noAuthority)
  });
}

function auditUnavailable(
  input: Readonly<CognitiveControlPlaneInputV1>,
  reason = 'Required governed proof is unavailable, malformed, ambiguous or conflicting.'
): Readonly<CognitiveControlPlaneProjectionV1> {
  return projection(
    input,
    'AUDIT_UNAVAILABLE',
    reason,
    'Restore exact governed proof resolution and re-run the read projection.'
  );
}

/**
 * Read-only readiness projection over already-governed proof state.
 *
 * Inputs are snapshots from existing authority/read-model boundaries. This projector validates
 * their bounded proof identities, normalizes the current blocker, and creates no lifecycle,
 * admission, activation, Recommendation, Official Truth or downstream action authority.
 */
export function projectCognitiveControlPlaneV1(
  input: Readonly<CognitiveControlPlaneInputV1>
): Readonly<CognitiveControlPlaneProjectionV1> {
  if (input.schemaVersion !== 1 || input.audit !== 'AVAILABLE') return auditUnavailable(input);
  if (!validProofs(input.proofs)) return auditUnavailable(input);

  if (input.improvement === 'CANDIDATE_AVAILABLE') {
    return projection(
      input,
      'CANDIDATE_AVAILABLE',
      null,
      'Run the existing governed candidate evaluation and activation process; do not auto-activate.'
    );
  }
  if (input.improvement === 'RESEARCH_IN_PROGRESS') {
    return projection(
      input,
      'RESEARCH_IN_PROGRESS',
      null,
      'Complete the existing governed Research Mission and evaluate resulting evidence.'
    );
  }
  if (input.improvement === 'COVERAGE_GAP') {
    return projection(
      input,
      'COVERAGE_GAP',
      'A governed capability or implementation coverage gap is admitted.',
      'Use the existing explicit Method Improvement research admission path.'
    );
  }

  if (input.method !== 'CURRENT') {
    return projection(
      input,
      'BLOCKED_BY_METHOD',
      `Method proof is ${input.method}.`,
      'Resolve an exact current governed Method without fabricating activation.'
    );
  }
  if (input.reference !== 'CURRENT' && input.reference !== 'NOT_REQUIRED') {
    return projection(
      input,
      'BLOCKED_BY_REFERENCE',
      `Reference proof is ${input.reference}.`,
      'Resolve exact current Reference evidence before production admission.'
    );
  }
  if (input.sourceCurrentness !== 'CURRENT' && input.sourceCurrentness !== 'NOT_REQUIRED') {
    return projection(
      input,
      'BLOCKED_BY_SOURCE_CURRENTNESS',
      `Source currentness is ${input.sourceCurrentness}.`,
      'Revalidate source currentness and source-use policy against exact evidence.'
    );
  }
  if (input.governance === 'PENDING' || input.governance === 'DENIED') {
    return projection(
      input,
      'BLOCKED_BY_GOVERNANCE',
      `Governance decision is ${input.governance}.`,
      'Obtain an explicit authoritative governance decision; never fabricate approval.'
    );
  }
  if (input.admission === 'PILOT') {
    return projection(
      input,
      'PILOT',
      'The bounded path is governed for pilot use only.',
      'Promote only through the existing governed production-admission process.'
    );
  }
  if (input.admission !== 'PRODUCTION_ADMISSIBLE') {
    return projection(
      input,
      'BLOCKED_BY_GOVERNANCE',
      'The bounded path is not production-admitted.',
      'Obtain explicit production admission from the existing authority source.'
    );
  }

  return projection(
    input,
    'READY',
    null,
    'No control-plane remediation is required; downstream consumers must still apply their own authority checks.'
  );
}
