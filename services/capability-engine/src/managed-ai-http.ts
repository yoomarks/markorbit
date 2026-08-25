import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
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
import {
  InMemoryManagedAiExecutionClaimStoreV1,
  type ManagedAiExecutionClaimIdentityV1,
  type ManagedAiExecutionClaimStoreV1
} from './managed-ai-execution-claim.js';
import {
  ManagedAiExactOutputStoreError,
  type ManagedAiExactOutputStoreV1
} from './managed-ai-exact-output.js';

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

export interface ManagedAiExecutionRouteOptionsV1 {
  internalServiceSecret: string;
  executor: ManagedAiExecutionAuthorityV1;
  claimStore?: ManagedAiExecutionClaimStoreV1;
  exactOutputStore?: ManagedAiExactOutputStoreV1;
  now?: () => string;
  ownerTokenFactory?: () => string;
  claimLeaseMs?: number;
}

const DEFAULT_CLAIM_LEASE_MS = 10 * 60 * 1000;

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

function claimStoreUnavailable(message: string, retryable: boolean): never {
  throw new HttpError(503, 'MANAGED_AI_CLAIM_STORE_UNAVAILABLE', message, retryable);
}

function resolutionRef(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw new HttpError(
      400,
      'INVALID_MANAGED_AI_EXACT_OUTPUT_RESOLUTION',
      'Exact-output resolution body must be an object.'
    );
  const record = body as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || typeof record.ref !== 'string')
    throw new HttpError(
      400,
      'INVALID_MANAGED_AI_EXACT_OUTPUT_RESOLUTION',
      'Exact-output resolution body must contain only ref.'
    );
  const ref = record.ref.trim();
  if (!ref || ref.length > 2_000)
    throw new HttpError(
      400,
      'INVALID_MANAGED_AI_EXACT_OUTPUT_RESOLUTION',
      'Exact-output ref must contain 1 to 2000 characters.'
    );
  return ref;
}

async function resolveExactOutput(
  store: ManagedAiExactOutputStoreV1,
  ref: string
): Promise<JsonResult> {
  try {
    return json(200, await store.resolve(ref));
  } catch (error) {
    if (error instanceof ManagedAiExactOutputStoreError) {
      if (error.code === 'REFERENCE_NOT_FOUND')
        throw new HttpError(
          404,
          'MANAGED_AI_EXACT_OUTPUT_NOT_FOUND',
          'Managed AI exact-output reference was not found.',
          false
        );
      if (error.code === 'PERSISTENCE_UNAVAILABLE')
        throw new HttpError(
          503,
          'MANAGED_AI_EXACT_OUTPUT_STORE_UNAVAILABLE',
          'Managed AI exact-output store is unavailable.',
          true
        );
    }
    throw new HttpError(
      503,
      'MANAGED_AI_EXACT_OUTPUT_INTEGRITY_FAILURE',
      'Managed AI exact-output integrity could not be verified.',
      false
    );
  }
}

async function durabilizeExactOutput(
  store: ManagedAiExactOutputStoreV1,
  executionId: string,
  outcome: Readonly<ManagedAiExecutionOutcomeV1>,
  exactOutputRequired: boolean,
  now: string
): Promise<ManagedAiExecutionOutcomeV1> {
  if (!outcome.exactOutput) {
    if (exactOutputRequired && outcome.status === 'COMPLETED')
      throw new ManagedAiExactOutputStoreError(
        'CONTENT_MISMATCH',
        'Completed Managed AI execution is missing required exact provider output.'
      );
    return structuredClone(outcome);
  }
  if (outcome.exactOutput.kind === 'INLINE_BASE64') {
    const durable = await store.persist({ executionId, output: outcome.exactOutput, now });
    return parseOutcome({ ...outcome, exactOutput: durable });
  }
  const resolved = await store.resolve(outcome.exactOutput.ref);
  if (
    resolved.mediaType !== outcome.exactOutput.mediaType ||
    resolved.sha256 !== outcome.exactOutput.sha256 ||
    resolved.sizeBytes !== outcome.exactOutput.sizeBytes
  )
    throw new ManagedAiExactOutputStoreError(
      'CONTENT_MISMATCH',
      'Executor durable exact-output reference metadata does not match stored bytes.'
    );
  return structuredClone(outcome);
}

async function bestEffortReconciliation(
  claimStore: ManagedAiExecutionClaimStoreV1,
  identity: Readonly<ManagedAiExecutionClaimIdentityV1>,
  reason: string
): Promise<void> {
  try {
    await claimStore.markReconciliationRequired({ ...identity, reason });
  } catch {
    // A failed reconciliation write must never trigger another provider execution.
    // The durable DISPATCHING state, when available, remains fail-closed on lease expiry.
  }
}

export function createManagedAiExecutionRoutesV1(
  options: ManagedAiExecutionRouteOptionsV1
): readonly JsonRoute[] {
  const claimStore = options.claimStore ?? new InMemoryManagedAiExecutionClaimStoreV1();
  const exactOutputStore = options.exactOutputStore;
  const now = options.now ?? (() => new Date().toISOString());
  const ownerTokenFactory = options.ownerTokenFactory ?? randomUUID;
  const claimLeaseMs = options.claimLeaseMs ?? DEFAULT_CLAIM_LEASE_MS;
  if (!Number.isInteger(claimLeaseMs) || claimLeaseMs < 1_000 || claimLeaseMs > 60 * 60 * 1000)
    throw new Error('Managed AI claimLeaseMs must be between 1000 and 3600000 milliseconds.');
  const inFlight = new Map<string, { fingerprintSha256: string; result: Promise<JsonResult> }>();

  const routes: JsonRoute[] = [
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
        const pending = inFlight.get(idempotencyKey);
        if (pending) {
          if (pending.fingerprintSha256 !== fingerprintSha256)
            return conflict(
              'Idempotency key is already in flight with a different Managed AI request.'
            );
          return pending.result;
        }

        const executionId = `maiexec_${sha256(idempotencyKey).slice(0, 32)}`;
        const ownerToken = ownerTokenFactory();
        const result = (async (): Promise<JsonResult> => {
          const claimedAt = now();
          const leaseExpiresAt = new Date(Date.parse(claimedAt) + claimLeaseMs).toISOString();
          let claim;
          try {
            claim = await claimStore.claim({
              idempotencyKey,
              fingerprintSha256,
              executionId,
              correlationId,
              ownerToken,
              now: claimedAt,
              leaseExpiresAt
            });
          } catch {
            return claimStoreUnavailable(
              'Managed AI execution could not obtain its durable idempotency claim.',
              true
            );
          }

          if (claim.kind === 'CONFLICT')
            return conflict(
              'Idempotency key was already used with a different Managed AI request.'
            );
          if (claim.kind === 'REPLAY') return json(200, claim.outcome);
          if (claim.kind === 'IN_PROGRESS')
            throw new HttpError(
              409,
              'MANAGED_AI_EXECUTION_IN_PROGRESS',
              'The same Managed AI execution is already owned by another runtime.',
              true
            );
          if (claim.kind === 'RECONCILIATION_REQUIRED')
            throw new HttpError(
              409,
              'MANAGED_AI_EXECUTION_RECONCILIATION_REQUIRED',
              'The prior Managed AI dispatch may have reached the provider and must be reconciled before another attempt.',
              false
            );

          const identity = {
            idempotencyKey,
            fingerprintSha256,
            ownerToken,
            now: now()
          } as const;
          try {
            await claimStore.markDispatching(identity);
          } catch {
            return claimStoreUnavailable(
              'Managed AI execution could not durably mark provider dispatch before executor access.',
              true
            );
          }

          let rawOutcome: unknown;
          try {
            rawOutcome = await options.executor.execute(input, { executionId, correlationId });
          } catch {
            await bestEffortReconciliation(
              claimStore,
              { ...identity, now: now() },
              'EXECUTOR_THROW_AFTER_DISPATCH_MARK'
            );
            throw new HttpError(
              503,
              'MANAGED_AI_EXECUTION_RECONCILIATION_REQUIRED',
              'Managed AI executor failed after dispatch became possible; automatic replay is blocked.',
              false
            );
          }

          let outcome: ManagedAiExecutionOutcomeV1;
          try {
            outcome = parseOutcome(rawOutcome);
          } catch (error) {
            await bestEffortReconciliation(
              claimStore,
              { ...identity, now: now() },
              'INVALID_GOVERNED_OUTCOME_AFTER_DISPATCH'
            );
            throw error;
          }

          if (exactOutputStore) {
            try {
              outcome = await durabilizeExactOutput(
                exactOutputStore,
                executionId,
                outcome,
                input.requirements.exactProviderOutputRequired,
                now()
              );
            } catch {
              await bestEffortReconciliation(
                claimStore,
                { ...identity, now: now() },
                'EXACT_OUTPUT_PERSISTENCE_UNCERTAIN_AFTER_PROVIDER_RESULT'
              );
              throw new HttpError(
                503,
                'MANAGED_AI_EXECUTION_RECONCILIATION_REQUIRED',
                'Managed AI exact provider output could not be durably verified and committed; automatic replay is blocked.',
                false
              );
            }
          }

          try {
            await claimStore.complete({ ...identity, now: now(), outcome });
          } catch {
            await bestEffortReconciliation(
              claimStore,
              { ...identity, now: now() },
              'OUTCOME_PERSISTENCE_UNCERTAIN_AFTER_PROVIDER_RESULT'
            );
            return claimStoreUnavailable(
              'Managed AI provider result could not be durably committed; automatic replay is blocked.',
              false
            );
          }
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

  if (exactOutputStore) {
    routes.push({
      method: 'POST',
      path: '/internal/v1/managed-ai-exact-output-resolutions',
      handle: async (request) => {
        authorize(request, options.internalServiceSecret);
        return resolveExactOutput(exactOutputStore, resolutionRef(request.body));
      }
    });
  }

  return routes;
}
