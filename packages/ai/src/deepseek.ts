import type {
  AiProviderAdapterV1,
  AiProviderExecutionFailureV1,
  AiProviderExecutionRequestV1,
  AiProviderExecutionResultV1,
  AiProviderExecutionSuccessV1,
  AiProviderUsageV1
} from './index.js';
import {
  AiHttpTransportError,
  fetchAiHttpTransport,
  type AiHttpTransport
} from './http-transport.js';
import { AiProviderInputError, parseAiTextGenerationInputV1 } from './provider-input.js';

export const DEEPSEEK_PROVIDER = 'DEEPSEEK' as const;
export const DEEPSEEK_IMPLEMENTATION_KEY = 'ai:deepseek:chat-completions:v1' as const;
export const DEEPSEEK_CANONICAL_ENDPOINT = 'https://api.deepseek.com/chat/completions' as const;
export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-flash' as const;
export const DEEPSEEK_SECRET_ENV = 'DEEPSEEK_API_KEY' as const;

const DEFAULT_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 300_000;
const BEIJING_UTC_OFFSET_MS = 8 * 60 * 60 * 1_000;
const MORNING_PEAK_START_MINUTE = 9 * 60;
const MORNING_PEAK_END_MINUTE = 12 * 60;
const AFTERNOON_PEAK_START_MINUTE = 14 * 60;
const AFTERNOON_PEAK_END_MINUTE = 18 * 60;

export type DeepSeekAdapterOptions = {
  environment?: NodeJS.ProcessEnv;
  transport?: AiHttpTransport;
  model?: string;
  maxResponseBytes?: number;
  now?: () => Date;
  clockMs?: () => number;
  offPeakOnly?: boolean;
};

type ParsedDeepSeekResponse = {
  text: string;
  model: string;
  providerRequestId?: string;
  usage?: Readonly<AiProviderUsageV1>;
};

export function isDeepSeekPeakPricingWindow(at: Date): boolean {
  if (Number.isNaN(at.getTime()))
    throw new TypeError('DeepSeek execution-window timestamp must be valid.');
  const beijing = new Date(at.getTime() + BEIJING_UTC_OFFSET_MS);
  const weekday = beijing.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const minuteOfDay = beijing.getUTCHours() * 60 + beijing.getUTCMinutes();
  return (
    (minuteOfDay >= MORNING_PEAK_START_MINUTE && minuteOfDay < MORNING_PEAK_END_MINUTE) ||
    (minuteOfDay >= AFTERNOON_PEAK_START_MINUTE && minuteOfDay < AFTERNOON_PEAK_END_MINUTE)
  );
}

function failure(
  deliveryState: AiProviderExecutionFailureV1['deliveryState'],
  retryDisposition: AiProviderExecutionFailureV1['retryDisposition'],
  code: string,
  message: string,
  extras: Partial<
    Pick<AiProviderExecutionFailureV1, 'model' | 'providerRequestId' | 'exactResponse' | 'usage'>
  > = {}
): AiProviderExecutionFailureV1 {
  return {
    kind: 'FAILURE',
    provider: DEEPSEEK_PROVIDER,
    deliveryState,
    retryDisposition,
    error: { code, message },
    ...extras
  };
}

function boundedTimeout(timeoutMs: number): number {
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < MIN_TIMEOUT_MS ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new AiProviderInputError(
      `DeepSeek timeoutMs must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} milliseconds.`
    );
  }
  return timeoutMs;
}

function boundedResponseBytes(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 64 * 1024 * 1024) {
    throw new TypeError(
      'DeepSeek maxResponseBytes must be a positive integer no greater than 64 MiB.'
    );
  }
  return value;
}

function optionalPositiveInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : undefined;
}

function parseUsage(value: unknown, latencyMs: number): Readonly<AiProviderUsageV1> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return latencyMs >= 0 ? { latencyMs } : undefined;
  }
  const record = value as Record<string, unknown>;
  const inputUnits = optionalPositiveInteger(record.prompt_tokens);
  const outputUnits = optionalPositiveInteger(record.completion_tokens);
  const cachedInputUnits = optionalPositiveInteger(record.prompt_cache_hit_tokens);
  return {
    ...(inputUnits === undefined ? {} : { inputUnits }),
    ...(outputUnits === undefined ? {} : { outputUnits }),
    ...(cachedInputUnits === undefined ? {} : { cachedInputUnits }),
    latencyMs
  };
}

function parseProviderRequestId(raw: Uint8Array): string | undefined {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(raw)) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
    const id = (parsed as Record<string, unknown>).id;
    return typeof id === 'string' && id.trim() ? id : undefined;
  } catch {
    return undefined;
  }
}

function parseSuccessfulResponse(raw: Uint8Array, latencyMs: number): ParsedDeepSeekResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new AiProviderInputError('DeepSeek returned invalid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new AiProviderInputError('DeepSeek response must be an object.');
  }
  const response = parsed as Record<string, unknown>;
  const choices = response.choices;
  const first: unknown = Array.isArray(choices) ? (choices as unknown[])[0] : undefined;
  const message =
    first && typeof first === 'object' && !Array.isArray(first)
      ? (first as Record<string, unknown>).message
      : undefined;
  const content =
    message && typeof message === 'object' && !Array.isArray(message)
      ? (message as Record<string, unknown>).content
      : undefined;
  if (typeof content !== 'string' || !content.trim()) {
    throw new AiProviderInputError(
      'DeepSeek response did not contain non-empty assistant content.'
    );
  }
  const model =
    typeof response.model === 'string' && response.model.trim()
      ? response.model
      : DEEPSEEK_DEFAULT_MODEL;
  const providerRequestId =
    typeof response.id === 'string' && response.id.trim() ? response.id : undefined;
  const usage = parseUsage(response.usage, latencyMs);
  return {
    text: content,
    model,
    ...(providerRequestId === undefined ? {} : { providerRequestId }),
    ...(usage === undefined ? {} : { usage })
  };
}

function transportFailure(
  error: AiHttpTransportError,
  model: string
): AiProviderExecutionFailureV1 {
  if (error.deliveryState === 'DELIVERY_UNCERTAIN') {
    return failure('DELIVERY_UNCERTAIN', 'RECONCILIATION_REQUIRED', error.code, error.message, {
      model
    });
  }
  if (error.deliveryState === 'DELIVERED_CONFIRMED') {
    return failure('DELIVERED_CONFIRMED', 'RETRY_FORBIDDEN', error.code, error.message, { model });
  }
  return failure('NOT_DELIVERED', 'RETRY_ALLOWED', error.code, error.message, { model });
}

export class DeepSeekProviderAdapterV1 implements AiProviderAdapterV1 {
  readonly implementationKey = DEEPSEEK_IMPLEMENTATION_KEY;
  readonly provider = DEEPSEEK_PROVIDER;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly transport: AiHttpTransport;
  private readonly model: string;
  private readonly maxResponseBytes: number;
  private readonly now: () => Date;
  private readonly clockMs: () => number;
  private readonly offPeakOnly: boolean;

  constructor(options: DeepSeekAdapterOptions = {}) {
    this.environment = options.environment ?? process.env;
    this.transport = options.transport ?? fetchAiHttpTransport;
    this.model = options.model?.trim() || DEEPSEEK_DEFAULT_MODEL;
    this.maxResponseBytes = boundedResponseBytes(
      options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES
    );
    this.now = options.now ?? (() => new Date());
    this.clockMs = options.clockMs ?? (() => Date.now());
    this.offPeakOnly = options.offPeakOnly ?? true;
  }

  async execute(
    request: Readonly<AiProviderExecutionRequestV1>
  ): Promise<AiProviderExecutionResultV1> {
    let input;
    let timeoutMs: number;
    try {
      input = parseAiTextGenerationInputV1(request.input);
      timeoutMs = boundedTimeout(request.timeoutMs);
    } catch (error) {
      return failure(
        'NOT_DELIVERED',
        'RETRY_FORBIDDEN',
        'AI_PROVIDER_INPUT_INVALID',
        error instanceof Error ? error.message : 'DeepSeek provider input is invalid.',
        { model: this.model }
      );
    }

    const secret = this.environment[DEEPSEEK_SECRET_ENV];
    if (!secret) {
      return failure(
        'NOT_DELIVERED',
        'RETRY_FORBIDDEN',
        'AI_PROVIDER_CREDENTIAL_MISSING',
        `DeepSeek credential environment variable ${DEEPSEEK_SECRET_ENV} is not configured.`,
        { model: this.model }
      );
    }

    const executionAt = this.now();
    if (this.offPeakOnly && isDeepSeekPeakPricingWindow(executionAt)) {
      return failure(
        'NOT_DELIVERED',
        'RETRY_ALLOWED',
        'AI_PROVIDER_PEAK_PRICING_WINDOW',
        'DeepSeek paid execution is deferred during the governed peak pricing window.',
        { model: this.model }
      );
    }

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (input.systemInstruction) {
      messages.push({ role: 'system', content: input.systemInstruction });
    }
    messages.push({ role: 'user', content: input.prompt });
    const body = JSON.stringify({
      model: this.model,
      messages,
      stream: false
    });

    const startedMs = this.clockMs();
    let response;
    try {
      response = await this.transport({
        url: DEEPSEEK_CANONICAL_ENDPOINT,
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
          accept: 'application/json'
        },
        body,
        timeoutMs,
        maxResponseBytes: this.maxResponseBytes
      });
    } catch (error) {
      if (error instanceof AiHttpTransportError) return transportFailure(error, this.model);
      return failure(
        'DELIVERY_UNCERTAIN',
        'RECONCILIATION_REQUIRED',
        'AI_PROVIDER_EXECUTION_UNCERTAIN',
        'DeepSeek transport failed without a governed delivery-state classification.',
        { model: this.model }
      );
    }
    const latencyMs = Math.max(0, Math.round(this.clockMs() - startedMs));
    const providerRequestId = parseProviderRequestId(response.body);
    const responseExtras = {
      model: this.model,
      exactResponse: response.body,
      ...(providerRequestId === undefined ? {} : { providerRequestId }),
      usage: { latencyMs }
    };

    if (response.status === 429 || response.status >= 500) {
      return failure(
        'DELIVERED_CONFIRMED',
        'RETRY_ALLOWED',
        'AI_PROVIDER_TEMPORARY_FAILURE',
        `DeepSeek returned HTTP ${response.status}.`,
        responseExtras
      );
    }
    if (response.status < 200 || response.status >= 300) {
      return failure(
        'DELIVERED_CONFIRMED',
        'RETRY_FORBIDDEN',
        'AI_PROVIDER_REJECTED',
        `DeepSeek returned HTTP ${response.status}.`,
        responseExtras
      );
    }

    let parsed: ParsedDeepSeekResponse;
    try {
      parsed = parseSuccessfulResponse(response.body, latencyMs);
    } catch (error) {
      return failure(
        'DELIVERED_CONFIRMED',
        'RETRY_FORBIDDEN',
        'AI_PROVIDER_RESPONSE_INVALID',
        error instanceof Error ? error.message : 'DeepSeek returned an invalid response.',
        responseExtras
      );
    }

    const success: AiProviderExecutionSuccessV1 = {
      kind: 'SUCCESS',
      provider: DEEPSEEK_PROVIDER,
      model: parsed.model,
      deliveryState: 'PROVIDER_COMPLETED',
      retryDisposition: 'RETRY_FORBIDDEN',
      exactResponse: response.body,
      ...(parsed.providerRequestId === undefined
        ? {}
        : { providerRequestId: parsed.providerRequestId }),
      structuredOutput: {
        text: parsed.text,
        outputFormat: input.outputFormat
      },
      ...(parsed.usage === undefined ? {} : { usage: parsed.usage })
    };
    return success;
  }
}
