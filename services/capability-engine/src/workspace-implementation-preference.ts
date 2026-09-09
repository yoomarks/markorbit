import { createHash } from 'node:crypto';
import type {
  GovernedWorkspaceImplementationPreferenceV1,
  WorkspaceImplementationPreferenceContextV1
} from './implementation-profile-registry.js';

export const workspaceImplementationPreferenceStatuses = ['ACTIVE', 'CLEARED'] as const;
export type WorkspaceImplementationPreferenceStatus =
  (typeof workspaceImplementationPreferenceStatuses)[number];

export interface WorkspaceImplementationPreferenceV1 {
  schemaVersion: 1;
  workspaceId: string;
  capabilityId: string;
  capabilityVersion: string;
  version: number;
  status: WorkspaceImplementationPreferenceStatus;
  preferredImplementationKeys: readonly string[];
  authorityReference: string;
  reason: string;
  createdAt: string;
}

export type WorkspaceImplementationPreferenceErrorCode =
  | 'INVALID_PREFERENCE'
  | 'PREFERENCE_VERSION_CONFLICT'
  | 'PERSISTENCE_UNAVAILABLE'
  | 'INVALID_PERSISTED_PREFERENCE';

export class WorkspaceImplementationPreferenceError extends Error {
  constructor(
    readonly code: WorkspaceImplementationPreferenceErrorCode,
    message: string,
    readonly status = 409,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'WorkspaceImplementationPreferenceError';
  }
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PREFERENCE',
      `${field} must be an object.`,
      422
    );
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const accepted = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !accepted.has(key));
  if (unsupported.length)
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PREFERENCE',
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`,
      422
    );
}

function text(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string')
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PREFERENCE',
      `${field} must be a string.`,
      422
    );
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PREFERENCE',
      `${field} must contain 1 to ${maximum} characters.`,
      422
    );
  return cleaned;
}

function positiveVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 1_000_000)
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PREFERENCE',
      'preference.version must be a positive safe integer not exceeding 1000000.',
      422
    );
  return Number(value);
}

function implementationKeys(value: unknown, status: WorkspaceImplementationPreferenceStatus) {
  if (!Array.isArray(value) || value.length > 100)
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PREFERENCE',
      'preference.preferredImplementationKeys must be a bounded array.',
      422
    );
  const keys = value.map((item, index) =>
    text(item, `preference.preferredImplementationKeys[${index}]`, 500)
  );
  if (new Set(keys).size !== keys.length)
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PREFERENCE',
      'preference.preferredImplementationKeys must not contain duplicates.',
      422
    );
  if (status === 'ACTIVE' && keys.length === 0)
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PREFERENCE',
      'ACTIVE preference requires at least one preferred implementation key.',
      422
    );
  if (status === 'CLEARED' && keys.length !== 0)
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PREFERENCE',
      'CLEARED preference cannot retain preferred implementation keys.',
      422
    );
  return keys;
}

function canonicalTimestamp(value: unknown): string {
  const cleaned = text(value, 'preference.createdAt', 80);
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== cleaned)
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PREFERENCE',
      'preference.createdAt must be a canonical ISO timestamp.',
      422
    );
  return cleaned;
}

export function normalizeWorkspaceImplementationPreferenceContextV1(
  value: Readonly<WorkspaceImplementationPreferenceContextV1>
): WorkspaceImplementationPreferenceContextV1 {
  return {
    workspaceId: text(value.workspaceId, 'context.workspaceId', 300),
    capabilityId: text(value.capabilityId, 'context.capabilityId', 300),
    capabilityVersion: text(value.capabilityVersion, 'context.capabilityVersion', 120)
  };
}

export function normalizeWorkspaceImplementationPreferenceV1(
  value: unknown
): WorkspaceImplementationPreferenceV1 {
  const preference = record(value, 'preference');
  exactKeys(
    preference,
    [
      'schemaVersion',
      'workspaceId',
      'capabilityId',
      'capabilityVersion',
      'version',
      'status',
      'preferredImplementationKeys',
      'authorityReference',
      'reason',
      'createdAt'
    ],
    'preference'
  );
  if (preference.schemaVersion !== 1)
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PREFERENCE',
      'preference.schemaVersion must be 1.',
      422
    );
  if (
    typeof preference.status !== 'string' ||
    !(workspaceImplementationPreferenceStatuses as readonly string[]).includes(preference.status)
  )
    throw new WorkspaceImplementationPreferenceError(
      'INVALID_PREFERENCE',
      'preference.status is invalid.',
      422
    );
  const status = preference.status as WorkspaceImplementationPreferenceStatus;
  return {
    schemaVersion: 1,
    workspaceId: text(preference.workspaceId, 'preference.workspaceId', 300),
    capabilityId: text(preference.capabilityId, 'preference.capabilityId', 300),
    capabilityVersion: text(preference.capabilityVersion, 'preference.capabilityVersion', 120),
    version: positiveVersion(preference.version),
    status,
    preferredImplementationKeys: implementationKeys(preference.preferredImplementationKeys, status),
    authorityReference: text(preference.authorityReference, 'preference.authorityReference', 500),
    reason: text(preference.reason, 'preference.reason', 1000),
    createdAt: canonicalTimestamp(preference.createdAt)
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  return value;
}

export function workspaceImplementationPreferenceFingerprintSha256V1(
  preference: Readonly<WorkspaceImplementationPreferenceV1>
): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(preference)))
    .digest('hex');
}

export function governedWorkspaceImplementationPreferenceV1(
  preference: Readonly<WorkspaceImplementationPreferenceV1>
): Readonly<GovernedWorkspaceImplementationPreferenceV1> | undefined {
  if (preference.status === 'CLEARED') return undefined;
  const fingerprint = workspaceImplementationPreferenceFingerprintSha256V1(preference);
  return {
    policyVersion: `workspace-implementation-preference.v1:${preference.version}:${fingerprint.slice(0, 32)}`,
    preferredImplementationKeys: [...preference.preferredImplementationKeys]
  };
}
