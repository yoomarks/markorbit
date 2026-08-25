import { createHash } from 'node:crypto';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import {
  capabilityImplementationKinds,
  capabilityRiskClasses,
  type CapabilityImplementationKind,
  type CapabilityRequestV2,
  type CapabilityRiskClass,
  type ImplementationProfile
} from '@markorbit/contracts/capability-runtime';
import type {
  GovernedImplementationSelection,
  ImplementationProfileSelector
} from './capability-runtime.js';

const PROFILE_ID = /^implementation-profile_[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const RISK_RANK: Readonly<Record<CapabilityRiskClass, number>> = Object.freeze({
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  PROTECTED: 3
});

export type ImplementationProfileRegistryErrorCode =
  | 'INVALID_PROFILE'
  | 'PROFILE_VERSION_CONFLICT'
  | 'PROFILE_LINEAGE_CONFLICT'
  | 'IMPLEMENTATION_KEY_CONFLICT'
  | 'AMBIGUOUS_IMPLEMENTATION_SELECTION';

export class ImplementationProfileRegistryError extends Error {
  constructor(
    readonly code: ImplementationProfileRegistryErrorCode,
    message: string,
    readonly status = 409
  ) {
    super(message);
    this.name = 'ImplementationProfileRegistryError';
  }
}

export interface GovernedImplementationSelectionPolicyV1 {
  policyVersion: string;
  admittedImplementationKinds: readonly CapabilityImplementationKind[];
  preferredImplementationKeys?: readonly string[];
}

export interface ImplementationProfileRegistryV1 {
  register(value: unknown): Readonly<ImplementationProfile>;
  findCurrent(implementationProfileId: string): Readonly<ImplementationProfile> | undefined;
  listCurrent(capabilityId?: string): readonly Readonly<ImplementationProfile>[];
}

type ProfileRecord = Readonly<{
  profile: Readonly<ImplementationProfile>;
  fingerprintSha256: string;
}>;

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      `${field} must be an object.`,
      422
    );
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string
): void {
  const accepted = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !accepted.has(key));
  if (unsupported.length > 0) {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`,
      422
    );
  }
}

function text(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string') {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      `${field} must be a string.`,
      422
    );
  }
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum) {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      `${field} must contain 1 to ${maximum} characters.`,
      422
    );
  }
  return cleaned;
}

function positiveInteger(value: unknown, field: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > maximum) {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      `${field} must be a positive safe integer not exceeding ${maximum}.`,
      422
    );
  }
  return Number(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function fingerprint(profile: Readonly<ImplementationProfile>): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(profile)))
    .digest('hex');
}

function normalizedStringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      `${field} must be a non-empty array.`,
      422
    );
  }
  const items: readonly unknown[] = value;
  const entries = items.map((item, index) => text(item, `${field}[${index}]`, 120));
  if (new Set(entries).size !== entries.length) {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      `${field} must not contain duplicates.`,
      422
    );
  }
  if (entries.includes('*') && entries.length !== 1) {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      `${field} cannot combine wildcard admission with named products.`,
      422
    );
  }
  return entries;
}

function normalizedImplementationKinds(value: unknown): readonly CapabilityImplementationKind[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      'selectionPolicy.admittedImplementationKinds must be non-empty.',
      422
    );
  }
  const items: readonly unknown[] = value;
  const kinds: CapabilityImplementationKind[] = [];
  for (const item of items) {
    if (
      typeof item !== 'string' ||
      !(capabilityImplementationKinds as readonly string[]).includes(item)
    ) {
      throw new ImplementationProfileRegistryError(
        'INVALID_PROFILE',
        'selectionPolicy.admittedImplementationKinds contains an invalid kind.',
        422
      );
    }
    kinds.push(item as CapabilityImplementationKind);
  }
  return kinds;
}

function canonicalTimestamp(value: unknown, field: string): string {
  const cleaned = text(value, field, 80);
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== cleaned) {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      `${field} must be a canonical ISO timestamp.`,
      422
    );
  }
  return cleaned;
}

export function normalizeImplementationProfileV1(value: unknown): ImplementationProfile {
  const profile = record(value, 'implementationProfile');
  exactKeys(
    profile,
    [
      'schemaVersion',
      'implementationProfileId',
      'version',
      'capabilityId',
      'capabilityVersion',
      'kind',
      'status',
      'implementationKey',
      'inputSchemaId',
      'outputSchemaId',
      'allowedCallerProducts',
      'maximumRiskClass',
      'timeoutMs',
      'maxAttempts',
      'approvalPolicyVersion',
      'createdAt'
    ],
    'implementationProfile'
  );
  if (profile.schemaVersion !== 1) {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      'implementationProfile.schemaVersion must be 1.',
      422
    );
  }
  const implementationProfileId = text(
    profile.implementationProfileId,
    'implementationProfile.implementationProfileId',
    300
  );
  if (!PROFILE_ID.test(implementationProfileId)) {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      'implementationProfile.implementationProfileId is invalid.',
      422
    );
  }
  if (
    typeof profile.kind !== 'string' ||
    !(capabilityImplementationKinds as readonly string[]).includes(profile.kind)
  ) {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      'implementationProfile.kind is invalid.',
      422
    );
  }
  if (profile.status !== 'APPROVED' && profile.status !== 'RETIRED') {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      'implementationProfile.status is invalid.',
      422
    );
  }
  if (
    typeof profile.maximumRiskClass !== 'string' ||
    !(capabilityRiskClasses as readonly string[]).includes(profile.maximumRiskClass)
  ) {
    throw new ImplementationProfileRegistryError(
      'INVALID_PROFILE',
      'implementationProfile.maximumRiskClass is invalid.',
      422
    );
  }
  return {
    schemaVersion: 1,
    implementationProfileId:
      implementationProfileId as ImplementationProfile['implementationProfileId'],
    version: positiveInteger(profile.version, 'implementationProfile.version', 1_000_000),
    capabilityId: text(profile.capabilityId, 'implementationProfile.capabilityId', 300),
    capabilityVersion: text(
      profile.capabilityVersion,
      'implementationProfile.capabilityVersion',
      120
    ),
    kind: profile.kind as CapabilityImplementationKind,
    status: profile.status,
    implementationKey: text(
      profile.implementationKey,
      'implementationProfile.implementationKey',
      500
    ),
    inputSchemaId: text(profile.inputSchemaId, 'implementationProfile.inputSchemaId', 300),
    outputSchemaId: text(profile.outputSchemaId, 'implementationProfile.outputSchemaId', 300),
    allowedCallerProducts: normalizedStringList(
      profile.allowedCallerProducts,
      'implementationProfile.allowedCallerProducts'
    ),
    maximumRiskClass: profile.maximumRiskClass as CapabilityRiskClass,
    timeoutMs: positiveInteger(profile.timeoutMs, 'implementationProfile.timeoutMs', 3_600_000),
    maxAttempts: positiveInteger(profile.maxAttempts, 'implementationProfile.maxAttempts', 100),
    approvalPolicyVersion: text(
      profile.approvalPolicyVersion,
      'implementationProfile.approvalPolicyVersion',
      300
    ),
    createdAt: canonicalTimestamp(profile.createdAt, 'implementationProfile.createdAt')
  };
}

function sameLineage(
  left: Readonly<ImplementationProfile>,
  right: Readonly<ImplementationProfile>
): boolean {
  return (
    left.implementationProfileId === right.implementationProfileId &&
    left.capabilityId === right.capabilityId &&
    left.capabilityVersion === right.capabilityVersion &&
    left.kind === right.kind &&
    left.implementationKey === right.implementationKey &&
    left.inputSchemaId === right.inputSchemaId &&
    left.outputSchemaId === right.outputSchemaId
  );
}

export class InMemoryImplementationProfileRegistryV1 implements ImplementationProfileRegistryV1 {
  private readonly versions = new Map<string, Map<number, ProfileRecord>>();
  private readonly implementationKeys = new Map<string, string>();

  constructor(seed: readonly unknown[] = []) {
    for (const profile of seed) this.register(profile);
  }

  register(value: unknown): Readonly<ImplementationProfile> {
    const profile = normalizeImplementationProfileV1(value);
    const profileFingerprint = fingerprint(profile);
    const versions =
      this.versions.get(profile.implementationProfileId) ?? new Map<number, ProfileRecord>();
    const existing = versions.get(profile.version);
    if (existing) {
      if (existing.fingerprintSha256 !== profileFingerprint) {
        throw new ImplementationProfileRegistryError(
          'PROFILE_VERSION_CONFLICT',
          'Implementation Profile version is immutable and conflicts with the registered document.'
        );
      }
      return structuredClone(existing.profile);
    }

    const current = [...versions.values()]
      .map((item) => item.profile)
      .sort((left, right) => right.version - left.version)[0];
    if (current && !sameLineage(current, profile)) {
      throw new ImplementationProfileRegistryError(
        'PROFILE_LINEAGE_CONFLICT',
        'Implementation Profile versions cannot change capability, implementation key, kind, or schema lineage.'
      );
    }
    if (current && profile.version <= current.version) {
      throw new ImplementationProfileRegistryError(
        'PROFILE_VERSION_CONFLICT',
        'A new Implementation Profile version must advance the current immutable version line.'
      );
    }

    const keyOwner = this.implementationKeys.get(profile.implementationKey);
    if (keyOwner && keyOwner !== profile.implementationProfileId) {
      throw new ImplementationProfileRegistryError(
        'IMPLEMENTATION_KEY_CONFLICT',
        'An implementation key can belong to only one Implementation Profile lineage.'
      );
    }

    versions.set(profile.version, {
      profile: structuredClone(profile),
      fingerprintSha256: profileFingerprint
    });
    this.versions.set(profile.implementationProfileId, versions);
    this.implementationKeys.set(profile.implementationKey, profile.implementationProfileId);
    return structuredClone(profile);
  }

  findCurrent(implementationProfileId: string): Readonly<ImplementationProfile> | undefined {
    const versions = this.versions.get(implementationProfileId);
    if (!versions) return undefined;
    const current = [...versions.values()]
      .map((item) => item.profile)
      .sort((left, right) => right.version - left.version)[0];
    return current ? structuredClone(current) : undefined;
  }

  listCurrent(capabilityId?: string): readonly Readonly<ImplementationProfile>[] {
    return [...this.versions.keys()]
      .map((profileId) => this.findCurrent(profileId))
      .filter((profile): profile is Readonly<ImplementationProfile> => profile !== undefined)
      .filter((profile) => capabilityId === undefined || profile.capabilityId === capabilityId)
      .sort((left, right) =>
        left.implementationProfileId.localeCompare(right.implementationProfileId)
      );
  }
}

function callerAllowed(
  profile: Readonly<ImplementationProfile>,
  request: Readonly<CapabilityRequestV2>
): boolean {
  return (
    profile.allowedCallerProducts.includes('*') ||
    profile.allowedCallerProducts.includes(request.caller.callerProduct)
  );
}

function profileEligible(
  profile: Readonly<ImplementationProfile>,
  request: Readonly<CapabilityRequestV2>,
  definition: Readonly<RuntimeCapabilityDefinition>,
  admittedKinds: ReadonlySet<CapabilityImplementationKind>
): boolean {
  return (
    profile.status === 'APPROVED' &&
    admittedKinds.has(profile.kind) &&
    profile.capabilityId === definition.capabilityId &&
    profile.capabilityVersion === definition.capabilityVersion &&
    request.capabilityId === definition.capabilityId &&
    request.capabilityVersion === definition.capabilityVersion &&
    profile.inputSchemaId === request.inputSchemaId &&
    profile.outputSchemaId === request.outputSchemaId &&
    callerAllowed(profile, request) &&
    RISK_RANK[request.riskClass] <= RISK_RANK[profile.maximumRiskClass]
  );
}

export class GovernedImplementationProfileSelectorV1 implements ImplementationProfileSelector {
  private readonly admittedKinds: ReadonlySet<CapabilityImplementationKind>;
  private readonly preferredImplementationKeys: readonly string[];
  private readonly policyVersion: string;

  constructor(
    private readonly registry: Readonly<ImplementationProfileRegistryV1>,
    policy: Readonly<GovernedImplementationSelectionPolicyV1>
  ) {
    this.policyVersion = text(policy.policyVersion, 'selectionPolicy.policyVersion', 300);
    this.admittedKinds = new Set(normalizedImplementationKinds(policy.admittedImplementationKinds));
    this.preferredImplementationKeys = [...(policy.preferredImplementationKeys ?? [])];
    if (
      new Set(this.preferredImplementationKeys).size !== this.preferredImplementationKeys.length
    ) {
      throw new ImplementationProfileRegistryError(
        'INVALID_PROFILE',
        'selectionPolicy.preferredImplementationKeys must not contain duplicates.',
        422
      );
    }
  }

  select(
    request: Readonly<CapabilityRequestV2>,
    definition: Readonly<RuntimeCapabilityDefinition>
  ): Promise<GovernedImplementationSelection | undefined> {
    const eligible = this.registry
      .listCurrent(definition.capabilityId)
      .filter((profile) => profileEligible(profile, request, definition, this.admittedKinds));
    if (eligible.length === 0) return Promise.resolve(undefined);

    if (this.preferredImplementationKeys.length > 0) {
      for (const implementationKey of this.preferredImplementationKeys) {
        const selected = eligible.find(
          (profile) => profile.implementationKey === implementationKey
        );
        if (selected) {
          return Promise.resolve({
            profile: structuredClone(selected),
            policyVersion: this.policyVersion
          });
        }
      }
      return Promise.resolve(undefined);
    }

    if (eligible.length !== 1) {
      return Promise.reject(
        new ImplementationProfileRegistryError(
          'AMBIGUOUS_IMPLEMENTATION_SELECTION',
          'Multiple approved Implementation Profiles are eligible; trusted server policy must choose an implementation key.'
        )
      );
    }
    const selected = eligible[0];
    if (!selected) return Promise.resolve(undefined);
    return Promise.resolve({
      profile: structuredClone(selected),
      policyVersion: this.policyVersion
    });
  }
}
