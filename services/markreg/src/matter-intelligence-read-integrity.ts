import { createHash } from 'node:crypto';
import {
  CN_DURATION_BAND_ACCEPTED_DATASET_REF,
  cnCompletedDurationHistoricalBands
} from '@markorbit/contracts/brain-cn-duration-band-classification';
import {
  MatterIntelligenceReadError,
  type MatterIntelligenceReadProjection
} from './matter-intelligence-read.js';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function persisted(message: string): never {
  throw new MatterIntelligenceReadError('PERSISTENCE_UNAVAILABLE', message, 503, true);
}

function observationFingerprint(
  observation: MatterIntelligenceReadProjection['items'][number]['observation']
): string {
  return fingerprint({
    schemaVersion: 1,
    matterIntelligenceObservationId: observation.matterIntelligenceObservationId,
    workspaceId: observation.workspaceId,
    formalMatterId: observation.formalMatter.id,
    formalMatterVersion: observation.formalMatter.version,
    formalMatterSnapshotSha256: observation.formalMatter.snapshotSha256,
    observationKind: observation.observationKind,
    observedCompletedDurationDays: observation.observedCompletedDurationDays,
    historicalBand: observation.historicalBand,
    datasetRefId: observation.datasetRefId,
    capabilityId: observation.capability.id,
    capabilityVersion: observation.capability.version,
    inputSchemaId: observation.capability.inputSchemaId,
    outputSchemaId: observation.capability.outputSchemaId,
    capabilityRequestId: observation.capabilityRequestId,
    capabilityInvocationId: observation.capabilityInvocationId,
    capabilityOutcomeId: observation.capabilityOutcomeId,
    capabilityReturnId: observation.capabilityReturnId,
    sessionReceiptId: observation.sessionReceiptId,
    implementationProfileId: observation.implementation.id,
    implementationVersion: observation.implementation.version,
    implementationKey: observation.implementation.implementationKey,
    correlationId: observation.correlationId,
    capabilityCorrelationId: observation.capabilityCorrelationId,
    methodPackageRef: observation.methodPackageRef,
    methodRef: observation.methodRef,
    methodVersionRef: observation.methodVersionRef,
    evaluationRef: observation.evaluationRef,
    researchDatasetRef: observation.researchDatasetRef,
    evidenceRefs: observation.evidenceRefs,
    evidenceFingerprintSha256: observation.evidenceFingerprintSha256,
    inputFingerprintSha256: observation.inputFingerprintSha256,
    outputFingerprintSha256: observation.outputFingerprintSha256,
    recordedByPrincipalId: observation.recordedByPrincipalId,
    recordedAt: observation.recordedAt
  });
}

type Observation = MatterIntelligenceReadProjection['items'][number]['observation'];
type Review = MatterIntelligenceReadProjection['items'][number]['reviewHistory'][number];

function assertObservationProvenance(observation: Observation): void {
  const evidenceFingerprint = fingerprint(observation.evidenceRefs);
  if (observation.evidenceFingerprintSha256 !== evidenceFingerprint)
    persisted('Persisted Matter Intelligence evidence fingerprint is inconsistent.');

  const boundRefs = [
    observation.methodPackageRef,
    observation.methodRef,
    observation.methodVersionRef,
    observation.evaluationRef,
    observation.researchDatasetRef
  ];
  for (const ref of boundRefs) {
    const matches = observation.evidenceRefs.filter((candidate) => candidate === ref).length;
    if (matches !== 1)
      persisted('Persisted Matter Intelligence provenance is not exactly bound to evidenceRefs.');
  }
  const acceptedDatasetPrefix = `research-dataset:${CN_DURATION_BAND_ACCEPTED_DATASET_REF}:`;
  if (!observation.researchDatasetRef.startsWith(acceptedDatasetPrefix))
    persisted('Persisted Matter Intelligence research dataset provenance is incompatible.');
}

function reviewPayloadFingerprint(review: Review): string {
  return fingerprint({
    schemaVersion: 1,
    workspaceId: review.workspaceId,
    formalMatterId: review.formalMatterId,
    matterIntelligenceObservationId: review.matterIntelligenceObservationId,
    outcome: review.outcome,
    reason: review.reason,
    rationale: review.rationale,
    reviewedByPrincipalId: review.reviewedByPrincipalId
  });
}

function reviewFingerprint(review: Review): string {
  return fingerprint({
    schemaVersion: 1,
    sourceAuthority: 'MARKREG',
    matterIntelligenceReviewId: review.matterIntelligenceReviewId,
    workspaceId: review.workspaceId,
    formalMatterId: review.formalMatterId,
    matterIntelligenceObservationId: review.matterIntelligenceObservationId,
    observationFingerprintSha256: review.observationFingerprintSha256,
    reviewVersion: review.reviewVersion,
    outcome: review.outcome,
    reason: review.reason,
    rationale: review.rationale,
    reviewedByPrincipalId: review.reviewedByPrincipalId,
    reviewedAt: review.reviewedAt,
    supersedes: review.supersedes,
    correlationId: review.correlationId
  });
}

function productSourceFingerprint(review: Review): string {
  return fingerprint({
    schemaVersion: 1,
    sourceAuthority: 'MARKREG',
    workspaceId: review.workspaceId,
    formalMatterId: review.formalMatterId,
    matterIntelligenceObservationId: review.matterIntelligenceObservationId,
    observationFingerprintSha256: review.observationFingerprintSha256,
    matterIntelligenceReviewId: review.matterIntelligenceReviewId,
    reviewVersion: review.reviewVersion,
    reviewFingerprintSha256: review.reviewFingerprintSha256
  });
}

export function assertMatterIntelligenceReadIntegrity(
  projection: Readonly<MatterIntelligenceReadProjection>,
  expectedWorkspaceId: string
): void {
  if (projection.items.length > projection.pageSize)
    persisted('Persisted Matter Intelligence page exceeds its declared bound.');
  if (projection.items.length > projection.total)
    persisted('Persisted Matter Intelligence page exceeds the total observation count.');

  for (const item of projection.items) {
    const observation = item.observation;
    if (observation.workspaceId !== expectedWorkspaceId)
      persisted('Persisted Matter Intelligence observation escaped the requested Workspace.');
    if (observation.formalMatter.id !== projection.formalMatter.id)
      persisted('Persisted Matter Intelligence observation belongs to another Formal Matter.');
    if (!cnCompletedDurationHistoricalBands.includes(observation.historicalBand))
      persisted('Persisted Matter Intelligence historical band is outside the accepted contract.');
    assertObservationProvenance(observation);

    const sourceCurrent =
      observation.formalMatter.version === projection.formalMatter.version &&
      observation.formalMatter.snapshotSha256 === projection.formalMatter.snapshotSha256;
    if (item.matterSourceCurrent !== sourceCurrent)
      persisted('Persisted Matter Intelligence source-current projection is inconsistent.');

    if (item.reviewHistory.length > projection.reviewHistoryLimit)
      persisted('Persisted Matter Intelligence review history exceeds its declared bound.');
    if (item.reviewHistory.length > item.reviewHistoryTotal)
      persisted('Persisted Matter Intelligence review history exceeds its total count.');
    const historyComplete = item.reviewHistory.length === item.reviewHistoryTotal;
    if (item.reviewHistoryComplete !== historyComplete)
      persisted('Persisted Matter Intelligence review completeness is inconsistent.');
    const reviewState = item.reviewHistoryTotal === 0 ? 'UNREVIEWED' : 'REVIEWED';
    if (item.reviewState !== reviewState)
      persisted('Persisted Matter Intelligence review state is inconsistent.');

    const expectedObservationFingerprint = observationFingerprint(observation);
    for (const review of item.reviewHistory) {
      const identityMatches =
        review.workspaceId === expectedWorkspaceId &&
        review.formalMatterId === projection.formalMatter.id &&
        review.matterIntelligenceObservationId === observation.matterIntelligenceObservationId;
      if (!identityMatches)
        persisted('Persisted Matter Intelligence review identity does not match its observation.');
      if (review.observationFingerprintSha256 !== expectedObservationFingerprint)
        persisted(
          'Persisted Matter Intelligence review is not bound to the exact observation fingerprint.'
        );
      if (review.reviewPayloadFingerprintSha256 !== reviewPayloadFingerprint(review))
        persisted('Persisted Matter Intelligence review payload fingerprint is inconsistent.');
      if (review.reviewFingerprintSha256 !== reviewFingerprint(review))
        persisted('Persisted Matter Intelligence review fingerprint is inconsistent.');
      if (review.productSourceFingerprintSha256 !== productSourceFingerprint(review))
        persisted('Persisted Matter Intelligence product-source fingerprint is inconsistent.');
    }

    const expectedCurrent = item.reviewHistory[0] ?? null;
    if (expectedCurrent === null) {
      if (item.currentReview !== null)
        persisted('Persisted Matter Intelligence current review exists without review history.');
      continue;
    }
    const currentMatches =
      item.currentReview?.matterIntelligenceReviewId ===
        expectedCurrent.matterIntelligenceReviewId &&
      item.currentReview.reviewVersion === expectedCurrent.reviewVersion &&
      item.currentReview.reviewFingerprintSha256 === expectedCurrent.reviewFingerprintSha256;
    if (!currentMatches)
      persisted(
        'Persisted Matter Intelligence current review does not match the latest review history item.'
      );
  }
}
