import type {
  TrademarkServiceMissingInput,
  TrademarkServiceMissingInputReason,
  TrademarkServiceReadiness,
  TrademarkServiceRequirementCandidate,
  TrademarkServiceRequirementKind,
  TrademarkServiceWorkPackage
} from '@markorbit/contracts/trademark-service-workbench';

export interface AssessTrademarkServiceReadinessCommand {
  workPackage: Readonly<TrademarkServiceWorkPackage>;
  evaluatedAt: string;
}

export interface TrademarkServiceReadinessAssessment {
  workPackageId: TrademarkServiceWorkPackage['workPackageId'];
  workspaceId: string;
  workPackageVersion: number;
  readiness: Readonly<TrademarkServiceReadiness>;
  missingInputs: ReadonlyArray<Readonly<TrademarkServiceMissingInput>>;
  generatedMissingInputCount: number;
  preparationCompletenessOnly: true;
  legalInsufficiencyFindingCreated: false;
  successProbabilityCalculated: false;
  filingEligibilityCertified: false;
  legalValidityCertified: false;
  officialTruthVerifiedByLite: false;
}

const clientMissingReasons = new Set<TrademarkServiceMissingInputReason>([
  'ASSET_CONTEXT_MISSING',
  'MATTER_CONTEXT_MISSING',
  'JURISDICTION_CONTEXT_MISSING',
  'CLIENT_INFORMATION_MISSING',
  'DOCUMENT_MISSING',
  'EVIDENCE_MISSING'
]);

const providerMissingReasons = new Set<TrademarkServiceMissingInputReason>([
  'CAPABILITY_CONTEXT_MISSING',
  'PROVIDER_CONTEXT_MISSING'
]);

const missingReasonByRequirementKind: Partial<
  Record<TrademarkServiceRequirementKind, TrademarkServiceMissingInputReason>
> = {
  IDENTITY: 'CLIENT_INFORMATION_MISSING',
  JURISDICTION: 'JURISDICTION_CONTEXT_MISSING',
  DOCUMENT: 'DOCUMENT_MISSING',
  EVIDENCE: 'EVIDENCE_MISSING',
  OWNER_DOMAIN_REVIEW: 'OWNER_DOMAIN_REVIEW_MISSING',
  CAPABILITY: 'CAPABILITY_CONTEXT_MISSING',
  PROVIDER: 'PROVIDER_CONTEXT_MISSING',
  COMMERCIAL: 'COMMERCIAL_CONTEXT_MISSING',
  OTHER_REVIEW_REQUIRED: 'OTHER_REVIEW_REQUIRED'
};

function missingFromRequirement(
  requirement: Readonly<TrademarkServiceRequirementCandidate>
): TrademarkServiceMissingInput | undefined {
  if (requirement.status !== 'MISSING') return undefined;
  const reason = missingReasonByRequirementKind[requirement.kind];
  if (!reason) return undefined;
  return {
    reason,
    title: requirement.title,
    explanation: `Preparation input is missing for the source-backed requirement candidate: ${requirement.explanation}`,
    blocking: true,
    relatedRequirementId: requirement.requirementId
  };
}

function dedupeMissingInputs(
  inputs: ReadonlyArray<Readonly<TrademarkServiceMissingInput>>
): ReadonlyArray<Readonly<TrademarkServiceMissingInput>> {
  const seen = new Map<string, Readonly<TrademarkServiceMissingInput>>();
  for (const input of inputs) {
    const key = [input.reason, input.relatedRequirementId ?? '', input.title].join('|');
    const current = seen.get(key);
    if (!current || (!current.blocking && input.blocking)) seen.set(key, input);
  }
  return [...seen.values()].sort((left, right) =>
    [left.reason, left.relatedRequirementId ?? '', left.title].join('|').localeCompare(
      [right.reason, right.relatedRequirementId ?? '', right.title].join('|')
    )
  );
}

function contextMissingInputs(
  workPackage: Readonly<TrademarkServiceWorkPackage>
): TrademarkServiceMissingInput[] {
  const inputs: TrademarkServiceMissingInput[] = [];
  if (!workPackage.asset && !workPackage.matterReference) {
    inputs.push({
      reason: 'ASSET_CONTEXT_MISSING',
      title: 'Asset or Matter context is required',
      explanation:
        'The preparation package has no Trademark Asset or MarkReg Matter reference to anchor professional review.',
      blocking: true
    });
  }
  if (!workPackage.intent.jurisdiction.trim()) {
    inputs.push({
      reason: 'JURISDICTION_CONTEXT_MISSING',
      title: 'Jurisdiction context is required',
      explanation: 'A jurisdiction is required before preparation completeness can be assessed.',
      blocking: true
    });
  }
  return inputs;
}

function requiresProfessionalRequirementReview(
  requirement: Readonly<TrademarkServiceRequirementCandidate>
): boolean {
  return (
    requirement.professionalReviewRequired ||
    requirement.status === 'CANDIDATE' ||
    requirement.status === 'UNKNOWN' ||
    requirement.status === 'REVIEW_REQUIRED'
  );
}

function readinessState(input: {
  workPackage: Readonly<TrademarkServiceWorkPackage>;
  missingInputs: ReadonlyArray<Readonly<TrademarkServiceMissingInput>>;
  reviewRequiredCount: number;
}): TrademarkServiceReadiness['state'] {
  const { workPackage, missingInputs, reviewRequiredCount } = input;
  const hasContextGap = missingInputs.some(
    (item) =>
      item.blocking &&
      (item.reason === 'ASSET_CONTEXT_MISSING' ||
        item.reason === 'MATTER_CONTEXT_MISSING' ||
        item.reason === 'JURISDICTION_CONTEXT_MISSING')
  );
  if (hasContextGap) return 'CONTEXT_INCOMPLETE';

  if (workPackage.requirementCandidates.length === 0 && missingInputs.length === 0) return 'DRAFT';
  if (reviewRequiredCount > 0) return 'REQUIREMENTS_REVIEW_REQUIRED';

  const blocking = missingInputs.filter((item) => item.blocking);
  if (blocking.some((item) => clientMissingReasons.has(item.reason))) return 'MISSING_CLIENT_INPUT';
  if (
    blocking.some(
      (item) => item.reason === 'OWNER_DOMAIN_REVIEW_MISSING' || providerMissingReasons.has(item.reason)
    )
  ) {
    return 'PROVIDER_INPUT_REQUIRED';
  }
  if (blocking.some((item) => item.reason === 'COMMERCIAL_CONTEXT_MISSING')) {
    return 'COMMERCIAL_REVIEW_REQUIRED';
  }
  if (blocking.length > 0) return 'REQUIREMENTS_REVIEW_REQUIRED';
  if (!workPackage.intent.reviewedByUser) return 'READY_FOR_USER_CONFIRMATION';
  return 'READY_FOR_EXECUTION_PREPARATION';
}

export function assessTrademarkServiceReadiness(
  command: Readonly<AssessTrademarkServiceReadinessCommand>
): TrademarkServiceReadinessAssessment {
  const evaluatedAt = new Date(command.evaluatedAt).toISOString();
  const workPackage = command.workPackage;
  const generatedMissingInputs = [
    ...contextMissingInputs(workPackage),
    ...workPackage.requirementCandidates.flatMap((requirement) => {
      const missing = missingFromRequirement(requirement);
      return missing ? [missing] : [];
    })
  ];
  const missingInputs = dedupeMissingInputs([
    ...workPackage.missingInputs,
    ...generatedMissingInputs
  ]);
  const presentRequirementCount = workPackage.requirementCandidates.filter(
    (requirement) => requirement.status === 'PRESENT'
  ).length;
  const reviewRequiredCount = workPackage.requirementCandidates.filter(
    requiresProfessionalRequirementReview
  ).length;
  const blockingMissingCount = missingInputs.filter((input) => input.blocking).length;

  const readiness: TrademarkServiceReadiness = {
    state: readinessState({ workPackage, missingInputs, reviewRequiredCount }),
    presentRequirementCount,
    blockingMissingCount,
    reviewRequiredCount,
    evaluatedAt,
    preparationCompletenessOnly: true,
    successProbabilityCalculated: false,
    filingEligibilityCertified: false,
    legalValidityCertified: false
  };

  return {
    workPackageId: workPackage.workPackageId,
    workspaceId: workPackage.workspaceId,
    workPackageVersion: workPackage.version,
    readiness,
    missingInputs,
    generatedMissingInputCount: generatedMissingInputs.length,
    preparationCompletenessOnly: true,
    legalInsufficiencyFindingCreated: false,
    successProbabilityCalculated: false,
    filingEligibilityCertified: false,
    legalValidityCertified: false,
    officialTruthVerifiedByLite: false
  };
}
