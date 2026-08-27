import { createHash } from 'node:crypto';
import {
  parseExecutableMethodPackageV1,
  type ExecutableMethodPackageV1,
  type KnowledgeRetrievalLineageRefV1
} from '@markorbit/contracts/brain-method';

export const OFFICIAL_FEE_PILOT_OPERATION =
  'USPTO_TM_NEW_APPLICATION_BASE_FEE_SECTION_1_44_ELECTRONIC_PER_CLASS' as const;

export type OfficialFeeReferenceId = `official-fee-ref_${string}`;
export type OfficialFeeReferenceStatus = 'CURRENT' | 'STALE';

export interface OfficialFeeReferenceV1 {
  schemaVersion: 1;
  referenceId: OfficialFeeReferenceId;
  operation: typeof OFFICIAL_FEE_PILOT_OPERATION;
  jurisdiction: 'US';
  authority: 'USPTO';
  currency: string;
  amountMinor: number;
  unit: 'PER_CLASS';
  effectiveFrom: string;
  effectiveTo?: string;
  status: OfficialFeeReferenceStatus;
  packageId: ExecutableMethodPackageV1['packageId'];
  methodId: ExecutableMethodPackageV1['methodId'];
  methodVersionId: ExecutableMethodPackageV1['methodVersionId'];
  knowledgeSources: readonly Readonly<KnowledgeRetrievalLineageRefV1>[];
  sourceIdentityFingerprintSha256: string;
  materializationFingerprintSha256: string;
  materializedAt: string;
}

export interface OfficialFeeMaterializationInputV1 {
  package: unknown;
  currency: string;
  amountMinor: number;
  unit: 'PER_CLASS';
  effectiveFrom: string;
  effectiveTo?: string;
  materializedAt: string;
}

export interface OfficialFeeResolutionQueryV1 {
  operation: typeof OFFICIAL_FEE_PILOT_OPERATION;
  jurisdiction: 'US';
  authority: 'USPTO';
  asOf: string;
}

export type OfficialFeeReferenceStoreErrorCode =
  | 'INVALID_INPUT'
  | 'PACKAGE_NOT_ACTIVE'
  | 'PACKAGE_OUT_OF_SCOPE'
  | 'MISSING_KNOWLEDGE_LINEAGE'
  | 'CONFLICT'
  | 'NO_CURRENT_REFERENCE'
  | 'AMBIGUOUS_CURRENT_REFERENCE'
  | 'PERSISTENCE_UNAVAILABLE';

export class OfficialFeeReferenceStoreError extends Error {
  constructor(
    readonly code: OfficialFeeReferenceStoreErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'OfficialFeeReferenceStoreError';
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function instant(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned || Number.isNaN(Date.parse(cleaned)))
    throw new OfficialFeeReferenceStoreError('INVALID_INPUT', `${field} must be an ISO date/time.`);
  return cleaned;
}

function currency(value: string): string {
  const cleaned = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/u.test(cleaned))
    throw new OfficialFeeReferenceStoreError('INVALID_INPUT', 'currency must be a 3-letter code.');
  return cleaned;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function digest(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function packageInPilotScope(pkg: ExecutableMethodPackageV1): boolean {
  const a = pkg.applicability;
  return (
    a.jurisdictions.includes('US') &&
    a.authorities.includes('USPTO') &&
    a.operations.includes(OFFICIAL_FEE_PILOT_OPERATION) &&
    a.filingBases.includes('SECTION_1') &&
    a.filingBases.includes('SECTION_44')
  );
}

function normalizedKnowledgeSources(
  pkg: ExecutableMethodPackageV1
): readonly Readonly<KnowledgeRetrievalLineageRefV1>[] {
  if (!pkg.lineage.knowledgeSources.length)
    throw new OfficialFeeReferenceStoreError(
      'MISSING_KNOWLEDGE_LINEAGE',
      'Official fee materialization requires exact Knowledge retrieval lineage.'
    );
  return [...pkg.lineage.knowledgeSources]
    .map((source) => clone(source))
    .sort((left, right) => {
      const a = `${left.content.objectId}:${left.chunkId}:${left.contentSha256}`;
      const b = `${right.content.objectId}:${right.chunkId}:${right.contentSha256}`;
      return a.localeCompare(b);
    });
}

export interface PreparedOfficialFeeMaterialization {
  reference: OfficialFeeReferenceV1;
  replayIdentityFingerprintSha256: string;
}

export function prepareOfficialFeeMaterialization(
  input: Readonly<OfficialFeeMaterializationInputV1>
): PreparedOfficialFeeMaterialization {
  const pkg = parseExecutableMethodPackageV1(input.package);
  if (pkg.lifecycle !== 'ACTIVE')
    throw new OfficialFeeReferenceStoreError(
      'PACKAGE_NOT_ACTIVE',
      'Official fee materialization requires an ACTIVE executable method package.',
      { packageId: pkg.packageId, lifecycle: pkg.lifecycle }
    );
  if (!packageInPilotScope(pkg))
    throw new OfficialFeeReferenceStoreError(
      'PACKAGE_OUT_OF_SCOPE',
      'Executable method package is outside the frozen official-fee pilot scope.',
      { packageId: pkg.packageId }
    );
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1)
    throw new OfficialFeeReferenceStoreError(
      'INVALID_INPUT',
      'amountMinor must be a positive safe integer.'
    );
  if (input.unit !== 'PER_CLASS')
    throw new OfficialFeeReferenceStoreError('INVALID_INPUT', 'unit must be PER_CLASS.');

  const effectiveFrom = instant(input.effectiveFrom, 'effectiveFrom');
  const effectiveTo = input.effectiveTo ? instant(input.effectiveTo, 'effectiveTo') : undefined;
  if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(effectiveFrom))
    throw new OfficialFeeReferenceStoreError(
      'INVALID_INPUT',
      'effectiveTo must be later than effectiveFrom.'
    );
  const materializedAt = instant(input.materializedAt, 'materializedAt');
  const knowledgeSources = normalizedKnowledgeSources(pkg);
  const sourceIdentityFingerprintSha256 = digest({
    packageId: pkg.packageId,
    methodId: pkg.methodId,
    methodVersionId: pkg.methodVersionId,
    knowledgeSources
  });
  const replayIdentityFingerprintSha256 = digest({
    operation: OFFICIAL_FEE_PILOT_OPERATION,
    jurisdiction: 'US',
    authority: 'USPTO',
    sourceIdentityFingerprintSha256,
    effectiveFrom,
    effectiveTo: effectiveTo ?? null
  });
  const normalizedCurrency = currency(input.currency);
  const materializationFingerprintSha256 = digest({
    replayIdentityFingerprintSha256,
    currency: normalizedCurrency,
    amountMinor: input.amountMinor,
    unit: input.unit
  });
  const referenceId: OfficialFeeReferenceId =
    `official-fee-ref_${materializationFingerprintSha256}`;

  return {
    replayIdentityFingerprintSha256,
    reference: {
      schemaVersion: 1,
      referenceId,
      operation: OFFICIAL_FEE_PILOT_OPERATION,
      jurisdiction: 'US',
      authority: 'USPTO',
      currency: normalizedCurrency,
      amountMinor: input.amountMinor,
      unit: 'PER_CLASS',
      effectiveFrom,
      ...(effectiveTo ? { effectiveTo } : {}),
      status: 'CURRENT',
      packageId: pkg.packageId,
      methodId: pkg.methodId,
      methodVersionId: pkg.methodVersionId,
      knowledgeSources,
      sourceIdentityFingerprintSha256,
      materializationFingerprintSha256,
      materializedAt
    }
  };
}

function effectiveAt(reference: OfficialFeeReferenceV1, asOf: number): boolean {
  return (
    Date.parse(reference.effectiveFrom) <= asOf &&
    (!reference.effectiveTo || asOf < Date.parse(reference.effectiveTo))
  );
}

export class InMemoryOfficialFeeReferenceStore {
  private readonly byReferenceId = new Map<OfficialFeeReferenceId, OfficialFeeReferenceV1>();
  private readonly referenceIdByReplayIdentity = new Map<string, OfficialFeeReferenceId>();

  materialize(
    input: Readonly<OfficialFeeMaterializationInputV1>
  ): Readonly<OfficialFeeReferenceV1> {
    const prepared = prepareOfficialFeeMaterialization(input);
    const existingId = this.referenceIdByReplayIdentity.get(
      prepared.replayIdentityFingerprintSha256
    );
    if (existingId) {
      const existing = this.byReferenceId.get(existingId)!;
      if (
        existing.materializationFingerprintSha256 !==
        prepared.reference.materializationFingerprintSha256
      )
        throw new OfficialFeeReferenceStoreError(
          'CONFLICT',
          'The same source/method replay identity produced a different fee payload.',
          { referenceId: existing.referenceId }
        );
      return clone(existing);
    }

    for (const [id, current] of this.byReferenceId) {
      if (current.status === 'CURRENT') this.byReferenceId.set(id, { ...current, status: 'STALE' });
    }
    this.byReferenceId.set(prepared.reference.referenceId, clone(prepared.reference));
    this.referenceIdByReplayIdentity.set(
      prepared.replayIdentityFingerprintSha256,
      prepared.reference.referenceId
    );
    return clone(prepared.reference);
  }

  get(referenceId: OfficialFeeReferenceId): Readonly<OfficialFeeReferenceV1> | undefined {
    const value = this.byReferenceId.get(referenceId);
    return value ? clone(value) : undefined;
  }

  resolveCurrent(query: Readonly<OfficialFeeResolutionQueryV1>): Readonly<OfficialFeeReferenceV1> {
    if (
      query.operation !== OFFICIAL_FEE_PILOT_OPERATION ||
      query.jurisdiction !== 'US' ||
      query.authority !== 'USPTO'
    )
      throw new OfficialFeeReferenceStoreError(
        'NO_CURRENT_REFERENCE',
        'Resolution query is outside the frozen official-fee pilot scope.'
      );
    const asOf = Date.parse(query.asOf);
    if (Number.isNaN(asOf))
      throw new OfficialFeeReferenceStoreError('INVALID_INPUT', 'asOf must be an ISO date/time.');
    const current = [...this.byReferenceId.values()].filter(
      (reference) => reference.status === 'CURRENT' && effectiveAt(reference, asOf)
    );
    if (!current.length)
      throw new OfficialFeeReferenceStoreError(
        'NO_CURRENT_REFERENCE',
        'No CURRENT official fee reference is effective for the requested time.'
      );
    if (current.length > 1)
      throw new OfficialFeeReferenceStoreError(
        'AMBIGUOUS_CURRENT_REFERENCE',
        'Multiple CURRENT official fee references are effective for the requested time.'
      );
    return clone(current[0]!);
  }
}
