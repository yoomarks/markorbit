import {
  parseInternalWorkspacePrincipal,
  type MarkOrbitId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { HttpError, type JsonRequest } from '@markorbit/service-kit';

export type Body = Record<string, unknown>;

const forbiddenTopLevelAuthorityFields = new Set([
  'workspaceId',
  'actorId',
  'userId',
  'membershipId',
  'principal',
  'principalReference',
  'workspaceMembershipReference',
  'requesterWorkspaceId',
  'originatingWorkspaceId',
  'trustedHumanAuthority',
  'selectionAuthorityReference',
  'handoffAuthorityReference',
  'authorityReference',
  'authorityVersion',
  'authenticatedAt',
  'affirmativeHumanActionEvidenceReference'
]);

export function bodyOf(request: JsonRequest): Body {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body))
    throw new HttpError(400, 'INVALID_GOVERNED_NETWORK_REQUEST', 'Request body must be an object.');
  return request.body as Body;
}

export function objectOf(value: unknown, field: string): Body {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_GOVERNED_NETWORK_REQUEST', `${field} must be an object.`);
  return value as Body;
}

export interface TransportShape {
  readonly [key: string]: null | TransportShape | readonly [TransportShape];
}

export function assertExactTransportShape(
  value: unknown,
  shape: TransportShape,
  field: string
): void {
  const object = objectOf(value, field);
  const allowed = new Set(Object.keys(shape));
  const unexpected = Object.keys(object).find((key) => !allowed.has(key));
  if (unexpected)
    throw new HttpError(
      400,
      'UNEXPECTED_GOVERNED_NETWORK_FIELD',
      `${field}.${unexpected} is not permitted by the governed-network transport contract.`
    );
  for (const [key, nested] of Object.entries(shape)) {
    const child = object[key];
    if (nested === null || child === undefined) continue;
    if (Array.isArray(nested)) {
      if (!Array.isArray(child))
        throw new HttpError(
          400,
          'INVALID_GOVERNED_NETWORK_REQUEST',
          `${field}.${key} must be an array.`
        );
      for (const [index, item] of child.entries())
        assertExactTransportShape(item, nested[0] as TransportShape, `${field}.${key}[${index}]`);
      continue;
    }
    assertExactTransportShape(child, nested as TransportShape, `${field}.${key}`);
  }
}

export function rejectTopLevelAuthority(body: Body): void {
  const field = Object.keys(body).find((candidate) =>
    forbiddenTopLevelAuthorityFields.has(candidate)
  );
  if (field)
    throw new HttpError(
      400,
      'SPOOFED_GOVERNED_NETWORK_AUTHORITY',
      `${field} cannot be supplied as governed-network authority.`
    );
}

export function trustedWorkspacePrincipalFor(
  request: JsonRequest,
  internalServiceSecret: string | undefined
): WorkspacePrincipal {
  if (
    !internalServiceSecret ||
    request.headers['x-markorbit-internal-authorization'] !== internalServiceSecret
  )
    throw new HttpError(
      401,
      'UNTRUSTED_INTERNAL_CALLER',
      'Trusted internal authorization is required.'
    );
  try {
    return parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
  } catch {
    throw new HttpError(
      401,
      'INVALID_INTERNAL_PRINCIPAL',
      'A trusted Workspace Principal is required.'
    );
  }
}

const governedSha256Pattern = /^[0-9a-f]{64}$/;
const governedWorkspaceUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalidGovernedValue(field: string, expectation: string): never {
  throw new HttpError(400, 'INVALID_GOVERNED_NETWORK_REQUEST', `${field} ${expectation}`);
}

export function requiredString(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string') return invalidGovernedValue(field, 'must be a string.');
  const text = value.trim();
  if (!text || text.length > maximum)
    return invalidGovernedValue(
      field,
      `must be non-empty and no longer than ${maximum} characters.`
    );
  return text;
}

export function optionalString(value: unknown, field: string, maximum = 500): string | undefined {
  return value === undefined ? undefined : requiredString(value, field, maximum);
}

export function requiredLiteral<const T extends string | number | boolean>(
  value: unknown,
  expected: T,
  field: string
): T {
  if (value !== expected)
    return invalidGovernedValue(field, `must equal ${JSON.stringify(expected)}.`);
  return expected;
}

export function requiredEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string
): T[number] {
  if (typeof value !== 'string' || !allowed.some((candidate) => candidate === value))
    return invalidGovernedValue(field, `must be one of ${allowed.join(', ')}.`);
  return value;
}

export function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1)
    return invalidGovernedValue(field, 'must be a positive integer.');
  return Number(value);
}

export function nonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 0)
    return invalidGovernedValue(field, 'must be a non-negative integer.');
  return Number(value);
}

export function versionValue(value: unknown, field: string): number | string {
  if (typeof value === 'number') return positiveInteger(value, field);
  return requiredString(value, field, 200);
}

export function timestamp(value: unknown, field: string): string {
  const text = requiredString(value, field, 100);
  if (!Number.isFinite(Date.parse(text)))
    return invalidGovernedValue(field, 'must be an ISO timestamp.');
  return text;
}

export function optionalTimestamp(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : timestamp(value, field);
}

export function sha256(value: unknown, field: string): string {
  const text = requiredString(value, field, 64);
  if (!governedSha256Pattern.test(text))
    return invalidGovernedValue(field, 'must be a lowercase SHA-256 value.');
  return text;
}

export function workspaceUuid(value: unknown, field: string): string {
  const text = requiredString(value, field, 100).toLowerCase();
  if (!governedWorkspaceUuidPattern.test(text))
    return invalidGovernedValue(field, 'must be a Core Workspace UUID.');
  return text;
}

export function prefixedId<T extends string>(value: unknown, prefix: string, field: string): T {
  const text = requiredString(value, field, 200);
  if (!text.startsWith(prefix) || text.length === prefix.length)
    return invalidGovernedValue(field, `must start with ${prefix}.`);
  return text as T;
}

export function markOrbitId(value: unknown, field: string): MarkOrbitId {
  const text = requiredString(value, field, 200);
  const separator = text.indexOf('_');
  if (separator < 1 || separator === text.length - 1)
    return invalidGovernedValue(
      field,
      'must be a MarkOrbit reference with an underscore separator.'
    );
  return text as MarkOrbitId;
}

export function arrayValue(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) return invalidGovernedValue(field, 'must be an array.');
  if (value.length > 1000) return invalidGovernedValue(field, 'contains too many entries.');
  return value;
}

export function parsedArray<T>(
  value: unknown,
  field: string,
  parser: (item: unknown, itemField: string) => T
): T[] {
  return arrayValue(value, field).map((item, index) => parser(item, `${field}[${index}]`));
}

export function stringArray(value: unknown, field: string): string[] {
  return parsedArray(value, field, (item, itemField) => requiredString(item, itemField, 500));
}

export function enumArray<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string
): T[number][] {
  return parsedArray(value, field, (item, itemField) => requiredEnum(item, allowed, itemField));
}

export function requireIdempotency(request: JsonRequest, body: Body): string {
  const key = request.headers['idempotency-key']?.trim();
  if (!key)
    throw new HttpError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key is required for governed-network mutations.'
    );
  if (body.idempotencyKey !== undefined && body.idempotencyKey !== key)
    throw new HttpError(
      400,
      'IDEMPOTENCY_KEY_MISMATCH',
      'Body idempotencyKey must match Idempotency-Key.'
    );
  return key;
}
