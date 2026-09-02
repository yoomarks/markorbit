import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormalMatterEvidencePanel } from './FormalMatterEvidencePanel.js';
import type {
  FormalMatterEvidenceClient,
  FormalMatterEvidenceProjection
} from './api/formal-matter-evidence.js';

const baseProjection = {
  schemaVersion: 1,
  workspaceId: '11111111-1111-4111-8111-111111111111',
  formalMatter: {
    formalMatterId: 'formal-matter_one',
    kind: 'TRADEMARK_REGISTRATION',
    status: 'OPEN',
    version: 5,
    snapshotSchemaVersion: 1,
    snapshotSha256: 'a'.repeat(64),
    sourceCustomerConfirmationId: 'confirmation_one',
    sourceCustomerConfirmationVersion: 2,
    sourceMatterDraftId: 'matter-draft_one',
    sourceMatterDraftVersion: 3,
    sourceQuoteId: 'quote_one',
    sourceQuoteVersion: 'quote-v4',
    createdAt: '2026-09-01T02:00:00.000Z',
    updatedAt: '2026-09-01T03:00:00.000Z'
  },
  documentPackages: { items: [], returned: 0, total: 0, truncated: false, limit: 50 },
  lifecycle: {
    current: null,
    events: [],
    total: 0,
    truncated: false,
    limit: 100,
    officialStatusVerified: false
  },
  intelligence: {
    formalMatter: { id: 'formal-matter_one', version: 5, snapshotSha256: 'a'.repeat(64) },
    items: [],
    page: 1,
    pageSize: 10,
    total: 0,
    reviewHistoryLimit: 5,
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
  },
  semantics: {
    workspaceScoped: true,
    readOnly: true,
    recomputed: false,
    reviewedEvidenceIsOfficialTruth: false,
    providerReturnIsOfficialTruth: false,
    lifecycleProjectionIsOfficialStatus: false,
    matterIntelligenceIsOfficialTruth: false,
    preparationLockIncluded: false
  },
  authorityConsequences: {
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
  }
} as const satisfies FormalMatterEvidenceProjection;

afterEach(cleanup);

describe('FormalMatterEvidencePanel', () => {
  it('keeps empty durable evidence components distinct from read failure', async () => {
    const get = vi.fn(() => Promise.resolve(baseProjection));
    const client = { get } as FormalMatterEvidenceClient;
    render(<FormalMatterEvidencePanel formalMatterId="formal-matter_one" client={client} />);

    expect(await screen.findByText(/No durable Document Packages are recorded/)).toBeTruthy();
    expect(screen.getByText(/No durable Lifecycle Projection is recorded/)).toBeTruthy();
    expect(screen.getByText(/Evidence Projection ≠ Official Truth/)).toBeTruthy();
    expect(get).toHaveBeenCalledWith('formal-matter_one');
  });

  it('renders stale package and lifecycle lineage without promoting either to Official Truth', async () => {
    const projection = {
      ...baseProjection,
      documentPackages: {
        items: [
          {
            documentPackageId: 'package_one',
            status: 'READY',
            version: 4,
            schemaVersion: 1,
            sourceFormalMatterVersion: 4,
            sourceFormalMatterSha256: 'b'.repeat(64),
            matterSourceCurrent: false,
            professionalReviewCaseId: 'review_case_one',
            sourceReviewVersion: 2,
            sourceCompletedDecisionId: 'decision_one',
            sourceCompletedDecisionSha256: 'c'.repeat(64),
            canonicalEvidenceSha256: 'd'.repeat(64),
            documentEvidence: [
              {
                documentItemId: 'document_one',
                requirementKey: 'specimen',
                documentType: 'SPECIMEN',
                displayName: 'Use specimen',
                evidenceType: 'FILE',
                evidenceSha256: 'e'.repeat(64),
                verificationStatus: 'REVIEWED',
                createdAt: '2026-09-01T02:10:00.000Z',
                updatedAt: '2026-09-01T02:20:00.000Z'
              }
            ],
            documentEvidenceTotal: 1,
            documentEvidenceTruncated: false,
            createdAt: '2026-09-01T02:05:00.000Z',
            updatedAt: '2026-09-01T02:30:00.000Z',
            readyAt: '2026-09-01T02:30:00.000Z'
          }
        ],
        returned: 1,
        total: 1,
        truncated: false,
        limit: 50
      },
      lifecycle: {
        current: {
          lifecycleViewId: 'lifecycle_one',
          version: 2,
          formalMatter: { id: 'formal-matter_one', version: 4 },
          matterSourceCurrent: false,
          currentEvent: {},
          currentEventFingerprintSha256: 'f'.repeat(64),
          state: 'EXAMINATION',
          customerSafeLabel: 'Under examination',
          customerSafeSummary: 'Internal lifecycle projection only.',
          lifecycleViewFingerprintSha256: '1'.repeat(64),
          officialStatusVerified: false,
          updatedAt: '2026-09-01T04:00:00.000Z'
        },
        events: [
          {
            lifecycleEventId: 'event_one',
            version: 1,
            formalMatter: { id: 'formal-matter_one', version: 4 },
            matterSourceCurrent: false,
            source: {},
            state: 'EXAMINATION',
            eventCode: 'EXAMINATION_PROJECTED',
            customerSafeLabel: 'Under examination',
            customerSafeSummary: 'Projected from governed internal evidence.',
            occurredAt: '2026-09-01T03:30:00.000Z',
            projectedAt: '2026-09-01T04:00:00.000Z',
            lifecycleEventFingerprintSha256: '2'.repeat(64),
            officialStatusVerified: false
          }
        ],
        total: 1,
        truncated: false,
        limit: 100,
        officialStatusVerified: false
      }
    } as const satisfies FormalMatterEvidenceProjection;
    const get = vi.fn(() => Promise.resolve(projection));
    render(<FormalMatterEvidencePanel formalMatterId="formal-matter_one" client={{ get }} />);

    expect(await screen.findByText('Historical Matter source')).toBeTruthy();
    expect(screen.getByText('Historical lifecycle source')).toBeTruthy();
    expect(screen.getAllByText('Under examination').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No').length).toBeGreaterThan(0);
    expect(screen.getByText(/not Official Status/)).toBeTruthy();
  });

  it('keeps dependency failure visibly different from successful empty evidence', async () => {
    const get = vi.fn(() => Promise.reject(new Error('downstream unavailable')));
    render(<FormalMatterEvidencePanel formalMatterId="formal-matter_one" client={{ get }} />);

    expect(await screen.findByText('Formal Matter evidence unavailable')).toBeTruthy();
    expect(screen.queryByText(/No durable Document Packages are recorded/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
