import { createHash } from 'node:crypto';
import {
  trademarkServiceIntentKinds,
  trademarkServiceRequirementKinds,
  trademarkServiceRequirementStatuses,
  type TrademarkServiceIntentKind,
  type TrademarkServiceMissingInput,
  type TrademarkServiceRequirementCandidate,
  type TrademarkServiceRequirementKind,
  type TrademarkServiceRequirementStatus,
  type TrademarkServiceWorkPackageId
} from '@markorbit/contracts/trademark-service-workbench';
import type {
  TrademarkAssetFreshnessState,
  TrademarkAssetSourceReference
} from '@markorbit/contracts/trademark-asset-workspace';

export interface TrademarkServiceRequirementObservation {
  jurisdiction: string;
  serviceIntentKind: TrademarkServiceIntentKind;
  kind: TrademarkServiceRequirementKind;
  status: TrademarkServiceRequirementStatus;
  title: string;
  explanation: string;
  sourceReferences: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>;
}

export interface ComposeTrademarkServiceRequirementsCommand {
  workspaceId: string;
  workPackageId: TrademarkServiceWorkPackageId;
  jurisdiction: string;
  serviceIntentKind: TrademarkServiceIntentKind;
  observations: ReadonlyArray<Readonly<TrademarkServiceRequirementObservation>>;
  generatedAt: string;
}

export interface TrademarkServiceRequirementCompositionResult {
  workspaceId: string;
  workPackageId: TrademarkServiceWorkPackageId;
  jurisdiction: string;
  serviceIntentKind: TrademarkServiceIntentKind;
  requirementCandidates: ReadonlyArray<Readonly<TrademarkServiceRequirementCandidate>>;
  missingInputs: ReadonlyArray<Readonly<TrademarkServiceMissingInput>>;
  sourceBackedObservationCount: number;
  discardedObservationCount: number;
  generatedAt: string;
  certifiedLegalRequirementsCreated: false;
  legalDeadlineCertified: false;
  officialTruthVerifiedByLite: false;
}

const freshnessRank: Record<TrademarkAssetFreshnessState, number> = {
  CURRENT: 0,
  UNKNOWN: 1,
  STALE: 2,
  CONFLICTING: 3
};

const statusRank: Record<TrademarkServiceRequirementStatus, number> = {
  NOT_APPLICABLE: 0,
  PRESENT: 1,
  CANDIDATE: 2,
  UNKNOWN: 3,
  MISSING: 4,
  REVIEW_REQUIRED: 5
};

function clean(value: string): string {
  return value.trim();
}

function stableRequirementId(input: {
  workspaceId: string;
  workPackageId: TrademarkServiceWorkPackageId;
  jurisdiction: string;
  serviceIntentKind: TrademarkServiceIntentKind;
  kind: TrademarkServiceRequirementKind;
  title: string;
}): `trademark-service-requirement_${string}` {
  const digest = createHash('sha256')
    .update(
      [
        input.workspaceId,
        input.workPackageId,
        input.jurisdiction.toUpperCase(),
        input.serviceIntentKind,
        input.kind,
        input.title.toLocaleLowerCase()
      ].join('|')
    )
    .digest('hex');
  return `trademark-service-requirement_${digest}`;
}

function dedupeSources(
  references: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>
): ReadonlyArray<Readonly<TrademarkAssetSourceReference>> {
  const seen = new Map<string, Readonly<TrademarkAssetSourceReference>>();
  for (const reference of references) {
    const key = [
      reference.owner,
      reference.kind,
      reference.sourceId,
      reference.sourceVersion,
      reference.sourceFingerprintSha256 ?? '',
      reference.observedAt,
      reference.freshness
    ].join('|');
    seen.set(key, reference);
  }
  return [...seen.values()].sort((left, right) =>
    [left.owner, left.kind, left.sourceId, left.sourceVersion].join('|').localeCompare(
      [right.owner, right.kind, right.sourceId, right.sourceVersion].join('|')
    )
  );
}

function worstFreshness(
  references: ReadonlyArray<Readonly<TrademarkAssetSourceReference>>
): TrademarkAssetFreshnessState {
  return references.reduce<TrademarkAssetFreshnessState>(
    (worst, reference) =>
      freshnessRank[reference.freshness] > freshnessRank[worst] ? reference.freshness : worst,
    'CURRENT'
  );
}

function worstStatus(statuses: readonly TrademarkServiceRequirementStatus[]) {
  return statuses.reduce<TrademarkServiceRequirementStatus>(
    (worst, status) => (statusRank[status] > statusRank[worst] ? status : worst),
    'NOT_APPLICABLE'
  );
}

function normalizeStatus(
  status: TrademarkServiceRequirementStatus,
  freshness: TrademarkAssetFreshnessState
): TrademarkServiceRequirementStatus {
  if (freshness !== 'CURRENT') return 'REVIEW_REQUIRED';
  return status;
}

function sourceFreshnessReviewed(freshness: TrademarkAssetFreshnessState): boolean {
  return freshness === 'CURRENT';
}

function professionalReviewRequired(
  kind: TrademarkServiceRequirementKind,
  status: TrademarkServiceRequirementStatus
): boolean {
  return kind === 'TIMING_OR_DEADLINE_REVIEW' || status === 'REVIEW_REQUIRED' || status === 'UNKNOWN';
}

export function composeTrademarkServiceRequirementCandidates(
  command: Readonly<ComposeTrademarkServiceRequirementsCommand>
): TrademarkServiceRequirementCompositionResult {
  const workspaceId = clean(command.workspaceId);
  const jurisdiction = clean(command.jurisdiction).toUpperCase();
  const generatedAt = new Date(command.generatedAt).toISOString();

  if (!workspaceId) throw new Error('workspaceId is required.');
  if (!command.workPackageId.startsWith('trademark-service-work-package_')) {
    throw new Error('workPackageId is invalid.');
  }
  if (!jurisdiction) throw new Error('jurisdiction is required.');
  if (!trademarkServiceIntentKinds.includes(command.serviceIntentKind)) {
    throw new Error('serviceIntentKind is invalid.');
  }

  const groups = new Map<string, TrademarkServiceRequirementObservation[]>();
  let sourceBackedObservationCount = 0;
  let discardedObservationCount = 0;

  for (const raw of command.observations) {
    const observation: TrademarkServiceRequirementObservation = {
      jurisdiction: clean(raw.jurisdiction).toUpperCase(),
      serviceIntentKind: raw.serviceIntentKind,
      kind: raw.kind,
      status: raw.status,
      title: clean(raw.title),
      explanation: clean(raw.explanation),
      sourceReferences: dedupeSources(raw.sourceReferences)
    };

    const validVocabulary =
      trademarkServiceIntentKinds.includes(observation.serviceIntentKind) &&
      trademarkServiceRequirementKinds.includes(observation.kind) &&
      trademarkServiceRequirementStatuses.includes(observation.status);
    const matchesContext =
      observation.jurisdiction === jurisdiction &&
      observation.serviceIntentKind === command.serviceIntentKind;
    const sourceBacked = observation.sourceReferences.length > 0;
    const meaningful = Boolean(observation.title && observation.explanation);

    if (!validVocabulary || !matchesContext || !sourceBacked || !meaningful) {
      discardedObservationCount += 1;
      continue;
    }

    sourceBackedObservationCount += 1;
    const key = [observation.kind, observation.title.toLocaleLowerCase()].join('|');
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }

  const requirementCandidates = [...groups.values()]
    .map((group): TrademarkServiceRequirementCandidate => {
      const first = group[0]!;
      const references = dedupeSources(group.flatMap((item) => item.sourceReferences));
      const freshness = worstFreshness(references);
      const status = normalizeStatus(
        worstStatus(group.map((item) => item.status)),
        freshness
      );
      const explanation = [...new Set(group.map((item) => item.explanation))].join(' ');
      return {
        schemaVersion: 1,
        requirementId: stableRequirementId({
          workspaceId,
          workPackageId: command.workPackageId,
          jurisdiction,
          serviceIntentKind: command.serviceIntentKind,
          kind: first.kind,
          title: first.title
        }),
        workspaceId,
        workPackageId: command.workPackageId,
        kind: first.kind,
        status,
        title: first.title,
        explanation,
        jurisdiction,
        sourceReferences: references,
        sourceFreshnessReviewed: sourceFreshnessReviewed(freshness),
        professionalReviewRequired: professionalReviewRequired(first.kind, status),
        certifiedLegalRequirement: false,
        legalDeadlineCertified: false,
        officialTruthVerifiedByLite: false,
        createdAt: generatedAt
      };
    })
    .sort((left, right) =>
      [left.kind, left.title, left.requirementId].join('|').localeCompare(
        [right.kind, right.title, right.requirementId].join('|')
      )
    );

  const missingInputs: TrademarkServiceMissingInput[] = [];
  if (command.observations.length === 0 || sourceBackedObservationCount === 0) {
    missingInputs.push({
      reason: 'OTHER_REVIEW_REQUIRED',
      title: 'Source-backed jurisdiction requirements are not available',
      explanation:
        'No source-backed requirement observation was available for this jurisdiction and service intent. Professional review is required instead of inventing a requirement.',
      blocking: true
    });
  }
  if (discardedObservationCount > 0) {
    missingInputs.push({
      reason: 'SOURCE_CONFLICT_OR_STALENESS',
      title: 'Some requirement observations could not be composed',
      explanation:
        'One or more observations were excluded because they lacked usable provenance, did not match the Service Work Package jurisdiction/intent, or were incomplete.',
      blocking: false
    });
  }

  return {
    workspaceId,
    workPackageId: command.workPackageId,
    jurisdiction,
    serviceIntentKind: command.serviceIntentKind,
    requirementCandidates,
    missingInputs,
    sourceBackedObservationCount,
    discardedObservationCount,
    generatedAt,
    certifiedLegalRequirementsCreated: false,
    legalDeadlineCertified: false,
    officialTruthVerifiedByLite: false
  };
}
