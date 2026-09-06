import {
  parseBrainAssetVersion,
  type BrainAssetVersion,
  type BrainAssetVersionId
} from '@markorbit/contracts/brain';
import {
  brainMethodFingerprintV1,
  executableMethodPackageFingerprintV1
} from '@markorbit/contracts/brain-method-activation';
import {
  USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE,
  USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
  US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID,
  US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID,
  US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID,
  US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID,
  US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID,
  US_TRADEMARK_MARK_REPRESENTATION_REFERENCE_DEPENDENCY,
  activateUsTrademarkMarkRepresentationMethodPackageV1,
  compileUsTrademarkMarkRepresentationMethodPackageV1,
  type UsTrademarkMarkRepresentationReferenceStateV1
} from '@markorbit/contracts/brain-us-trademark-mark-representation-method';
import { noRecommendationSourceAuthorityConsequences } from '@markorbit/contracts/markreg-early-funnel';

import { BrainAssetRegistryError, type BrainAssetResolutionQuery } from './brain-asset-registry.js';

export const US_TRADEMARK_MARK_REPRESENTATION_BRAIN_ASSET_ID =
  'brain-asset_us-trademark-mark-representation-strategy' as const;
export const US_TRADEMARK_MARK_REPRESENTATION_BRAIN_DOMAIN = 'TRADEMARK' as const;
export const US_TRADEMARK_MARK_REPRESENTATION_BRAIN_CONCEPT =
  'trademark.mark-representation.strategy' as const;
export const US_TRADEMARK_MARK_REPRESENTATION_KNOWLEDGE_GOVERNANCE_REF =
  'github:yoomarks/markorbit-knowledge@7ba94f5e7d45bd451d6ac25d5b509a600da43b7f' as const;
export const US_TRADEMARK_MARK_REPRESENTATION_BRAIN_VERSION_IDS = Object.freeze([
  'brain-asset-version_us-trademark-mark-representation-strategy-draft-v1',
  'brain-asset-version_us-trademark-mark-representation-strategy-candidate-v1',
  'brain-asset-version_us-trademark-mark-representation-strategy-validated-v1',
  'brain-asset-version_us-trademark-mark-representation-strategy-active-v1'
] as const satisfies readonly BrainAssetVersionId[]);

export const US_TRADEMARK_MARK_REPRESENTATION_CURRENTNESS_MECHANISM =
  'CORE_BRAIN_ASSET_LATEST_ACTIVE_PLUS_EXACT_KNOWLEDGE_REFERENCE_IDENTITY_AND_CAPTURE_WINDOW' as const;
const US_TRADEMARK_MARK_REPRESENTATION_MAX_CAPTURE_AGE_MS = 31 * 86_400_000;

export interface UsTrademarkMarkRepresentationResolutionQueryV1 {
  operation: 'MARK_REPRESENTATION_STRATEGY';
  jurisdiction: 'US';
  authority: 'USPTO';
  asOf: string;
}

export type UsTrademarkMarkRepresentationMethodAuthorityErrorCode =
  | 'INVALID_INPUT'
  | 'NO_CURRENT_METHOD'
  | 'AMBIGUOUS_CURRENT_METHOD'
  | 'IDENTITY_MISMATCH'
  | 'PERSISTENCE_UNAVAILABLE';

export class UsTrademarkMarkRepresentationMethodAuthorityError extends Error {
  constructor(
    readonly code: UsTrademarkMarkRepresentationMethodAuthorityErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'UsTrademarkMarkRepresentationMethodAuthorityError';
  }
}
export interface BrainMethodLifecycleRegistryV1 {
  register(value: unknown): Readonly<BrainAssetVersion> | Promise<Readonly<BrainAssetVersion>>;
  getVersion(
    brainAssetVersionId: BrainAssetVersionId
  ): Readonly<BrainAssetVersion> | Promise<Readonly<BrainAssetVersion>>;
  listVersions(
    brainAssetId: BrainAssetVersion['brainAssetId']
  ): readonly Readonly<BrainAssetVersion>[] | Promise<readonly Readonly<BrainAssetVersion>[]>;
  resolveActive(
    query: BrainAssetResolutionQuery
  ): Readonly<BrainAssetVersion> | Promise<Readonly<BrainAssetVersion>>;
}

export interface CurrentUsTrademarkMarkRepresentationMethodV1 {
  schemaVersion: 1;
  currentness: 'CURRENT';
  currentnessMechanism: typeof US_TRADEMARK_MARK_REPRESENTATION_CURRENTNESS_MECHANISM;
  brainAssetId: typeof US_TRADEMARK_MARK_REPRESENTATION_BRAIN_ASSET_ID;
  brainAssetVersionId: BrainAssetVersionId;
  methodId: typeof US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID;
  methodVersionId: typeof US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID;
  methodFingerprintSha256: string;
  packageId: typeof US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID;
  packageVersion: 2;
  packageFingerprintSha256: string;
  activatedAt: string;
  activationDecisionId: `brain-method-activation_${string}`;
  activationEvidenceRef: string;
  inputSchemaId: typeof US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID;
  outputSchemaId: typeof US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID;
  referenceDependency: typeof US_TRADEMARK_MARK_REPRESENTATION_REFERENCE_DEPENDENCY;
  sourceReference: Readonly<UsTrademarkMarkRepresentationReferenceStateV1>;
  knowledgeGovernanceRef: typeof US_TRADEMARK_MARK_REPRESENTATION_KNOWLEDGE_GOVERNANCE_REF;
  currentnessCheckedAt: string;
  authorityConsequences: typeof noRecommendationSourceAuthorityConsequences;
}
function canonicalBundle() {
  const compiled = compileUsTrademarkMarkRepresentationMethodPackageV1({
    knowledgeSources: USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE,
    reference: {
      ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
      currentness: 'CURRENT'
    }
  });
  if (compiled.status !== 'READY') {
    throw new UsTrademarkMarkRepresentationMethodAuthorityError(
      'IDENTITY_MISMATCH',
      `Canonical Method package failed to compile: ${compiled.reason}.`
    );
  }
  const activation = activateUsTrademarkMarkRepresentationMethodPackageV1(compiled.package);
  return { compiled, activation };
}

function storedCurrentIdentity() {
  const { compiled, activation } = canonicalBundle();
  return Object.freeze({
    schemaVersion: 1 as const,
    kind: 'GOVERNED_US_TRADEMARK_MARK_REPRESENTATION_METHOD' as const,
    currentness: 'CURRENT' as const,
    currentnessMechanism: US_TRADEMARK_MARK_REPRESENTATION_CURRENTNESS_MECHANISM,
    methodId: US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID,
    methodVersionId: US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID,
    methodFingerprintSha256: brainMethodFingerprintV1(compiled.method),
    packageId: US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID,
    packageVersion: 2 as const,
    packageFingerprintSha256: executableMethodPackageFingerprintV1(activation.activePackage),
    activatedAt: activation.decision.approval.approvedAt,
    activationDecisionId: activation.decision.decisionId,
    activationEvidenceRef: activation.activationEvidenceRef,
    inputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID,
    outputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID,
    referenceDependency: US_TRADEMARK_MARK_REPRESENTATION_REFERENCE_DEPENDENCY,
    sourceReference: Object.freeze({
      ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
      currentness: 'CURRENT' as const
    }),
    knowledgeGovernanceRef: US_TRADEMARK_MARK_REPRESENTATION_KNOWLEDGE_GOVERNANCE_REF,
    confidenceSemantics:
      'BrainAsset confidence describes exact source/governance integrity only; it is not legal, registrability, filing, or Recommendation confidence.',
    authorityConsequences: noRecommendationSourceAuthorityConsequences
  });
}
const BRAIN_ASSET_STATUSES = ['DRAFT', 'CANDIDATE', 'VALIDATED', 'ACTIVE'] as const;
const BRAIN_ASSET_CREATED_AT = [
  '2026-09-06T19:00:00.000Z',
  '2026-09-06T19:02:00.000Z',
  '2026-09-06T19:04:00.000Z',
  '2026-09-06T19:05:00.000Z'
] as const;

function evidenceRefs() {
  return USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE.map((source) => ({
    sourceOwner: 'KNOWLEDGE' as const,
    sourceObjectId: source.chunkId,
    sourceVersion: `${source.content.objectId}:artifact-v${USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE.artifactVersion}:${source.indexedAt}`,
    sourceFingerprintSha256: source.contentSha256,
    observedAt: source.indexedAt
  }));
}

function governanceConfidence() {
  return {
    score: 1,
    band: 'VERY_HIGH' as const,
    factors: {
      authority: 1,
      freshness: 1,
      agreement: 1,
      coverage: 1,
      validation: 1,
      methodQuality: 1
    }
  };
}

function preActivePayload(status: 'DRAFT' | 'CANDIDATE' | 'VALIDATED') {
  const current = storedCurrentIdentity();
  return {
    schemaVersion: 1,
    kind: current.kind,
    currentness: 'NOT_CURRENT',
    lifecycleMaterializationStatus: status,
    methodId: current.methodId,
    methodVersionId: current.methodVersionId,
    packageId: current.packageId,
    validatedPackageVersion: 1,
    inputSchemaId: current.inputSchemaId,
    outputSchemaId: current.outputSchemaId,
    referenceDependency: current.referenceDependency,
    sourceReference: current.sourceReference,
    knowledgeGovernanceRef: current.knowledgeGovernanceRef,
    confidenceSemantics: current.confidenceSemantics,
    authorityConsequences: current.authorityConsequences
  } as const;
}
export function buildUsTrademarkMarkRepresentationBrainAssetLifecycleV1(): readonly Readonly<BrainAssetVersion>[] {
  const current = storedCurrentIdentity();
  return BRAIN_ASSET_STATUSES.map((status, index) =>
    parseBrainAssetVersion({
      schemaVersion: 1,
      brainAssetId: US_TRADEMARK_MARK_REPRESENTATION_BRAIN_ASSET_ID,
      brainAssetVersionId: US_TRADEMARK_MARK_REPRESENTATION_BRAIN_VERSION_IDS[index],
      version: index + 1,
      assetType: 'REASONING_METHOD',
      status,
      scope: {
        domain: US_TRADEMARK_MARK_REPRESENTATION_BRAIN_DOMAIN,
        jurisdiction: 'US',
        concept: US_TRADEMARK_MARK_REPRESENTATION_BRAIN_CONCEPT,
        inputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID,
        outputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID,
        effectiveFrom:
          status === 'ACTIVE'
            ? current.activatedAt
            : USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE.indexedAt
      },
      evidenceRefs: evidenceRefs(),
      derivedFromBrainAssetVersionIds:
        index === 0 ? [] : [US_TRADEMARK_MARK_REPRESENTATION_BRAIN_VERSION_IDS[index - 1]],
      confidence: governanceConfidence(),
      payload:
        status === 'ACTIVE'
          ? { ...current, lifecycleMaterializationStatus: 'ACTIVE' as const }
          : preActivePayload(status),
      createdAt: BRAIN_ASSET_CREATED_AT[index],
      ...(status === 'VALIDATED' || status === 'ACTIVE'
        ? { validatedAt: '2026-09-06T19:04:00.000Z' }
        : {})
    })
  );
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

function exactJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}
function translateRegistryError(error: unknown): never {
  if (!(error instanceof BrainAssetRegistryError)) throw error;
  if (error.code === 'PERSISTENCE_UNAVAILABLE') {
    throw new UsTrademarkMarkRepresentationMethodAuthorityError(
      'PERSISTENCE_UNAVAILABLE',
      'Brain Method registry persistence is unavailable.'
    );
  }
  if (error.code === 'NO_ACTIVE_ASSET') {
    throw new UsTrademarkMarkRepresentationMethodAuthorityError(
      'NO_CURRENT_METHOD',
      'No CURRENT US trademark mark-representation Method is active.'
    );
  }
  if (error.code === 'AMBIGUOUS_ACTIVE_ASSET') {
    throw new UsTrademarkMarkRepresentationMethodAuthorityError(
      'AMBIGUOUS_CURRENT_METHOD',
      'Multiple ACTIVE US trademark mark-representation Methods were resolved.'
    );
  }
  throw new UsTrademarkMarkRepresentationMethodAuthorityError(
    'IDENTITY_MISMATCH',
    error.message,
    error.details
  );
}

async function existingVersion(
  registry: BrainMethodLifecycleRegistryV1,
  versionId: BrainAssetVersionId
): Promise<Readonly<BrainAssetVersion> | undefined> {
  try {
    return await registry.getVersion(versionId);
  } catch (error) {
    if (error instanceof BrainAssetRegistryError && error.code === 'VERSION_NOT_FOUND') {
      return undefined;
    }
    return translateRegistryError(error);
  }
}
export async function materializeUsTrademarkMarkRepresentationBrainAssetLifecycleV1(
  registry: BrainMethodLifecycleRegistryV1
): Promise<readonly Readonly<BrainAssetVersion>[]> {
  const expected = buildUsTrademarkMarkRepresentationBrainAssetLifecycleV1();
  const materialized: BrainAssetVersion[] = [];
  for (const version of expected) {
    const existing = await existingVersion(registry, version.brainAssetVersionId);
    if (existing) {
      if (!exactJson(existing, version)) {
        throw new UsTrademarkMarkRepresentationMethodAuthorityError(
          'IDENTITY_MISMATCH',
          'Existing Brain Method lifecycle version does not match the governed #903 identity.',
          { brainAssetVersionId: version.brainAssetVersionId }
        );
      }
      materialized.push(structuredClone(existing));
      continue;
    }
    try {
      materialized.push(structuredClone(await registry.register(version)));
    } catch (error) {
      return translateRegistryError(error);
    }
  }
  return materialized;
}

function validateQuery(query: Readonly<UsTrademarkMarkRepresentationResolutionQueryV1>): void {
  if (
    query.operation !== 'MARK_REPRESENTATION_STRATEGY' ||
    query.jurisdiction !== 'US' ||
    query.authority !== 'USPTO' ||
    typeof query.asOf !== 'string' ||
    !query.asOf.trim() ||
    query.asOf !== query.asOf.trim() ||
    Number.isNaN(Date.parse(query.asOf))
  ) {
    throw new UsTrademarkMarkRepresentationMethodAuthorityError(
      'INVALID_INPUT',
      'Only the exact US/USPTO mark-representation current Method query is supported.'
    );
  }
}
export class UsTrademarkMarkRepresentationMethodAuthorityV1 {
  constructor(private readonly registry: BrainMethodLifecycleRegistryV1) {}

  async resolveCurrent(
    query: Readonly<UsTrademarkMarkRepresentationResolutionQueryV1>
  ): Promise<Readonly<CurrentUsTrademarkMarkRepresentationMethodV1>> {
    validateQuery(query);
    if (
      Date.parse(query.asOf) -
        Date.parse(USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE.capturedAt) >
      US_TRADEMARK_MARK_REPRESENTATION_MAX_CAPTURE_AGE_MS
    ) {
      throw new UsTrademarkMarkRepresentationMethodAuthorityError(
        'NO_CURRENT_METHOD',
        'The governed USPTO reference capture is stale and must be refreshed before Method resolution.'
      );
    }
    let active: Readonly<BrainAssetVersion>;
    try {
      active = await this.registry.resolveActive({
        domain: US_TRADEMARK_MARK_REPRESENTATION_BRAIN_DOMAIN,
        concept: US_TRADEMARK_MARK_REPRESENTATION_BRAIN_CONCEPT,
        jurisdiction: 'US',
        asOf: query.asOf
      });
    } catch (error) {
      return translateRegistryError(error);
    }

    let versions: readonly Readonly<BrainAssetVersion>[];
    try {
      versions = await this.registry.listVersions(US_TRADEMARK_MARK_REPRESENTATION_BRAIN_ASSET_ID);
    } catch (error) {
      return translateRegistryError(error);
    }
    const latest = versions.at(-1);
    if (
      !latest ||
      latest.brainAssetVersionId !== active.brainAssetVersionId ||
      latest.status !== 'ACTIVE'
    ) {
      throw new UsTrademarkMarkRepresentationMethodAuthorityError(
        'NO_CURRENT_METHOD',
        'The latest governed Brain Method lifecycle version is not ACTIVE.',
        {
          resolvedBrainAssetVersionId: active.brainAssetVersionId,
          latestBrainAssetVersionId: latest?.brainAssetVersionId,
          latestStatus: latest?.status
        }
      );
    }

    const expectedActive = buildUsTrademarkMarkRepresentationBrainAssetLifecycleV1().at(-1)!;
    if (!exactJson(active, expectedActive)) {
      throw new UsTrademarkMarkRepresentationMethodAuthorityError(
        'IDENTITY_MISMATCH',
        'ACTIVE Brain Method identity does not match the governed #903 Method/package/reference bundle.',
        { brainAssetVersionId: active.brainAssetVersionId }
      );
    }
    const stored = storedCurrentIdentity();
    return {
      schemaVersion: 1,
      currentness: 'CURRENT',
      currentnessMechanism: US_TRADEMARK_MARK_REPRESENTATION_CURRENTNESS_MECHANISM,
      brainAssetId: US_TRADEMARK_MARK_REPRESENTATION_BRAIN_ASSET_ID,
      brainAssetVersionId: active.brainAssetVersionId,
      methodId: stored.methodId,
      methodVersionId: stored.methodVersionId,
      methodFingerprintSha256: stored.methodFingerprintSha256,
      packageId: stored.packageId,
      packageVersion: stored.packageVersion,
      packageFingerprintSha256: stored.packageFingerprintSha256,
      activatedAt: stored.activatedAt,
      activationDecisionId: stored.activationDecisionId,
      activationEvidenceRef: stored.activationEvidenceRef,
      inputSchemaId: stored.inputSchemaId,
      outputSchemaId: stored.outputSchemaId,
      referenceDependency: stored.referenceDependency,
      sourceReference: structuredClone(stored.sourceReference),
      knowledgeGovernanceRef: stored.knowledgeGovernanceRef,
      currentnessCheckedAt: query.asOf,
      authorityConsequences: noRecommendationSourceAuthorityConsequences
    };
  }
}
