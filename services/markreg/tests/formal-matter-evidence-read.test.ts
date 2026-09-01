import { describe, expect, it } from 'vitest';
import type { FormalMatter, FormalMatterId, WorkspacePrincipal } from '@markorbit/contracts';
import type {
  CurrentLifecycleView,
  LifecycleEventProjection
} from '@markorbit/contracts/evidence-lifecycle';
import { DocumentPackageError } from '../src/document-package.js';
import {
  FormalMatterEvidenceReadService,
  PostgresFormalMatterDocumentPackageReader,
  type FormalMatterEvidenceReadDependencies
} from '../src/formal-matter-evidence-read.js';
import { FormalMatterError } from '../src/formal-matter.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
const formalMatterId = 'formal-matter_evidence' as FormalMatterId;
const sha = (character: string) => character.repeat(64);

const matter: FormalMatter = {
  schemaVersion: 1,
  formalMatterId,
  workspaceId,
  kind: 'TRADEMARK_REGISTRATION',
  status: 'OPEN',
  version: 1,
  sourceCustomerConfirmationId: 'confirmation_evidence',
  sourceCustomerConfirmationVersion: 2,
  sourceMatterDraftId: 'matter-draft_evidence',
  sourceMatterDraftVersion: 4,
  sourceQuoteId: 'quote_evidence',
  sourceQuoteVersion: 'quote-v1',
  sourceSnapshot: {
    schemaVersion: 1,
    customerConfirmation: { id: 'confirmation_evidence', version: 2, status: 'CONFIRMED' },
    quote: { id: 'quote_evidence', version: 'quote-v1', currency: 'USD', totalMinor: 100 },
    matterDraft: {
      id: 'matter-draft_evidence',
      version: 4,
      status: 'READY_FOR_PROFESSIONAL_REVIEW',
      readiness: {
        evaluatedAt: '2026-08-10T00:00:00.000Z',
        readyForProfessionalReview: true,
        checks: []
      }
    },
    preparation: { classes: [9], documentReferences: [] }
  },
  snapshotSchemaVersion: 1,
  snapshotSha256: sha('a'),
  createdByUserId: 'user_evidence',
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T01:00:00.000Z'
};

const lifecycleView: CurrentLifecycleView = {
  schemaVersion: 1,
  lifecycleViewId: 'lifecycle-view_evidence',
  workspaceId,
  formalMatter: { id: formalMatterId, version: 1 },
  version: 2,
  currentEvent: { id: 'lifecycle-event_evidence', version: 1 },
  currentEventFingerprintSha256: sha('b'),
  state: 'REVIEWED_PROVIDER_EVIDENCE',
  customerSafeLabel: 'Reviewed update',
  customerSafeSummary: 'Reviewed evidence is available.',
  lifecycleViewFingerprintSha256: sha('c'),
  officialStatusVerified: false,
  updatedAt: '2026-08-10T02:00:00.000Z'
};

const lifecycleEvent: LifecycleEventProjection = {
  schemaVersion: 1,
  lifecycleEventId: 'lifecycle-event_evidence',
  workspaceId,
  formalMatter: { id: formalMatterId, version: 2 },
  version: 1,
  source: {
    reviewedSourceAdmission: { id: 'reviewed-source-admission_evidence', version: 1 },
    admissionFingerprintSha256: sha('d'),
    evidenceReviewDecision: { id: 'evidence-review-decision_evidence', version: 1 },
    evidenceReceipt: { id: 'evidence-receipt_evidence', version: 1 },
    providerReturn: { id: 'provider-return_evidence', version: 1 },
    formalMatter: { id: formalMatterId, version: 2 }
  },
  state: 'REVIEWED_PROVIDER_EVIDENCE',
  eventCode: 'REVIEWED_UPDATE',
  customerSafeLabel: 'Reviewed update',
  customerSafeSummary: 'Reviewed evidence is available.',
  occurredAt: '2026-08-10T01:50:00.000Z',
  projectedAt: '2026-08-10T02:00:00.000Z',
  lifecycleEventFingerprintSha256: sha('e'),
  officialStatusVerified: false,
  correlationId: 'correlation_evidence'
};

function principal(workspace = workspaceId, completePermissions = true): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_evidence',
    userId: 'user_evidence',
    workspaceId: workspace,
    membershipId: 'membership_evidence',
    role: 'MATTER_MANAGER',
    permissions: completePermissions
      ? ['workspace:read', 'matter:read', 'document-package:read']
      : ['workspace:read'],
    sessionExpiresAt: '2026-09-02T00:00:00.000Z'
  };
}

function dependencies(options?: {
  missingMatter?: boolean;
  noEvidence?: boolean;
  persistenceFailure?: boolean;
  documentPackageFailure?: boolean;
  observedMatterIds?: FormalMatterId[];
}): FormalMatterEvidenceReadDependencies {
  const documentPackage = {
    documentPackageId: 'document-package_evidence',
    workspaceId,
    formalMatterId,
    sourceFormalMatterVersion: 2,
    sourceFormalMatterHash: sha('f'),
    professionalReviewCaseId: 'professional-review_evidence',
    sourceReviewVersion: 5,
    sourceCompletedDecisionId: 'decision_evidence',
    sourceCompletedDecisionHash: sha('g'),
    status: 'READY_FOR_PREPARATION_LOCK',
    version: 7,
    schemaVersion: 1,
    requirements: [],
    draft: {},
    documentItems: [
      {
        documentItemId: 'document-item_evidence',
        requirementKey: 'MARK_REPRESENTATION_FILE',
        documentType: 'MARK_REPRESENTATION',
        displayName: 'Mark representation',
        evidenceType: 'UPLOADED_FILE',
        checksum: sha('h'),
        verificationStatus: 'REVIEWED',
        createdAt: '2026-08-10T01:00:00.000Z',
        updatedAt: '2026-08-10T01:00:00.000Z'
      }
    ],
    instructionEntries: [],
    canonicalEvidenceHash: sha('i'),
    readyAt: '2026-08-10T01:30:00.000Z',
    readyBy: 'user_evidence',
    createdBy: 'user_evidence',
    updatedBy: 'user_evidence',
    createdAt: '2026-08-10T00:30:00.000Z',
    updatedAt: '2026-08-10T01:30:00.000Z'
  };
  const intelligence = {
    formalMatter: { id: formalMatterId, version: 1, snapshotSha256: matter.snapshotSha256 },
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    reviewHistoryLimit: 20,
    semantics: {
      descriptiveHistoricalEvidence: true,
      prediction: false,
      deadline: false,
      serviceLevelAgreement: false,
      officialStatus: false
    },
    authorityConsequences: {
      officialTruthCreated: false,
      lifecycleStateMutated: false,
      formalMatterMutated: false,
      filingAuthorized: false,
      paymentAuthorized: false,
      externalActionExecuted: false
    }
  };
  const packages = options?.noEvidence ? [] : [structuredClone(documentPackage)];
  const currentLifecycle = options?.noEvidence ? undefined : structuredClone(lifecycleView);
  const events = options?.noEvidence ? [] : [structuredClone(lifecycleEvent)];

  return {
    formalMatters: {
      findById: (requestedWorkspace) => {
        if (options?.persistenceFailure)
          return Promise.reject(
            new FormalMatterError(
              'PERSISTENCE_UNAVAILABLE',
              'Formal Matter persistence unavailable.'
            )
          );
        return Promise.resolve(
          !options?.missingMatter && requestedWorkspace === workspaceId
            ? structuredClone(matter)
            : null
        );
      }
    },
    documentPackages: {
      listForMatter: (_principal, requestedMatterId) => {
        options?.observedMatterIds?.push(requestedMatterId);
        if (options?.documentPackageFailure)
          return Promise.reject(
            new DocumentPackageError(
              'PERSISTENCE_UNAVAILABLE',
              'Document Package persistence unavailable.',
              503,
              true
            )
          ) as never;
        return Promise.resolve(requestedMatterId === formalMatterId ? packages : []) as never;
      }
    },
    lifecycle: {
      getCurrentView: () => Promise.resolve(currentLifecycle),
      listEvents: () => Promise.resolve(events)
    },
    intelligence: {
      getForMatter: () => Promise.resolve(structuredClone(intelligence)) as never
    }
  };
}

describe('Postgres Formal Matter Document Package Reader', () => {
  it('queries exact Workspace + Formal Matter and preserves producer ordering', async () => {
    const calls: { text: string; values: readonly unknown[] | undefined }[] = [];
    const loaded: string[] = [];
    const query = {
      query: async (text: string, values?: readonly unknown[]) => {
        calls.push({ text, values });
        return {
          rows: [
            { document_package_id: 'document-package_newest' },
            { document_package_id: 'document-package_older' }
          ],
          rowCount: 2
        };
      }
    } as never;
    const reader = new PostgresFormalMatterDocumentPackageReader(query, {
      get: async (_principal, packageId) => {
        loaded.push(packageId);
        return { documentPackageId: packageId } as never;
      }
    });

    const result = await reader.listForMatter(principal(), formalMatterId);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toContain(
      'WHERE workspace_id=$1 AND formal_matter_id=$2 ORDER BY updated_at DESC,document_package_id'
    );
    expect(calls[0]?.values).toEqual([workspaceId, formalMatterId]);
    expect(loaded).toEqual(['document-package_newest', 'document-package_older']);
    expect(result.map((value) => value.documentPackageId)).toEqual([
      'document-package_newest',
      'document-package_older'
    ]);
  });

  it('keeps a different Workspace isolated and does not load unrelated packages', async () => {
    let loaded = false;
    const query = {
      query: async (_text: string, values?: readonly unknown[]) => ({
        rows: values?.[0] === workspaceId ? [{ document_package_id: 'document-package_hidden' }] : [],
        rowCount: values?.[0] === workspaceId ? 1 : 0
      })
    } as never;
    const reader = new PostgresFormalMatterDocumentPackageReader(query, {
      get: async () => {
        loaded = true;
        return {} as never;
      }
    });

    await expect(reader.listForMatter(principal(otherWorkspaceId), formalMatterId)).resolves.toEqual(
      []
    );
    expect(loaded).toBe(false);
  });

  it('fails before persistence access when document-package:read is absent', async () => {
    let queried = false;
    const reader = new PostgresFormalMatterDocumentPackageReader(
      {
        query: async () => {
          queried = true;
          return { rows: [], rowCount: 0 };
        }
      } as never,
      { get: async () => ({}) as never }
    );

    await expect(
      reader.listForMatter(principal(workspaceId, false), formalMatterId)
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });
    expect(queried).toBe(false);
  });
});

describe('Formal Matter Evidence Read Projection V1', () => {
  it('consolidates existing evidence truth without creating authority', async () => {
    const service = new FormalMatterEvidenceReadService(dependencies());
    const projection = await service.getForMatter(principal(), formalMatterId);

    expect(projection.formalMatter).toMatchObject({
      formalMatterId,
      version: 1,
      snapshotSha256: matter.snapshotSha256
    });
    expect(projection.documentPackages).toMatchObject({ total: 1, returned: 1 });
    expect(projection.documentPackages.items[0]).toMatchObject({
      documentPackageId: 'document-package_evidence',
      matterSourceCurrent: false,
      canonicalEvidenceSha256: sha('i'),
      documentEvidence: [{ evidenceSha256: sha('h') }]
    });
    expect(projection.lifecycle.current).toMatchObject({
      matterSourceCurrent: true,
      officialStatusVerified: false
    });
    expect(projection.lifecycle.events[0]).toMatchObject({
      matterSourceCurrent: false,
      officialStatusVerified: false
    });
    expect(projection.intelligence).toMatchObject({
      semantics: { officialStatus: false },
      authorityConsequences: { officialTruthCreated: false }
    });
    expect(projection.authorityConsequences).toEqual({
      formalMatterMutated: false,
      lifecycleMutated: false,
      evidenceCreatedOrCertified: false,
      recommendationAuthorized: false,
      paymentCreated: false,
      invoiceCreated: false,
      filingAuthorized: false,
      filingSubmitted: false,
      providerContacted: false,
      officialTruthCreated: false
    });
  });

  it('reads Document Packages through the exact requested Formal Matter boundary', async () => {
    const observedMatterIds: FormalMatterId[] = [];
    const service = new FormalMatterEvidenceReadService(dependencies({ observedMatterIds }));

    await service.getForMatter(principal(), formalMatterId);

    expect(observedMatterIds).toEqual([formalMatterId]);
  });

  it('returns successful empty components for a real Matter with no evidence yet', async () => {
    const service = new FormalMatterEvidenceReadService(dependencies({ noEvidence: true }));
    const projection = await service.getForMatter(principal(), formalMatterId);

    expect(projection.documentPackages).toMatchObject({ items: [], total: 0, returned: 0 });
    expect(projection.lifecycle.current).toBeNull();
    expect(projection.lifecycle.events).toEqual([]);
    expect(projection.intelligence).toMatchObject({ total: 0, items: [] });
  });

  it('fails closed for a missing or wrong-Workspace Matter', async () => {
    const missingService = new FormalMatterEvidenceReadService(
      dependencies({ missingMatter: true })
    );
    await expect(missingService.getForMatter(principal(), formalMatterId)).rejects.toMatchObject({
      code: 'FORMAL_MATTER_NOT_FOUND',
      status: 404
    });

    const wrongWorkspaceService = new FormalMatterEvidenceReadService(dependencies());
    await expect(
      wrongWorkspaceService.getForMatter(principal(otherWorkspaceId), formalMatterId)
    ).rejects.toMatchObject({ code: 'FORMAL_MATTER_NOT_FOUND', status: 404 });
  });

  it('requires all existing read permissions instead of treating denial as empty evidence', async () => {
    const service = new FormalMatterEvidenceReadService(dependencies());
    await expect(
      service.getForMatter(principal(workspaceId, false), formalMatterId)
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED', status: 403 });
  });

  it('preserves Document Package persistence failure instead of returning empty evidence', async () => {
    const service = new FormalMatterEvidenceReadService(
      dependencies({ documentPackageFailure: true })
    );
    await expect(service.getForMatter(principal(), formalMatterId)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503,
      retryable: true
    });
  });

  it('preserves Formal Matter persistence failure as retryable failure', async () => {
    const service = new FormalMatterEvidenceReadService(dependencies({ persistenceFailure: true }));
    await expect(service.getForMatter(principal(), formalMatterId)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
      status: 503,
      retryable: true
    });
  });
});
