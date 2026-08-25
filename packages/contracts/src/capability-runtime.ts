import type {
  RuntimeCapabilityDefinitionId
} from './capability-learning.js';

export type CapabilityRequestV2Id = `capreq_${string}`;
export type ImplementationProfileId = `implementation-profile_${string}`;
export type ImplementationBindingId = `implementation-binding_${string}`;
export type CapabilityInvocationId = `capability-invocation_${string}`;
export type CapabilityOutcomeId = `capability-outcome_${string}`;
export type CapabilityReturnId = `capability-return_${string}`;
export type SessionReceiptId = `session-receipt_${string}`;

export const capabilityImplementationKinds = [
  'DETERMINISTIC_SERVICE',
  'AI_ASSISTED_SERVICE',
  'WORKFLOW',
  'SKILL_AGENT',
  'HUMAN_REVIEWED',
  'EXTERNAL_PROVIDER',
  'COMPOSITE'
] as const;
export type CapabilityImplementationKind = (typeof capabilityImplementationKinds)[number];

export const capabilityRiskClasses = ['LOW', 'MODERATE', 'HIGH', 'PROTECTED'] as const;
export type CapabilityRiskClass = (typeof capabilityRiskClasses)[number];

export interface TrustedCapabilityCallerContext {
  workspaceId: string;
  principalId: string;
  callerProduct: string;
  permissionContextRef: string;
  entitlementContextRef?: string;
}

export interface CapabilityRequestV2Command {
  schemaVersion: 2;
  capabilityId: string;
  capabilityVersion: string;
  caller: Readonly<TrustedCapabilityCallerContext>;
  purpose: string;
  input: unknown;
  inputSchemaId: string;
  outputSchemaId: string;
  riskClass: CapabilityRiskClass;
  idempotencyKey: string;
  correlationId: string;
}

export interface CapabilityRequestV2 extends CapabilityRequestV2Command {
  capabilityRequestId: CapabilityRequestV2Id;
  receivedAt: string;
}

export interface ImplementationProfile {
  schemaVersion: 1;
  implementationProfileId: ImplementationProfileId;
  version: number;
  capabilityId: string;
  capabilityVersion: string;
  kind: CapabilityImplementationKind;
  status: 'APPROVED' | 'RETIRED';
  implementationKey: string;
  inputSchemaId: string;
  outputSchemaId: string;
  allowedCallerProducts: readonly string[];
  maximumRiskClass: CapabilityRiskClass;
  timeoutMs: number;
  maxAttempts: number;
  approvalPolicyVersion: string;
  createdAt: string;
}

export interface CapabilityEligibilityDecision {
  schemaVersion: 1;
  capabilityRequestId: CapabilityRequestV2Id;
  decision:
    | 'ELIGIBLE'
    | 'CAPABILITY_NOT_FOUND'
    | 'CAPABILITY_VERSION_MISMATCH'
    | 'CALLER_NOT_ALLOWED'
    | 'SCHEMA_MISMATCH'
    | 'RISK_NOT_ALLOWED'
    | 'NO_APPROVED_IMPLEMENTATION';
  eligible: boolean;
  policyVersion: string;
  reason: string;
  decidedAt: string;
}

export interface CapabilityComposition {
  schemaVersion: 1;
  capabilityRequestId: CapabilityRequestV2Id;
  mode: 'SINGLE_IMPLEMENTATION';
  primaryImplementationProfileId: ImplementationProfileId;
  supportingImplementationProfileIds: readonly ImplementationProfileId[];
  criticImplementationProfileIds: readonly ImplementationProfileId[];
  composedAt: string;
}

export interface ImplementationBinding {
  schemaVersion: 1;
  implementationBindingId: ImplementationBindingId;
  capabilityRequestId: CapabilityRequestV2Id;
  runtimeCapability: Readonly<{
    id: RuntimeCapabilityDefinitionId;
    version: number;
    capabilityId: string;
    capabilityVersion: string;
  }>;
  implementation: Readonly<{
    id: ImplementationProfileId;
    version: number;
    implementationKey: string;
    kind: CapabilityImplementationKind;
  }>;
  selectionPolicyVersion: string;
  boundAt: string;
}

export interface CapabilityInvocation {
  schemaVersion: 1;
  capabilityInvocationId: CapabilityInvocationId;
  capabilityRequestId: CapabilityRequestV2Id;
  implementationBindingId: ImplementationBindingId;
  attempt: number;
  timeoutMs: number;
  status: 'STARTED' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt?: string;
}

export interface CapabilityUsage {
  latencyMs?: number;
  inputUnits?: number;
  outputUnits?: number;
  costMinor?: number;
  currency?: string;
}

export interface CapabilityRuntimeAuthorityConsequences {
  canonicalTruthCreated: false;
  capabilityCanonMutated: false;
  professionalDecisionCreated: false;
  providerSelectionAuthorityGrantedToCaller: false;
  paymentCreated: false;
  filingSubmitted: false;
  externalMessageSent: false;
  externalProfessionalActionExecuted: false;
}

export const capabilityRuntimeNoAuthorityConsequences = Object.freeze({
  canonicalTruthCreated: false,
  capabilityCanonMutated: false,
  professionalDecisionCreated: false,
  providerSelectionAuthorityGrantedToCaller: false,
  paymentCreated: false,
  filingSubmitted: false,
  externalMessageSent: false,
  externalProfessionalActionExecuted: false
}) satisfies Readonly<CapabilityRuntimeAuthorityConsequences>;

export interface CapabilityOutcomeError {
  code:
    | 'IMPLEMENTATION_FAILED'
    | 'OUTPUT_CONTRACT_INVALID'
    | 'IMPLEMENTATION_TIMEOUT'
    | 'UNKNOWN_IMPLEMENTATION_FAILURE';
  message: string;
  retryable: boolean;
}

export interface CapabilityOutcome {
  schemaVersion: 1;
  capabilityOutcomeId: CapabilityOutcomeId;
  capabilityRequestId: CapabilityRequestV2Id;
  capabilityInvocationId: CapabilityInvocationId;
  status: 'SUCCEEDED' | 'FAILED' | 'REQUIRES_REVIEW';
  outputSchemaId: string;
  output?: unknown;
  error?: Readonly<CapabilityOutcomeError>;
  evidenceRefs: readonly string[];
  usage?: Readonly<CapabilityUsage>;
  completedAt: string;
  authority: Readonly<CapabilityRuntimeAuthorityConsequences>;
}

export interface CapabilityReturn {
  schemaVersion: 1;
  capabilityReturnId: CapabilityReturnId;
  capabilityRequestId: CapabilityRequestV2Id;
  capabilityOutcomeId: CapabilityOutcomeId;
  status: 'COMPLETED' | 'FAILED' | 'REVIEW_REQUIRED';
  outputSchemaId: string;
  output?: unknown;
  error?: Readonly<CapabilityOutcomeError>;
  evidenceRefs: readonly string[];
  returnedAt: string;
  authority: Readonly<CapabilityRuntimeAuthorityConsequences>;
}

export interface SessionReceipt {
  schemaVersion: 1;
  sessionReceiptId: SessionReceiptId;
  capabilityRequestId: CapabilityRequestV2Id;
  correlationId: string;
  workspaceId: string;
  principalId: string;
  callerProduct: string;
  runtimeCapability: Readonly<{
    id: RuntimeCapabilityDefinitionId;
    version: number;
    capabilityId: string;
    capabilityVersion: string;
  }>;
  implementation: Readonly<{
    id: ImplementationProfileId;
    version: number;
    implementationKey: string;
  }>;
  capabilityInvocationId: CapabilityInvocationId;
  capabilityOutcomeId: CapabilityOutcomeId;
  capabilityReturnId: CapabilityReturnId;
  evidenceRefs: readonly string[];
  createdAt: string;
  authority: Readonly<CapabilityRuntimeAuthorityConsequences>;
}

export class CapabilityRuntimeContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CapabilityRuntimeContractError';
  }
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new CapabilityRuntimeContractError(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const allow = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allow.has(key));
  if (unknown.length)
    throw new CapabilityRuntimeContractError(
      `${field} contains unsupported fields: ${unknown.join(', ')}.`
    );
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string')
    throw new CapabilityRuntimeContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new CapabilityRuntimeContractError(
      `${field} must contain 1 to ${maximum} characters.`
    );
  return cleaned;
}

function riskClass(value: unknown): CapabilityRiskClass {
  if (
    typeof value !== 'string' ||
    !(capabilityRiskClasses as readonly string[]).includes(value)
  )
    throw new CapabilityRuntimeContractError('riskClass is invalid.');
  return value as CapabilityRiskClass;
}

export function parseCapabilityRequestV2Command(value: unknown): CapabilityRequestV2Command {
  const command = record(value, 'command');
  exactKeys(
    command,
    [
      'schemaVersion',
      'capabilityId',
      'capabilityVersion',
      'caller',
      'purpose',
      'input',
      'inputSchemaId',
      'outputSchemaId',
      'riskClass',
      'idempotencyKey',
      'correlationId'
    ],
    'command'
  );
  if (command.schemaVersion !== 2)
    throw new CapabilityRuntimeContractError('schemaVersion must be 2.');

  const caller = record(command.caller, 'caller');
  exactKeys(
    caller,
    [
      'workspaceId',
      'principalId',
      'callerProduct',
      'permissionContextRef',
      'entitlementContextRef'
    ],
    'caller'
  );

  const entitlementContextRef =
    caller.entitlementContextRef === undefined
      ? undefined
      : text(caller.entitlementContextRef, 'caller.entitlementContextRef', 500);

  return {
    schemaVersion: 2,
    capabilityId: text(command.capabilityId, 'capabilityId', 300),
    capabilityVersion: text(command.capabilityVersion, 'capabilityVersion', 120),
    caller: {
      workspaceId: text(caller.workspaceId, 'caller.workspaceId', 300),
      principalId: text(caller.principalId, 'caller.principalId', 300),
      callerProduct: text(caller.callerProduct, 'caller.callerProduct', 120),
      permissionContextRef: text(caller.permissionContextRef, 'caller.permissionContextRef', 500),
      ...(entitlementContextRef ? { entitlementContextRef } : {})
    },
    purpose: text(command.purpose, 'purpose', 1000),
    input: structuredClone(command.input),
    inputSchemaId: text(command.inputSchemaId, 'inputSchemaId', 300),
    outputSchemaId: text(command.outputSchemaId, 'outputSchemaId', 300),
    riskClass: riskClass(command.riskClass),
    idempotencyKey: text(command.idempotencyKey, 'idempotencyKey', 300),
    correlationId: text(command.correlationId, 'correlationId', 300)
  };
}
