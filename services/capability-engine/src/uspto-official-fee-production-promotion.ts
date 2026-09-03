import { isDeepStrictEqual } from 'node:util';

import {
  USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE,
  prepareUsptoOfficialFeeGovernedSuccessorV1
} from '@markorbit/contracts/brain-official-fee-method';
import {
  activateExecutableMethodPackageV1,
  executableMethodActivationEvidenceRefV1,
  prepareExecutableMethodPackageActivationDecisionV1
} from '@markorbit/contracts/brain-method-activation';

import {
  ExecutableMethodCapabilityExecutorV1,
  type ExecutableMethodPackageRunnerInputV1,
  type ExecutableMethodPackageRunnerV1
} from './executable-method-runtime.js';
import type {
  UsptoOfficialFeeMethodActivationAuthorityV1,
  UsptoOfficialFeeMethodActivationQueryV1,
  UsptoOfficialFeeMethodActivationResolutionV1
} from './uspto-official-fee-method-currentness.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REPLAY_IDENTITY_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
  USPTO_OFFICIAL_FEE_RESOLVER_EXECUTABLE_KIND,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
  USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
  UsptoOfficialFeeMethodSelectionContextResolverV1,
  parseUsptoOfficialFeeResolverInputV1,
  parseUsptoOfficialFeeResolverReferenceV1,
  type OfficialFeeReferenceReaderV1,
  type UsptoOfficialFeeResolverOutputV1
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
    legacyPilot: structuredClone(prepared.legacyPilot),
    predecessor,
    validatedSuccessorFingerprintSha256: prepared.validatedSuccessorFingerprintSha256,
    decision,
    activePackage,
    activationEvidenceRef
  });
}

class ApprovedUsptoOfficialFeeSourceResolutionRunnerV1 implements ExecutableMethodPackageRunnerV1 {
  constructor(private readonly references: OfficialFeeReferenceReaderV1) {}

  async run(
    input: Readonly<ExecutableMethodPackageRunnerInputV1>
  ): Promise<{ output: UsptoOfficialFeeResolverOutputV1; evidenceRefs: readonly string[] }> {
    const activation = materializeApprovedUsptoOfficialFeeGovernedActivationV1();
    if (!isDeepStrictEqual(input.package, activation.activePackage)) {
      throw new TypeError(
        'USPTO production Resolver requires the exact canonical ACTIVE successor approved by #659.'
      );
    }

    const requestInput = parseUsptoOfficialFeeResolverInputV1(input.request.input);
    const reference = parseUsptoOfficialFeeResolverReferenceV1(
      await this.references.resolveCurrent({
        operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
        jurisdiction: 'US',
        authority: 'USPTO',
        asOf: requestInput.asOf
      })
    );
    if (Date.parse(reference.effectiveFrom) > Date.parse(requestInput.asOf)) {
      throw new TypeError(
        'Accepted Official Fee reference is not effective at the requested time.'
      );
    }
    if (
      reference.packageId !== activation.legacyPilot.packageId ||
      reference.methodId !== input.package.methodId ||
      reference.methodVersionId !== input.package.methodVersionId
    ) {
      throw new TypeError(
        'Official Fee reference must retain the exact frozen predecessor materialization lineage used by the governed successor.'
      );
    }

    const output: UsptoOfficialFeeResolverOutputV1 = {
      schemaVersion: 1,
      kind: USPTO_OFFICIAL_FEE_RESOLVER_EXECUTABLE_KIND,
      jurisdiction: 'US',
      authority: 'USPTO',
      operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
      filingBasis: requestInput.filingBasis,
      classCount: requestInput.classCount,
      reference: {
        referenceId: reference.referenceId,
        currency: reference.currency,
        amountMinor: reference.amountMinor,
        unit: 'PER_CLASS',
        effectiveFrom: reference.effectiveFrom,
        packageId: reference.packageId,
        methodId: reference.methodId,
        methodVersionId: reference.methodVersionId,
        sourceIdentityFingerprintSha256:
          USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256,
        replayIdentityFingerprintSha256:
          USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REPLAY_IDENTITY_SHA256,
        materializationFingerprintSha256:
          USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256
      },
      limitations: [...input.package.limitations],
      knowledgeResearchInvoked: false,
      referenceStoreReadControlled: true,
      productBusinessStateMutated: false
    };

    return {
      output,
      evidenceRefs: [
        `official-fee-reference:${reference.referenceId}`,
        `official-fee-source-identity-sha256:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_SOURCE_IDENTITY_SHA256}`,
        `official-fee-replay-identity-sha256:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REPLAY_IDENTITY_SHA256}`,
        `official-fee-materialization-sha256:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256}`,
        `brain-method-activation:${activation.decision.decisionId}`,
        activation.activationEvidenceRef,
        'capability-runtime:knowledge-research-hot-path=absent',
        'capability-runtime:reference-store-read=controlled',
        'capability-runtime:product-business-state-write=absent'
      ]
    };
  }
}

export function createApprovedUsptoOfficialFeeResolverCapabilityExecutorV1(
  references: OfficialFeeReferenceReaderV1
): ExecutableMethodCapabilityExecutorV1 {
  const activation = materializeApprovedUsptoOfficialFeeGovernedActivationV1();
  const runner = new ApprovedUsptoOfficialFeeSourceResolutionRunnerV1(references);
  return new ExecutableMethodCapabilityExecutorV1({
    packages: {
      list: () => Promise.resolve([activation.activePackage])
    },
    selectionContext: new UsptoOfficialFeeMethodSelectionContextResolverV1(),
    runners: {
      resolve: (kind) => (kind === USPTO_OFFICIAL_FEE_RESOLVER_EXECUTABLE_KIND ? runner : undefined)
    }
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
