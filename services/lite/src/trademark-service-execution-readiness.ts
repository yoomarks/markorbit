import { createHash } from 'node:crypto';
import type {
  TrademarkServiceExecutionReadiness,
  TrademarkServiceWorkPackage
} from '@markorbit/contracts/trademark-service-workbench';

export class TrademarkServiceExecutionReadinessError extends Error {
  constructor(
    readonly code:
      | 'WORKSPACE_MISMATCH'
      | 'VERSION_MISMATCH'
      | 'READINESS_REQUIRED'
      | 'USER_REVIEW_REQUIRED'
      | 'OWNER_VALIDATION_REQUIRED'
      | 'EVIDENCE_REQUIRED'
      | 'AUTHORITY_BOUNDARY_VIOLATION',
    message: string,
    readonly status = 409
  ) {
    super(message);
    this.name = 'TrademarkServiceExecutionReadinessError';
  }
}

export interface PrepareTrademarkServiceExecutionReadinessCommand {
  readonly workspaceId: string;
  readonly workPackage: Readonly<TrademarkServiceWorkPackage>;
  readonly expectedWorkPackageVersion: number;
  readonly reviewedByUserId: string;
  readonly reviewedAt: string;
  readonly ownerDomainValidationReferences: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly executionPreparationReference?: string;
}

export interface TrademarkServiceAuthorityAudit {
  readonly passed: boolean;
  readonly checks: ReadonlyArray<{
    readonly code: string;
    readonly passed: boolean;
    readonly explanation: string;
  }>;
}

function cleanedReferences(values: readonly string[], field: string): string[] {
  const cleaned = [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
  if (!cleaned.length) {
    throw new TrademarkServiceExecutionReadinessError(
      field === 'ownerDomainValidationReferences' ? 'OWNER_VALIDATION_REQUIRED' : 'EVIDENCE_REQUIRED',
      `${field} must contain at least one explicit reference.`
    );
  }
  return cleaned;
}

function cleanText(value: string, field: string): string {
  const cleaned = value.trim();
  if (!cleaned) {
    throw new TrademarkServiceExecutionReadinessError(
      'USER_REVIEW_REQUIRED',
      `${field} is required.`
    );
  }
  return cleaned;
}

function stableId(command: Readonly<PrepareTrademarkServiceExecutionReadinessCommand>): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        workspaceId: command.workspaceId,
        workPackageId: command.workPackage.workPackageId,
        workPackageVersion: command.expectedWorkPackageVersion,
        reviewedByUserId: command.reviewedByUserId.trim(),
        ownerDomainValidationReferences: [...command.ownerDomainValidationReferences]
          .map((value) => value.trim())
          .filter(Boolean)
          .sort(),
        evidenceReferences: [...command.evidenceReferences]
          .map((value) => value.trim())
          .filter(Boolean)
          .sort(),
        executionPreparationReference: command.executionPreparationReference?.trim() ?? null
      })
    )
    .digest('hex')
    .slice(0, 32);
}

export function auditTrademarkServiceAuthorityBoundaries(
  workPackage: Readonly<TrademarkServiceWorkPackage>
): TrademarkServiceAuthorityAudit {
  const checks = [
    {
      code: 'NO_PARALLEL_MATTER_LIFECYCLE',
      passed: workPackage.parallelMatterLifecycleCreated === false,
      explanation: 'Lite must not create a parallel Matter lifecycle.'
    },
    {
      code: 'NO_OFFICIAL_TRUTH_PROMOTION',
      passed: workPackage.officialTruthCreated === false,
      explanation: 'Product preparation must not create official truth.'
    },
    {
      code: 'NO_PROTECTED_ACTION_AUTHORITY',
      passed: workPackage.protectedActionAuthorized === false,
      explanation: 'A Service Work Package cannot authorize protected action.'
    },
    {
      code: 'NO_VERIFIED_CAPABILITY_PROMOTION',
      passed: workPackage.capabilityCandidates.every(
        (candidate) => candidate.verifiedCapability === false
      ),
      explanation: 'Capability candidates remain unverified by Lite.'
    },
    {
      code: 'NO_PROVIDER_ENGAGEMENT_OR_SELECTION',
      passed: workPackage.providerCandidates.every(
        (candidate) => candidate.engaged === false && candidate.selectedForExecution === false
      ),
      explanation: 'Provider candidates remain unengaged and unselected.'
    },
    {
      code: 'NO_SERVICE_PACKAGE_SELECTION',
      passed: workPackage.servicePackageCandidates.every((candidate) => candidate.selected === false),
      explanation: 'Service Package candidates remain candidates.'
    },
    {
      code: 'NO_BINDING_QUOTE_OR_PAYMENT',
      passed:
        !workPackage.quoteCandidate ||
        (workPackage.quoteCandidate.bindingQuote === false &&
          workPackage.quoteCandidate.paymentAuthorized === false),
      explanation: 'Commercial preparation remains non-binding and unpaid.'
    },
    {
      code: 'NO_EXTERNAL_COMMUNICATION',
      passed: workPackage.communicationDrafts.every(
        (draft) => draft.sent === false && draft.externalContactAuthorized === false
      ),
      explanation: 'Communication remains unsent and unauthorized.'
    }
  ] as const;
  return { passed: checks.every((check) => check.passed), checks };
}

export function prepareTrademarkServiceExecutionReadiness(
  command: Readonly<PrepareTrademarkServiceExecutionReadinessCommand>
): TrademarkServiceExecutionReadiness {
  const workPackage = command.workPackage;
  if (workPackage.workspaceId.toLowerCase() !== command.workspaceId.toLowerCase()) {
    throw new TrademarkServiceExecutionReadinessError(
      'WORKSPACE_MISMATCH',
      'Service Work Package does not belong to this Workspace.',
      404
    );
  }
  if (workPackage.version !== command.expectedWorkPackageVersion) {
    throw new TrademarkServiceExecutionReadinessError(
      'VERSION_MISMATCH',
      'Service Work Package changed since the requested version.'
    );
  }
  if (workPackage.readiness.state !== 'READY_FOR_EXECUTION_PREPARATION') {
    throw new TrademarkServiceExecutionReadinessError(
      'READINESS_REQUIRED',
      'Service Work Package is not ready for Execution preparation.'
    );
  }
  if (!workPackage.intent.reviewedByUser) {
    throw new TrademarkServiceExecutionReadinessError(
      'USER_REVIEW_REQUIRED',
      'Service Intent must remain explicitly user-reviewed.'
    );
  }
  const reviewedByUserId = cleanText(command.reviewedByUserId, 'reviewedByUserId');
  const reviewedAt = new Date(command.reviewedAt);
  if (Number.isNaN(reviewedAt.valueOf())) {
    throw new TrademarkServiceExecutionReadinessError(
      'USER_REVIEW_REQUIRED',
      'reviewedAt must be a valid timestamp.'
    );
  }
  const ownerDomainValidationReferences = cleanedReferences(
    command.ownerDomainValidationReferences,
    'ownerDomainValidationReferences'
  );
  const evidenceReferences = cleanedReferences(command.evidenceReferences, 'evidenceReferences');
  const audit = auditTrademarkServiceAuthorityBoundaries(workPackage);
  if (!audit.passed) {
    throw new TrademarkServiceExecutionReadinessError(
      'AUTHORITY_BOUNDARY_VIOLATION',
      'Service Work Package violates an M12 authority boundary.'
    );
  }
  return {
    schemaVersion: 1,
    executionReadinessId: `trademark-service-execution-readiness_${stableId(command)}`,
    workspaceId: command.workspaceId,
    workPackage: {
      id: workPackage.workPackageId,
      version: workPackage.version
    },
    readinessState: 'READY_FOR_EXECUTION_PREPARATION',
    reviewedByUserId,
    reviewedAt: reviewedAt.toISOString(),
    ownerDomainValidationReferences,
    evidenceReferences,
    ...(command.executionPreparationReference?.trim()
      ? { executionPreparationReference: command.executionPreparationReference.trim() }
      : {}),
    executionAuthorized: false,
    filingAuthorized: false,
    externalContactAuthorized: false,
    paymentAuthorized: false,
    publicationAuthorized: false,
    providerEngagementAuthorized: false
  };
}
