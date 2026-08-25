import { createHash } from 'node:crypto';
import {
  MANAGED_AI_EXECUTION_CAPABILITY_ID,
  MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  managedAiNoAuthorityConsequences,
  parseManagedAiExecutionInputV1,
  type ManagedAiDataClassification,
  type ManagedAiErrorCode,
  type ManagedAiExecutionInputV1,
  type ManagedAiExecutionOutcomeV1,
  type ManagedAiOutputFormat,
  type ManagedAiProcessingClass
} from '@markorbit/contracts/managed-ai-execution';
import type { AiProviderExecutionResultV1 } from './index.js';

export const KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_PROFILE_ID =
  'managed-ai:knowledge-deepseek:v1' as const;
export const KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY = 'ai:deepseek:chat-completions:v1' as const;
export const KNOWLEDGE_DISTILLATION_PROMPT_POLICY_ID = 'knowledge.ai-distillation' as const;
export const KNOWLEDGE_DISTILLATION_PROMPT_POLICY_VERSION = '1' as const;
export const KNOWLEDGE_DISTILLED_MARKDOWN_SCHEMA_ID = 'knowledge.ai-distilled-markdown.v1' as const;

const DEFAULT_PROVIDER_TIMEOUT_MS = 120_000;

export interface ManagedAiImplementationProfileV1 {
  profileId: string;
  version: number;
  implementationKey: string;
  provider: string;
  capabilities: readonly string[];
  processingClasses: readonly ManagedAiProcessingClass[];
  dataClassifications: readonly ManagedAiDataClassification[];
  promptPolicies: readonly Readonly<{ policyId: string; policyVersion: string }>[];
  outputSchemas: readonly Readonly<{ schemaId: string; format: ManagedAiOutputFormat }>[];
  exactOutputMediaType: string;
}

export const knowledgeDeepSeekImplementationProfileV1 = Object.freeze({
  profileId: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_PROFILE_ID,
  version: 1,
  implementationKey: KNOWLEDGE_DEEPSEEK_IMPLEMENTATION_KEY,
  provider: 'DEEPSEEK',
  capabilities: ['text-generation'],
  processingClasses: ['SOURCE_ACQUISITION'],
  dataClassifications: ['PUBLIC'],
  promptPolicies: [
    {
      policyId: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_ID,
      policyVersion: KNOWLEDGE_DISTILLATION_PROMPT_POLICY_VERSION
    }
  ],
  outputSchemas: [
    {
      schemaId: KNOWLEDGE_DISTILLED_MARKDOWN_SCHEMA_ID,
      format: 'MARKDOWN'
    }
  ],
  exactOutputMediaType: 'application/json'
} as const) satisfies Readonly<ManagedAiImplementationProfileV1>;

export interface ManagedAiExecutionContextV1 {
  executionId: string;
  correlationId: string;
}

export interface ManagedAiProviderGatewayV1 {
  execute(value: unknown): Promise<AiProviderExecutionResultV1>;
}

export interface ManagedAiExecutorOptionsV1 {
  now?: () => Date;
}

export class ManagedAiExecutorBoundaryError extends Error {
  constructor(
    readonly code:
      | 'MANAGED_AI_PROFILE_DUPLICATE'
      | 'MANAGED_AI_PROFILE_INVALID'
      | 'MANAGED_AI_PROFILE_AMBIGUOUS'
      | 'MANAGED_AI_CONTEXT_INVALID'
      | 'MANAGED_AI_INPUT_NOT_JSON',
    message: string
  ) {
    super(message);
    this.name = 'ManagedAiExecutorBoundaryError';
  }
}

function nonEmpty(value: string, field: string, maxLength = 500): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) {
    throw new ManagedAiExecutorBoundaryError(
      'MANAGED_AI_PROFILE_INVALID',
      `${field} must contain 1 to ${maxLength} characters.`
    );
  }
  return cleaned;
}

function assertProfile(profile: Readonly<ManagedAiImplementationProfileV1>): void {
  nonEmpty(profile.profileId, 'profile.profileId', 300);
  nonEmpty(profile.implementationKey, 'profile.implementationKey', 500);
  nonEmpty(profile.provider, 'profile.provider', 120);
  nonEmpty(profile.exactOutputMediaType, 'profile.exactOutputMediaType', 200);
  if (!Number.isSafeInteger(profile.version) || profile.version < 1) {
    throw new ManagedAiExecutorBoundaryError(
      'MANAGED_AI_PROFILE_INVALID',
      'profile.version must be a positive safe integer.'
    );
  }
  if (
    profile.capabilities.length === 0 ||
    new Set(profile.capabilities).size !== profile.capabilities.length
  ) {
    throw new ManagedAiExecutorBoundaryError(
      'MANAGED_AI_PROFILE_INVALID',
      'profile.capabilities must be non-empty and unique.'
    );
  }
  if (
    profile.processingClasses.length === 0 ||
    profile.dataClassifications.length === 0 ||
    profile.promptPolicies.length === 0 ||
    profile.outputSchemas.length === 0
  ) {
    throw new ManagedAiExecutorBoundaryError(
      'MANAGED_AI_PROFILE_INVALID',
      'Managed AI profiles must declare processing, classification, prompt-policy and output constraints.'
    );
  }
}

function profileMatches(
  profile: Readonly<ManagedAiImplementationProfileV1>,
  input: Readonly<ManagedAiExecutionInputV1>
): boolean {
  if (!profile.processingClasses.includes(input.processingClass)) return false;
  if (!profile.dataClassifications.includes(input.dataClassification)) return false;
  if (
    !input.requirements.capabilities.every((capability) =>
      profile.capabilities.includes(capability)
    )
  ) {
    return false;
  }
  if (
    !profile.promptPolicies.some(
      (policy) =>
        policy.policyId === input.promptPolicy.policyId &&
        policy.policyVersion === input.promptPolicy.policyVersion
    )
  ) {
    return false;
  }
  return profile.outputSchemas.some(
    (output) =>
      output.schemaId === input.requestedOutput.schemaId &&
      output.format === input.requestedOutput.format
  );
}

export class ManagedAiImplementationRegistryV1 {
  private readonly profiles: readonly Readonly<ManagedAiImplementationProfileV1>[];

  constructor(profiles: readonly Readonly<ManagedAiImplementationProfileV1>[]) {
    const seen = new Set<string>();
    for (const profile of profiles) {
      assertProfile(profile);
      const identity = `${profile.profileId}@${profile.version}`;
      if (seen.has(identity)) {
        throw new ManagedAiExecutorBoundaryError(
          'MANAGED_AI_PROFILE_DUPLICATE',
          `Duplicate Managed AI implementation profile: ${identity}.`
        );
      }
      seen.add(identity);
    }
    this.profiles = [...profiles];
  }

  select(
    input: Readonly<ManagedAiExecutionInputV1>
  ): Readonly<ManagedAiImplementationProfileV1> | null {
    const matches = this.profiles.filter((profile) => profileMatches(profile, input));
    if (matches.length > 1) {
      throw new ManagedAiExecutorBoundaryError(
        'MANAGED_AI_PROFILE_AMBIGUOUS',
        `Managed AI input matched multiple implementation profiles: ${matches
          .map((profile) => `${profile.profileId}@${profile.version}`)
          .join(', ')}.`
      );
    }
    return matches[0] ?? null;
  }
}

function canonicalJson(value: unknown, path = 'input'): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ManagedAiExecutorBoundaryError(
        'MANAGED_AI_INPUT_NOT_JSON',
        `${path} contains a non-finite number.`
      );
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalJson(item, `${path}[${index}]`)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], `${path}.${key}`)}`)
      .join(',')}}`;
  }
  throw new ManagedAiExecutorBoundaryError(
    'MANAGED_AI_INPUT_NOT_JSON',
    `${path} contains unsupported ${typeof value} data.`
  );
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function timestamp(now: () => Date): string {
  const value = now();
  if (Number.isNaN(value.getTime())) {
    throw new ManagedAiExecutorBoundaryError(
      'MANAGED_AI_CONTEXT_INVALID',
      'Managed AI runtime clock returned an invalid Date.'
    );
  }
  return value.toISOString();
}

function executionContext(
  value: Readonly<ManagedAiExecutionContextV1>
): ManagedAiExecutionContextV1 {
  const executionId = value.executionId.trim();
  const correlationId = value.correlationId.trim();
  if (!executionId || executionId.length > 300 || !correlationId || correlationId.length > 300) {
    throw new ManagedAiExecutorBoundaryError(
      'MANAGED_AI_CONTEXT_INVALID',
      'Managed AI executionId and correlationId must contain 1 to 300 characters.'
    );
  }
  return { executionId, correlationId };
}

function exactOutput(
  bytes: Uint8Array | undefined,
  mediaType: string
): ManagedAiExecutionOutcomeV1['exactOutput'] | undefined {
  if (!bytes) return undefined;
  return {
    kind: 'INLINE_BASE64',
    mediaType,
    sha256: sha256(bytes),
    sizeBytes: bytes.byteLength,
    dataBase64: Buffer.from(bytes).toString('base64')
  };
}

function managedErrorCode(
  result: Extract<AiProviderExecutionResultV1, { kind: 'FAILURE' }>
): ManagedAiErrorCode {
  switch (result.error.code) {
    case 'AI_PROVIDER_CREDENTIAL_MISSING':
      return 'AUTHENTICATION_FAILED';
    case 'AI_PROVIDER_INPUT_INVALID':
      return 'INVALID_REQUEST';
    case 'AI_PROVIDER_PEAK_PRICING_WINDOW':
      return 'POLICY_BLOCKED';
    case 'AI_PROVIDER_RATE_LIMITED':
      return 'RATE_LIMITED';
    case 'AI_PROVIDER_REJECTED':
      return 'PROVIDER_REJECTED';
    case 'AI_PROVIDER_RESPONSE_INVALID':
    case 'AI_HTTP_RESPONSE_TOO_LARGE':
      return 'STRUCTURED_OUTPUT_INVALID';
    case 'AI_HTTP_TIMEOUT':
      return 'TIMEOUT';
    case 'AI_HTTP_NETWORK_ERROR':
      return result.deliveryState === 'NOT_DELIVERED'
        ? 'NETWORK_FAILURE_BEFORE_DELIVERY'
        : 'DELIVERY_UNCERTAIN';
    case 'AI_PROVIDER_TEMPORARY_FAILURE':
      return 'PROVIDER_INTERNAL_ERROR';
    default:
      return result.deliveryState === 'DELIVERY_UNCERTAIN'
        ? 'DELIVERY_UNCERTAIN'
        : 'UNKNOWN_PROVIDER_FAILURE';
  }
}

function failureStatus(
  result: Extract<AiProviderExecutionResultV1, { kind: 'FAILURE' }>,
  code: ManagedAiErrorCode
): ManagedAiExecutionOutcomeV1['status'] {
  if (
    result.deliveryState === 'DELIVERY_UNCERTAIN' ||
    result.retryDisposition === 'RECONCILIATION_REQUIRED'
  ) {
    return 'REQUIRES_RECONCILIATION';
  }
  if (code === 'AUTHENTICATION_FAILED' || code === 'POLICY_BLOCKED' || code === 'BUDGET_BLOCKED') {
    return 'BLOCKED';
  }
  return 'FAILED';
}

function usage(
  result: AiProviderExecutionResultV1
): ManagedAiExecutionOutcomeV1['usage'] | undefined {
  if (!result.usage) return undefined;
  return {
    ...(result.usage.inputUnits === undefined ? {} : { inputUnits: result.usage.inputUnits }),
    ...(result.usage.outputUnits === undefined ? {} : { outputUnits: result.usage.outputUnits }),
    ...(result.usage.cachedInputUnits === undefined
      ? {}
      : { cachedInputUnits: result.usage.cachedInputUnits }),
    ...(result.usage.latencyMs === undefined ? {} : { latencyMs: result.usage.latencyMs }),
    ...(result.usage.costMinor === undefined ? {} : { costMinor: result.usage.costMinor }),
    ...(result.usage.currency === undefined ? {} : { currency: result.usage.currency }),
    retryCount: 0,
    fallbackCount: 0
  };
}

export class ManagedAiExecutorV1 {
  private readonly now: () => Date;

  constructor(
    private readonly implementations: ManagedAiImplementationRegistryV1,
    private readonly providers: ManagedAiProviderGatewayV1,
    options: ManagedAiExecutorOptionsV1 = {}
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async execute(
    value: unknown,
    runtimeContext: Readonly<ManagedAiExecutionContextV1>
  ): Promise<ManagedAiExecutionOutcomeV1> {
    const input = parseManagedAiExecutionInputV1(value);
    const context = executionContext(runtimeContext);
    const inputSha256 = sha256(canonicalJson(input));
    const profile = this.implementations.select(input);
    if (!profile) {
      return {
        schemaVersion: 1,
        capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
        capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
        status: 'BLOCKED',
        deliveryState: 'NOT_DELIVERED',
        retryDisposition: 'RETRY_FORBIDDEN',
        error: {
          code: 'POLICY_BLOCKED',
          message:
            'No trusted Managed AI implementation profile satisfies the requested policy and capability constraints.'
        },
        authority: managedAiNoAuthorityConsequences
      };
    }

    const startedAt = timestamp(this.now);
    const result = await this.providers.execute({
      protocolVersion: 1,
      executionId: context.executionId,
      implementationKey: profile.implementationKey,
      correlationId: context.correlationId,
      timeoutMs: input.requirements.maxLatencyMs ?? DEFAULT_PROVIDER_TIMEOUT_MS,
      input: input.taskInput
    });
    const completedAt = timestamp(this.now);
    const providerUsage = usage(result);
    const output = exactOutput(result.exactResponse, profile.exactOutputMediaType);
    const model = result.model;
    const provenance =
      model && result.provider === profile.provider
        ? {
            implementationProfileId: profile.profileId,
            implementationProfileVersion: profile.version,
            implementationKey: profile.implementationKey,
            provider: result.provider,
            model,
            promptPolicyId: input.promptPolicy.policyId,
            promptPolicyVersion: input.promptPolicy.policyVersion,
            outputSchemaId: input.requestedOutput.schemaId,
            inputSha256,
            ...(result.providerRequestId === undefined
              ? {}
              : { providerRequestId: result.providerRequestId }),
            startedAt,
            completedAt
          }
        : undefined;

    if (result.kind === 'SUCCESS') {
      if (!provenance) {
        return {
          schemaVersion: 1,
          capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
          capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
          status: 'FAILED',
          deliveryState: 'DELIVERED_CONFIRMED',
          retryDisposition: 'RETRY_FORBIDDEN',
          ...(output === undefined ? {} : { exactOutput: output }),
          ...(providerUsage === undefined ? {} : { usage: providerUsage }),
          error: {
            code: 'UNKNOWN_PROVIDER_FAILURE',
            message: 'Provider execution completed with implementation-profile identity drift.'
          },
          authority: managedAiNoAuthorityConsequences
        };
      }
      return {
        schemaVersion: 1,
        capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
        capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
        status: 'COMPLETED',
        deliveryState: 'PROVIDER_COMPLETED',
        retryDisposition: 'RETRY_FORBIDDEN',
        provenance,
        ...(output === undefined ? {} : { exactOutput: output }),
        ...(result.structuredOutput === undefined
          ? {}
          : { structuredOutput: structuredClone(result.structuredOutput) }),
        ...(providerUsage === undefined ? {} : { usage: providerUsage }),
        authority: managedAiNoAuthorityConsequences
      };
    }

    const errorCode = managedErrorCode(result);
    return {
      schemaVersion: 1,
      capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
      capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
      status: failureStatus(result, errorCode),
      deliveryState: result.deliveryState,
      retryDisposition: result.retryDisposition,
      ...(provenance === undefined ? {} : { provenance }),
      ...(output === undefined ? {} : { exactOutput: output }),
      ...(providerUsage === undefined ? {} : { usage: providerUsage }),
      error: {
        code: errorCode,
        message: result.error.message
      },
      authority: managedAiNoAuthorityConsequences
    };
  }
}
