import {
  USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE,
  prepareUsptoOfficialFeeGovernedSuccessorV1
} from '@markorbit/contracts/brain-official-fee-method';
import {
  activateExecutableMethodPackageV1,
  executableMethodActivationEvidenceRefV1,
  prepareExecutableMethodPackageActivationDecisionV1
} from '@markorbit/contracts/brain-method-activation';

import type {
  UsptoOfficialFeeMethodActivationAuthorityV1,
  UsptoOfficialFeeMethodActivationQueryV1,
  UsptoOfficialFeeMethodActivationResolutionV1
} from './uspto-official-fee-method-currentness.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE
} from './uspto-official-fee-resolver-pilot.js';

// External governance source: the repository owner explicitly approved #659; this module only materializes that decision canonically.
export const USPTO_OFFICIAL_FEE_GOVERNANCE_APPROVAL_V1 = Object.freeze({
  authority: 'BRAIN_GOVERNANCE' as const,
  approvedBy: 'yoomarks',
  approvalTicketRef: 'github:issue/659',
  approvedAt: '2026-09-03T01:23:00.000Z',
  policyVersion: 'brain-governance-v1',
  selectionPriority: 100,
  rationale:
    'Approve activation of the exact validated USPTO official-fee governed successor using its frozen accepted source/evaluation lineage and existing bounded applicability/limitations. This approval is limited to Method activation and creates no Recommendation, Quote, Filing, Payment, provider/contact, publication, Product lifecycle, legal conclusion or Official Truth authority.'
});

export const USPTO_OFFICIAL_FEE_GOVERNED_COMPILATION_INPUT_V1 = Object.freeze({
  knowledgeSources: structuredClone(USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE),
  temporalResolution: Object.freeze({
    status: 'RESOLVED' as const,
    effectiveFrom: '2025-01-18T00:00:00.000-05:00',
    evidenceRef: 'USPTO_TRADEMARK_FEE_FINAL_RULE_EFFECTIVE_2025_01_18'
  }),
  conflictResolution: Object.freeze({
    status: 'NONE' as const,
    evidenceRef: 'USPTO_DUAL_SOURCE_AUTHORITY_RECONCILIATION_2026_08_28'
  })
});

export function materializeApprovedUsptoOfficialFeeGovernedActivationV1() {
  const prepared = prepareUsptoOfficialFeeGovernedSuccessorV1(
    USPTO_OFFICIAL_FEE_GOVERNED_COMPILATION_INPUT_V1
  );
  if (prepared.status !== 'PREPARED') {
    throw new Error(`USPTO governed successor is not preparation-ready: ${prepared.status}.`);
  }

  const predecessor = prepared.validatedSuccessor;
  const decision = prepareExecutableMethodPackageActivationDecisionV1(predecessor, {
    decision: 'APPROVED',
    selectionPriority: USPTO_OFFICIAL_FEE_GOVERNANCE_APPROVAL_V1.selectionPriority,
    limitations: predecessor.limitations,
    policyVersion: USPTO_OFFICIAL_FEE_GOVERNANCE_APPROVAL_V1.policyVersion,
    approvedBy: USPTO_OFFICIAL_FEE_GOVERNANCE_APPROVAL_V1.approvedBy,
    approvalTicketRef: USPTO_OFFICIAL_FEE_GOVERNANCE_APPROVAL_V1.approvalTicketRef,
    approvedAt: USPTO_OFFICIAL_FEE_GOVERNANCE_APPROVAL_V1.approvedAt,
    rationale: USPTO_OFFICIAL_FEE_GOVERNANCE_APPROVAL_V1.rationale
  });
  const activePackage = activateExecutableMethodPackageV1(predecessor, decision);
  const activationEvidenceRef = executableMethodActivationEvidenceRefV1(decision);

  return Object.freeze({
    predecessor,
    validatedSuccessorFingerprintSha256: prepared.validatedSuccessorFingerprintSha256,
    decision,
    activePackage,
    activationEvidenceRef
  });
}

function exactQuery(query: Readonly<UsptoOfficialFeeMethodActivationQueryV1>): boolean {
  return (
    query.capabilityId === USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID &&
    query.capabilityVersion === USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION &&
    query.implementationProfileId ===
      USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationProfileId &&
    query.methodId === USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID &&
    query.methodVersionId === USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID
  );
}

export class ApprovedUsptoOfficialFeeMethodActivationAuthorityV1 implements UsptoOfficialFeeMethodActivationAuthorityV1 {
  resolveCurrent(
    query: Readonly<UsptoOfficialFeeMethodActivationQueryV1>
  ): UsptoOfficialFeeMethodActivationResolutionV1 {
    if (!exactQuery(query)) {
      return {
        status: 'NOT_ESTABLISHED',
        reason:
          'The approved #659 governance decision applies only to the exact accepted USPTO official-fee Resolver binding.'
      };
    }

    const activation = materializeApprovedUsptoOfficialFeeGovernedActivationV1();
    return {
      status: 'RESOLVED',
      predecessor: activation.predecessor,
      decision: activation.decision,
      activePackage: activation.activePackage,
      activationEvidenceRef: activation.activationEvidenceRef
    };
  }
}

export const currentApprovedUsptoOfficialFeeMethodActivationAuthorityV1 =
  new ApprovedUsptoOfficialFeeMethodActivationAuthorityV1();
