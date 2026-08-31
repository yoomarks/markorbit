import { isDeepStrictEqual } from 'node:util';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import {
  capabilityRuntimeNoAuthorityConsequences,
  type CapabilityRiskClass,
  type ImplementationProfile
} from '@markorbit/contracts/capability-runtime';
import type { CapabilityRuntimeExecution } from './capability-runtime.js';

const SHA256 = /^[0-9a-f]{64}$/;
const RISK_RANK: Readonly<Record<CapabilityRiskClass, number>> = Object.freeze({
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  PROTECTED: 3
});

export type CapabilitySourceAdmissionDenialCode =
  | 'INVALID_PRODUCER_EVIDENCE'
  | 'NON_CURRENT_CAPABILITY_BINDING'
  | 'NON_CURRENT_IMPLEMENTATION_BINDING'
  | 'SOURCE_REFERENCE_NOT_CURRENT'
  | 'UNSUPPORTED_APPLICABILITY'
  | 'DEPENDENCY_RUNTIME_UNAVAILABLE';

export interface CapabilitySourceAdmissionAuthorityConsequences {
  productBusinessStateCreated: false;
  productAuthorizationGranted: false;
  officialTruthCreated: false;
  methodImprovementTriggerCreated: false;
  automaticFallbackExecuted: false;
  syntheticSourceCreated: false;
}

export const capabilitySourceAdmissionNoAuthorityConsequences = Object.freeze({
  productBusinessStateCreated: false,
  productAuthorizationGranted: false,
  officialTruthCreated: false,
  methodImprovementTriggerCreated: false,
  automaticFallbackExecuted: false,
  syntheticSourceCreated: false
}) satisfies Readonly<CapabilitySourceAdmissionAuthorityConsequences>;

export interface CurrentRuntimeCapabilityAuthority {
  findCurrent(capabilityId: string): Promise<RuntimeCapabilityDefinition | undefined>;
}

export interface CurrentImplementationProfileAuthority {
  findCurrent(
    implementationProfileId: string
  ):
    | Readonly<ImplementationProfile>
    | undefined
    | Promise<Readonly<ImplementationProfile> | undefined>;
}

export interface CapabilitySourceAdmissionPolicyInput {
  execution: Readonly<CapabilityRuntimeExecution>;
  currentCapability: Readonly<RuntimeCapabilityDefinition>;
  currentImplementation: Readonly<ImplementationProfile>;
}

export type CapabilitySourceAdmissionPolicyResult =
  | Readonly<{
      applicability: 'SUPPORTED';
      methodCurrentness: 'REQUIRED' | 'NOT_REQUIRED';
      referenceCurrentness: 'REQUIRED' | 'NOT_REQUIRED';
    }>
  | Readonly<{
      applicability: 'UNSUPPORTED';
      reason: string;
    }>
  | Readonly<{
      applicability: 'UNAVAILABLE';
      reason: string;
    }>;

export interface CapabilitySourceAdmissionPolicyAuthority {
  evaluate(
    input: Readonly<CapabilitySourceAdmissionPolicyInput>
  ): CapabilitySourceAdmissionPolicyResult | Promise<CapabilitySourceAdmissionPolicyResult>;
}

export interface ExactMethodSourceIdentity {
  evidenceRef: string;
  methodId: string;
  methodVersionId: string;
  packageId: string;
  packageVersion: string;
  activationId: string;
  evaluationId: string;
}

export type CapabilityMethodCurrentnessResult =
  | Readonly<{
      status: 'CURRENT';
      identity: Readonly<ExactMethodSourceIdentity>;
    }>
  | Readonly<{
      status: 'NOT_CURRENT';
      reason: string;
    }>
  | Readonly<{
      status: 'UNSUPPORTED_APPLICABILITY';
      reason: string;
    }>
  | Readonly<{
      status: 'UNAVAILABLE';
      reason: string;
    }>;

export interface CapabilityMethodCurrentnessAuthority {
  evaluate(
    input: Readonly<CapabilitySourceAdmissionPolicyInput>
  ): CapabilityMethodCurrentnessResult | Promise<CapabilityMethodCurrentnessResult>;
}

export interface ExactReferenceSourceIdentity {
  evidenceRef: string;
  sourceId: string;
  sourceVersion: string | number;
  sourceFingerprintSha256?: string;
}

export type CapabilityReferenceCurrentnessResult =
  | Readonly<{
      status: 'CURRENT';
      references: readonly Readonly<ExactReferenceSourceIdentity>[];
    }>
  | Readonly<{
      status: 'NOT_CURRENT';
      reason: string;
    }>
  | Readonly<{
      status: 'UNSUPPORTED_APPLICABILITY';
      reason: string;
    }>
  | Readonly<{
      status: 'UNAVAILABLE';
      reason: string;
    }>;

export interface CapabilityReferenceCurrentnessAuthority {
  evaluate(
    input: Readonly<CapabilitySourceAdmissionPolicyInput>
  ): CapabilityReferenceCurrentnessResult | Promise<CapabilityReferenceCurrentnessResult>;
}

export interface CurrentCapabilitySourceAdmissionEvaluatorOptions {
  capabilities: Readonly<CurrentRuntimeCapabilityAuthority>;
  implementations: Readonly<CurrentImplementationProfileAuthority>;
  policy: Readonly<CapabilitySourceAdmissionPolicyAuthority>;
  methodCurrentness?: Readonly<CapabilityMethodCurrentnessAuthority>;
  referenceCurrentness?: Readonly<CapabilityReferenceCurrentnessAuthority>;
}

export interface CapabilitySourceAdmissionHistoricalEvidence {
  capabilityRequestId: string;
  implementationBindingId: string;
  capabilityInvocationId: string;
  capabilityOutcomeId: string;
  capabilityReturnId: string;
  sessionReceiptId: string;
  replayed: boolean;
}

export interface CapabilitySourceAdmissionCurrentBinding {
  capability: Readonly<{
    runtimeCapabilityDefinitionId: string;
    version: number;
    capabilityId: string;
    capabilityVersion: string;
  }>;
  implementation: Readonly<{
    implementationProfileId: string;
    version: number;
    implementationKey: string;
    status: 'APPROVED';
  }>;
}

interface CapabilitySourceAdmissionDecisionBase {
  schemaVersion: 1;
  producer: 'CAPABILITY_ENGINE';
  historical: Readonly<CapabilitySourceAdmissionHistoricalEvidence>;
  authority: Readonly<CapabilitySourceAdmissionAuthorityConsequences>;
}

export type CapabilitySourceAdmissionDecision =
  | Readonly<
      CapabilitySourceAdmissionDecisionBase & {
        decision: 'PRODUCTION_ADMISSIBLE';
        current: Readonly<CapabilitySourceAdmissionCurrentBinding>;
        methodSource?: Readonly<ExactMethodSourceIdentity>;
        referenceSources?: readonly Readonly<ExactReferenceSourceIdentity>[];
      }
    >
  | Readonly<
      CapabilitySourceAdmissionDecisionBase & {
        decision: 'DENIED';
        denial: Readonly<{
          code: CapabilitySourceAdmissionDenialCode;
          reason: string;
        }>;
      }
    >;

function record(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function stringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.some((item) => !nonEmptyText(item))) return undefined;
  return value as readonly string[];
}

function authorityIsNoAuthority(value: unknown): boolean {
  return isDeepStrictEqual(value, capabilityRuntimeNoAuthorityConsequences);
}

function executionShape(value: unknown): CapabilityRuntimeExecution | undefined {
  const input = record(value);
  if (!input || typeof input.replayed !== 'boolean') return undefined;
  const requiredRecords = [
    'request',
    'eligibility',
    'composition',
    'binding',
    'invocation',
    'outcome',
    'returnValue',
    'receipt'
  ] as const;
  if (requiredRecords.some((key) => !record(input[key]))) return undefined;
  return value as CapabilityRuntimeExecution;
}

function validHistoricalExecution(execution: Readonly<CapabilityRuntimeExecution>): boolean {
  const request = record(execution.request)!;
  const eligibility = record(execution.eligibility)!;
  const composition = record(execution.composition)!;
  const binding = record(execution.binding)!;
  const invocation = record(execution.invocation)!;
  const outcome = record(execution.outcome)!;
  const returnValue = record(execution.returnValue)!;
  const receipt = record(execution.receipt)!;
  const requestCaller = record(request.caller);
  const bindingCapability = record(binding.runtimeCapability);
  const bindingImplementation = record(binding.implementation);
  const receiptCapability = record(receipt.runtimeCapability);
  const receiptImplementation = record(receipt.implementation);

  if (
    request.schemaVersion !== 2 ||
    eligibility.schemaVersion !== 1 ||
    composition.schemaVersion !== 1 ||
    binding.schemaVersion !== 1 ||
    invocation.schemaVersion !== 1 ||
    outcome.schemaVersion !== 1 ||
    returnValue.schemaVersion !== 1 ||
    receipt.schemaVersion !== 1 ||
    !requestCaller ||
    !bindingCapability ||
    !bindingImplementation ||
    !receiptCapability ||
    !receiptImplementation
  ) {
    return false;
  }

  const requiredTextValues = [
    request.capabilityRequestId,
    request.capabilityId,
    request.capabilityVersion,
    request.inputSchemaId,
    request.outputSchemaId,
    request.correlationId,
    requestCaller.workspaceId,
    requestCaller.principalId,
    requestCaller.callerProduct,
    eligibility.capabilityRequestId,
    eligibility.policyVersion,
    composition.capabilityRequestId,
    composition.primaryImplementationProfileId,
    binding.implementationBindingId,
    binding.capabilityRequestId,
    bindingCapability.id,
    bindingCapability.capabilityId,
    bindingCapability.capabilityVersion,
    bindingImplementation.id,
    bindingImplementation.implementationKey,
    bindingImplementation.kind,
    binding.selectionPolicyVersion,
    invocation.capabilityInvocationId,
    invocation.capabilityRequestId,
    invocation.implementationBindingId,
    outcome.capabilityOutcomeId,
    outcome.capabilityRequestId,
    outcome.capabilityInvocationId,
    outcome.outputSchemaId,
    returnValue.capabilityReturnId,
    returnValue.capabilityRequestId,
    returnValue.capabilityOutcomeId,
    returnValue.outputSchemaId,
    receipt.sessionReceiptId,
    receipt.capabilityRequestId,
    receipt.correlationId,
    receipt.workspaceId,
    receipt.principalId,
    receipt.callerProduct,
    receiptCapability.id,
    receiptCapability.capabilityId,
    receiptCapability.capabilityVersion,
    receiptImplementation.id,
    receiptImplementation.implementationKey,
    receipt.capabilityInvocationId,
    receipt.capabilityOutcomeId,
    receipt.capabilityReturnId
  ];
  if (requiredTextValues.some((item) => !nonEmptyText(item))) return false;

  if (
    !positiveInteger(bindingCapability.version) ||
    !positiveInteger(bindingImplementation.version) ||
    !positiveInteger(receiptCapability.version) ||
    !positiveInteger(receiptImplementation.version) ||
    !positiveInteger(invocation.attempt) ||
    !positiveInteger(invocation.timeoutMs)
  ) {
    return false;
  }

  const outcomeEvidence = stringArray(outcome.evidenceRefs);
  const returnEvidence = stringArray(returnValue.evidenceRefs);
  const receiptEvidence = stringArray(receipt.evidenceRefs);
  const supportingProfiles = stringArray(composition.supportingImplementationProfileIds);
  const criticProfiles = stringArray(composition.criticImplementationProfileIds);
  if (
    !outcomeEvidence ||
    !returnEvidence ||
    !receiptEvidence ||
    !supportingProfiles ||
    !criticProfiles
  ) {
    return false;
  }

  if (
    eligibility.eligible !== true ||
    eligibility.decision !== 'ELIGIBLE' ||
    composition.mode !== 'SINGLE_IMPLEMENTATION' ||
    supportingProfiles.length !== 0 ||
    criticProfiles.length !== 0
  ) {
    return false;
  }

  const requestId = request.capabilityRequestId;
  if (
    eligibility.capabilityRequestId !== requestId ||
    composition.capabilityRequestId !== requestId ||
    binding.capabilityRequestId !== requestId ||
    invocation.capabilityRequestId !== requestId ||
    outcome.capabilityRequestId !== requestId ||
    returnValue.capabilityRequestId !== requestId ||
    receipt.capabilityRequestId !== requestId
  ) {
    return false;
  }

  if (
    request.capabilityId !== bindingCapability.capabilityId ||
    request.capabilityVersion !== bindingCapability.capabilityVersion ||
    composition.primaryImplementationProfileId !== bindingImplementation.id ||
    eligibility.policyVersion !== binding.selectionPolicyVersion ||
    invocation.implementationBindingId !== binding.implementationBindingId ||
    outcome.capabilityInvocationId !== invocation.capabilityInvocationId ||
    returnValue.capabilityOutcomeId !== outcome.capabilityOutcomeId ||
    receipt.capabilityInvocationId !== invocation.capabilityInvocationId ||
    receipt.capabilityOutcomeId !== outcome.capabilityOutcomeId ||
    receipt.capabilityReturnId !== returnValue.capabilityReturnId
  ) {
    return false;
  }

  if (
    receipt.correlationId !== request.correlationId ||
    receipt.workspaceId !== requestCaller.workspaceId ||
    receipt.principalId !== requestCaller.principalId ||
    receipt.callerProduct !== requestCaller.callerProduct ||
    !isDeepStrictEqual(receiptCapability, bindingCapability) ||
    receiptImplementation.id !== bindingImplementation.id ||
    receiptImplementation.version !== bindingImplementation.version ||
    receiptImplementation.implementationKey !== bindingImplementation.implementationKey
  ) {
    return false;
  }

  if (
    request.outputSchemaId !== outcome.outputSchemaId ||
    outcome.outputSchemaId !== returnValue.outputSchemaId ||
    !arraysEqual(outcomeEvidence, returnEvidence) ||
    !arraysEqual(outcomeEvidence, receiptEvidence) ||
    !isDeepStrictEqual(outcome.output, returnValue.output) ||
    !isDeepStrictEqual(outcome.error, returnValue.error) ||
    !authorityIsNoAuthority(outcome.authority) ||
    !authorityIsNoAuthority(returnValue.authority) ||
    !authorityIsNoAuthority(receipt.authority)
  ) {
    return false;
  }

  if (outcome.status === 'SUCCEEDED') {
    return invocation.status === 'COMPLETED' && returnValue.status === 'COMPLETED';
  }
  if (outcome.status === 'REQUIRES_REVIEW') {
    return invocation.status === 'COMPLETED' && returnValue.status === 'REVIEW_REQUIRED';
  }
  if (outcome.status === 'FAILED') {
    return (
      (invocation.status === 'COMPLETED' || invocation.status === 'FAILED') &&
      returnValue.status === 'FAILED'
    );
  }
  return false;
}

function historicalEvidence(
  execution: Readonly<CapabilityRuntimeExecution>
): CapabilitySourceAdmissionHistoricalEvidence {
  return {
    capabilityRequestId: execution.request.capabilityRequestId,
    implementationBindingId: execution.binding.implementationBindingId,
    capabilityInvocationId: execution.invocation.capabilityInvocationId,
    capabilityOutcomeId: execution.outcome.capabilityOutcomeId,
    capabilityReturnId: execution.returnValue.capabilityReturnId,
    sessionReceiptId: execution.receipt.sessionReceiptId,
    replayed: execution.replayed
  };
}

function unknownHistoricalEvidence(): CapabilitySourceAdmissionHistoricalEvidence {
  return {
    capabilityRequestId: 'unknown',
    implementationBindingId: 'unknown',
    capabilityInvocationId: 'unknown',
    capabilityOutcomeId: 'unknown',
    capabilityReturnId: 'unknown',
    sessionReceiptId: 'unknown',
    replayed: false
  };
}

function denial(
  historical: Readonly<CapabilitySourceAdmissionHistoricalEvidence>,
  code: CapabilitySourceAdmissionDenialCode,
  reason: string
): CapabilitySourceAdmissionDecision {
  return {
    schemaVersion: 1,
    producer: 'CAPABILITY_ENGINE',
    decision: 'DENIED',
    historical: structuredClone(historical),
    denial: { code, reason },
    authority: capabilitySourceAdmissionNoAuthorityConsequences
  };
}

function currentCapabilityMatches(
  execution: Readonly<CapabilityRuntimeExecution>,
  current: Readonly<RuntimeCapabilityDefinition>
): boolean {
  const bound = execution.binding.runtimeCapability;
  return (
    current.acceptedCanonProjection === true &&
    current.createdFromWorkEvidence === false &&
    current.createdFromAiOutput === false &&
    current.runtimeCapabilityDefinitionId === bound.id &&
    current.version === bound.version &&
    current.capabilityId === bound.capabilityId &&
    current.capabilityVersion === bound.capabilityVersion
  );
}

function callerAllowed(
  profile: Readonly<ImplementationProfile>,
  execution: Readonly<CapabilityRuntimeExecution>
): boolean {
  return (
    profile.allowedCallerProducts.includes('*') ||
    profile.allowedCallerProducts.includes(execution.request.caller.callerProduct)
  );
}

function currentImplementationMatches(
  execution: Readonly<CapabilityRuntimeExecution>,
  current: Readonly<ImplementationProfile>
): boolean {
  const bound = execution.binding.implementation;
  return (
    current.status === 'APPROVED' &&
    current.implementationProfileId === bound.id &&
    current.version === bound.version &&
    current.implementationKey === bound.implementationKey &&
    current.kind === bound.kind &&
    current.capabilityId === execution.request.capabilityId &&
    current.capabilityVersion === execution.request.capabilityVersion &&
    current.inputSchemaId === execution.request.inputSchemaId &&
    current.outputSchemaId === execution.request.outputSchemaId &&
    current.timeoutMs === execution.invocation.timeoutMs &&
    current.maxAttempts === 1 &&
    callerAllowed(current, execution) &&
    RISK_RANK[execution.request.riskClass] <= RISK_RANK[current.maximumRiskClass]
  );
}

function exactMethodIdentity(value: Readonly<ExactMethodSourceIdentity>): boolean {
  return [
    value.evidenceRef,
    value.methodId,
    value.methodVersionId,
    value.packageId,
    value.packageVersion,
    value.activationId,
    value.evaluationId
  ].every(nonEmptyText);
}

function exactReferenceIdentity(value: Readonly<ExactReferenceSourceIdentity>): boolean {
  return (
    nonEmptyText(value.evidenceRef) &&
    nonEmptyText(value.sourceId) &&
    (nonEmptyText(value.sourceVersion) || positiveInteger(value.sourceVersion)) &&
    (value.sourceFingerprintSha256 === undefined || SHA256.test(value.sourceFingerprintSha256))
  );
}

function evidenceContains(
  execution: Readonly<CapabilityRuntimeExecution>,
  evidenceRef: string
): boolean {
  return execution.receipt.evidenceRefs.includes(evidenceRef);
}

export class CurrentCapabilitySourceAdmissionEvaluator {
  constructor(private readonly options: CurrentCapabilitySourceAdmissionEvaluatorOptions) {}

  async evaluate(value: unknown): Promise<CapabilitySourceAdmissionDecision> {
    const execution = executionShape(value);
    if (!execution || !validHistoricalExecution(execution)) {
      return denial(
        execution ? historicalEvidence(execution) : unknownHistoricalEvidence(),
        'INVALID_PRODUCER_EVIDENCE',
        'Governed runtime execution identity, integrity or provenance is missing or inconsistent.'
      );
    }

    const historical = historicalEvidence(execution);
    if (
      execution.outcome.status !== 'SUCCEEDED' ||
      execution.invocation.status !== 'COMPLETED' ||
      execution.returnValue.status !== 'COMPLETED'
    ) {
      return denial(
        historical,
        'DEPENDENCY_RUNTIME_UNAVAILABLE',
        'The historical governed runtime execution did not produce a successful completed source result.'
      );
    }

    let currentCapability: RuntimeCapabilityDefinition | undefined;
    try {
      currentCapability = await this.options.capabilities.findCurrent(
        execution.request.capabilityId
      );
    } catch {
      return denial(
        historical,
        'DEPENDENCY_RUNTIME_UNAVAILABLE',
        'Current Capability definition authority is unavailable.'
      );
    }
    if (!currentCapability || !currentCapabilityMatches(execution, currentCapability)) {
      return denial(
        historical,
        'NON_CURRENT_CAPABILITY_BINDING',
        'The historical Runtime Capability definition is not the current accepted producer definition.'
      );
    }

    let currentImplementation: Readonly<ImplementationProfile> | undefined;
    try {
      currentImplementation = await this.options.implementations.findCurrent(
        execution.binding.implementation.id
      );
    } catch {
      return denial(
        historical,
        'DEPENDENCY_RUNTIME_UNAVAILABLE',
        'Current Implementation Profile authority is unavailable.'
      );
    }
    if (!currentImplementation || !currentImplementationMatches(execution, currentImplementation)) {
      return denial(
        historical,
        'NON_CURRENT_IMPLEMENTATION_BINDING',
        'The historical Implementation Profile is not the current applicable APPROVED producer binding.'
      );
    }

    const policyInput: CapabilitySourceAdmissionPolicyInput = {
      execution,
      currentCapability,
      currentImplementation
    };
    let policy: CapabilitySourceAdmissionPolicyResult;
    try {
      policy = await this.options.policy.evaluate(policyInput);
    } catch {
      return denial(
        historical,
        'DEPENDENCY_RUNTIME_UNAVAILABLE',
        'Producer source-admission policy authority is unavailable.'
      );
    }
    if (policy.applicability === 'UNSUPPORTED') {
      return denial(historical, 'UNSUPPORTED_APPLICABILITY', policy.reason);
    }
    if (policy.applicability === 'UNAVAILABLE') {
      return denial(historical, 'DEPENDENCY_RUNTIME_UNAVAILABLE', policy.reason);
    }

    let methodSource: Readonly<ExactMethodSourceIdentity> | undefined;
    if (policy.methodCurrentness === 'REQUIRED') {
      if (!this.options.methodCurrentness) {
        return denial(
          historical,
          'DEPENDENCY_RUNTIME_UNAVAILABLE',
          'Method currentness is required but no bounded producer method authority is configured.'
        );
      }
      let methodResult: CapabilityMethodCurrentnessResult;
      try {
        methodResult = await this.options.methodCurrentness.evaluate(policyInput);
      } catch {
        return denial(
          historical,
          'DEPENDENCY_RUNTIME_UNAVAILABLE',
          'Method currentness authority is unavailable.'
        );
      }
      if (methodResult.status === 'NOT_CURRENT') {
        return denial(historical, 'SOURCE_REFERENCE_NOT_CURRENT', methodResult.reason);
      }
      if (methodResult.status === 'UNSUPPORTED_APPLICABILITY') {
        return denial(historical, 'UNSUPPORTED_APPLICABILITY', methodResult.reason);
      }
      if (methodResult.status === 'UNAVAILABLE') {
        return denial(historical, 'DEPENDENCY_RUNTIME_UNAVAILABLE', methodResult.reason);
      }
      if (
        !exactMethodIdentity(methodResult.identity) ||
        !evidenceContains(execution, methodResult.identity.evidenceRef)
      ) {
        return denial(
          historical,
          'INVALID_PRODUCER_EVIDENCE',
          'Method currentness authority did not bind a complete exact method identity to producer evidence.'
        );
      }
      methodSource = structuredClone(methodResult.identity);
    }

    let referenceSources: readonly Readonly<ExactReferenceSourceIdentity>[] | undefined;
    if (policy.referenceCurrentness === 'REQUIRED') {
      if (!this.options.referenceCurrentness) {
        return denial(
          historical,
          'DEPENDENCY_RUNTIME_UNAVAILABLE',
          'Reference currentness is required but no bounded producer source authority is configured.'
        );
      }
      let referenceResult: CapabilityReferenceCurrentnessResult;
      try {
        referenceResult = await this.options.referenceCurrentness.evaluate(policyInput);
      } catch {
        return denial(
          historical,
          'DEPENDENCY_RUNTIME_UNAVAILABLE',
          'Reference currentness authority is unavailable.'
        );
      }
      if (referenceResult.status === 'NOT_CURRENT') {
        return denial(historical, 'SOURCE_REFERENCE_NOT_CURRENT', referenceResult.reason);
      }
      if (referenceResult.status === 'UNSUPPORTED_APPLICABILITY') {
        return denial(historical, 'UNSUPPORTED_APPLICABILITY', referenceResult.reason);
      }
      if (referenceResult.status === 'UNAVAILABLE') {
        return denial(historical, 'DEPENDENCY_RUNTIME_UNAVAILABLE', referenceResult.reason);
      }
      if (
        referenceResult.references.length === 0 ||
        referenceResult.references.some(
          (reference) =>
            !exactReferenceIdentity(reference) ||
            !evidenceContains(execution, reference.evidenceRef)
        )
      ) {
        return denial(
          historical,
          'INVALID_PRODUCER_EVIDENCE',
          'Reference currentness authority did not bind complete source identities to producer evidence.'
        );
      }
      referenceSources = structuredClone(referenceResult.references);
    }

    return {
      schemaVersion: 1,
      producer: 'CAPABILITY_ENGINE',
      decision: 'PRODUCTION_ADMISSIBLE',
      historical: structuredClone(historical),
      current: {
        capability: {
          runtimeCapabilityDefinitionId: currentCapability.runtimeCapabilityDefinitionId,
          version: currentCapability.version,
          capabilityId: currentCapability.capabilityId,
          capabilityVersion: currentCapability.capabilityVersion
        },
        implementation: {
          implementationProfileId: currentImplementation.implementationProfileId,
          version: currentImplementation.version,
          implementationKey: currentImplementation.implementationKey,
          status: 'APPROVED'
        }
      },
      ...(methodSource ? { methodSource } : {}),
      ...(referenceSources ? { referenceSources } : {}),
      authority: capabilitySourceAdmissionNoAuthorityConsequences
    };
  }
}
