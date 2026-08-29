import {
  capabilityImplementationKinds,
  capabilityRuntimeNoAuthorityConsequences,
  parseCapabilityRequestV2Command,
  type CapabilityComposition,
  type CapabilityEligibilityDecision,
  type CapabilityInvocation,
  type CapabilityOutcome,
  type CapabilityRequestV2,
  type CapabilityReturn,
  type CapabilityUsage,
  type ImplementationBinding,
  type SessionReceipt
} from './capability-runtime.js';

export interface GovernedCapabilityRuntimeExecutionV2 {
  request: Readonly<CapabilityRequestV2>;
  eligibility: Readonly<CapabilityEligibilityDecision>;
  composition: Readonly<CapabilityComposition>;
  binding: Readonly<ImplementationBinding>;
  invocation: Readonly<CapabilityInvocation>;
  outcome: Readonly<CapabilityOutcome>;
  returnValue: Readonly<CapabilityReturn>;
  receipt: Readonly<SessionReceipt>;
  replayed: boolean;
}

export class CapabilityRuntimeExecutionContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CapabilityRuntimeExecutionContractError';
  }
}

type RecordValue = Record<string, unknown>;

function record(value: unknown, field: string): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CapabilityRuntimeExecutionContractError(`${field} must be an object.`);
  }
  return value as RecordValue;
}

function exactKeys(value: RecordValue, keys: readonly string[], field: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new CapabilityRuntimeExecutionContractError(`${field} has an unsupported shape.`);
  }
}

function allowedKeys(value: RecordValue, keys: readonly string[], field: string): void {
  const allowed = new Set(keys);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw new CapabilityRuntimeExecutionContractError(
      `${field} contains unsupported fields: ${unknown.join(', ')}.`
    );
  }
}

function text(value: unknown, field: string, maximum = 1000): string {
  if (typeof value !== 'string') {
    throw new CapabilityRuntimeExecutionContractError(`${field} must be a string.`);
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum) {
    throw new CapabilityRuntimeExecutionContractError(
      `${field} must contain between 1 and ${maximum} characters.`
    );
  }
  return cleaned;
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new CapabilityRuntimeExecutionContractError(`${field} must be a positive integer.`);
  }
  return Number(value);
}

function nonNegativeNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new CapabilityRuntimeExecutionContractError(
      `${field} must be a non-negative finite number.`
    );
  }
  return value;
}

function timestamp(value: unknown, field: string): string {
  const cleaned = text(value, field, 100);
  if (Number.isNaN(Date.parse(cleaned))) {
    throw new CapabilityRuntimeExecutionContractError(`${field} must be an ISO timestamp.`);
  }
  return cleaned;
}

function stringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 1000) {
    throw new CapabilityRuntimeExecutionContractError(`${field} must be a bounded string array.`);
  }
  const items = value.map((item, index) => text(item, `${field}[${index}]`, 2000));
  if (new Set(items).size !== items.length) {
    throw new CapabilityRuntimeExecutionContractError(`${field} must not contain duplicates.`);
  }
  return items;
}

function authority(value: unknown, field: string) {
  const parsed = record(value, field);
  exactKeys(parsed, Object.keys(capabilityRuntimeNoAuthorityConsequences), field);
  for (const [key, expected] of Object.entries(capabilityRuntimeNoAuthorityConsequences)) {
    if (parsed[key] !== expected) {
      throw new CapabilityRuntimeExecutionContractError(`${field}.${key} must remain false.`);
    }
  }
  return capabilityRuntimeNoAuthorityConsequences;
}

function usage(value: unknown): CapabilityUsage {
  const parsed = record(value, 'outcome.usage');
  allowedKeys(
    parsed,
    ['latencyMs', 'inputUnits', 'outputUnits', 'costMinor', 'currency'],
    'outcome.usage'
  );
  const result: CapabilityUsage = {};
  if (parsed.latencyMs !== undefined) {
    result.latencyMs = nonNegativeNumber(parsed.latencyMs, 'outcome.usage.latencyMs');
  }
  if (parsed.inputUnits !== undefined) {
    result.inputUnits = nonNegativeNumber(parsed.inputUnits, 'outcome.usage.inputUnits');
  }
  if (parsed.outputUnits !== undefined) {
    result.outputUnits = nonNegativeNumber(parsed.outputUnits, 'outcome.usage.outputUnits');
  }
  if (parsed.costMinor !== undefined) {
    result.costMinor = nonNegativeNumber(parsed.costMinor, 'outcome.usage.costMinor');
  }
  if (parsed.currency !== undefined) {
    result.currency = text(parsed.currency, 'outcome.usage.currency', 20);
  }
  return result;
}

function parseRequest(value: unknown): CapabilityRequestV2 {
  const request = record(value, 'request');
  exactKeys(
    request,
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
      'correlationId',
      'capabilityRequestId',
      'receivedAt'
    ],
    'request'
  );
  const command = parseCapabilityRequestV2Command({
    schemaVersion: request.schemaVersion,
    capabilityId: request.capabilityId,
    capabilityVersion: request.capabilityVersion,
    caller: request.caller,
    purpose: request.purpose,
    input: request.input,
    inputSchemaId: request.inputSchemaId,
    outputSchemaId: request.outputSchemaId,
    riskClass: request.riskClass,
    idempotencyKey: request.idempotencyKey,
    correlationId: request.correlationId
  });
  return {
    ...command,
    capabilityRequestId: text(
      request.capabilityRequestId,
      'request.capabilityRequestId',
      300
    ) as CapabilityRequestV2['capabilityRequestId'],
    receivedAt: timestamp(request.receivedAt, 'request.receivedAt')
  };
}

function parseEligibility(value: unknown): CapabilityEligibilityDecision {
  const item = record(value, 'eligibility');
  exactKeys(
    item,
    [
      'schemaVersion',
      'capabilityRequestId',
      'decision',
      'eligible',
      'policyVersion',
      'reason',
      'decidedAt'
    ],
    'eligibility'
  );
  if (item.schemaVersion !== 1 || item.decision !== 'ELIGIBLE' || item.eligible !== true) {
    throw new CapabilityRuntimeExecutionContractError(
      'eligibility must be an accepted ELIGIBLE decision.'
    );
  }
  return {
    schemaVersion: 1,
    capabilityRequestId: text(
      item.capabilityRequestId,
      'eligibility.capabilityRequestId',
      300
    ) as CapabilityEligibilityDecision['capabilityRequestId'],
    decision: 'ELIGIBLE',
    eligible: true,
    policyVersion: text(item.policyVersion, 'eligibility.policyVersion', 300),
    reason: text(item.reason, 'eligibility.reason', 2000),
    decidedAt: timestamp(item.decidedAt, 'eligibility.decidedAt')
  };
}

function parseComposition(value: unknown): CapabilityComposition {
  const item = record(value, 'composition');
  exactKeys(
    item,
    [
      'schemaVersion',
      'capabilityRequestId',
      'mode',
      'primaryImplementationProfileId',
      'supportingImplementationProfileIds',
      'criticImplementationProfileIds',
      'composedAt'
    ],
    'composition'
  );
  if (item.schemaVersion !== 1 || item.mode !== 'SINGLE_IMPLEMENTATION') {
    throw new CapabilityRuntimeExecutionContractError(
      'composition must use SINGLE_IMPLEMENTATION.'
    );
  }
  return {
    schemaVersion: 1,
    capabilityRequestId: text(
      item.capabilityRequestId,
      'composition.capabilityRequestId',
      300
    ) as CapabilityComposition['capabilityRequestId'],
    mode: 'SINGLE_IMPLEMENTATION',
    primaryImplementationProfileId: text(
      item.primaryImplementationProfileId,
      'composition.primaryImplementationProfileId',
      300
    ) as CapabilityComposition['primaryImplementationProfileId'],
    supportingImplementationProfileIds: stringList(
      item.supportingImplementationProfileIds,
      'composition.supportingImplementationProfileIds'
    ) as CapabilityComposition['supportingImplementationProfileIds'],
    criticImplementationProfileIds: stringList(
      item.criticImplementationProfileIds,
      'composition.criticImplementationProfileIds'
    ) as CapabilityComposition['criticImplementationProfileIds'],
    composedAt: timestamp(item.composedAt, 'composition.composedAt')
  };
}

function parseBinding(value: unknown): ImplementationBinding {
  const item = record(value, 'binding');
  exactKeys(
    item,
    [
      'schemaVersion',
      'implementationBindingId',
      'capabilityRequestId',
      'runtimeCapability',
      'implementation',
      'selectionPolicyVersion',
      'boundAt'
    ],
    'binding'
  );
  if (item.schemaVersion !== 1) {
    throw new CapabilityRuntimeExecutionContractError('binding.schemaVersion must be 1.');
  }
  const runtimeCapability = record(item.runtimeCapability, 'binding.runtimeCapability');
  exactKeys(
    runtimeCapability,
    ['id', 'version', 'capabilityId', 'capabilityVersion'],
    'binding.runtimeCapability'
  );
  const implementation = record(item.implementation, 'binding.implementation');
  exactKeys(
    implementation,
    ['id', 'version', 'implementationKey', 'kind'],
    'binding.implementation'
  );
  if (
    typeof implementation.kind !== 'string' ||
    !(capabilityImplementationKinds as readonly string[]).includes(implementation.kind)
  ) {
    throw new CapabilityRuntimeExecutionContractError('binding.implementation.kind is invalid.');
  }
  return {
    schemaVersion: 1,
    implementationBindingId: text(
      item.implementationBindingId,
      'binding.implementationBindingId',
      300
    ) as ImplementationBinding['implementationBindingId'],
    capabilityRequestId: text(
      item.capabilityRequestId,
      'binding.capabilityRequestId',
      300
    ) as ImplementationBinding['capabilityRequestId'],
    runtimeCapability: {
      id: text(
        runtimeCapability.id,
        'binding.runtimeCapability.id',
        300
      ) as ImplementationBinding['runtimeCapability']['id'],
      version: positiveInteger(runtimeCapability.version, 'binding.runtimeCapability.version'),
      capabilityId: text(
        runtimeCapability.capabilityId,
        'binding.runtimeCapability.capabilityId',
        300
      ),
      capabilityVersion: text(
        runtimeCapability.capabilityVersion,
        'binding.runtimeCapability.capabilityVersion',
        120
      )
    },
    implementation: {
      id: text(
        implementation.id,
        'binding.implementation.id',
        300
      ) as ImplementationBinding['implementation']['id'],
      version: positiveInteger(implementation.version, 'binding.implementation.version'),
      implementationKey: text(
        implementation.implementationKey,
        'binding.implementation.implementationKey',
        500
      ),
      kind: implementation.kind as ImplementationBinding['implementation']['kind']
    },
    selectionPolicyVersion: text(
      item.selectionPolicyVersion,
      'binding.selectionPolicyVersion',
      300
    ),
    boundAt: timestamp(item.boundAt, 'binding.boundAt')
  };
}

function parseInvocation(value: unknown): CapabilityInvocation {
  const item = record(value, 'invocation');
  exactKeys(
    item,
    [
      'schemaVersion',
      'capabilityInvocationId',
      'capabilityRequestId',
      'implementationBindingId',
      'attempt',
      'timeoutMs',
      'status',
      'startedAt',
      'completedAt'
    ],
    'invocation'
  );
  if (item.schemaVersion !== 1 || item.status !== 'COMPLETED') {
    throw new CapabilityRuntimeExecutionContractError('invocation must be COMPLETED.');
  }
  return {
    schemaVersion: 1,
    capabilityInvocationId: text(
      item.capabilityInvocationId,
      'invocation.capabilityInvocationId',
      300
    ) as CapabilityInvocation['capabilityInvocationId'],
    capabilityRequestId: text(
      item.capabilityRequestId,
      'invocation.capabilityRequestId',
      300
    ) as CapabilityInvocation['capabilityRequestId'],
    implementationBindingId: text(
      item.implementationBindingId,
      'invocation.implementationBindingId',
      300
    ) as CapabilityInvocation['implementationBindingId'],
    attempt: positiveInteger(item.attempt, 'invocation.attempt'),
    timeoutMs: positiveInteger(item.timeoutMs, 'invocation.timeoutMs'),
    status: 'COMPLETED',
    startedAt: timestamp(item.startedAt, 'invocation.startedAt'),
    completedAt: timestamp(item.completedAt, 'invocation.completedAt')
  };
}

function parseOutcome(value: unknown): CapabilityOutcome {
  const item = record(value, 'outcome');
  allowedKeys(
    item,
    [
      'schemaVersion',
      'capabilityOutcomeId',
      'capabilityRequestId',
      'capabilityInvocationId',
      'status',
      'outputSchemaId',
      'output',
      'evidenceRefs',
      'usage',
      'completedAt',
      'authority'
    ],
    'outcome'
  );
  if (item.schemaVersion !== 1 || item.status !== 'SUCCEEDED' || item.output === undefined) {
    throw new CapabilityRuntimeExecutionContractError(
      'outcome must be a successful output-bearing result.'
    );
  }
  return {
    schemaVersion: 1,
    capabilityOutcomeId: text(
      item.capabilityOutcomeId,
      'outcome.capabilityOutcomeId',
      300
    ) as CapabilityOutcome['capabilityOutcomeId'],
    capabilityRequestId: text(
      item.capabilityRequestId,
      'outcome.capabilityRequestId',
      300
    ) as CapabilityOutcome['capabilityRequestId'],
    capabilityInvocationId: text(
      item.capabilityInvocationId,
      'outcome.capabilityInvocationId',
      300
    ) as CapabilityOutcome['capabilityInvocationId'],
    status: 'SUCCEEDED',
    outputSchemaId: text(item.outputSchemaId, 'outcome.outputSchemaId', 300),
    output: structuredClone(item.output),
    evidenceRefs: stringList(item.evidenceRefs, 'outcome.evidenceRefs'),
    ...(item.usage === undefined ? {} : { usage: usage(item.usage) }),
    completedAt: timestamp(item.completedAt, 'outcome.completedAt'),
    authority: authority(item.authority, 'outcome.authority')
  };
}

function parseReturn(value: unknown): CapabilityReturn {
  const item = record(value, 'returnValue');
  exactKeys(
    item,
    [
      'schemaVersion',
      'capabilityReturnId',
      'capabilityRequestId',
      'capabilityOutcomeId',
      'status',
      'outputSchemaId',
      'output',
      'evidenceRefs',
      'returnedAt',
      'authority'
    ],
    'returnValue'
  );
  if (item.schemaVersion !== 1 || item.status !== 'COMPLETED' || item.output === undefined) {
    throw new CapabilityRuntimeExecutionContractError('returnValue must be COMPLETED with output.');
  }
  return {
    schemaVersion: 1,
    capabilityReturnId: text(
      item.capabilityReturnId,
      'returnValue.capabilityReturnId',
      300
    ) as CapabilityReturn['capabilityReturnId'],
    capabilityRequestId: text(
      item.capabilityRequestId,
      'returnValue.capabilityRequestId',
      300
    ) as CapabilityReturn['capabilityRequestId'],
    capabilityOutcomeId: text(
      item.capabilityOutcomeId,
      'returnValue.capabilityOutcomeId',
      300
    ) as CapabilityReturn['capabilityOutcomeId'],
    status: 'COMPLETED',
    outputSchemaId: text(item.outputSchemaId, 'returnValue.outputSchemaId', 300),
    output: structuredClone(item.output),
    evidenceRefs: stringList(item.evidenceRefs, 'returnValue.evidenceRefs'),
    returnedAt: timestamp(item.returnedAt, 'returnValue.returnedAt'),
    authority: authority(item.authority, 'returnValue.authority')
  };
}

function parseReceipt(value: unknown): SessionReceipt {
  const item = record(value, 'receipt');
  exactKeys(
    item,
    [
      'schemaVersion',
      'sessionReceiptId',
      'capabilityRequestId',
      'correlationId',
      'workspaceId',
      'principalId',
      'callerProduct',
      'runtimeCapability',
      'implementation',
      'capabilityInvocationId',
      'capabilityOutcomeId',
      'capabilityReturnId',
      'evidenceRefs',
      'createdAt',
      'authority'
    ],
    'receipt'
  );
  if (item.schemaVersion !== 1) {
    throw new CapabilityRuntimeExecutionContractError('receipt.schemaVersion must be 1.');
  }
  const runtimeCapability = record(item.runtimeCapability, 'receipt.runtimeCapability');
  exactKeys(
    runtimeCapability,
    ['id', 'version', 'capabilityId', 'capabilityVersion'],
    'receipt.runtimeCapability'
  );
  const implementation = record(item.implementation, 'receipt.implementation');
  exactKeys(implementation, ['id', 'version', 'implementationKey'], 'receipt.implementation');
  return {
    schemaVersion: 1,
    sessionReceiptId: text(
      item.sessionReceiptId,
      'receipt.sessionReceiptId',
      300
    ) as SessionReceipt['sessionReceiptId'],
    capabilityRequestId: text(
      item.capabilityRequestId,
      'receipt.capabilityRequestId',
      300
    ) as SessionReceipt['capabilityRequestId'],
    correlationId: text(item.correlationId, 'receipt.correlationId', 300),
    workspaceId: text(item.workspaceId, 'receipt.workspaceId', 300),
    principalId: text(item.principalId, 'receipt.principalId', 300),
    callerProduct: text(item.callerProduct, 'receipt.callerProduct', 120),
    runtimeCapability: {
      id: text(
        runtimeCapability.id,
        'receipt.runtimeCapability.id',
        300
      ) as SessionReceipt['runtimeCapability']['id'],
      version: positiveInteger(runtimeCapability.version, 'receipt.runtimeCapability.version'),
      capabilityId: text(
        runtimeCapability.capabilityId,
        'receipt.runtimeCapability.capabilityId',
        300
      ),
      capabilityVersion: text(
        runtimeCapability.capabilityVersion,
        'receipt.runtimeCapability.capabilityVersion',
        120
      )
    },
    implementation: {
      id: text(
        implementation.id,
        'receipt.implementation.id',
        300
      ) as SessionReceipt['implementation']['id'],
      version: positiveInteger(implementation.version, 'receipt.implementation.version'),
      implementationKey: text(
        implementation.implementationKey,
        'receipt.implementation.implementationKey',
        500
      )
    },
    capabilityInvocationId: text(
      item.capabilityInvocationId,
      'receipt.capabilityInvocationId',
      300
    ) as SessionReceipt['capabilityInvocationId'],
    capabilityOutcomeId: text(
      item.capabilityOutcomeId,
      'receipt.capabilityOutcomeId',
      300
    ) as SessionReceipt['capabilityOutcomeId'],
    capabilityReturnId: text(
      item.capabilityReturnId,
      'receipt.capabilityReturnId',
      300
    ) as SessionReceipt['capabilityReturnId'],
    evidenceRefs: stringList(item.evidenceRefs, 'receipt.evidenceRefs'),
    createdAt: timestamp(item.createdAt, 'receipt.createdAt'),
    authority: authority(item.authority, 'receipt.authority')
  };
}

function exactEvidence(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function parseGovernedCapabilityRuntimeExecutionV2(
  value: unknown
): GovernedCapabilityRuntimeExecutionV2 {
  const execution = record(value, 'execution');
  exactKeys(
    execution,
    [
      'request',
      'eligibility',
      'composition',
      'binding',
      'invocation',
      'outcome',
      'returnValue',
      'receipt',
      'replayed'
    ],
    'execution'
  );
  if (typeof execution.replayed !== 'boolean') {
    throw new CapabilityRuntimeExecutionContractError('execution.replayed must be boolean.');
  }

  const request = parseRequest(execution.request);
  const eligibility = parseEligibility(execution.eligibility);
  const composition = parseComposition(execution.composition);
  const binding = parseBinding(execution.binding);
  const invocation = parseInvocation(execution.invocation);
  const outcome = parseOutcome(execution.outcome);
  const returnValue = parseReturn(execution.returnValue);
  const receipt = parseReceipt(execution.receipt);
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
    throw new CapabilityRuntimeExecutionContractError(
      'Capability request linkage is inconsistent.'
    );
  }
  if (
    invocation.implementationBindingId !== binding.implementationBindingId ||
    outcome.capabilityInvocationId !== invocation.capabilityInvocationId ||
    receipt.capabilityInvocationId !== invocation.capabilityInvocationId ||
    returnValue.capabilityOutcomeId !== outcome.capabilityOutcomeId ||
    receipt.capabilityOutcomeId !== outcome.capabilityOutcomeId ||
    receipt.capabilityReturnId !== returnValue.capabilityReturnId
  ) {
    throw new CapabilityRuntimeExecutionContractError(
      'Capability execution linkage is inconsistent.'
    );
  }
  if (
    composition.primaryImplementationProfileId !== binding.implementation.id ||
    receipt.runtimeCapability.id !== binding.runtimeCapability.id ||
    receipt.runtimeCapability.version !== binding.runtimeCapability.version ||
    receipt.runtimeCapability.capabilityId !== binding.runtimeCapability.capabilityId ||
    receipt.runtimeCapability.capabilityVersion !== binding.runtimeCapability.capabilityVersion ||
    receipt.implementation.id !== binding.implementation.id ||
    receipt.implementation.version !== binding.implementation.version ||
    receipt.implementation.implementationKey !== binding.implementation.implementationKey
  ) {
    throw new CapabilityRuntimeExecutionContractError(
      'Capability binding and receipt are inconsistent.'
    );
  }
  if (
    returnValue.outputSchemaId !== outcome.outputSchemaId ||
    JSON.stringify(returnValue.output) !== JSON.stringify(outcome.output) ||
    !exactEvidence(outcome.evidenceRefs, returnValue.evidenceRefs) ||
    !exactEvidence(outcome.evidenceRefs, receipt.evidenceRefs)
  ) {
    throw new CapabilityRuntimeExecutionContractError(
      'Capability result and receipt evidence are inconsistent.'
    );
  }

  return {
    request,
    eligibility,
    composition,
    binding,
    invocation,
    outcome,
    returnValue,
    receipt,
    replayed: execution.replayed
  };
}
