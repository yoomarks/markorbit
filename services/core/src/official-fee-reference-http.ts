import { HttpError, json, type JsonRoute } from '@markorbit/service-kit';

import { validateInternalServiceSecret } from './auth.js';
import {
  OFFICIAL_FEE_PILOT_OPERATION,
  OfficialFeeReferenceStoreError,
  type OfficialFeeReferenceV1,
  type OfficialFeeResolutionQueryV1
} from './official-fee-reference-store.js';

export interface OfficialFeeReferenceResolutionAuthorityV1 {
  resolveCurrent(
    query: Readonly<OfficialFeeResolutionQueryV1>
  ): Readonly<OfficialFeeReferenceV1> | Promise<Readonly<OfficialFeeReferenceV1>>;
}

export interface OfficialFeeReferenceHttpOptionsV1 {
  internalServiceSecret: string;
  references: Readonly<OfficialFeeReferenceResolutionAuthorityV1>;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseQuery(value: unknown): OfficialFeeResolutionQueryV1 {
  const input = record(value);
  if (!input) throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const expectedKeys = ['operation', 'jurisdiction', 'authority', 'asOf'] as const;
  const keys = Object.keys(input).sort();
  if (
    keys.length !== expectedKeys.length ||
    ![...expectedKeys].sort().every((expected, index) => keys[index] === expected)
  )
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Request body must contain only operation, jurisdiction, authority and asOf.'
    );
  if (
    input.operation !== OFFICIAL_FEE_PILOT_OPERATION ||
    input.jurisdiction !== 'US' ||
    input.authority !== 'USPTO' ||
    typeof input.asOf !== 'string' ||
    !input.asOf.trim() ||
    input.asOf !== input.asOf.trim() ||
    Number.isNaN(Date.parse(input.asOf))
  )
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Only the exact USPTO official-fee current-reference query is supported.'
    );
  return {
    operation: OFFICIAL_FEE_PILOT_OPERATION,
    jurisdiction: 'US',
    authority: 'USPTO',
    asOf: input.asOf
  };
}

function translate(error: unknown): never {
  if (!(error instanceof OfficialFeeReferenceStoreError)) throw error;
  if (error.code === 'INVALID_INPUT') throw new HttpError(400, error.code, error.message, false);
  if (error.code === 'NO_CURRENT_REFERENCE')
    throw new HttpError(404, error.code, error.message, false);
  if (error.code === 'AMBIGUOUS_CURRENT_REFERENCE')
    throw new HttpError(409, error.code, error.message, false);
  if (error.code === 'PERSISTENCE_UNAVAILABLE')
    throw new HttpError(503, error.code, error.message, true);
  throw new HttpError(409, error.code, error.message, false);
}

export function createOfficialFeeReferenceRoutesV1(
  options: Readonly<OfficialFeeReferenceHttpOptionsV1>
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/official-fee-references/current',
      async handle(request) {
        if (
          !validateInternalServiceSecret(
            options.internalServiceSecret,
            request.headers['x-markorbit-internal-authorization']
          )
        )
          throw new HttpError(
            401,
            'INTERNAL_SERVICE_UNAUTHORIZED',
            'Internal service identity is invalid.'
          );
        const query = parseQuery(request.body);
        try {
          return json(200, await options.references.resolveCurrent(query));
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
