import { createHash } from 'node:crypto';

export type SeedWorkspacePackageIdV1 = `seed-workspace-package_${string}`;

export const seedTargetKindsV1 = ['AGENCY', 'TRADEMARK_INVESTOR', 'OTHER'] as const;
export type SeedTargetKindV1 = (typeof seedTargetKindsV1)[number];

export const seedReferenceOwnersV1 = ['DATA_ENGINE', 'BRAIN', 'LITE'] as const;
export type SeedReferenceOwnerV1 = (typeof seedReferenceOwnersV1)[number];

export interface SeedExactReferenceV1 {
  owner: SeedReferenceOwnerV1;
  kind: string;
  id: string;
  version: string | number;
  fingerprintSha256: string;
  observedAt: string;
}

export interface SeedCollectionReferenceV1 extends SeedExactReferenceV1 {
  count: number;
}

export const noSeedWorkspacePackageAuthorityConsequencesV1 = Object.freeze({
  accountCreated: false,
  workspaceActivated: false,
  organizationAuthorityEstablished: false,
  customerRelationshipEstablished: false,
  managedAssetEstablished: false,
  opportunityQualified: false,
  marketingConsentInferred: false,
  externalInvitationSent: false,
  externalActionAuthorized: false
});

export interface SeedWorkspacePackageV1 {
  schemaVersion: 1;
  seedWorkspacePackageId: SeedWorkspacePackageIdV1;
  version: 1;
  stage: 'PREPARED';
  preparedByWorkspaceId: string;
  target: Readonly<{
    kind: SeedTargetKindV1;
    displayName: string;
    sourceRefs: readonly Readonly<SeedExactReferenceV1>[];
  }>;
  collections: Readonly<{
    representedApplicants?: Readonly<SeedCollectionReferenceV1>;
    relatedTrademarks?: Readonly<SeedCollectionReferenceV1>;
    opportunityCandidates?: Readonly<SeedCollectionReferenceV1>;
    businessArchetypeCandidates?: Readonly<SeedCollectionReferenceV1>;
  }>;
  preparedAt: string;
  expiresAt: string;
  packageFingerprintSha256: string;
  authorityConsequences: typeof noSeedWorkspacePackageAuthorityConsequencesV1;
}

export class SeedWorkspacePackageValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'SeedWorkspacePackageValidationError';
  }
}

type JsonObject = Record<string, unknown>;
const SHA256 = /^[0-9a-f]{64}$/u;
const PACKAGE_ID = /^seed-workspace-package_[A-Za-z0-9_-]+$/u;

function object(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new SeedWorkspacePackageValidationError(`${field} must be an object.`);
  return value as JsonObject;
}

function exact(value: JsonObject, fields: readonly string[], field: string): void {
  if (Object.keys(value).sort().join(',') !== [...fields].sort().join(','))
    throw new SeedWorkspacePackageValidationError(`${field} must contain exactly the V1 fields.`);
}

function text(value: unknown, field: string, maximum = 300): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new SeedWorkspacePackageValidationError(`${field} is invalid.`);
  return value.trim();
}

function at(value: unknown, field: string): string {
  const result = text(value, field, 80);
  if (!Number.isFinite(Date.parse(result)))
    throw new SeedWorkspacePackageValidationError(`${field} must be an ISO timestamp.`);
  return new Date(result).toISOString();
}

function sha(value: unknown, field: string): string {
  const result = text(value, field, 64);
  if (!SHA256.test(result))
    throw new SeedWorkspacePackageValidationError(`${field} must be lowercase SHA-256.`);
  return result;
}

function positiveOrZero(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new SeedWorkspacePackageValidationError(`${field} must be a non-negative safe integer.`);
  return Number(value);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)])
    );
  return value;
}

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

function reference(value: unknown, field: string): SeedExactReferenceV1 {
  const input = object(value, field);
  exact(input, ['owner', 'kind', 'id', 'version', 'fingerprintSha256', 'observedAt'], field);
  if (
    typeof input.owner !== 'string' ||
    !seedReferenceOwnersV1.includes(input.owner as SeedReferenceOwnerV1)
  )
    throw new SeedWorkspacePackageValidationError(`${field}.owner is invalid.`);
  const version = input.version;
  if (!(
    (Number.isSafeInteger(version) && Number(version) >= 1) ||
    (typeof version === 'string' && version.trim())
  ))
    throw new SeedWorkspacePackageValidationError(`${field}.version is invalid.`);
  return {
    owner: input.owner as SeedReferenceOwnerV1,
    kind: text(input.kind, `${field}.kind`, 160),
    id: text(input.id, `${field}.id`, 300),
    version: typeof version === 'string' ? version.trim() : Number(version),
    fingerprintSha256: sha(input.fingerprintSha256, `${field}.fingerprintSha256`),
    observedAt: at(input.observedAt, `${field}.observedAt`)
  };
}

function collection(value: unknown, field: string): SeedCollectionReferenceV1 {
  const input = object(value, field);
  exact(
    input,
    ['owner', 'kind', 'id', 'version', 'fingerprintSha256', 'observedAt', 'count'],
    field
  );
  const base = reference(
    {
      owner: input.owner,
      kind: input.kind,
      id: input.id,
      version: input.version,
      fingerprintSha256: input.fingerprintSha256,
      observedAt: input.observedAt
    },
    field
  );
  return { ...base, count: positiveOrZero(input.count, `${field}.count`) };
}

function authority(value: unknown): typeof noSeedWorkspacePackageAuthorityConsequencesV1 {
  const input = object(value, 'authorityConsequences');
  exact(input, Object.keys(noSeedWorkspacePackageAuthorityConsequencesV1), 'authorityConsequences');
  if (Object.values(input).some((item) => item !== false))
    throw new SeedWorkspacePackageValidationError(
      'Seed package cannot establish business or execution authority.'
    );
  return noSeedWorkspacePackageAuthorityConsequencesV1;
}

export function seedWorkspacePackageFingerprintSha256V1(
  value: Omit<SeedWorkspacePackageV1, 'packageFingerprintSha256'>
): string {
  return fingerprint(value);
}

export function parseSeedWorkspacePackageV1(value: unknown): SeedWorkspacePackageV1 {
  const input = object(value, 'seedWorkspacePackage');
  exact(
    input,
    [
      'schemaVersion',
      'seedWorkspacePackageId',
      'version',
      'stage',
      'preparedByWorkspaceId',
      'target',
      'collections',
      'preparedAt',
      'expiresAt',
      'packageFingerprintSha256',
      'authorityConsequences'
    ],
    'seedWorkspacePackage'
  );
  const id = text(input.seedWorkspacePackageId, 'seedWorkspacePackageId');
  if (
    input.schemaVersion !== 1 ||
    input.version !== 1 ||
    input.stage !== 'PREPARED' ||
    !PACKAGE_ID.test(id)
  )
    throw new SeedWorkspacePackageValidationError(
      'Seed package identity or immutable stage is invalid.'
    );

  const targetInput = object(input.target, 'target');
  exact(targetInput, ['kind', 'displayName', 'sourceRefs'], 'target');
  if (
    typeof targetInput.kind !== 'string' ||
    !seedTargetKindsV1.includes(targetInput.kind as SeedTargetKindV1)
  )
    throw new SeedWorkspacePackageValidationError('target.kind is invalid.');
  if (!Array.isArray(targetInput.sourceRefs) || targetInput.sourceRefs.length === 0)
    throw new SeedWorkspacePackageValidationError('target.sourceRefs must be non-empty.');
  if (targetInput.sourceRefs.length > 20)
    throw new SeedWorkspacePackageValidationError('target.sourceRefs exceeds the V1 bound.');

  const collectionsInput = object(input.collections, 'collections');
  const collectionKeys = [
    'representedApplicants',
    'relatedTrademarks',
    'opportunityCandidates',
    'businessArchetypeCandidates'
  ] as const;
  if (Object.keys(collectionsInput).some((key) => !collectionKeys.includes(key as never)))
    throw new SeedWorkspacePackageValidationError('collections contains unsupported fields.');
  const collections = Object.fromEntries(
    collectionKeys
      .filter((key) => collectionsInput[key] !== undefined)
      .map((key) => [key, collection(collectionsInput[key], `collections.${key}`)])
  ) as SeedWorkspacePackageV1['collections'];

  const preparedAt = at(input.preparedAt, 'preparedAt');
  const expiresAt = at(input.expiresAt, 'expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(preparedAt))
    throw new SeedWorkspacePackageValidationError('expiresAt must be after preparedAt.');

  const parsed: Omit<SeedWorkspacePackageV1, 'packageFingerprintSha256'> = {
    schemaVersion: 1,
    seedWorkspacePackageId: id as SeedWorkspacePackageIdV1,
    version: 1,
    stage: 'PREPARED',
    preparedByWorkspaceId: text(input.preparedByWorkspaceId, 'preparedByWorkspaceId', 120),
    target: {
      kind: targetInput.kind as SeedTargetKindV1,
      displayName: text(targetInput.displayName, 'target.displayName', 300),
      sourceRefs: targetInput.sourceRefs.map((item, index) =>
        reference(item, `target.sourceRefs[${index}]`)
      )
    },
    collections,
    preparedAt,
    expiresAt,
    authorityConsequences: authority(input.authorityConsequences)
  };
  const expected = seedWorkspacePackageFingerprintSha256V1(parsed);
  if (sha(input.packageFingerprintSha256, 'packageFingerprintSha256') !== expected)
    throw new SeedWorkspacePackageValidationError('Seed package fingerprint mismatch.');
  return { ...parsed, packageFingerprintSha256: expected };
}
