import { HttpError, json, type JsonRoute } from '@markorbit/service-kit';
import { validateInternalServiceSecret } from './auth.js';
import {
  GovernedHumanActionReceiptError,
  type GovernedHumanActionReceiptAuthorityV1,
  type GovernedHumanActionReceiptMaterializationV1
} from './governed-human-action-receipt.js';

export interface GovernedHumanActionReceiptHttpOptionsV1 {
  internalServiceSecret: string;
  receipts: Readonly<GovernedHumanActionReceiptAuthorityV1>;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseMaterialization(value: unknown): GovernedHumanActionReceiptMaterializationV1 {
  const input = record(value);
  if (!input) throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be an object.');
  const expected = [
    'schemaVersion',
    'kind',
    'workspaceId',
    'userId',
    'membershipId',
    'principalReference',
    'authorityReference',
    'idempotencyKeySha256',
    'requestFingerprintSha256',
    'authenticatedAt'
  ].sort();
  const actual = Object.keys(input).sort();
  if (actual.length !== expected.length || !expected.every((key, index) => actual[index] === key))
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'Governed human-action receipt body has unexpected fields.'
    );
  return input as unknown as GovernedHumanActionReceiptMaterializationV1;
}

function authorize(options: Readonly<GovernedHumanActionReceiptHttpOptionsV1>, supplied?: string) {
  if (!validateInternalServiceSecret(options.internalServiceSecret, supplied))
    throw new HttpError(
      401,
      'INTERNAL_SERVICE_UNAUTHORIZED',
      'Internal service identity is invalid.'
    );
}

function translate(error: unknown): never {
  if (!(error instanceof GovernedHumanActionReceiptError)) throw error;
  if (error.code === 'INVALID_INPUT') throw new HttpError(400, error.code, error.message, false);
  if (error.code === 'CONFLICT') throw new HttpError(409, error.code, error.message, false);
  if (error.code === 'NOT_FOUND') throw new HttpError(404, error.code, error.message, false);
  throw new HttpError(503, error.code, error.message, true);
}

export function createGovernedHumanActionReceiptRoutesV1(
  options: Readonly<GovernedHumanActionReceiptHttpOptionsV1>
): readonly JsonRoute[] {
  return [
    {
      method: 'POST',
      path: '/internal/v1/governed-human-action-receipts',
      async handle(request) {
        authorize(options, request.headers['x-markorbit-internal-authorization']);
        try {
          return json(200, await options.receipts.materialize(parseMaterialization(request.body)));
        } catch (error) {
          return translate(error);
        }
      }
    },
    {
      method: 'GET',
      path: '/internal/v1/governed-human-action-receipts/:receiptId',
      async handle(request) {
        authorize(options, request.headers['x-markorbit-internal-authorization']);
        try {
          const receipt = await options.receipts.get(request.params.receiptId!);
          if (!receipt)
            throw new GovernedHumanActionReceiptError(
              'NOT_FOUND',
              'Governed human-action receipt was not found.'
            );
          return json(200, receipt);
        } catch (error) {
          return translate(error);
        }
      }
    }
  ];
}
