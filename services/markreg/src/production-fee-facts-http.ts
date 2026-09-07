import { timingSafeEqual } from 'node:crypto';
import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type { CreateProductionFeeFactsCommandV1 } from '@markorbit/contracts/markreg-early-funnel';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ProductionFeeFactsError,
  type PostgresProductionFeeFactsService
} from './production-fee-facts.js';

export interface ProductionFeeFactsHttpOptions {
  readonly internalServiceSecret: string;
  readonly service: Pick<PostgresProductionFeeFactsService, 'create' | 'getCurrent'>;
}

function trusted(configured: string, supplied: string | undefined): boolean {
  if (Buffer.byteLength(configured) < 32)
    throw new Error('MO_INTERNAL_SERVICE_SECRET must contain at least 32 bytes.');
  if (!supplied) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function principalFor(request: JsonRequest, secret: string): WorkspacePrincipal {
  if (!trusted(secret, request.headers['x-markorbit-internal-authorization']))
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  let principal: WorkspacePrincipal;
  try {
    principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch (error) {
    if (error instanceof AuthenticationError) throw new HttpError(401, error.code, error.message);
    throw error;
  }
  const workspaceId = request.headers['x-markorbit-workspace-id'];
  if (!workspaceId || workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase())
    throw new HttpError(404, 'WORKSPACE_MISMATCH', 'Workspace-scoped record was not found.');
  return principal;
}

function translate(error: unknown): never {
  if (error instanceof ProductionFeeFactsError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

function commandFor(request: JsonRequest): CreateProductionFeeFactsCommandV1 {
  const body =
    request.body && typeof request.body === 'object' && !Array.isArray(request.body)
      ? (request.body as Record<string, unknown>)
      : {};
  for (const field of [
    'actor',
    'actorId',
    'userId',
    'workspaceId',
    'membershipId',
    'classCount',
    'filingBasisProvenance',
    'classSelectionProvenance'
  ]) {
    if (Object.hasOwn(body, field))
      throw new HttpError(
        400,
        'INVALID_PRODUCTION_FEE_FACTS_REQUEST',
        `${field} is trusted or server-derived context and must not be supplied by this command.`
      );
  }
  const idempotencyKey = request.headers['idempotency-key'] ?? '';
  if (body.idempotencyKey !== undefined && body.idempotencyKey !== idempotencyKey)
    throw new HttpError(
      400,
      'INVALID_PRODUCTION_FEE_FACTS_REQUEST',
      'Request idempotencyKey must match Idempotency-Key header.'
    );
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  return {
    schemaVersion: body.schemaVersion as 1,
    intakeId: text(body.intakeId) as CreateProductionFeeFactsCommandV1['intakeId'],
    expectedIntakeVersion: Number(body.expectedIntakeVersion),
    filingBasis: body.filingBasis as CreateProductionFeeFactsCommandV1['filingBasis'],
    niceClasses: Array.isArray(body.niceClasses) ? (body.niceClasses as number[]) : [],
    filingBasisSourceClass:
      body.filingBasisSourceClass as CreateProductionFeeFactsCommandV1['filingBasisSourceClass'],
    classSelectionSourceClass:
      body.classSelectionSourceClass as CreateProductionFeeFactsCommandV1['classSelectionSourceClass'],
    idempotencyKey,
    correlationId: text(body.correlationId) as CreateProductionFeeFactsCommandV1['correlationId']
  };
}

function expectedVersion(request: JsonRequest): number {
  const raw = request.query.expectedIntakeVersion;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new HttpError(
      400,
      'INVALID_PRODUCTION_FEE_FACTS_REQUEST',
      'expectedIntakeVersion must be a positive safe integer.'
    );
  return value;
}

export function createProductionFeeFactsRoutes(
  options: ProductionFeeFactsHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/production-fee-facts',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(200, {
            feeFacts: await options.service.create(
              principal,
              commandFor(request),
              request.headers['x-correlation-id']
            )
          });
        } catch (error) {
          return translate(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/v1/production-intakes/:intakeId/fee-facts/current',
      async handle(request) {
        const principal = principalFor(request, options.internalServiceSecret);
        try {
          return json(200, {
            feeFacts: await options.service.getCurrent(
              principal,
              request.params.intakeId!,
              expectedVersion(request)
            )
          });
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
