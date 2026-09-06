import { HttpError, json, type JsonRoute } from '@markorbit/service-kit';

import { validateInternalServiceSecret } from './auth.js';
import {
  UsTrademarkMarkRepresentationMethodAuthorityError,
  type CurrentUsTrademarkMarkRepresentationMethodV1,
  type UsTrademarkMarkRepresentationResolutionQueryV1
} from './us-trademark-mark-representation-method-authority.js';

export interface UsTrademarkMarkRepresentationMethodResolutionAuthorityV1 {
  resolveCurrent(
    query: Readonly<UsTrademarkMarkRepresentationResolutionQueryV1>
  ):
    | Readonly<CurrentUsTrademarkMarkRepresentationMethodV1>
    | Promise<Readonly<CurrentUsTrademarkMarkRepresentationMethodV1>>;
}

export interface UsTrademarkMarkRepresentationMethodHttpOptionsV1 {
  internalServiceSecret: string;
  methods: Readonly<UsTrademarkMarkRepresentationMethodResolutionAuthorityV1>;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function parseQuery(value: unknown): UsTrademarkMarkRepresentationResolutionQueryV1 {
  const input = record(value);
  if (!input) throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const expectedKeys = ['operation', 'jurisdiction', 'authority', 'asOf'] as const;
  const keys = Object.keys(input).sort();
  if (
    keys.length !== expectedKeys.length ||
    ![...expectedKeys].sort().every((expected, index) => keys[index] === expected)
  ) {
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Request body must contain only operation, jurisdiction, authority and asOf.'
    );
  }
  if (
    input.operation !== 'MARK_REPRESENTATION_STRATEGY' ||
    input.jurisdiction !== 'US' ||
    input.authority !== 'USPTO' ||
    typeof input.asOf !== 'string' ||
    !input.asOf.trim() ||
    input.asOf !== input.asOf.trim() ||
    Number.isNaN(Date.parse(input.asOf))
  ) {
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Only the exact US/USPTO mark-representation current Method query is supported.'
    );
  }
  return {
    operation: 'MARK_REPRESENTATION_STRATEGY',
    jurisdiction: 'US',
    authority: 'USPTO',
    asOf: input.asOf
  };
}
function translate(error: unknown): never {
  if (!(error instanceof UsTrademarkMarkRepresentationMethodAuthorityError)) throw error;
  if (error.code === 'INVALID_INPUT') {
    throw new HttpError(400, error.code, error.message, false);
  }
  if (error.code === 'NO_CURRENT_METHOD') {
    throw new HttpError(404, error.code, error.message, false);
  }
  if (error.code === 'AMBIGUOUS_CURRENT_METHOD' || error.code === 'IDENTITY_MISMATCH') {
    throw new HttpError(409, error.code, error.message, false);
  }
  throw new HttpError(503, error.code, error.message, true);
}

export function createUsTrademarkMarkRepresentationMethodRoutesV1(
  options: Readonly<UsTrademarkMarkRepresentationMethodHttpOptionsV1>
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/brain-method-references/us-trademark-mark-representation/current',
      async handle(request) {
        if (
          !validateInternalServiceSecret(
            options.internalServiceSecret,
            request.headers['x-markorbit-internal-authorization']
          )
        ) {
          throw new HttpError(
            401,
            'INTERNAL_SERVICE_UNAUTHORIZED',
            'Internal service identity is invalid.'
          );
        }
        const query = parseQuery(request.body);
        try {
          return json(200, await options.methods.resolveCurrent(query));
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
