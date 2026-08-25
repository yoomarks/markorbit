export const packageName = '@markorbit/ai' as const;
export const AI_PROVIDER_ADAPTER_PROTOCOL_VERSION = 1 as const;

export type AiProviderDeliveryState =
  | 'NOT_DELIVERED'
  | 'DELIVERY_UNCERTAIN'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_COMPLETED';

export type AiProviderRetryDisposition =
  | 'RETRY_ALLOWED'
  | 'RETRY_FORBIDDEN'
  | 'RECONCILIATION_REQUIRED';

export interface AiProviderUsageV1 {
  inputUnits?: number;
  outputUnits?: number;
  cachedInputUnits?: number;
  latencyMs?: number;
  costMinor?: number;
  currency?: string;
}

export interface AiProviderExecutionRequestV1 {
  protocolVersion: typeof AI_PROVIDER_ADAPTER_PROTOCOL_VERSION;
  executionId: string;
  implementationKey: string;
  correlationId: string;
  timeoutMs: number;
  input: unknown;
}

export interface AiProviderExecutionSuccessV1 {
  kind: 'SUCCESS';
  provider: string;
  model: string;
  deliveryState: 'PROVIDER_COMPLETED';
  retryDisposition: 'RETRY_FORBIDDEN';
  exactResponse: Uint8Array;
  providerRequestId?: string;
  structuredOutput?: unknown;
  usage?: Readonly<AiProviderUsageV1>;
}

export interface AiProviderExecutionFailureV1 {
  kind: 'FAILURE';
  provider: string;
  model?: string;
  deliveryState: Exclude<AiProviderDeliveryState, 'PROVIDER_COMPLETED'>;
  retryDisposition: AiProviderRetryDisposition;
  error: Readonly<{
    code: string;
    message: string;
  }>;
  providerRequestId?: string;
  exactResponse?: Uint8Array;
  usage?: Readonly<AiProviderUsageV1>;
}

export type AiProviderExecutionResultV1 =
  | AiProviderExecutionSuccessV1
  | AiProviderExecutionFailureV1;

export interface AiProviderAdapterV1 {
  readonly implementationKey: string;
  readonly provider: string;
  execute(request: Readonly<AiProviderExecutionRequestV1>): Promise<AiProviderExecutionResultV1>;
}

export interface AiProviderAdapterDescriptorV1 {
  protocolVersion: typeof AI_PROVIDER_ADAPTER_PROTOCOL_VERSION;
  implementationKey: string;
  provider: string;
}

export class AiGatewayBoundaryError extends Error {
  constructor(
    readonly code:
      | 'AI_GATEWAY_REQUEST_INVALID'
      | 'AI_GATEWAY_IMPLEMENTATION_NOT_FOUND'
      | 'AI_GATEWAY_IMPLEMENTATION_DUPLICATE'
      | 'AI_GATEWAY_ADAPTER_RESULT_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'AiGatewayBoundaryError';
  }
}

function requireNonEmptyString(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== 'string') {
    throw new AiGatewayBoundaryError('AI_GATEWAY_REQUEST_INVALID', `${field} must be a string.`);
  }
  const cleaned = value.trim();
  if (cleaned.length === 0 || cleaned.length > maxLength) {
    throw new AiGatewayBoundaryError(
      'AI_GATEWAY_REQUEST_INVALID',
      `${field} must contain 1 to ${maxLength} characters.`,
    );
  }
  return cleaned;
}

function assertRetryDeliveryConsistency(result: AiProviderExecutionResultV1): void {
  if (result.deliveryState === 'DELIVERY_UNCERTAIN') {
    if (result.retryDisposition !== 'RECONCILIATION_REQUIRED') {
      throw new AiGatewayBoundaryError(
        'AI_GATEWAY_ADAPTER_RESULT_INVALID',
        'Delivery-uncertain provider results must require reconciliation.',
      );
    }
    return;
  }

  if (result.retryDisposition === 'RECONCILIATION_REQUIRED') {
    throw new AiGatewayBoundaryError(
      'AI_GATEWAY_ADAPTER_RESULT_INVALID',
      'Reconciliation-required results must use DELIVERY_UNCERTAIN delivery state.',
    );
  }
}

function assertAdapterResult(
  adapter: AiProviderAdapterV1,
  result: AiProviderExecutionResultV1,
): AiProviderExecutionResultV1 {
  if (result.provider !== adapter.provider) {
    throw new AiGatewayBoundaryError(
      'AI_GATEWAY_ADAPTER_RESULT_INVALID',
      `Provider adapter ${adapter.implementationKey} returned provider ${result.provider} instead of ${adapter.provider}.`,
    );
  }

  assertRetryDeliveryConsistency(result);

  if (result.kind === 'SUCCESS') {
    if (result.deliveryState !== 'PROVIDER_COMPLETED') {
      throw new AiGatewayBoundaryError(
        'AI_GATEWAY_ADAPTER_RESULT_INVALID',
        'Successful provider execution must use PROVIDER_COMPLETED delivery state.',
      );
    }
    if (!(result.exactResponse instanceof Uint8Array)) {
      throw new AiGatewayBoundaryError(
        'AI_GATEWAY_ADAPTER_RESULT_INVALID',
        'Successful provider execution must preserve exact response bytes.',
      );
    }
  } else if (result.deliveryState === 'PROVIDER_COMPLETED') {
    throw new AiGatewayBoundaryError(
      'AI_GATEWAY_ADAPTER_RESULT_INVALID',
      'Failed provider execution cannot use PROVIDER_COMPLETED delivery state.',
    );
  }

  return result;
}

export function parseAiProviderExecutionRequestV1(value: unknown): AiProviderExecutionRequestV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AiGatewayBoundaryError('AI_GATEWAY_REQUEST_INVALID', 'AI gateway request must be an object.');
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set([
    'protocolVersion',
    'executionId',
    'implementationKey',
    'correlationId',
    'timeoutMs',
    'input',
  ]);
  const unsupported = Object.keys(record).filter((key) => !allowed.has(key));
  if (unsupported.length > 0) {
    throw new AiGatewayBoundaryError(
      'AI_GATEWAY_REQUEST_INVALID',
      `AI gateway request contains unsupported fields: ${unsupported.join(', ')}.`,
    );
  }
  if (record.protocolVersion !== AI_PROVIDER_ADAPTER_PROTOCOL_VERSION) {
    throw new AiGatewayBoundaryError(
      'AI_GATEWAY_REQUEST_INVALID',
      `AI gateway protocolVersion must be ${AI_PROVIDER_ADAPTER_PROTOCOL_VERSION}.`,
    );
  }
  if (!Number.isSafeInteger(record.timeoutMs) || (record.timeoutMs as number) < 1) {
    throw new AiGatewayBoundaryError(
      'AI_GATEWAY_REQUEST_INVALID',
      'AI gateway timeoutMs must be a positive safe integer.',
    );
  }

  return {
    protocolVersion: AI_PROVIDER_ADAPTER_PROTOCOL_VERSION,
    executionId: requireNonEmptyString(record.executionId, 'executionId', 300),
    implementationKey: requireNonEmptyString(record.implementationKey, 'implementationKey', 500),
    correlationId: requireNonEmptyString(record.correlationId, 'correlationId', 300),
    timeoutMs: record.timeoutMs as number,
    input: structuredClone(record.input),
  };
}

export class AiProviderRegistryV1 {
  private readonly adapters = new Map<string, AiProviderAdapterV1>();

  constructor(adapters: readonly AiProviderAdapterV1[]) {
    for (const adapter of adapters) {
      const implementationKey = requireNonEmptyString(
        adapter.implementationKey,
        'adapter.implementationKey',
        500,
      );
      requireNonEmptyString(adapter.provider, 'adapter.provider', 120);
      if (this.adapters.has(implementationKey)) {
        throw new AiGatewayBoundaryError(
          'AI_GATEWAY_IMPLEMENTATION_DUPLICATE',
          `Duplicate AI implementation key: ${implementationKey}.`,
        );
      }
      this.adapters.set(implementationKey, adapter);
    }
  }

  describe(): readonly AiProviderAdapterDescriptorV1[] {
    return [...this.adapters.values()]
      .map((adapter) => ({
        protocolVersion: AI_PROVIDER_ADAPTER_PROTOCOL_VERSION,
        implementationKey: adapter.implementationKey,
        provider: adapter.provider,
      }))
      .sort((left, right) => left.implementationKey.localeCompare(right.implementationKey));
  }

  resolve(implementationKey: string): AiProviderAdapterV1 {
    const key = requireNonEmptyString(implementationKey, 'implementationKey', 500);
    const adapter = this.adapters.get(key);
    if (!adapter) {
      throw new AiGatewayBoundaryError(
        'AI_GATEWAY_IMPLEMENTATION_NOT_FOUND',
        `No AI provider adapter is registered for implementation key ${key}.`,
      );
    }
    return adapter;
  }

  async execute(value: unknown): Promise<AiProviderExecutionResultV1> {
    const request = parseAiProviderExecutionRequestV1(value);
    const adapter = this.resolve(request.implementationKey);
    const result = await adapter.execute(request);
    return assertAdapterResult(adapter, result);
  }
}
