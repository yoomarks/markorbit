import type { ImplementationProfileId } from './capability-runtime.js';
import type {
  AudioArtifactId,
  AudioArtifactV1,
  ClipArtifactId,
  ClipArtifactV1,
  MediaRightsSnapshotRefV1,
  VideoArtifactId,
  VideoArtifactV1
} from './media.js';
import type { PublishPackage, PublishPackageId } from './product-loop.js';
import type {
  SocialChannelBindingId,
  SocialChannelBindingV1,
  SocialChannelVerificationObservationV1
} from './social-channel-binding.js';
import { assessSocialChannelBindingEligibilityV1 } from './social-channel-binding.js';

export type DistributionIntentId = `distribution-intent_${string}`;
export type DistributionTargetId = `distribution-target_${string}`;
export type PublishReceiptId = `publish-receipt_${string}`;

export type DistributionMediaArtifactId = AudioArtifactId | ClipArtifactId | VideoArtifactId;
export type DistributionMediaArtifactV1 = AudioArtifactV1 | ClipArtifactV1 | VideoArtifactV1;
export type DistributionSourceV1 =
  | Readonly<{
      kind: 'PUBLISH_PACKAGE';
      publishPackageId: PublishPackageId;
      version: number;
      fingerprintSha256: string;
    }>
  | Readonly<{
      kind: 'MEDIA_ARTIFACT';
      artifactType: 'AUDIO_ARTIFACT' | 'CLIP_ARTIFACT' | 'VIDEO_ARTIFACT';
      artifactId: DistributionMediaArtifactId;
      version: number;
      sha256: string;
      rightsSnapshot: Readonly<MediaRightsSnapshotRefV1>;
    }>;

export interface DistributionTargetReferenceV1 {
  id: DistributionTargetId;
  version: number;
}

export const distributionAdaptationPolicies = [
  'EXACT_AS_APPROVED',
  'BOUNDED_PLATFORM_TRANSFORM_REQUESTED'
] as const;
export type DistributionAdaptationPolicy = (typeof distributionAdaptationPolicies)[number];
export const noDistributionAuthorityConsequencesV1 = Object.freeze({
  credentialAuthorityGranted: false,
  providerSelectionAuthorityGranted: false,
  protectedActionAuthorized: false,
  executionAuthorized: false,
  executionStarted: false,
  publicationAuthorized: false,
  externalMessageAuthorized: false,
  officialTruthCreated: false,
  businessTruthCreated: false,
  trademarkTruthCreated: false
});
export type DistributionAuthorityConsequencesV1 = typeof noDistributionAuthorityConsequencesV1;

/** Social-owned request to distribute one exact existing owner-backed package or Media Artifact. */
export interface DistributionIntentV1 {
  schemaVersion: 1;
  distributionIntentId: DistributionIntentId;
  version: number;
  workspaceId: string;
  source: DistributionSourceV1;
  targets: readonly Readonly<DistributionTargetReferenceV1>[];
  adaptationPolicy: DistributionAdaptationPolicy;
  humanReviewRequired: true;
  createdAt: string;
  updatedAt: string;
  authority: Readonly<DistributionAuthorityConsequencesV1>;
}
export const distributionDeliveryTimings = ['IMMEDIATE', 'REQUESTED_TIME'] as const;
export type DistributionDeliveryTiming = (typeof distributionDeliveryTimings)[number];
export const distributionVisibilities = ['ACCOUNT_DEFAULT', 'PUBLIC'] as const;
export type DistributionVisibility = (typeof distributionVisibilities)[number];

export interface DistributionDestinationV1 {
  platformId: string;
  externalAccountId: string;
  externalChannelId?: string;
}

export interface DistributionDeliveryRequestV1 {
  timing: DistributionDeliveryTiming;
  requestedPublishAt?: string;
  visibility: DistributionVisibility;
}

/** One exact intended destination. This is not an account credential or an execution request. */
export interface DistributionTargetV1 {
  schemaVersion: 1;
  distributionTargetId: DistributionTargetId;
  version: number;
  workspaceId: string;
  intent: Readonly<{ id: DistributionIntentId; version: number }>;
  channelBinding: Readonly<{ id: SocialChannelBindingId; version: number }>;
  destination: Readonly<DistributionDestinationV1>;
  delivery: Readonly<DistributionDeliveryRequestV1>;
  createdAt: string;
  updatedAt: string;
  authority: Readonly<DistributionAuthorityConsequencesV1>;
}
export const publishReceiptPlatformStatuses = [
  'SUBMITTED',
  'ACCEPTED',
  'PUBLISHED',
  'FAILED',
  'UNKNOWN',
  'UNAVAILABLE'
] as const;
export type PublishReceiptPlatformStatus = (typeof publishReceiptPlatformStatuses)[number];

export const publishReceiptEvidenceKinds = [
  'ADAPTER_TRANSPORT',
  'PLATFORM_RECEIPT',
  'PLATFORM_RECONCILIATION'
] as const;
export type PublishReceiptEvidenceKind = (typeof publishReceiptEvidenceKinds)[number];

export interface PublishReceiptPlatformObservationV1 {
  status: PublishReceiptPlatformStatus;
  evidenceKind: PublishReceiptEvidenceKind;
  platformObjectId?: string;
  evidenceRefs: readonly string[];
  observedAt: string;
}

export interface PublishReceiptExecutionRefV1 {
  executionId: `execution_${string}`;
  correlationId: string;
}
export interface PublishReceiptImplementationRefV1 {
  implementationProfileId: ImplementationProfileId;
  version: number;
}

/** Durable Social evidence of what the platform was observed to report after governed execution. */
export interface PublishReceiptV1 {
  schemaVersion: 1;
  publishReceiptId: PublishReceiptId;
  version: number;
  workspaceId: string;
  intent: Readonly<{ id: DistributionIntentId; version: number }>;
  target: Readonly<{ id: DistributionTargetId; version: number }>;
  execution: Readonly<PublishReceiptExecutionRefV1>;
  implementation: Readonly<PublishReceiptImplementationRefV1>;
  submittedAt: string;
  acceptedAt?: string;
  observation: Readonly<PublishReceiptPlatformObservationV1>;
  createdAt: string;
  authority: Readonly<DistributionAuthorityConsequencesV1>;
}

export class SocialDistributionContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'SocialDistributionContractError';
  }
}

type JsonRecord = Record<string, unknown>;
const forbiddenKeys = new Set([
  'password',
  'secret',
  'apisecret',
  'clientsecret',
  'apikey',
  'accesstoken',
  'refreshtoken',
  'sessiontoken',
  'sessionid',
  'session',
  'cookie',
  'cookies',
  'credential',
  'credentials',
  'authorization',
  'bearer',
  'browserstorage',
  'localstorage',
  'raw',
  'rawresponse',
  'responsebody',
  'metadata',
  'extras',
  'provider',
  'model',
  'endpoint',
  'httpstatus',
  'providerhttpstatus'
]);
function normalizedKey(value: string): string {
  return value.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
}

function rejectForbiddenMaterial(value: unknown, field = 'socialDistribution'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectForbiddenMaterial(entry, `${field}[${index}]`));
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, nested] of Object.entries(value as JsonRecord)) {
    if (forbiddenKeys.has(normalizedKey(key)))
      throw new SocialDistributionContractError(`${field}.${key} is forbidden material.`);
    rejectForbiddenMaterial(nested, `${field}.${key}`);
  }
}

function object(value: unknown, field: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new SocialDistributionContractError(`${field} must be an object.`);
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unsupported.length)
    throw new SocialDistributionContractError(
      `${field} contains unsupported fields: ${unsupported.join(', ')}.`
    );
}
function text(value: unknown, field: string, maximum = 300): string {
  if (typeof value !== 'string')
    throw new SocialDistributionContractError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum)
    throw new SocialDistributionContractError(`${field} must contain 1 to ${maximum} characters.`);
  return cleaned;
}

function integer(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new SocialDistributionContractError(`${field} must be a positive safe integer.`);
  return value as number;
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field, 80);
  if (!Number.isFinite(Date.parse(result)))
    throw new SocialDistributionContractError(`${field} must be a timestamp.`);
  return result;
}

function sha256(value: unknown, field: string): string {
  const result = text(value, field, 64);
  if (!/^[a-f0-9]{64}$/u.test(result))
    throw new SocialDistributionContractError(`${field} must be lowercase SHA-256 hex.`);
  return result;
}

function assertOrder(
  earlier: string,
  later: string,
  earlierField: string,
  laterField: string
): void {
  if (Date.parse(earlier) > Date.parse(later))
    throw new SocialDistributionContractError(`${earlierField} cannot be after ${laterField}.`);
}
function prefixed<T extends string>(value: unknown, field: string, prefix: string): T {
  const result = text(value, field, 300);
  if (!result.startsWith(prefix)) throw new SocialDistributionContractError(`${field} is invalid.`);
  return result as T;
}

function parseRightsSnapshot(value: unknown): MediaRightsSnapshotRefV1 {
  const item = object(value, 'source.rightsSnapshot');
  exactKeys(
    item,
    [
      'snapshotId',
      'version',
      'fingerprintSha256',
      'capturedAt',
      'currentEligibilityRevalidationRequired'
    ],
    'source.rightsSnapshot'
  );
  if (item.currentEligibilityRevalidationRequired !== true)
    throw new SocialDistributionContractError(
      'source.rightsSnapshot must require current eligibility revalidation.'
    );
  return {
    snapshotId: text(item.snapshotId, 'source.rightsSnapshot.snapshotId'),
    version: integer(item.version, 'source.rightsSnapshot.version'),
    fingerprintSha256: sha256(item.fingerprintSha256, 'source.rightsSnapshot.fingerprintSha256'),
    capturedAt: timestamp(item.capturedAt, 'source.rightsSnapshot.capturedAt'),
    currentEligibilityRevalidationRequired: true
  };
}

function parseDistributionSource(value: unknown): DistributionSourceV1 {
  const item = object(value, 'source');
  if (item.kind === 'PUBLISH_PACKAGE') {
    exactKeys(item, ['kind', 'publishPackageId', 'version', 'fingerprintSha256'], 'source');
    return {
      kind: 'PUBLISH_PACKAGE',
      publishPackageId: prefixed<PublishPackageId>(
        item.publishPackageId,
        'source.publishPackageId',
        'publish-package_'
      ),
      version: integer(item.version, 'source.version'),
      fingerprintSha256: sha256(item.fingerprintSha256, 'source.fingerprintSha256')
    };
  }
  if (item.kind !== 'MEDIA_ARTIFACT')
    throw new SocialDistributionContractError('source.kind is invalid.');
  exactKeys(
    item,
    ['kind', 'artifactType', 'artifactId', 'version', 'sha256', 'rightsSnapshot'],
    'source'
  );
  if (!['AUDIO_ARTIFACT', 'CLIP_ARTIFACT', 'VIDEO_ARTIFACT'].includes(String(item.artifactType)))
    throw new SocialDistributionContractError('source.artifactType is invalid.');
  const artifactType = item.artifactType as 'AUDIO_ARTIFACT' | 'CLIP_ARTIFACT' | 'VIDEO_ARTIFACT';
  const prefix =
    artifactType === 'AUDIO_ARTIFACT'
      ? 'audio-artifact_'
      : artifactType === 'CLIP_ARTIFACT'
        ? 'clip-artifact_'
        : 'video-artifact_';
  return {
    kind: 'MEDIA_ARTIFACT',
    artifactType,
    artifactId: prefixed<DistributionMediaArtifactId>(item.artifactId, 'source.artifactId', prefix),
    version: integer(item.version, 'source.version'),
    sha256: sha256(item.sha256, 'source.sha256'),
    rightsSnapshot: parseRightsSnapshot(item.rightsSnapshot)
  };
}

function parseAuthority(value: unknown): DistributionAuthorityConsequencesV1 {
  const item = object(value, 'authority');
  exactKeys(item, Object.keys(noDistributionAuthorityConsequencesV1), 'authority');
  for (const key of Object.keys(noDistributionAuthorityConsequencesV1) as Array<
    keyof DistributionAuthorityConsequencesV1
  >) {
    if (item[key] !== false)
      throw new SocialDistributionContractError(`authority.${key} must be false.`);
  }
  return noDistributionAuthorityConsequencesV1;
}
function parseTargetReferences(value: unknown): readonly DistributionTargetReferenceV1[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new SocialDistributionContractError('targets must be a non-empty array.');
  const result = value.map((entry, index) => {
    const item = object(entry, `targets[${index}]`);
    exactKeys(item, ['id', 'version'], `targets[${index}]`);
    return {
      id: prefixed<DistributionTargetId>(item.id, `targets[${index}].id`, 'distribution-target_'),
      version: integer(item.version, `targets[${index}].version`)
    };
  });
  if (new Set(result.map((target) => `${target.id}:${target.version}`)).size !== result.length)
    throw new SocialDistributionContractError(
      'targets must not contain duplicate exact references.'
    );
  return result;
}

export function parseDistributionIntentV1(value: unknown): DistributionIntentV1 {
  rejectForbiddenMaterial(value);
  const item = object(value, 'distributionIntent');
  exactKeys(
    item,
    [
      'schemaVersion',
      'distributionIntentId',
      'version',
      'workspaceId',
      'source',
      'targets',
      'adaptationPolicy',
      'humanReviewRequired',
      'createdAt',
      'updatedAt',
      'authority'
    ],
    'distributionIntent'
  );
  if (item.schemaVersion !== 1)
    throw new SocialDistributionContractError('schemaVersion must be 1.');
  if (
    !distributionAdaptationPolicies.includes(item.adaptationPolicy as DistributionAdaptationPolicy)
  )
    throw new SocialDistributionContractError('adaptationPolicy is invalid.');
  if (item.humanReviewRequired !== true)
    throw new SocialDistributionContractError('humanReviewRequired must be true.');
  const createdAt = timestamp(item.createdAt, 'createdAt');
  const updatedAt = timestamp(item.updatedAt, 'updatedAt');
  assertOrder(createdAt, updatedAt, 'createdAt', 'updatedAt');
  return {
    schemaVersion: 1,
    distributionIntentId: prefixed<DistributionIntentId>(
      item.distributionIntentId,
      'distributionIntentId',
      'distribution-intent_'
    ),
    version: integer(item.version, 'version'),
    workspaceId: text(item.workspaceId, 'workspaceId', 240),
    source: parseDistributionSource(item.source),
    targets: parseTargetReferences(item.targets),
    adaptationPolicy: item.adaptationPolicy as DistributionAdaptationPolicy,
    humanReviewRequired: true,
    createdAt,
    updatedAt,
    authority: parseAuthority(item.authority)
  };
}

function parseDestination(value: unknown): DistributionDestinationV1 {
  const item = object(value, 'destination');
  exactKeys(item, ['platformId', 'externalAccountId', 'externalChannelId'], 'destination');
  const externalChannelId =
    item.externalChannelId === undefined
      ? undefined
      : text(item.externalChannelId, 'destination.externalChannelId');
  return {
    platformId: text(item.platformId, 'destination.platformId', 80),
    externalAccountId: text(item.externalAccountId, 'destination.externalAccountId'),
    ...(externalChannelId ? { externalChannelId } : {})
  };
}
function parseDelivery(value: unknown): DistributionDeliveryRequestV1 {
  const item = object(value, 'delivery');
  exactKeys(item, ['timing', 'requestedPublishAt', 'visibility'], 'delivery');
  if (!distributionDeliveryTimings.includes(item.timing as DistributionDeliveryTiming))
    throw new SocialDistributionContractError('delivery.timing is invalid.');
  if (!distributionVisibilities.includes(item.visibility as DistributionVisibility))
    throw new SocialDistributionContractError('delivery.visibility is invalid.');
  const requestedPublishAt =
    item.requestedPublishAt === undefined
      ? undefined
      : timestamp(item.requestedPublishAt, 'delivery.requestedPublishAt');
  if (item.timing === 'IMMEDIATE' && requestedPublishAt)
    throw new SocialDistributionContractError(
      'IMMEDIATE delivery cannot carry requestedPublishAt.'
    );
  if (item.timing === 'REQUESTED_TIME' && !requestedPublishAt)
    throw new SocialDistributionContractError(
      'REQUESTED_TIME delivery requires requestedPublishAt.'
    );
  return {
    timing: item.timing as DistributionDeliveryTiming,
    ...(requestedPublishAt ? { requestedPublishAt } : {}),
    visibility: item.visibility as DistributionVisibility
  };
}

function parseExactRef<T extends string>(
  value: unknown,
  field: string,
  prefix: string
): Readonly<{ id: T; version: number }> {
  const item = object(value, field);
  exactKeys(item, ['id', 'version'], field);
  return {
    id: prefixed<T>(item.id, `${field}.id`, prefix),
    version: integer(item.version, `${field}.version`)
  };
}
export function parseDistributionTargetV1(value: unknown): DistributionTargetV1 {
  rejectForbiddenMaterial(value);
  const item = object(value, 'distributionTarget');
  exactKeys(
    item,
    [
      'schemaVersion',
      'distributionTargetId',
      'version',
      'workspaceId',
      'intent',
      'channelBinding',
      'destination',
      'delivery',
      'createdAt',
      'updatedAt',
      'authority'
    ],
    'distributionTarget'
  );
  if (item.schemaVersion !== 1)
    throw new SocialDistributionContractError('schemaVersion must be 1.');
  const createdAt = timestamp(item.createdAt, 'createdAt');
  const updatedAt = timestamp(item.updatedAt, 'updatedAt');
  assertOrder(createdAt, updatedAt, 'createdAt', 'updatedAt');
  const delivery = parseDelivery(item.delivery);
  if (delivery.requestedPublishAt)
    assertOrder(createdAt, delivery.requestedPublishAt, 'createdAt', 'delivery.requestedPublishAt');
  return {
    schemaVersion: 1,
    distributionTargetId: prefixed<DistributionTargetId>(
      item.distributionTargetId,
      'distributionTargetId',
      'distribution-target_'
    ),
    version: integer(item.version, 'version'),
    workspaceId: text(item.workspaceId, 'workspaceId', 240),
    intent: parseExactRef<DistributionIntentId>(item.intent, 'intent', 'distribution-intent_'),
    channelBinding: parseExactRef<SocialChannelBindingId>(
      item.channelBinding,
      'channelBinding',
      'social-channel-binding_'
    ),
    destination: parseDestination(item.destination),
    delivery,
    createdAt,
    updatedAt,
    authority: parseAuthority(item.authority)
  };
}
function stringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new SocialDistributionContractError(`${field} must be a non-empty array.`);
  const result = value.map((entry, index) => text(entry, `${field}[${index}]`, 500));
  if (new Set(result).size !== result.length)
    throw new SocialDistributionContractError(`${field} must not contain duplicates.`);
  return result;
}

function parseExecutionRef(value: unknown): PublishReceiptExecutionRefV1 {
  const item = object(value, 'execution');
  exactKeys(item, ['executionId', 'correlationId'], 'execution');
  return {
    executionId: prefixed<`execution_${string}`>(
      item.executionId,
      'execution.executionId',
      'execution_'
    ),
    correlationId: text(item.correlationId, 'execution.correlationId', 300)
  };
}

function parseImplementationRef(value: unknown): PublishReceiptImplementationRefV1 {
  const item = object(value, 'implementation');
  exactKeys(item, ['implementationProfileId', 'version'], 'implementation');
  return {
    implementationProfileId: prefixed<ImplementationProfileId>(
      item.implementationProfileId,
      'implementation.implementationProfileId',
      'implementation-profile_'
    ),
    version: integer(item.version, 'implementation.version')
  };
}
function parsePlatformObservation(value: unknown): PublishReceiptPlatformObservationV1 {
  const item = object(value, 'observation');
  exactKeys(
    item,
    ['status', 'evidenceKind', 'platformObjectId', 'evidenceRefs', 'observedAt'],
    'observation'
  );
  if (!publishReceiptPlatformStatuses.includes(item.status as PublishReceiptPlatformStatus))
    throw new SocialDistributionContractError('observation.status is invalid.');
  if (!publishReceiptEvidenceKinds.includes(item.evidenceKind as PublishReceiptEvidenceKind))
    throw new SocialDistributionContractError('observation.evidenceKind is invalid.');
  const status = item.status as PublishReceiptPlatformStatus;
  const evidenceKind = item.evidenceKind as PublishReceiptEvidenceKind;
  const platformObjectId =
    item.platformObjectId === undefined
      ? undefined
      : text(item.platformObjectId, 'observation.platformObjectId', 500);
  if (status === 'PUBLISHED') {
    if (evidenceKind === 'ADAPTER_TRANSPORT')
      throw new SocialDistributionContractError(
        'Transport/provider success cannot prove PUBLISHED.'
      );
    if (!platformObjectId)
      throw new SocialDistributionContractError('PUBLISHED observation requires platformObjectId.');
  }
  return {
    status,
    evidenceKind,
    ...(platformObjectId ? { platformObjectId } : {}),
    evidenceRefs: stringList(item.evidenceRefs, 'observation.evidenceRefs'),
    observedAt: timestamp(item.observedAt, 'observation.observedAt')
  };
}
export function parsePublishReceiptV1(value: unknown): PublishReceiptV1 {
  rejectForbiddenMaterial(value);
  const item = object(value, 'publishReceipt');
  exactKeys(
    item,
    [
      'schemaVersion',
      'publishReceiptId',
      'version',
      'workspaceId',
      'intent',
      'target',
      'execution',
      'implementation',
      'submittedAt',
      'acceptedAt',
      'observation',
      'createdAt',
      'authority'
    ],
    'publishReceipt'
  );
  if (item.schemaVersion !== 1)
    throw new SocialDistributionContractError('schemaVersion must be 1.');
  const submittedAt = timestamp(item.submittedAt, 'submittedAt');
  const acceptedAt =
    item.acceptedAt === undefined ? undefined : timestamp(item.acceptedAt, 'acceptedAt');
  const observation = parsePlatformObservation(item.observation);
  const createdAt = timestamp(item.createdAt, 'createdAt');
  if ((observation.status === 'ACCEPTED' || observation.status === 'PUBLISHED') && !acceptedAt)
    throw new SocialDistributionContractError(`${observation.status} receipt requires acceptedAt.`);
  if (acceptedAt) {
    assertOrder(submittedAt, acceptedAt, 'submittedAt', 'acceptedAt');
    assertOrder(acceptedAt, observation.observedAt, 'acceptedAt', 'observation.observedAt');
  } else {
    assertOrder(submittedAt, observation.observedAt, 'submittedAt', 'observation.observedAt');
  }
  assertOrder(observation.observedAt, createdAt, 'observation.observedAt', 'createdAt');
  return {
    schemaVersion: 1,
    publishReceiptId: prefixed<PublishReceiptId>(
      item.publishReceiptId,
      'publishReceiptId',
      'publish-receipt_'
    ),
    version: integer(item.version, 'version'),
    workspaceId: text(item.workspaceId, 'workspaceId', 240),
    intent: parseExactRef<DistributionIntentId>(item.intent, 'intent', 'distribution-intent_'),
    target: parseExactRef<DistributionTargetId>(item.target, 'target', 'distribution-target_'),
    execution: parseExecutionRef(item.execution),
    implementation: parseImplementationRef(item.implementation),
    submittedAt,
    ...(acceptedAt ? { acceptedAt } : {}),
    observation,
    createdAt,
    authority: parseAuthority(item.authority)
  };
}
export type DistributionSourceAssessmentReasonV1 =
  | 'MATCH'
  | 'WORKSPACE_MISMATCH'
  | 'SOURCE_KIND_MISMATCH'
  | 'SOURCE_ID_MISMATCH'
  | 'SOURCE_VERSION_MISMATCH'
  | 'SOURCE_FINGERPRINT_MISMATCH'
  | 'RIGHTS_SNAPSHOT_MISMATCH';

export interface DistributionSourceAssessmentV1 {
  matches: boolean;
  reason: DistributionSourceAssessmentReasonV1;
  createsExecutionAuthority: false;
}

function mediaArtifactId(record: DistributionMediaArtifactV1): DistributionMediaArtifactId {
  if (record.objectType === 'AUDIO_ARTIFACT') return record.audioArtifactId;
  if (record.objectType === 'CLIP_ARTIFACT') return record.clipArtifactId;
  return record.videoArtifactId;
}

function sameRightsSnapshot(
  left: Readonly<MediaRightsSnapshotRefV1>,
  right: Readonly<MediaRightsSnapshotRefV1>
): boolean {
  return (
    left.snapshotId === right.snapshotId &&
    left.version === right.version &&
    left.fingerprintSha256 === right.fingerprintSha256
  );
}
export function assessDistributionIntentSourceV1(
  intent: Readonly<DistributionIntentV1>,
  sourceRecord: Readonly<PublishPackage | DistributionMediaArtifactV1>
): DistributionSourceAssessmentV1 {
  let reason: DistributionSourceAssessmentReasonV1 = 'MATCH';
  if (sourceRecord.workspaceId !== intent.workspaceId) reason = 'WORKSPACE_MISMATCH';
  else if (intent.source.kind === 'PUBLISH_PACKAGE') {
    if (!('publishPackageId' in sourceRecord)) reason = 'SOURCE_KIND_MISMATCH';
    else if (sourceRecord.publishPackageId !== intent.source.publishPackageId)
      reason = 'SOURCE_ID_MISMATCH';
    else if (sourceRecord.version !== intent.source.version) reason = 'SOURCE_VERSION_MISMATCH';
    else if (sourceRecord.publishPackageFingerprintSha256 !== intent.source.fingerprintSha256)
      reason = 'SOURCE_FINGERPRINT_MISMATCH';
  } else {
    if (!('objectType' in sourceRecord) || !sourceRecord.objectType.endsWith('_ARTIFACT'))
      reason = 'SOURCE_KIND_MISMATCH';
    else {
      const artifact = sourceRecord as DistributionMediaArtifactV1;
      if (artifact.objectType !== intent.source.artifactType) reason = 'SOURCE_KIND_MISMATCH';
      else if (mediaArtifactId(artifact) !== intent.source.artifactId)
        reason = 'SOURCE_ID_MISMATCH';
      else if (artifact.version !== intent.source.version) reason = 'SOURCE_VERSION_MISMATCH';
      else if (artifact.sha256 !== intent.source.sha256) reason = 'SOURCE_FINGERPRINT_MISMATCH';
      else if (!sameRightsSnapshot(artifact.rightsSnapshot, intent.source.rightsSnapshot))
        reason = 'RIGHTS_SNAPSHOT_MISMATCH';
    }
  }
  return { matches: reason === 'MATCH', reason, createsExecutionAuthority: false };
}
export type DistributionTargetEligibilityReasonV1 =
  | 'ELIGIBLE'
  | 'TARGET_WORKSPACE_MISMATCH'
  | 'INTENT_REFERENCE_MISMATCH'
  | 'TARGET_NOT_DECLARED'
  | 'BINDING_REFERENCE_MISMATCH'
  | 'DESTINATION_IDENTITY_MISMATCH'
  | 'CHANNEL_BINDING_WORKSPACE_MISMATCH'
  | 'CHANNEL_BINDING_STALE'
  | 'CHANNEL_BINDING_REVOKED'
  | 'CHANNEL_VERIFICATION_UNKNOWN'
  | 'CHANNEL_VERIFICATION_UNAVAILABLE';

export interface DistributionTargetEligibilityV1 {
  eligible: boolean;
  reason: DistributionTargetEligibilityReasonV1;
  target: Readonly<{ id: DistributionTargetId; version: number }>;
  channelBinding: Readonly<{ id: SocialChannelBindingId; version: number }>;
  assessedAt: string;
  createsExecutionAuthority: false;
}

function sameDestination(
  target: Readonly<DistributionDestinationV1>,
  binding: Readonly<SocialChannelBindingV1>
): boolean {
  return (
    target.platformId === binding.identity.platformId &&
    target.externalAccountId === binding.identity.externalAccountId &&
    (target.externalChannelId ?? undefined) === (binding.identity.externalChannelId ?? undefined)
  );
}
function channelReason(
  reason: ReturnType<typeof assessSocialChannelBindingEligibilityV1>['reason']
): DistributionTargetEligibilityReasonV1 {
  if (reason === 'WORKSPACE_MISMATCH') return 'CHANNEL_BINDING_WORKSPACE_MISMATCH';
  if (reason === 'BINDING_STALE') return 'CHANNEL_BINDING_STALE';
  if (reason === 'BINDING_REVOKED') return 'CHANNEL_BINDING_REVOKED';
  if (reason === 'VERIFICATION_UNKNOWN') return 'CHANNEL_VERIFICATION_UNKNOWN';
  if (reason === 'VERIFICATION_UNAVAILABLE') return 'CHANNEL_VERIFICATION_UNAVAILABLE';
  return 'ELIGIBLE';
}

export function assessDistributionTargetEligibilityV1(
  target: Readonly<DistributionTargetV1>,
  intent: Readonly<DistributionIntentV1>,
  binding: Readonly<SocialChannelBindingV1>,
  request: Readonly<{
    assessedAt: string;
    verification: Readonly<SocialChannelVerificationObservationV1>;
  }>
): DistributionTargetEligibilityV1 {
  const assessedAt = timestamp(request.assessedAt, 'assessedAt');
  let reason: DistributionTargetEligibilityReasonV1 = 'ELIGIBLE';
  if (target.workspaceId !== intent.workspaceId) reason = 'TARGET_WORKSPACE_MISMATCH';
  else if (
    target.intent.id !== intent.distributionIntentId ||
    target.intent.version !== intent.version
  )
    reason = 'INTENT_REFERENCE_MISMATCH';
  else if (
    !intent.targets.some(
      (ref) => ref.id === target.distributionTargetId && ref.version === target.version
    )
  )
    reason = 'TARGET_NOT_DECLARED';
  else if (
    target.channelBinding.id !== binding.socialChannelBindingId ||
    target.channelBinding.version !== binding.version
  )
    reason = 'BINDING_REFERENCE_MISMATCH';
  else if (!sameDestination(target.destination, binding)) reason = 'DESTINATION_IDENTITY_MISMATCH';
  else {
    const channel = assessSocialChannelBindingEligibilityV1(binding, {
      workspaceId: target.workspaceId,
      assessedAt,
      verification: request.verification
    });
    reason = channelReason(channel.reason);
  }
  return {
    eligible: reason === 'ELIGIBLE',
    reason,
    target: { id: target.distributionTargetId, version: target.version },
    channelBinding: { id: binding.socialChannelBindingId, version: binding.version },
    assessedAt,
    createsExecutionAuthority: false
  };
}

export type PublishReceiptAssessmentReasonV1 =
  | 'PUBLISHED_CONFIRMED'
  | 'WORKSPACE_MISMATCH'
  | 'INTENT_REFERENCE_MISMATCH'
  | 'TARGET_REFERENCE_MISMATCH'
  | 'EXECUTION_PROVENANCE_MISMATCH'
  | 'IMPLEMENTATION_PROVENANCE_MISMATCH'
  | 'PLATFORM_NOT_PUBLISHED'
  | 'PLATFORM_STATE_UNKNOWN'
  | 'PLATFORM_UNAVAILABLE';
export interface PublishReceiptAssessmentV1 {
  publicationConfirmed: boolean;
  reason: PublishReceiptAssessmentReasonV1;
  receipt: Readonly<{ id: PublishReceiptId; version: number }>;
  createsOfficialTruth: false;
  createsBusinessTruth: false;
  createsTrademarkTruth: false;
}

export function assessPublishReceiptV1(
  receipt: Readonly<PublishReceiptV1>,
  intent: Readonly<DistributionIntentV1>,
  target: Readonly<DistributionTargetV1>,
  expected: Readonly<{
    execution: Readonly<PublishReceiptExecutionRefV1>;
    implementation: Readonly<PublishReceiptImplementationRefV1>;
  }>
): PublishReceiptAssessmentV1 {
  let reason: PublishReceiptAssessmentReasonV1 = 'PUBLISHED_CONFIRMED';
  if (receipt.workspaceId !== intent.workspaceId || receipt.workspaceId !== target.workspaceId)
    reason = 'WORKSPACE_MISMATCH';
  else if (
    receipt.intent.id !== intent.distributionIntentId ||
    receipt.intent.version !== intent.version
  )
    reason = 'INTENT_REFERENCE_MISMATCH';
  else if (
    receipt.target.id !== target.distributionTargetId ||
    receipt.target.version !== target.version
  )
    reason = 'TARGET_REFERENCE_MISMATCH';
  else if (
    receipt.execution.executionId !== expected.execution.executionId ||
    receipt.execution.correlationId !== expected.execution.correlationId
  )
    reason = 'EXECUTION_PROVENANCE_MISMATCH';
  else if (
    receipt.implementation.implementationProfileId !==
      expected.implementation.implementationProfileId ||
    receipt.implementation.version !== expected.implementation.version
  )
    reason = 'IMPLEMENTATION_PROVENANCE_MISMATCH';
  else if (receipt.observation.status === 'UNKNOWN') reason = 'PLATFORM_STATE_UNKNOWN';
  else if (receipt.observation.status === 'UNAVAILABLE') reason = 'PLATFORM_UNAVAILABLE';
  else if (receipt.observation.status !== 'PUBLISHED') reason = 'PLATFORM_NOT_PUBLISHED';
  return {
    publicationConfirmed: reason === 'PUBLISHED_CONFIRMED',
    reason,
    receipt: { id: receipt.publishReceiptId, version: receipt.version },
    createsOfficialTruth: false,
    createsBusinessTruth: false,
    createsTrademarkTruth: false
  };
}
