import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { validateInternalServiceSecret } from './auth.js';
import {
  GOVERNED_HUMAN_ACTION_KINDS,
  GovernedHumanActionReceiptError,
  type GovernedHumanActionKind,
  type GovernedHumanActionReceiptService,
  type MaterializeGovernedHumanActionReceiptRequest,
  type ValidateGovernedHumanActionReceiptRequest
} from './governed-human-action-receipt.js';

export interface GovernedHumanActionReceiptHttpOptions {
  internalServiceSecret: string;
  service: Pick<
    GovernedHumanActionReceiptService,
    'materializeOrResolve' | 'validateCurrent'
  >;
}

const materializeKeys = new Set([
  'workspaceId',
  'userId',
  'membershipId',
  'principalReference',
  'kind',
  'mutationRoute',
  'reviewedActionDigest',
  'idempotencyKey',
  'authenticatedAt'
]);
const validateKeys = new Set([...materializeKeys, 'receiptId']);

function authenticated(request: JsonRequest, configured: string): void {
  if (
    !validateInternalServiceSecret(
      configured,
      request.headers['x-markorbit-internal-authorization']
    )
  )
    throw new HttpError(
      401,
      'INTERNAL_SERVICE_UNAUTHORIZED',
      'Internal service identity is invalid.'
    );
}

function recordBody(request: JsonRequest): Record<string, unknown> {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(
      400,
      'INVALID_GOVERNED_HUMAN_ACTION_REQUEST',
      'Request body must be an object.'
    );
  return request.body as Record<string, unknown>;
}

function binding(
  request: JsonRequest,
  includeReceiptId: false
): MaterializeGovernedHumanActionReceiptRequest;
function binding(
  request: JsonRequest,
  includeReceiptId: true
): ValidateGovernedHumanActionReceiptRequest;
function binding(
  request: JsonRequest,
  includeReceiptId: boolean
): MaterializeGovernedHumanActionReceiptRequest | ValidateGovernedHumanActionReceiptRequest {
  const value = recordBody(request);
  const allowed = includeReceiptId ? validateKeys : materializeKeys;
  if (Object.keys(value).some((key) => !allowed.has(key)))
    throw new HttpError(
      400,
      'INVALID_GOVERNED_HUMAN_ACTION_REQUEST',
      'Only bounded governed human-action receipt fields may be supplied.'
    );
  const stringFields = [
    'workspaceId',
    'userId',
    'membershipId',
    'principalReference',
    'mutationRoute',
    'reviewedActionDigest',
    'idempotencyKey',
    'authenticatedAt'
  ] as const;
  if (stringFields.some((field) => typeof value[field] !== 'string'))
    throw new HttpError(
      400,
      'INVALID_GOVERNED_HUMAN_ACTION_REQUEST',
      'Exact governed human-action receipt binding fields are required.'
    );
  if (
    typeof value.kind !== 'string' ||
    !(GOVERNED_HUMAN_ACTION_KINDS as readonly string[]).includes(value.kind)
  )
    throw new HttpError(
      400,
      'INVALID_GOVERNED_HUMAN_ACTION_REQUEST',
      'kind must identify a reviewed governed human-action domain.'
    );
  if (includeReceiptId && typeof value.receiptId !== 'string')
    throw new HttpError(
      400,
      'INVALID_GOVERNED_HUMAN_ACTION_REQUEST',
      'receiptId is required for current validation.'
    );
  const result = {
    workspaceId: value.workspaceId as string,
    userId: value.userId as string,
    membershipId: value.membershipId as string,
    principalReference: value.principalReference as string,
    kind: value.kind as GovernedHumanActionKind,
    mutationRoute: value.mutationRoute as string,
    reviewedActionDigest: value.reviewedActionDigest as string,
    idempotencyKey: value.idempotencyKey as string,
    authenticatedAt: value.authenticatedAt as string
  };
  return includeReceiptId ? { ...result, receiptId: value.receiptId as string } : result;
}

function mapError(error: unknown): never {
  if (error instanceof GovernedHumanActionReceiptError)
    throw new HttpError(error.status, error.code, error.message, error.retryable);
  throw error;
}

export function createGovernedHumanActionReceiptRoutes(
  options: GovernedHumanActionReceiptHttpOptions
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/auth/governed-human-actions/receipts',
      async handle(request) {
        authenticated(request, options.internalServiceSecret);
        try {
          return json(200, await options.service.materializeOrResolve(binding(request, false)));
        } catch (error) {
          return mapError(error);
        }
      }
    },
    {
      method: 'POST',
      path: '/internal/auth/governed-human-actions/receipts/validate-current',
      async handle(request) {
        authenticated(request, options.internalServiceSecret);
        try {
          return json(200, await options.service.validateCurrent(binding(request, true)));
        } catch (error) {
          return mapError(error);
        }
      }
    }
  ];
}
