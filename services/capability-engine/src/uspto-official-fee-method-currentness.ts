import { isDeepStrictEqual } from 'node:util';

import {
  activateExecutableMethodPackageV1,
  executableMethodActivationEvidenceRefV1,
  parseExecutableMethodPackageActivationDecisionV1,
  prepareExecutableMethodPackageActivationDecisionV1
} from '@markorbit/contracts/brain-method-activation';
import { parseExecutableMethodPackageV1 } from '@markorbit/contracts/brain-method';
import type {
  CapabilityMethodCurrentnessAuthority,
  CapabilityMethodCurrentnessResult,
  CapabilitySourceAdmissionPolicyInput,
  ExactMethodSourceIdentity
} from './current-source-admission.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_EVALUATION_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_VERSION,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
  USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
  USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
  parseUsptoOfficialFeeResolverInputV1
} from './uspto-official-fee-resolver-pilot.js';

const USPTO_OFFICIAL_FEE_GOVERNED_SUCCESSOR_PACKAGE_ID = `${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_ID}-governed-successor`;

export interface UsptoOfficialFeeMethodActivationQueryV1 {
  capabilityId: typeof USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID;
  capabilityVersion: typeof USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION;
  implementationProfileId: string;
  methodId: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID;
  methodVersionId: typeof USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID;
}

export type UsptoOfficialFeeMethodActivationResolutionV1 =
  | Readonly<{
      status: 'RESOLVED';
      predecessor: unknown;
      decision: unknown;
      activePackage: unknown;
      activationEvidenceRef: string;
    }>
  | Readonly<{
      status: 'NOT_ESTABLISHED';
      reason: string;
    }>
  | Readonly<{
      status: 'UNAVAILABLE';
      reason: string;
    }>;

export interface UsptoOfficialFeeMethodActivationAuthorityV1 {
  resolveCurrent(
    query: Readonly<UsptoOfficialFeeMethodActivationQueryV1>
  ):
    | UsptoOfficialFeeMethodActivationResolutionV1
    | Promise<UsptoOfficialFeeMethodActivationResolutionV1>;
}

export interface UsptoOfficialFeeMethodCurrentnessOptionsV1 {
  readonly activation: Readonly<UsptoOfficialFeeMethodActivationAuthorityV1>;
}

function unsupported(reason: string): CapabilityMethodCurrentnessResult {
  return { status: 'UNSUPPORTED_APPLICABILITY', reason };
}

function unavailable(reason: string): CapabilityMethodCurrentnessResult {
  return { status: 'UNAVAILABLE', reason };
}

function notCurrent(reason: string): CapabilityMethodCurrentnessResult {
  return { status: 'NOT_CURRENT', reason };
}

function exactApplicability(input: Readonly<CapabilitySourceAdmissionPolicyInput>): boolean {
  const capability = input.currentCapability;
  const implementation = input.currentImplementation;
  const request = input.execution.request;
  if (
    capability.runtimeCapabilityDefinitionId !==
      USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION.runtimeCapabilityDefinitionId ||
    capability.version !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION.version ||
    capability.capabilityId !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID ||
    capability.capabilityVersion !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION ||
    capability.acceptedCanonProjection !== true ||
    capability.createdFromWorkEvidence !== false ||
    capability.createdFromAiOutput !== false ||
    implementation.implementationProfileId !==
      USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationProfileId ||
    implementation.version !== USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.version ||
    implementation.implementationKey !==
      USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationKey ||
    implementation.status !== 'APPROVED' ||
    implementation.capabilityId !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID ||
    implementation.capabilityVersion !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION ||
    implementation.inputSchemaId !== USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA ||
    implementation.outputSchemaId !== USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA ||
    request.capabilityId !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID ||
    request.capabilityVersion !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION ||
    request.inputSchemaId !== USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA ||
    request.outputSchemaId !== USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA
  ) {
    return false;
  }
  try {
    parseUsptoOfficialFeeResolverInputV1(request.input);
    return true;
  } catch {
    return false;
  }
}

function legacyPackageEvidenceRef(): string {
  return `brain-method-package:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_ID}@${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_PACKAGE_VERSION}`;
}

function commonMethodEvidenceComplete(evidenceRefs: readonly string[]): boolean {
  return [
    `brain-method:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID}`,
    `brain-method-version:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID}`,
    `brain-method-evaluation:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_EVALUATION_ID}`
  ].every((evidenceRef) => evidenceRefs.includes(evidenceRef));
}

function exactGovernedSuccessorPredecessor(value: unknown) {
  const predecessor = parseExecutableMethodPackageV1(value);
  if (
    predecessor.packageId !== USPTO_OFFICIAL_FEE_GOVERNED_SUCCESSOR_PACKAGE_ID ||
    predecessor.packageVersion !== 1 ||
    predecessor.lifecycle !== 'VALIDATED' ||
    predecessor.activatedAt !== undefined ||
    predecessor.methodId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID ||
    predecessor.methodVersionId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID ||
    predecessor.evaluation.evaluationId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_EVALUATION_ID ||
    predecessor.evaluation.status !== 'PASSED' ||
    predecessor.inputSchemaId !== USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA ||
    predecessor.outputSchemaId !== USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA
  ) {
    throw new Error(
      'Activation predecessor is not the exact governed USPTO official-fee successor.'
    );
  }
  return predecessor;
}

function verifiedCurrentIdentity(
  resolution: Extract<UsptoOfficialFeeMethodActivationResolutionV1, { status: 'RESOLVED' }>,
  evidenceRefs: readonly string[]
): Readonly<ExactMethodSourceIdentity> | undefined {
  try {
    const predecessor = exactGovernedSuccessorPredecessor(resolution.predecessor);
    const decision = parseExecutableMethodPackageActivationDecisionV1(resolution.decision);
    if (decision.decision !== 'APPROVED') return undefined;

    const canonicalDecision = prepareExecutableMethodPackageActivationDecisionV1(predecessor, {
      decision: decision.decision,
      selectionPriority: decision.target.selectionPriority,
      limitations: decision.target.limitations,
      policyVersion: decision.approval.policyVersion,
      approvedBy: decision.approval.approvedBy,
      approvalTicketRef: decision.approval.approvalTicketRef,
      approvedAt: decision.approval.approvedAt,
      rationale: decision.approval.rationale
    });
    if (!isDeepStrictEqual(canonicalDecision, decision)) return undefined;

    const expectedActivationEvidenceRef = executableMethodActivationEvidenceRefV1(decision);
    if (resolution.activationEvidenceRef !== expectedActivationEvidenceRef) return undefined;

    const expectedActivePackage = activateExecutableMethodPackageV1(predecessor, decision);
    const activePackage = parseExecutableMethodPackageV1(resolution.activePackage);
    if (!isDeepStrictEqual(expectedActivePackage, activePackage)) return undefined;
    if (
      activePackage.lifecycle !== 'ACTIVE' ||
      activePackage.methodId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID ||
      activePackage.methodVersionId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID ||
      activePackage.evaluation.evaluationId !== USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_EVALUATION_ID
    ) {
      return undefined;
    }

    const evidenceRef = `brain-method-package:${activePackage.packageId}@${activePackage.packageVersion}`;
    if (!evidenceRefs.includes(evidenceRef)) return undefined;

    return Object.freeze({
      evidenceRef,
      methodId: activePackage.methodId,
      methodVersionId: activePackage.methodVersionId,
      packageId: activePackage.packageId,
      packageVersion: String(activePackage.packageVersion),
      activationId: decision.decisionId,
      evaluationId: activePackage.evaluation.evaluationId
    });
  } catch {
    return undefined;
  }
}

export class UsptoOfficialFeeMethodCurrentnessAuthorityV1 implements CapabilityMethodCurrentnessAuthority {
  constructor(private readonly options: Readonly<UsptoOfficialFeeMethodCurrentnessOptionsV1>) {}

  async evaluate(
    input: Readonly<CapabilitySourceAdmissionPolicyInput>
  ): Promise<CapabilityMethodCurrentnessResult> {
    if (!exactApplicability(input)) {
      return unsupported(
        'USPTO official-fee Method currentness only applies to the exact accepted Resolver Capability and Implementation Profile binding.'
      );
    }

    const evidenceRefs = input.execution.receipt.evidenceRefs;
    if (evidenceRefs.includes(legacyPackageEvidenceRef())) {
      return notCurrent(
        'Historical USPTO official-fee package v1 is a legacy direct-ACTIVE pilot without canonical BRAIN_GOVERNANCE activation.'
      );
    }
    if (!commonMethodEvidenceComplete(evidenceRefs)) {
      return notCurrent(
        'Historical Capability execution is missing exact Method version or evaluation evidence.'
      );
    }

    let resolution: UsptoOfficialFeeMethodActivationResolutionV1;
    try {
      resolution = await this.options.activation.resolveCurrent({
        capabilityId: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
        capabilityVersion: USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
        implementationProfileId:
          USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationProfileId,
        methodId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID,
        methodVersionId: USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID
      });
    } catch {
      return unavailable('Governed USPTO official-fee Method activation authority is unavailable.');
    }

    if (resolution.status === 'UNAVAILABLE') {
      return unavailable(resolution.reason);
    }
    if (resolution.status === 'NOT_ESTABLISHED') {
      return notCurrent(resolution.reason);
    }

    const identity = verifiedCurrentIdentity(resolution, evidenceRefs);
    if (!identity) {
      return notCurrent(
        'Governed USPTO official-fee activation state is missing, rejected, non-canonical, mismatched or not evidenced by this execution.'
      );
    }
    return { status: 'CURRENT', identity };
  }
}
