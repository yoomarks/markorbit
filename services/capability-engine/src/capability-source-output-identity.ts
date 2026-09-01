import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const SHA256 = /^[0-9a-f]{64}$/;
const ARRAY_INDEX = /^(0|[1-9]\d*)$/;
const OUTPUT_IDENTITY_KEYS = new Set<PropertyKey>([
  'schemaVersion',
  'outputSchemaId',
  'outputFingerprintSha256'
]);

export interface CapabilitySourceOutputIdentityV1 {
  readonly schemaVersion: 1;
  readonly outputSchemaId: string;
  readonly outputFingerprintSha256: string;
}

export type CapabilitySourceOutputIdentityErrorCode =
  'INVALID_OUTPUT_SCHEMA' | 'INVALID_OUTPUT_SHAPE' | 'INCONSISTENT_RUNTIME_OUTPUT';

export class CapabilitySourceOutputIdentityError extends Error {
  constructor(
    readonly code: CapabilitySourceOutputIdentityErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CapabilitySourceOutputIdentityError';
  }
}

function invalidOutputShape(message: string): never {
  throw new CapabilitySourceOutputIdentityError('INVALID_OUTPUT_SHAPE', message);
}

function canonicalKeyOrder(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalJson(value: unknown, ancestors: WeakSet<object>): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return invalidOutputShape('Capability source output cannot contain non-finite numbers.');
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (
    value === undefined ||
    typeof value === 'bigint' ||
    typeof value === 'function' ||
    typeof value === 'symbol'
  ) {
    return invalidOutputShape(
      `Capability source output contains unsupported ${typeof value} content.`
    );
  }
  if (typeof value !== 'object') {
    return invalidOutputShape('Capability source output contains an unsupported value.');
  }

  const objectValue = value as object;
  if (ancestors.has(objectValue)) {
    return invalidOutputShape('Capability source output cannot contain cyclic references.');
  }
  ancestors.add(objectValue);
  try {
    if (Array.isArray(value)) {
      const ownKeys = Reflect.ownKeys(value);
      for (const key of ownKeys) {
        if (key === 'length') continue;
        if (typeof key !== 'string' || !ARRAY_INDEX.test(key)) {
          return invalidOutputShape(
            'Capability source output arrays cannot contain custom or symbolic properties.'
          );
        }
      }
      const items: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          return invalidOutputShape('Capability source output arrays cannot contain sparse holes.');
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !('value' in descriptor) || descriptor.enumerable !== true) {
          return invalidOutputShape(
            'Capability source output arrays must contain ordinary enumerable data elements.'
          );
        }
        items.push(canonicalJson(descriptor.value, ancestors));
      }
      return `[${items.join(',')}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return invalidOutputShape(
        'Capability source output must use JSON-compatible plain objects only.'
      );
    }

    const entries: Array<readonly [string, unknown]> = [];
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') {
        return invalidOutputShape('Capability source output cannot contain symbolic object keys.');
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || descriptor.enumerable !== true) {
        return invalidOutputShape(
          'Capability source output objects must contain ordinary enumerable data properties.'
        );
      }
      entries.push([key, descriptor.value]);
    }
    entries.sort(([left], [right]) => canonicalKeyOrder(left, right));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item, ancestors)}`)
      .join(',')}}`;
  } finally {
    ancestors.delete(objectValue);
  }
}

export function canonicalJsonSha256V1(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value, new WeakSet())).digest('hex');
}

export function materializeCapabilitySourceOutputIdentityV1(
  outputSchemaId: string,
  output: unknown
): Readonly<CapabilitySourceOutputIdentityV1> {
  if (
    typeof outputSchemaId !== 'string' ||
    outputSchemaId.length === 0 ||
    outputSchemaId.length > 300 ||
    outputSchemaId !== outputSchemaId.trim()
  ) {
    throw new CapabilitySourceOutputIdentityError(
      'INVALID_OUTPUT_SCHEMA',
      'Capability source output identity requires an exact non-whitespace-padded output schema id.'
    );
  }
  const outputFingerprintSha256 = canonicalJsonSha256V1({
    outputSchemaId,
    output
  });
  return Object.freeze({
    schemaVersion: 1,
    outputSchemaId,
    outputFingerprintSha256
  });
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function resolveCapabilitySourceOutputIdentityV1(
  runtimeExecution: unknown
): Readonly<CapabilitySourceOutputIdentityV1> | undefined {
  const execution = record(runtimeExecution);
  const outcome = record(execution?.outcome);
  const returnValue = record(execution?.returnValue);
  if (!outcome || !returnValue) return undefined;
  if (outcome.status !== 'SUCCEEDED' || returnValue.status !== 'COMPLETED') return undefined;

  if (
    typeof outcome.outputSchemaId !== 'string' ||
    typeof returnValue.outputSchemaId !== 'string' ||
    outcome.outputSchemaId !== returnValue.outputSchemaId ||
    !isDeepStrictEqual(outcome.output, returnValue.output)
  ) {
    throw new CapabilitySourceOutputIdentityError(
      'INCONSISTENT_RUNTIME_OUTPUT',
      'Successful Capability outcome and return must contain the same exact output schema and output.'
    );
  }

  return materializeCapabilitySourceOutputIdentityV1(outcome.outputSchemaId, outcome.output);
}

export function validCapabilitySourceOutputIdentityV1(
  value: unknown
): value is CapabilitySourceOutputIdentityV1 {
  const identity = record(value);
  if (!identity) return false;
  const keys = Reflect.ownKeys(identity);
  if (
    keys.length !== OUTPUT_IDENTITY_KEYS.size ||
    keys.some((key) => !OUTPUT_IDENTITY_KEYS.has(key))
  ) {
    return false;
  }
  return (
    identity.schemaVersion === 1 &&
    typeof identity.outputSchemaId === 'string' &&
    identity.outputSchemaId.length > 0 &&
    identity.outputSchemaId.length <= 300 &&
    identity.outputSchemaId === identity.outputSchemaId.trim() &&
    typeof identity.outputFingerprintSha256 === 'string' &&
    SHA256.test(identity.outputFingerprintSha256)
  );
}
