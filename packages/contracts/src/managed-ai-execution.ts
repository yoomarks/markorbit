export const MANAGED_AI_EXECUTION_CAPABILITY_ID = 'managed-ai-execution' as const;
export const MANAGED_AI_EXECUTION_CONTRACT_VERSION = '1.0.0' as const;

export const managedAiProcessingClasses = [
  'SOURCE_ACQUISITION',
  'REASONING',
  'CONTENT_GENERATION',
  'PROFESSIONAL_ASSISTANCE',
  'OTHER'
] as const;
export type ManagedAiProcessingClass = (typeof managedAiProcessingClasses)[number];

export const managedAiDataClassifications = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED'
] as const;
export type ManagedAiDataClassification = (typeof managedAiDataClassifications)[number];

export const managedAiOutputFormats = ['JSON', 'TEXT', 'MARKDOWN'] as const;
export type ManagedAiOutputFormat = (typeof managedAiOutputFormats)[number];

export const managedAiDeliveryStates = [
  'NOT_DELIVERED',
  'DELIVERED_CONFIRMED',
  'DELIVERY_UNCERTAIN',
  'PROVIDER_REJECTED',
  'PROVIDER_COMPLETED'
] as const;
export type ManagedAiDeliveryState = (typeof managedAiDeliveryStates)[number];

export const managedAiRetryDispositions = [
  'RETRY_ALLOWED',
  'RETRY_FORBIDDEN',
  'RECONCILIATION_REQUIRED'
] as const;
export type ManagedAiRetryDisposition = (typeof managedAiRetryDispositions)[number];

export const managedAiOutcomeStatuses = [
  'COMPLETED',
  'FAILED',
  'BLOCKED',
  'REQUIRES_RECONCILIATION'
] as const;
export type ManagedAiOutcomeStatus = (typeof managedAiOutcomeStatuses)[number];

export const managedAiErrorCodes = [
  'AUTHENTICATION_FAILED',
  'RATE_LIMITED',
  'INVALID_REQUEST',
  'UNSUPPORTED_MODEL_CAPABILITY',
  'PROVIDER_REJECTED',
  'PROVIDER_INTERNAL_ERROR',
  'NETWORK_FAILURE_BEFORE_DELIVERY',
  'DELIVERY_UNCERTAIN',
  'STRUCTURED_OUTPUT_INVALID',
  'BUDGET_BLOCKED',
  'POLICY_BLOCKED',
  'TIMEOUT',
  'UNKNOWN_PROVIDER_FAILURE'
] as const;
export type ManagedAiErrorCode = (typeof managedAiErrorCodes)[number];

export interface ManagedAiRequestedOutputV1 {
  schemaId: string;
  format: ManagedAiOutputFormat;
}

export interface ManagedAiCapabilityRequirementsV1 {
  capabilities: readonly string[];
  maxLatencyMs?: number;
  exactProviderOutputRequired: boolean;
  provenanceRequired: boolean;
}

export interface ManagedAiBudgetV1 {
  maxInputUnits?: number;
  maxOutputUnits?: number;
  maxCostMinor?: number;
  currency?: string;
}

export interface ManagedAiPromptPolicyRefV1 {
  policyId: string;
  policyVersion: string;
  templateId?: string;
  templateVersion?: string;
}

export interface ManagedAiEvidenceExpectationV1 {
  exactOutput: 'REQUIRED' | 'OPTIONAL';
  providerRequestId: 'REQUIRED_WHEN_AVAILABLE' | 'OPTIONAL';
}

export interface ManagedAiExecutionInputV1 {
  schemaVersion: 1;
  processingClass: ManagedAiProcessingClass;
  dataClassification: ManagedAiDataClassification;
  taskInput: unknown;
  requestedOutput: Readonly<ManagedAiRequestedOutputV1>;
  requirements: Readonly<ManagedAiCapabilityRequirementsV1>;
  budget?: Readonly<ManagedAiBudgetV1>;
  promptPolicy: Readonly<ManagedAiPromptPolicyRefV1>;
  evidence: Readonly<ManagedAiEvidenceExpectationV1>;
}

export interface ManagedAiImplementationProvenanceV1 {
  implementationProfileId: string;
  implementationProfileVersion: number;
  implementationKey: string;
  provider: string;
  model: string;
  promptPolicyId: string;
  promptPolicyVersion: string;
  outputSchemaId: string;
  inputSha256: string;
  providerRequestId?: string;
  startedAt: string;
  completedAt: string;
}

export interface ManagedAiExactOutputInlineV1 {
  kind: 'INLINE_BASE64';
  mediaType: string;
  sha256: string;
  sizeBytes: number;
  dataBase64: string;
}

export interface ManagedAiExactOutputReferenceV1 {
  kind: 'DURABLE_REF';
  mediaType: string;
  sha256: string;
  sizeBytes: number;
  ref: string;
}

export type ManagedAiExactOutputV1 =
  | ManagedAiExactOutputInlineV1
  | ManagedAiExactOutputReferenceV1;

export interface ManagedAiUsageV1 {
  inputUnits?: number;
  outputUnits?: number;
  cachedInputUnits?: number;
  latencyMs?: number;
  costMinor?: number;
  currency?: string;
  retryCount?: number;
  fallbackCount?: number;
}

export interface ManagedAiExecutionErrorV1 {
  code: ManagedAiErrorCode;
  message: string;
}

export interface ManagedAiAuthorityConsequencesV1 {
  canonicalTruthCreated: false;
  capabilityCanonMutated: false;
  knowledgeApproved: false;
  brainConclusionCreated: false;
  professionalDecisionCreated: false;
  paymentCreated: false;
  filingSubmitted: false;
  externalMessageSent: false;
  externalProfessionalActionExecuted: false;
}

export const managedAiNoAuthorityConsequences = Object.freeze({
  canonicalTruthCreated: false,
  capabilityCanonMutated: false,
  knowledgeApproved: false,
  brainConclusionCreated: false,
  professionalDecisionCreated: false,
  paymentCreated: false,
  filingSubmitted: false,
  externalMessageSent: false,
  externalProfessionalActionExecuted: false
}) satisfies Readonly<ManagedAiAuthorityConsequencesV1>;

export interface ManagedAiExecutionOutcomeV1 {
  schemaVersion: 1;
  capabilityId: typeof MANAGED_AI_EXECUTION_CAPABILITY_ID;
  capabilityVersion: typeof MANAGED_AI_EXECUTION_CONTRACT_VERSION;
  status: ManagedAiOutcomeStatus;
  deliveryState: ManagedAiDeliveryState;
  retryDisposition: ManagedAiRetryDisposition;
  provenance?: Readonly<ManagedAiImplementationProvenanceV1>;
  exactOutput?: Readonly<ManagedAiExactOutputV1>;
  structuredOutput?: unknown;
  usage?: Readonly<ManagedAiUsageV1>;
  error?: Readonly<ManagedAiExecutionErrorV1>;
  authority: Readonly<ManagedAiAuthorityConsequencesV1>;
}

export class ManagedAiContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManagedAiContractError';
  }
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new ManagedAiContractError(`${field} must be an object.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], field: string): void {
  const allow = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allow.has(key));
  if (unknown.length)
    throw new ManagedAiContractError(`${field} contains unsupported fields: ${unknown.join(', ')}.`);
}

function nonEmptyString(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== 'string') throw new ManagedAiContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength)
    throw new ManagedAiContractError(`${field} must contain 1 to ${maxLength} characters.`);
  return cleaned;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T))
    throw new ManagedAiContractError(`${field} is invalid.`);
  return value as T;
}

function optionalNonNegativeInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new ManagedAiContractError(`${field} must be a non-negative safe integer.`);
  return value as number;
}

function optionalPositiveInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new ManagedAiContractError(`${field} must be a positive safe integer.`);
  return value as number;
}

function optionalString(value: unknown, field: string, maxLength = 500): string | undefined {
  if (value === undefined) return undefined;
  return nonEmptyString(value, field, maxLength);
}

function parseRequestedOutput(value: unknown): ManagedAiRequestedOutputV1 {
  const record = asRecord(value, 'requestedOutput');
  exactKeys(record, ['schemaId', 'format'], 'requestedOutput');
  return {
    schemaId: nonEmptyString(record.schemaId, 'requestedOutput.schemaId', 300),
    format: enumValue(record.format, managedAiOutputFormats, 'requestedOutput.format')
  };
}

function parseRequirements(value: unknown): ManagedAiCapabilityRequirementsV1 {
  const record = asRecord(value, 'requirements');
  exactKeys(
    record,
    ['capabilities', 'maxLatencyMs', 'exactProviderOutputRequired', 'provenanceRequired'],
    'requirements'
  );
  if (!Array.isArray(record.capabilities))
    throw new ManagedAiContractError('requirements.capabilities must be an array.');
  const capabilities = record.capabilities.map((item, index) =>
    nonEmptyString(item, `requirements.capabilities[${index}]`, 120)
  );
  if (new Set(capabilities).size !== capabilities.length)
    throw new ManagedAiContractError('requirements.capabilities must not contain duplicates.');
  if (typeof record.exactProviderOutputRequired !== 'boolean')
    throw new ManagedAiContractError('requirements.exactProviderOutputRequired must be boolean.');
  if (typeof record.provenanceRequired !== 'boolean')
    throw new ManagedAiContractError('requirements.provenanceRequired must be boolean.');
  const maxLatencyMs = optionalPositiveInteger(record.maxLatencyMs, 'requirements.maxLatencyMs');
  return {
    capabilities,
    ...(maxLatencyMs === undefined ? {} : { maxLatencyMs }),
    exactProviderOutputRequired: record.exactProviderOutputRequired,
    provenanceRequired: record.provenanceRequired
  };
}

function parseBudget(value: unknown): ManagedAiBudgetV1 | undefined {
  if (value === undefined) return undefined;
  const record = asRecord(value, 'budget');
  exactKeys(record, ['maxInputUnits', 'maxOutputUnits', 'maxCostMinor', 'currency'], 'budget');
  const maxInputUnits = optionalNonNegativeInteger(record.maxInputUnits, 'budget.maxInputUnits');
  const maxOutputUnits = optionalNonNegativeInteger(record.maxOutputUnits, 'budget.maxOutputUnits');
  const maxCostMinor = optionalNonNegativeInteger(record.maxCostMinor, 'budget.maxCostMinor');
  const currency = optionalString(record.currency, 'budget.currency', 12);
  if (
    maxInputUnits === undefined &&
    maxOutputUnits === undefined &&
    maxCostMinor === undefined &&
    currency === undefined
  )
    throw new ManagedAiContractError('budget must contain at least one governed limit.');
  if (currency !== undefined && !/^[A-Z]{3}$/u.test(currency))
    throw new ManagedAiContractError('budget.currency must be an ISO-style three-letter uppercase code.');
  if (maxCostMinor !== undefined && currency === undefined)
    throw new ManagedAiContractError('budget.currency is required when maxCostMinor is supplied.');
  return {
    ...(maxInputUnits === undefined ? {} : { maxInputUnits }),
    ...(maxOutputUnits === undefined ? {} : { maxOutputUnits }),
    ...(maxCostMinor === undefined ? {} : { maxCostMinor }),
    ...(currency === undefined ? {} : { currency })
  };
}

function parsePromptPolicy(value: unknown): ManagedAiPromptPolicyRefV1 {
  const record = asRecord(value, 'promptPolicy');
  exactKeys(record, ['policyId', 'policyVersion', 'templateId', 'templateVersion'], 'promptPolicy');
  const templateId = optionalString(record.templateId, 'promptPolicy.templateId', 300);
  const templateVersion = optionalString(record.templateVersion, 'promptPolicy.templateVersion', 120);
  if ((templateId === undefined) !== (templateVersion === undefined))
    throw new ManagedAiContractError(
      'promptPolicy.templateId and promptPolicy.templateVersion must be supplied together.'
    );
  return {
    policyId: nonEmptyString(record.policyId, 'promptPolicy.policyId', 300),
    policyVersion: nonEmptyString(record.policyVersion, 'promptPolicy.policyVersion', 120),
    ...(templateId === undefined ? {} : { templateId, templateVersion: templateVersion as string })
  };
}

function parseEvidence(value: unknown): ManagedAiEvidenceExpectationV1 {
  const record = asRecord(value, 'evidence');
  exactKeys(record, ['exactOutput', 'providerRequestId'], 'evidence');
  return {
    exactOutput: enumValue(record.exactOutput, ['REQUIRED', 'OPTIONAL'] as const, 'evidence.exactOutput'),
    providerRequestId: enumValue(
      record.providerRequestId,
      ['REQUIRED_WHEN_AVAILABLE', 'OPTIONAL'] as const,
      'evidence.providerRequestId'
    )
  };
}

export function parseManagedAiExecutionInputV1(value: unknown): ManagedAiExecutionInputV1 {
  const record = asRecord(value, 'managedAiInput');
  exactKeys(
    record,
    [
      'schemaVersion',
      'processingClass',
      'dataClassification',
      'taskInput',
      'requestedOutput',
      'requirements',
      'budget',
      'promptPolicy',
      'evidence'
    ],
    'managedAiInput'
  );
  if (record.schemaVersion !== 1)
    throw new ManagedAiContractError('managedAiInput.schemaVersion must be 1.');
  const budget = parseBudget(record.budget);
  return {
    schemaVersion: 1,
    processingClass: enumValue(
      record.processingClass,
      managedAiProcessingClasses,
      'managedAiInput.processingClass'
    ),
    dataClassification: enumValue(
      record.dataClassification,
      managedAiDataClassifications,
      'managedAiInput.dataClassification'
    ),
    taskInput: structuredClone(record.taskInput),
    requestedOutput: parseRequestedOutput(record.requestedOutput),
    requirements: parseRequirements(record.requirements),
    ...(budget === undefined ? {} : { budget }),
    promptPolicy: parsePromptPolicy(record.promptPolicy),
    evidence: parseEvidence(record.evidence)
  };
}

function parseProvenance(value: unknown): ManagedAiImplementationProvenanceV1 {
  const record = asRecord(value, 'provenance');
  exactKeys(
    record,
    [
      'implementationProfileId',
      'implementationProfileVersion',
      'implementationKey',
      'provider',
      'model',
      'promptPolicyId',
      'promptPolicyVersion',
      'outputSchemaId',
      'inputSha256',
      'providerRequestId',
      'startedAt',
      'completedAt'
    ],
    'provenance'
  );
  const implementationProfileVersion = optionalPositiveInteger(
    record.implementationProfileVersion,
    'provenance.implementationProfileVersion'
  );
  if (implementationProfileVersion === undefined)
    throw new ManagedAiContractError('provenance.implementationProfileVersion is required.');
  const inputSha256 = nonEmptyString(record.inputSha256, 'provenance.inputSha256', 64);
  if (!/^[a-f0-9]{64}$/u.test(inputSha256))
    throw new ManagedAiContractError('provenance.inputSha256 must be lowercase SHA-256 hex.');
  const providerRequestId = optionalString(record.providerRequestId, 'provenance.providerRequestId', 500);
  return {
    implementationProfileId: nonEmptyString(
      record.implementationProfileId,
      'provenance.implementationProfileId',
      300
    ),
    implementationProfileVersion,
    implementationKey: nonEmptyString(record.implementationKey, 'provenance.implementationKey', 500),
    provider: nonEmptyString(record.provider, 'provenance.provider', 120),
    model: nonEmptyString(record.model, 'provenance.model', 300),
    promptPolicyId: nonEmptyString(record.promptPolicyId, 'provenance.promptPolicyId', 300),
    promptPolicyVersion: nonEmptyString(
      record.promptPolicyVersion,
      'provenance.promptPolicyVersion',
      120
    ),
    outputSchemaId: nonEmptyString(record.outputSchemaId, 'provenance.outputSchemaId', 300),
    inputSha256,
    ...(providerRequestId === undefined ? {} : { providerRequestId }),
    startedAt: nonEmptyString(record.startedAt, 'provenance.startedAt', 80),
    completedAt: nonEmptyString(record.completedAt, 'provenance.completedAt', 80)
  };
}

function parseExactOutput(value: unknown): ManagedAiExactOutputV1 {
  const record = asRecord(value, 'exactOutput');
  const kind = enumValue(record.kind, ['INLINE_BASE64', 'DURABLE_REF'] as const, 'exactOutput.kind');
  const common = ['kind', 'mediaType', 'sha256', 'sizeBytes'];
  exactKeys(record, [...common, kind === 'INLINE_BASE64' ? 'dataBase64' : 'ref'], 'exactOutput');
  const sha256 = nonEmptyString(record.sha256, 'exactOutput.sha256', 64);
  if (!/^[a-f0-9]{64}$/u.test(sha256))
    throw new ManagedAiContractError('exactOutput.sha256 must be lowercase SHA-256 hex.');
  const sizeBytes = optionalNonNegativeInteger(record.sizeBytes, 'exactOutput.sizeBytes');
  if (sizeBytes === undefined) throw new ManagedAiContractError('exactOutput.sizeBytes is required.');
  const commonValue = {
    mediaType: nonEmptyString(record.mediaType, 'exactOutput.mediaType', 200),
    sha256,
    sizeBytes
  };
  if (kind === 'INLINE_BASE64') {
    const dataBase64 = nonEmptyString(record.dataBase64, 'exactOutput.dataBase64', 16 * 1024 * 1024);
    if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(dataBase64))
      throw new ManagedAiContractError('exactOutput.dataBase64 must be base64 text.');
    return { kind, ...commonValue, dataBase64 };
  }
  return {
    kind,
    ...commonValue,
    ref: nonEmptyString(record.ref, 'exactOutput.ref', 2000)
  };
}

function parseUsage(value: unknown): ManagedAiUsageV1 | undefined {
  if (value === undefined) return undefined;
  const record = asRecord(value, 'usage');
  exactKeys(
    record,
    [
      'inputUnits',
      'outputUnits',
      'cachedInputUnits',
      'latencyMs',
      'costMinor',
      'currency',
      'retryCount',
      'fallbackCount'
    ],
    'usage'
  );
  const usage: ManagedAiUsageV1 = {};
  for (const field of [
    'inputUnits',
    'outputUnits',
    'cachedInputUnits',
    'latencyMs',
    'costMinor',
    'retryCount',
    'fallbackCount'
  ] as const) {
    const parsed = optionalNonNegativeInteger(record[field], `usage.${field}`);
    if (parsed !== undefined) usage[field] = parsed;
  }
  const currency = optionalString(record.currency, 'usage.currency', 12);
  if (currency !== undefined) {
    if (!/^[A-Z]{3}$/u.test(currency))
      throw new ManagedAiContractError('usage.currency must be an ISO-style three-letter uppercase code.');
    usage.currency = currency;
  }
  if (usage.costMinor !== undefined && usage.currency === undefined)
    throw new ManagedAiContractError('usage.currency is required when usage.costMinor is supplied.');
  return usage;
}

function parseError(value: unknown): ManagedAiExecutionErrorV1 | undefined {
  if (value === undefined) return undefined;
  const record = asRecord(value, 'error');
  exactKeys(record, ['code', 'message'], 'error');
  return {
    code: enumValue(record.code, managedAiErrorCodes, 'error.code'),
    message: nonEmptyString(record.message, 'error.message', 2000)
  };
}

function assertAuthority(value: unknown): ManagedAiAuthorityConsequencesV1 {
  const record = asRecord(value, 'authority');
  const expected = Object.keys(managedAiNoAuthorityConsequences);
  exactKeys(record, expected, 'authority');
  for (const field of expected) {
    if (record[field] !== false)
      throw new ManagedAiContractError(`authority.${field} must remain false.`);
  }
  return managedAiNoAuthorityConsequences;
}

function assertOutcomeConsistency(outcome: ManagedAiExecutionOutcomeV1): void {
  if (outcome.deliveryState === 'DELIVERY_UNCERTAIN') {
    if (outcome.status !== 'REQUIRES_RECONCILIATION')
      throw new ManagedAiContractError(
        'DELIVERY_UNCERTAIN outcomes must use status REQUIRES_RECONCILIATION.'
      );
    if (outcome.retryDisposition !== 'RECONCILIATION_REQUIRED')
      throw new ManagedAiContractError(
        'DELIVERY_UNCERTAIN outcomes must require reconciliation rather than retry.'
      );
  }
  if (outcome.retryDisposition === 'RECONCILIATION_REQUIRED' && outcome.status !== 'REQUIRES_RECONCILIATION')
    throw new ManagedAiContractError(
      'RECONCILIATION_REQUIRED retry disposition requires REQUIRES_RECONCILIATION status.'
    );
  if (outcome.status === 'COMPLETED') {
    if (outcome.deliveryState !== 'PROVIDER_COMPLETED')
      throw new ManagedAiContractError('COMPLETED outcomes must use deliveryState PROVIDER_COMPLETED.');
    if (outcome.error !== undefined)
      throw new ManagedAiContractError('COMPLETED outcomes must not contain an error.');
    if (outcome.provenance === undefined)
      throw new ManagedAiContractError('COMPLETED outcomes require implementation provenance.');
  }
  if (outcome.deliveryState === 'PROVIDER_COMPLETED' && outcome.status !== 'COMPLETED')
    throw new ManagedAiContractError('PROVIDER_COMPLETED delivery requires COMPLETED status.');
  if (outcome.status !== 'COMPLETED' && outcome.error === undefined)
    throw new ManagedAiContractError('Non-completed outcomes require a typed generic error.');
  if (outcome.retryDisposition === 'RETRY_ALLOWED' && outcome.deliveryState === 'DELIVERY_UNCERTAIN')
    throw new ManagedAiContractError('Delivery-uncertain execution can never be marked retry allowed.');
}

export function parseManagedAiExecutionOutcomeV1(value: unknown): ManagedAiExecutionOutcomeV1 {
  const record = asRecord(value, 'managedAiOutcome');
  exactKeys(
    record,
    [
      'schemaVersion',
      'capabilityId',
      'capabilityVersion',
      'status',
      'deliveryState',
      'retryDisposition',
      'provenance',
      'exactOutput',
      'structuredOutput',
      'usage',
      'error',
      'authority'
    ],
    'managedAiOutcome'
  );
  if (record.schemaVersion !== 1)
    throw new ManagedAiContractError('managedAiOutcome.schemaVersion must be 1.');
  if (record.capabilityId !== MANAGED_AI_EXECUTION_CAPABILITY_ID)
    throw new ManagedAiContractError(
      `managedAiOutcome.capabilityId must be ${MANAGED_AI_EXECUTION_CAPABILITY_ID}.`
    );
  if (record.capabilityVersion !== MANAGED_AI_EXECUTION_CONTRACT_VERSION)
    throw new ManagedAiContractError(
      `managedAiOutcome.capabilityVersion must be ${MANAGED_AI_EXECUTION_CONTRACT_VERSION}.`
    );
  const provenance = record.provenance === undefined ? undefined : parseProvenance(record.provenance);
  const exactOutput = record.exactOutput === undefined ? undefined : parseExactOutput(record.exactOutput);
  const usage = parseUsage(record.usage);
  const error = parseError(record.error);
  const outcome: ManagedAiExecutionOutcomeV1 = {
    schemaVersion: 1,
    capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
    capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
    status: enumValue(record.status, managedAiOutcomeStatuses, 'managedAiOutcome.status'),
    deliveryState: enumValue(
      record.deliveryState,
      managedAiDeliveryStates,
      'managedAiOutcome.deliveryState'
    ),
    retryDisposition: enumValue(
      record.retryDisposition,
      managedAiRetryDispositions,
      'managedAiOutcome.retryDisposition'
    ),
    ...(provenance === undefined ? {} : { provenance }),
    ...(exactOutput === undefined ? {} : { exactOutput }),
    ...(record.structuredOutput === undefined
      ? {}
      : { structuredOutput: structuredClone(record.structuredOutput) }),
    ...(usage === undefined ? {} : { usage }),
    ...(error === undefined ? {} : { error }),
    authority: assertAuthority(record.authority)
  };
  assertOutcomeConsistency(outcome);
  return outcome;
}
