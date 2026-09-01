import type { FormalMatterId, WorkspacePrincipal } from '@markorbit/contracts';
import type {
  CurrentLifecycleView,
  LifecycleEventProjection
} from '@markorbit/contracts/evidence-lifecycle';
import type { PostgresDocumentPackageService } from './document-package.js';
import { FormalMatterError, type FormalMatterRepository } from './formal-matter.js';
import type { LifecycleProjectionRepository } from './lifecycle-projection.js';
import { assertMatterIntelligenceReadIntegrity } from './matter-intelligence-read-integrity.js';
import type {
  MatterIntelligenceReadQuery,
  MatterIntelligenceReadService
} from './matter-intelligence-read.js';

const MAX_DOCUMENT_PACKAGES = 50;
const MAX_DOCUMENT_ITEMS_PER_PACKAGE = 100;
const MAX_LIFECYCLE_EVENTS = 100;

export type FormalMatterEvidenceReadErrorCode =
  'FORMAL_MATTER_NOT_FOUND' | 'PERMISSION_DENIED' | 'PERSISTENCE_UNAVAILABLE';

export class FormalMatterEvidenceReadError extends Error {
  constructor(
    readonly code: FormalMatterEvidenceReadErrorCode,
    message: string,
    readonly status: number,
    readonly retryable = false,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'FormalMatterEvidenceReadError';
  }
}

type DocumentPackageList = Awaited<ReturnType<PostgresDocumentPackageService['list']>>;
type DocumentPackageView = DocumentPackageList[number];

export interface FormalMatterEvidenceReadDependencies {
  formalMatters: Pick<FormalMatterRepository, 'findById'>;
  documentPackages: Pick<PostgresDocumentPackageService, 'list'>;
  lifecycle: Pick<LifecycleProjectionRepository, 'getCurrentView' | 'listEvents'>;
  intelligence: Pick<MatterIntelligenceReadService, 'getForMatter'>;
}

export type FormalMatterEvidenceReadQuery = MatterIntelligenceReadQuery;

function requirePermissions(principal: WorkspacePrincipal): void {
  const required = ['workspace:read', 'matter:read', 'document-package:read'] as const;
  const missing = required.filter((permission) => !principal.permissions.includes(permission));
  if (missing.length)
    throw new FormalMatterEvidenceReadError(
      'PERMISSION_DENIED',
      `${missing.join(', ')} permission is required.`,
      403,
      false,
      { missingPermissions: missing }
    );
}

function sameVersion(left: number | string, right: number | string): boolean {
  return String(left) === String(right);
}

function documentEvidence(item: DocumentPackageView['documentItems'][number]) {
  return {
    documentItemId: item.documentItemId,
    requirementKey: item.requirementKey,
    documentType: item.documentType,
    displayName: item.displayName,
    evidenceType: item.evidenceType,
    ...(item.originalFileName ? { originalFileName: item.originalFileName } : {}),
    ...(item.mediaType ? { mediaType: item.mediaType } : {}),
    ...(item.sizeBytes === undefined ? {} : { sizeBytes: item.sizeBytes }),
    evidenceSha256: item.checksum,
    ...(item.storageReference ? { storageReference: item.storageReference } : {}),
    verificationStatus: item.verificationStatus,
    ...(item.structuredNote ? { structuredNote: structuredClone(item.structuredNote) } : {}),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function packageEvidence(
  value: DocumentPackageView,
  currentMatter: { version: number | string; snapshotSha256: string }
) {
  const documentItems = value.documentItems.slice(0, MAX_DOCUMENT_ITEMS_PER_PACKAGE);
  return {
    documentPackageId: value.documentPackageId,
    status: value.status,
    version: value.version,
    schemaVersion: value.schemaVersion,
    sourceFormalMatterVersion: value.sourceFormalMatterVersion,
    sourceFormalMatterSha256: value.sourceFormalMatterHash,
    matterSourceCurrent:
      sameVersion(value.sourceFormalMatterVersion, currentMatter.version) &&
      value.sourceFormalMatterHash === currentMatter.snapshotSha256,
    professionalReviewCaseId: value.professionalReviewCaseId,
    sourceReviewVersion: value.sourceReviewVersion,
    sourceCompletedDecisionId: value.sourceCompletedDecisionId,
    sourceCompletedDecisionSha256: value.sourceCompletedDecisionHash,
    ...(value.canonicalEvidenceHash
      ? { canonicalEvidenceSha256: value.canonicalEvidenceHash }
      : {}),
    documentEvidence: documentItems.map(documentEvidence),
    documentEvidenceTotal: value.documentItems.length,
    documentEvidenceTruncated: value.documentItems.length > documentItems.length,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    ...(value.readyAt ? { readyAt: value.readyAt } : {})
  };
}

function lifecycleCurrent(value: CurrentLifecycleView | undefined, matterVersion: number | string) {
  if (!value) return null;
  return {
    lifecycleViewId: value.lifecycleViewId,
    version: value.version,
    formalMatter: structuredClone(value.formalMatter),
    matterSourceCurrent: sameVersion(value.formalMatter.version, matterVersion),
    currentEvent: structuredClone(value.currentEvent),
    currentEventFingerprintSha256: value.currentEventFingerprintSha256,
    state: value.state,
    customerSafeLabel: value.customerSafeLabel,
    customerSafeSummary: value.customerSafeSummary,
    lifecycleViewFingerprintSha256: value.lifecycleViewFingerprintSha256,
    officialStatusVerified: false as const,
    updatedAt: value.updatedAt
  };
}

function lifecycleEvent(value: LifecycleEventProjection, matterVersion: number | string) {
  return {
    lifecycleEventId: value.lifecycleEventId,
    version: value.version,
    formalMatter: structuredClone(value.formalMatter),
    matterSourceCurrent: sameVersion(value.formalMatter.version, matterVersion),
    source: structuredClone(value.source),
    state: value.state,
    eventCode: value.eventCode,
    customerSafeLabel: value.customerSafeLabel,
    customerSafeSummary: value.customerSafeSummary,
    occurredAt: value.occurredAt,
    projectedAt: value.projectedAt,
    lifecycleEventFingerprintSha256: value.lifecycleEventFingerprintSha256,
    officialStatusVerified: false as const
  };
}

export class FormalMatterEvidenceReadService {
  constructor(private readonly dependencies: FormalMatterEvidenceReadDependencies) {}

  async getForMatter(
    principal: WorkspacePrincipal,
    formalMatterId: FormalMatterId,
    query: FormalMatterEvidenceReadQuery = {}
  ) {
    requirePermissions(principal);
    let matter: Awaited<ReturnType<FormalMatterRepository['findById']>>;
    try {
      matter = await this.dependencies.formalMatters.findById(
        principal.workspaceId,
        formalMatterId
      );
    } catch (cause) {
      if (cause instanceof FormalMatterError && cause.code === 'PERSISTENCE_UNAVAILABLE')
        throw new FormalMatterEvidenceReadError(
          'PERSISTENCE_UNAVAILABLE',
          'Formal Matter evidence persistence is unavailable.',
          503,
          true,
          undefined,
          { cause }
        );
      throw cause;
    }
    if (!matter)
      throw new FormalMatterEvidenceReadError(
        'FORMAL_MATTER_NOT_FOUND',
        'Formal Matter was not found.',
        404
      );

    const evidence = await Promise.all([
      this.dependencies.documentPackages.list(principal),
      this.dependencies.lifecycle.getCurrentView(principal.workspaceId, formalMatterId),
      this.dependencies.lifecycle.listEvents(principal.workspaceId, formalMatterId),
      this.dependencies.intelligence.getForMatter(principal, formalMatterId, query)
    ]);
    const [workspacePackages, currentLifecycle, lifecycleEvents, intelligence] = evidence;

    assertMatterIntelligenceReadIntegrity(intelligence, principal.workspaceId);

    const matterPackages = workspacePackages.filter(
      (value) => value.formalMatterId === formalMatterId
    );
    const matchingPackages = matterPackages.slice(0, MAX_DOCUMENT_PACKAGES);
    const boundedEvents = lifecycleEvents.slice(0, MAX_LIFECYCLE_EVENTS);
    const currentMatterSource = {
      version: matter.version,
      snapshotSha256: matter.snapshotSha256
    };

    return {
      schemaVersion: 1 as const,
      workspaceId: principal.workspaceId,
      formalMatter: {
        formalMatterId: matter.formalMatterId,
        kind: matter.kind,
        status: matter.status,
        version: matter.version,
        snapshotSchemaVersion: matter.snapshotSchemaVersion,
        snapshotSha256: matter.snapshotSha256,
        sourceCustomerConfirmationId: matter.sourceCustomerConfirmationId,
        sourceCustomerConfirmationVersion: matter.sourceCustomerConfirmationVersion,
        sourceMatterDraftId: matter.sourceMatterDraftId,
        sourceMatterDraftVersion: matter.sourceMatterDraftVersion,
        sourceQuoteId: matter.sourceQuoteId,
        sourceQuoteVersion: matter.sourceQuoteVersion,
        createdAt: matter.createdAt,
        updatedAt: matter.updatedAt
      },
      documentPackages: {
        items: matchingPackages.map((value) => packageEvidence(value, currentMatterSource)),
        returned: matchingPackages.length,
        total: matterPackages.length,
        truncated: matterPackages.length > matchingPackages.length,
        limit: MAX_DOCUMENT_PACKAGES
      },
      lifecycle: {
        current: lifecycleCurrent(currentLifecycle, matter.version),
        events: boundedEvents.map((value) => lifecycleEvent(value, matter.version)),
        total: lifecycleEvents.length,
        truncated: lifecycleEvents.length > boundedEvents.length,
        limit: MAX_LIFECYCLE_EVENTS,
        officialStatusVerified: false as const
      },
      intelligence: structuredClone(intelligence),
      semantics: {
        workspaceScoped: true as const,
        readOnly: true as const,
        recomputed: false as const,
        reviewedEvidenceIsOfficialTruth: false as const,
        providerReturnIsOfficialTruth: false as const,
        lifecycleProjectionIsOfficialStatus: false as const,
        matterIntelligenceIsOfficialTruth: false as const,
        preparationLockIncluded: false as const
      },
      authorityConsequences: {
        formalMatterMutated: false as const,
        lifecycleMutated: false as const,
        evidenceCreatedOrCertified: false as const,
        recommendationAuthorized: false as const,
        paymentCreated: false as const,
        invoiceCreated: false as const,
        filingAuthorized: false as const,
        filingSubmitted: false as const,
        providerContacted: false as const,
        officialTruthCreated: false as const
      }
    };
  }
}
