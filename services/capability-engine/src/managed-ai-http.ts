import { createHash, timingSafeEqual } from 'node:crypto';
import {
  ManagedAiContractError,
  parseManagedAiExecutionInputV1,
  parseManagedAiExecutionOutcomeV1,
  type ManagedAiExecutionInputV1,
  type ManagedAiExecutionOutcomeV1
} from '@markorbit/contracts/managed-ai-execution';
import {
  HttpError,
  json,
  type JsonRequest,
  type JsonResult,
  type JsonRoute
} from '@markorbit/service-kit';

export interface ManagedAiExecutionContextV1 {
  executionId: string;
  correlationId: string;
}

export interface ManagedAiExecutionAuthorityV1 {
  execute(
    input: Readonly<ManagedAiExecutionInputV1>,
    context: Readonly<ManagedAiExecutionContextV1>
  ): Promise<unknown>;
}

export interface ManagedAiExecutionReplayEntryV1 {
  fingerprintSha256: string;
  outcome: Readonly<ManagedAiExecutionOutcomeV1>;
}

export interface ManagedAiExecutionReplayRepositoryV1 {
  find(idempotencyKey: string): Promise<ManagedAiExecutionReplayEntryV1 | undefined>;
  save(idempotencyKey: string, entry: Readonly<ManagedAiExecutionReplayEntryV1>): Promise<void>;
}

export class InMemoryManagedAiExecutionReplayRepositoryV1 implements ManagedAiExecutionReplayRepositoryV1 {
  private readonly entries = new Map<string, ManagedAiExecutionReplayEntryV1>();

  find(idempotencyKey: string): Promise<ManagedAiExecutionReplayEntryV1 | undefined> {
    const entry = this.entries.get(idempotencyKey);
    return Promise.resolve(
      entry
        ? {
            fingerprintSha256: entry.fingerprintSha256,
            outcome: structuredClone(entry.outcome)
          }
        : undefined
    );
  }

  save(idempotencyKey: string, entry: Readonly<ManagedAiExecutionReplayEntryV1>): Promise<void> {
    this.entries.set(idempotencyKey, {
      fingerprintSha256: entry.fingerprintSha256,
      outcome: structuredClone(entry.outcome)
    });
    return Promise.resolve();
  }
}

export interface ManagedAiExecutionRouteOptionsV1 {
  internalServiceSecret: string;
  executor: ManagedAiExecutionAuthorityV1;
  replayRepository?: ManagedAiExecutionReplayRepositoryV1;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorize(request: JsonRequest, secret: string): void {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
}

function requiredHeader(
  request: JsonRequest,
  header: string,
  code: string,
  maxLength: number
): string {
  const value = request.headers[header]?.trim();
  if (!value || value.length > maxLength)
    throw new HttpError(400, code, `${header} must contain 1 to ${maxLength} characters.`);
  return value;
}

function canonicalJson(value: unknown, path = 'managedAiInput'): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new HttpError(
        400,
        'INVALID_MANAGED_AI_REQUEST',
        `${path} contains a non-finite number.`
      );
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return `[${value.map((item, index) => canonicalJson(item, `${path}[${index}]`)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], `${path}.${key}`)}`)
      .join(',')}}`;
  }
  throw new HttpError(
    400,
    'INVALID_MANAGED_AI_REQUEST',
    `${path} contains unsupported ${typeof value} data.`
  );
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseInput(body: unknown): ManagedAiExecutionInputV1 {
  try {
    return parseManagedAiExecutionInputV1(body);
  } catch (error) {
    if (error instanceof ManagedAiContractError)
      throw new HttpError(400, 'INVALID_MANAGED_AI_REQUEST', error.message);
    throw error;
  }
}

function parseOutcome(value: unknown): ManagedAiExecutionOutcomeV1 {
  try {
    return parseManagedAiExecutionOutcomeV1(value);
  } catch (error) {
    if (error instanceof ManagedAiContractError)
      throw new HttpError(
        502,
        'MANAGED_AI_EXECUTOR_INVALID_RESULT',
        'Managed AI executor returned an outcome that violates the governed contract.'
      );
    throw error;
  }
}

function conflict(message: string): never {
  throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', message);
}

export function createManagedAiExecutionRoutesV1(
  options: ManagedAiExecutionRouteOptionsV1
): readonly JsonRoute[] {
  const replayRepository =
    options.replayRepository ?? new InMemoryManagedAiExecutionReplayRepositoryV1();
  const inFlight = new Map<string, { fingerprintSha256: string; result: Promise<JsonResult> }>();

  return [
    {
      method: 'POST',
      path: '/internal/v1/managed-ai-executions',
      handle: async (request) => {
        authorize(request, options.internalServiceSecret);
        const idempotencyKey = requiredHeader(
          request,
          'idempotency-key',
          'IDEMPOTENCY_KEY_REQUIRED',
          500
        );
        const correlationId = requiredHeader(
          request,
          'x-correlation-id',
          'CORRELATION_ID_REQUIRED',
          300
        );
        const input = parseInput(request.body);
        const fingerprintSha256 = sha256(canonicalJson({ correlationId, input }));

        const existing = await replayRepository.find(idempotencyKey);
        if (existing) {
          if (existing.fingerprintSha256 !== fingerprintSha256)
            return conflict(
              'Idempotency key was already used with a different Managed AI request.'
            );
          return json(200, existing.outcome);
        }

        const pending = inFlight.get(idempotencyKey);
        if (pending) {
          if (pending.fingerprintSha256 !== fingerprintSha256)
            return conflict(
              'Idempotency key is already in flight with a different Managed AI request.'
            );
          return pending.result;
        }

        const executionId = `maiexec_${sha256(idempotencyKey).slice(0, 32)}`;
        const result = (async (): Promise<JsonResult> => {
          let rawOutcome: unknown;
          try {
            rawOutcome = await options.executor.execute(input, { executionId, correlationId });
          } catch (error) {
            if (error instanceof HttpError) throw error;
            throw new HttpError(
              503,
              'MANAGED_AI_EXECUTOR_UNAVAILABLE',
              'Managed AI executor is unavailable.',
              true
            );
          }
          const outcome = parseOutcome(rawOutcome);
          await replayRepository.save(idempotencyKey, { fingerprintSha256, outcome });
          return json(200, outcome);
        })();
        inFlight.set(idempotencyKey, { fingerprintSha256, result });
        try {
          return await result;
        } finally {
          if (inFlight.get(idempotencyKey)?.result === result) inFlight.delete(idempotencyKey);
        }
      }
    }
  ];
}
