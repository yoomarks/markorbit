import { isDeepStrictEqual } from 'node:util';

import {
  capabilitySourceAdmissionNoAuthorityConsequences,
  type ExactMethodSourceIdentity,
  type ExactReferenceSourceIdentity
} from './current-source-admission.js';
import type { CapabilitySourceAdmissionEvidenceV2 } from './current-source-admission-evidence-v2.js';
import type {
  CapabilitySourceUseContextAuthorityV1,
  CapabilitySourceUseContextResolutionV1
} from './current-source-admission-evidence-v3.js';
import {
  canonicalJsonSha256V1,
  resolveCapabilitySourceOutputIdentityV1
} from './capability-source-output-identity.js';
import {
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_EVALUATION_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID,
  USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION,
  USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE,
  USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA,
  USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA,
  parseUsptoOfficialFeeResolverInputV1,
  validateUsptoOfficialFeeResolverOutputV1,
  type UsptoOfficialFeeResolverOutputV1
} from './uspto-official-fee-resolver-pilot.js';

const SHA256 = /^[0-9a-f]{64}$/;

type ProductionCapabilitySourceAdmissionEvidenceV2 = Readonly<
  Omit<CapabilitySourceAdmissionEvidenceV2, 'decision' | 'sourceOutput'> & {
    decision: Extract<
      CapabilitySourceAdmissionEvidenceV2['decision'],
      { decision: 'PRODUCTION_ADMISSIBLE' }
    >;
    sourceOutput: NonNullable<CapabilitySourceAdmissionEvidenceV2['sourceOutput']>;
  }
>;

export const USPTO_OFFICIAL_FEE_SOURCE_USE_POLICY_ID =
  'source-use-policy.uspto-official-fee-resolver.markreg.v1' as const;
export const USPTO_OFFICIAL_FEE_SOURCE_USE_POLICY_VERSION = 1 as const;

export const USPTO_OFFICIAL_FEE_SOURCE_USE_ASSUMPTIONS = Object.freeze([
  'The filing basis and class count are governed request inputs supplied by the caller and are not independently verified facts.',
  'The source may be used only while Method and official-fee Reference currentness are independently established by source admission.'
] as const);

export const USPTO_OFFICIAL_FEE_SOURCE_USE_LIMITATIONS = Object.freeze([
  'Only the USPTO electronic new-application base fee per class for Section 1 or Section 44 is covered.',
  'The resolved fee is a bounded source input and is not a Quote, payment instruction, filing authorization, legal conclusion, Recommendation, or Official Truth.',
  'Use is limited to MARKREG LOW-risk requests with the exact accepted Resolver Capability and Implementation Profile binding.'
] as const);

function unsupported(reason: string): CapabilitySourceUseContextResolutionV1 {
  return { status: 'UNSUPPORTED', reason };
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value === value.trim();
}

function exactIsoInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function methodIdentityValid(value: Readonly<ExactMethodSourceIdentity> | undefined): boolean {
  return Boolean(
    value &&
    nonEmpty(value.evidenceRef) &&
    value.evidenceRef === `brain-method-package:${value.packageId}@${value.packageVersion}` &&
    value.methodId === USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_ID &&
    value.methodVersionId === USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_METHOD_VERSION_ID &&
    value.evaluationId === USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_EVALUATION_ID &&
    nonEmpty(value.packageId) &&
    nonEmpty(value.packageVersion) &&
    nonEmpty(value.activationId) &&
    value.activationId.startsWith('brain-method-activation_')
  );
}

function referenceIdentityValid(
  value: Readonly<ExactReferenceSourceIdentity> | undefined,
  output: Readonly<UsptoOfficialFeeResolverOutputV1>
): boolean {
  return Boolean(
    value &&
    value.evidenceRef ===
      `official-fee-reference:${USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID}` &&
    value.sourceId === USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_REFERENCE_ID &&
    (typeof value.sourceVersion === 'number' || nonEmpty(value.sourceVersion)) &&
    value.sourceFingerprintSha256 === USPTO_OFFICIAL_FEE_RESOLVER_ACCEPTED_MATERIALIZATION_SHA256 &&
    output.reference.referenceId === value.sourceId &&
    output.reference.materializationFingerprintSha256 === value.sourceFingerprintSha256
  );
}

function exactRuntimeApplicability(
  runtimeExecution: unknown
): UsptoOfficialFeeResolverOutputV1 | undefined {
  if (
    !runtimeExecution ||
    typeof runtimeExecution !== 'object' ||
    Array.isArray(runtimeExecution)
  ) {
    return undefined;
  }
  const execution = runtimeExecution as Record<string, unknown>;
  const request = execution.request as Record<string, unknown> | undefined;
  const caller = request?.caller as Record<string, unknown> | undefined;
  const binding = execution.binding as Record<string, unknown> | undefined;
  const boundCapability = binding?.runtimeCapability as Record<string, unknown> | undefined;
  const boundImplementation = binding?.implementation as Record<string, unknown> | undefined;
  const outcome = execution.outcome as Record<string, unknown> | undefined;
  const returnValue = execution.returnValue as Record<string, unknown> | undefined;
  const receipt = execution.receipt as Record<string, unknown> | undefined;
  const receiptCapability = receipt?.runtimeCapability as Record<string, unknown> | undefined;
  const receiptImplementation = receipt?.implementation as Record<string, unknown> | undefined;

  if (
    !request ||
    !caller ||
    !binding ||
    !boundCapability ||
    !boundImplementation ||
    !outcome ||
    !returnValue ||
    !receipt ||
    !receiptCapability ||
    !receiptImplementation ||
    request.capabilityId !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID ||
    request.capabilityVersion !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION ||
    request.inputSchemaId !== USPTO_OFFICIAL_FEE_RESOLVER_INPUT_SCHEMA ||
    request.outputSchemaId !== USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA ||
    caller.callerProduct !== 'MARKREG' ||
    request.riskClass !== 'LOW' ||
    boundCapability.id !==
      USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION.runtimeCapabilityDefinitionId ||
    boundCapability.version !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION.version ||
    boundCapability.capabilityId !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID ||
    boundCapability.capabilityVersion !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION ||
    boundImplementation.id !==
      USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationProfileId ||
    boundImplementation.version !== USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.version ||
    boundImplementation.implementationKey !==
      USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationKey ||
    receipt.capabilityRequestId !== request.capabilityRequestId ||
    receipt.workspaceId !== caller.workspaceId ||
    receipt.principalId !== caller.principalId ||
    receipt.callerProduct !== caller.callerProduct ||
    !isDeepStrictEqual(receiptCapability, boundCapability) ||
    receiptImplementation.id !== boundImplementation.id ||
    receiptImplementation.version !== boundImplementation.version ||
    receiptImplementation.implementationKey !== boundImplementation.implementationKey ||
    outcome.status !== 'SUCCEEDED' ||
    returnValue.status !== 'COMPLETED' ||
    outcome.outputSchemaId !== USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA ||
    returnValue.outputSchemaId !== USPTO_OFFICIAL_FEE_RESOLVER_OUTPUT_SCHEMA ||
    !validateUsptoOfficialFeeResolverOutputV1(outcome.output) ||
    !validateUsptoOfficialFeeResolverOutputV1(returnValue.output) ||
    !isDeepStrictEqual(outcome.output, returnValue.output)
  ) {
    return undefined;
  }

  try {
    parseUsptoOfficialFeeResolverInputV1(request.input);
  } catch {
    return undefined;
  }
  return returnValue.output as UsptoOfficialFeeResolverOutputV1;
}

function validProductionEvidenceV2(
  evidence: Readonly<CapabilitySourceAdmissionEvidenceV2>
): evidence is ProductionCapabilitySourceAdmissionEvidenceV2 {
  if (
    evidence.schemaVersion !== 2 ||
    evidence.producer !== 'CAPABILITY_ENGINE' ||
    evidence.evidenceVersion !== 2 ||
    evidence.decision.decision !== 'PRODUCTION_ADMISSIBLE' ||
    !evidence.sourceOutput ||
    !exactIsoInstant(evidence.evaluatedAt) ||
    !SHA256.test(evidence.decisionFingerprintSha256) ||
    !SHA256.test(evidence.evidenceFingerprintSha256) ||
    !isDeepStrictEqual(evidence.authority, capabilitySourceAdmissionNoAuthorityConsequences) ||
    !isDeepStrictEqual(
      evidence.decision.authority,
      capabilitySourceAdmissionNoAuthorityConsequences
    )
  ) {
    return false;
  }
  if (canonicalJsonSha256V1(evidence.decision) !== evidence.decisionFingerprintSha256) return false;
  const basis = {
    schemaVersion: 2 as const,
    producer: 'CAPABILITY_ENGINE' as const,
    evidenceVersion: 2 as const,
    evaluatedAt: evidence.evaluatedAt,
    decisionFingerprintSha256: evidence.decisionFingerprintSha256,
    decision: evidence.decision,
    sourceOutput: evidence.sourceOutput,
    authority: capabilitySourceAdmissionNoAuthorityConsequences
  };
  return (
    canonicalJsonSha256V1(basis) === evidence.evidenceFingerprintSha256 &&
    evidence.evidenceId ===
      `capability-source-admission-evidence_${evidence.evidenceFingerprintSha256}`
  );
}

function evidenceMatchesRuntime(
  runtimeExecution: unknown,
  evidence: Readonly<CapabilitySourceAdmissionEvidenceV2>,
  output: Readonly<UsptoOfficialFeeResolverOutputV1>
): evidence is ProductionCapabilitySourceAdmissionEvidenceV2 {
  if (
    !runtimeExecution ||
    typeof runtimeExecution !== 'object' ||
    Array.isArray(runtimeExecution) ||
    !validProductionEvidenceV2(evidence)
  ) {
    return false;
  }

  const execution = runtimeExecution as {
    request: { capabilityRequestId: string };
    binding: { implementationBindingId: string };
    invocation: { capabilityInvocationId: string };
    outcome: { capabilityOutcomeId: string };
    returnValue: { capabilityReturnId: string };
    receipt: { sessionReceiptId: string; evidenceRefs: readonly string[] };
    replayed: boolean;
  };

  let sourceOutput;
  try {
    sourceOutput = resolveCapabilitySourceOutputIdentityV1(runtimeExecution);
  } catch {
    return false;
  }
  if (!sourceOutput || !isDeepStrictEqual(sourceOutput, evidence.sourceOutput)) return false;

  const historical = evidence.decision.historical;
  if (
    historical.capabilityRequestId !== execution.request.capabilityRequestId ||
    historical.implementationBindingId !== execution.binding.implementationBindingId ||
    historical.capabilityInvocationId !== execution.invocation.capabilityInvocationId ||
    historical.capabilityOutcomeId !== execution.outcome.capabilityOutcomeId ||
    historical.capabilityReturnId !== execution.returnValue.capabilityReturnId ||
    historical.sessionReceiptId !== execution.receipt.sessionReceiptId ||
    historical.replayed !== execution.replayed
  ) {
    return false;
  }

  const current = evidence.decision.current;
  if (
    current.capability.runtimeCapabilityDefinitionId !==
      USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION.runtimeCapabilityDefinitionId ||
    current.capability.version !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_DEFINITION.version ||
    current.capability.capabilityId !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID ||
    current.capability.capabilityVersion !== USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_VERSION ||
    current.implementation.implementationProfileId !==
      USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationProfileId ||
    current.implementation.version !== USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.version ||
    current.implementation.implementationKey !==
      USPTO_OFFICIAL_FEE_RESOLVER_IMPLEMENTATION_PROFILE.implementationKey ||
    current.implementation.status !== 'APPROVED'
  ) {
    return false;
  }

  const method = evidence.decision.methodSource;
  const references = evidence.decision.referenceSources;
  const reference = references?.[0];
  if (
    !method ||
    !reference ||
    references.length !== 1 ||
    !methodIdentityValid(method) ||
    !referenceIdentityValid(reference, output)
  ) {
    return false;
  }

  return (
    execution.receipt.evidenceRefs.includes(method.evidenceRef) &&
    execution.receipt.evidenceRefs.includes(reference.evidenceRef)
  );
}

export class UsptoOfficialFeeSourceUseContextAuthorityV1 implements CapabilitySourceUseContextAuthorityV1 {
  resolve(input: {
    runtimeExecution: unknown;
    evidence: Readonly<CapabilitySourceAdmissionEvidenceV2>;
  }): CapabilitySourceUseContextResolutionV1 {
    const output = exactRuntimeApplicability(input.runtimeExecution);
    if (!output) {
      return unsupported(
        'USPTO official-fee source use only supports the exact accepted MARKREG LOW-risk Resolver execution.'
      );
    }
    const evidence = input.evidence;
    if (!evidenceMatchesRuntime(input.runtimeExecution, evidence, output)) {
      return unsupported(
        'USPTO official-fee source use requires exact producer evidence, current bindings, output identity and Method/Reference currentness identities.'
      );
    }

    const execution = input.runtimeExecution as {
      request: { capabilityRequestId: string };
      returnValue: { capabilityReturnId: string };
      receipt: { sessionReceiptId: string };
    };
    const method = evidence.decision.methodSource;
    const reference = evidence.decision.referenceSources?.[0];
    if (!method || !reference) {
      return unsupported(
        'USPTO official-fee source use requires exact Method and Reference identities.'
      );
    }

    return Object.freeze({
      status: 'RESOLVED',
      policy: Object.freeze({
        policyId: USPTO_OFFICIAL_FEE_SOURCE_USE_POLICY_ID,
        policyVersion: USPTO_OFFICIAL_FEE_SOURCE_USE_POLICY_VERSION
      }),
      provenanceRefs: Object.freeze([
        `capability-request:${execution.request.capabilityRequestId}`,
        `capability-return:${execution.returnValue.capabilityReturnId}`,
        `capability-session-receipt:${execution.receipt.sessionReceiptId}`,
        method.evidenceRef,
        reference.evidenceRef,
        `official-fee-materialization-sha256:${output.reference.materializationFingerprintSha256}`
      ]),
      assumptions: USPTO_OFFICIAL_FEE_SOURCE_USE_ASSUMPTIONS,
      limitations: USPTO_OFFICIAL_FEE_SOURCE_USE_LIMITATIONS
    });
  }
}
