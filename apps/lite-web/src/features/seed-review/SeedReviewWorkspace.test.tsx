// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  DataEngineApplicantCandidateV1,
  DataEngineDiscoveredTrademarkCandidateV1
} from '@markorbit/contracts/data-engine-applicant-discovery';
import type { LiteWorkItemV1 } from '@markorbit/contracts/lite-work-item';
import {
  noSeedWorkspacePackageAuthorityConsequencesV1,
  seedWorkspacePackageFingerprintSha256V1,
  type SeedWorkspacePackageV1
} from '@markorbit/contracts/seed-workspace-package';
import type { TrademarkAsset } from '@markorbit/contracts/trademark-asset-workspace';
import {
  noWorkspaceDirectoryAuthorityConsequencesV1,
  type WorkspaceDirectoryEntryV1
} from '@markorbit/contracts/workspace-directory';
import { describe, expect, it, vi } from 'vitest';
import type {
  CnSeedAgentRecord,
  CnSeedPortfolioRelationship,
  CnSeedRelationshipItem,
  SeedReviewApi
} from '../../api/seed-review.js';
import { SeedReviewWorkspace } from './SeedReviewWorkspace.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const packageId = 'seed-workspace-package_agency-first-value';
const observedAt = '2026-09-21T01:02:03.000Z';
const fingerprint = 'a'.repeat(64);

const exactAgentRef = {
  owner: 'DATA_ENGINE' as const,
  kind: 'CN_AGENT',
  id: 'A001',
  version: '42',
  fingerprintSha256: fingerprint,
  observedAt
};

function seedPackage(): SeedWorkspacePackageV1 {
  const base: Omit<SeedWorkspacePackageV1, 'packageFingerprintSha256'> = {
    schemaVersion: 1,
    seedWorkspacePackageId: packageId,
    version: 1,
    stage: 'PREPARED',
    preparedByWorkspaceId: '11111111-1111-4111-8111-111111111111',
    target: {
      kind: 'AGENCY',
      displayName: 'Example IP Agency',
      sourceRefs: [exactAgentRef]
    },
    collections: {
      representedApplicants: { ...exactAgentRef, kind: 'REPRESENTED_APPLICANTS', count: 4 },
      relatedTrademarks: { ...exactAgentRef, kind: 'RELATED_TRADEMARKS', count: 18 }
    },
    preparedAt: '2026-09-21T00:00:00.000Z',
    expiresAt: '2026-10-21T00:00:00.000Z',
    authorityConsequences: noSeedWorkspacePackageAuthorityConsequencesV1
  };
  return {
    ...base,
    packageFingerprintSha256: seedWorkspacePackageFingerprintSha256V1(base)
  };
}

const agent: CnSeedAgentRecord = {
  agent_code: 'A001',
  mention_id: '10000000-0000-0000-0000-000000000001',
  entity_id: '20000000-0000-0000-0000-000000000002',
  agent_name: 'Example IP Agency',
  agent_name_norm: 'example ip agency',
  source_file: 'agents.csv',
  source_first_line: 10,
  source_last_line: 10,
  source_package_id: '30000000-0000-0000-0000-000000000003',
  source_rank: 42,
  ingested_at: observedAt,
  source_reference: exactAgentRef,
  currentness: {
    state: 'CURRENT_SOURCE_FACT',
    source_rank: 42,
    observed_at: observedAt,
    is_deleted: false
  },
  legal_identity_verified: false,
  customer_relationship_established: false,
  professional_appointment_established: false
};

const agencyMark: CnSeedPortfolioRelationship = {
  entity_id: agent.entity_id!,
  role: 'AGENT',
  application_number: '12345678',
  relationship_states: ['CURRENT_AGENT'],
  mark_name_raw: 'ORBIT',
  classes: [9],
  first_observed_at: '2025-01-01T00:00:00.000Z',
  last_observed_at: observedAt
};

const owner: CnSeedRelationshipItem = {
  edge: {
    relationship_type: 'CURRENT_OWNER',
    temporal: { is_current: true },
    evidence: {},
    provenance: {}
  },
  source_fact: {
    role: 'OWNER',
    relation_key: 'b'.repeat(64),
    entity_id: '40000000-0000-0000-0000-000000000004',
    name: 'Orbit Brand Co., Ltd.',
    address: 'Beijing'
  }
};

const applicant: DataEngineApplicantCandidateV1 = {
  candidate_type: 'APPLICANT_IDENTITY',
  applicant_candidate_id: 'cn-applicant-orbit-brand',
  display_name: 'Orbit Brand Co., Ltd.',
  alternate_names: [],
  source_reference: {
    owner: 'MARKORBIT_DATA_ENGINE',
    authority: 'DATA_ENGINE_FACT_READ_MODEL',
    jurisdiction: 'CN',
    source_kind: 'APPLICANT_IDENTITY',
    source_id: 'cn-applicant-orbit-brand',
    source_version: 'cn-epoch-42',
    source_fingerprint_sha256: 'c'.repeat(64),
    observed_at: observedAt
  },
  match_kind: 'EXACT_NORMALIZED_NAME',
  review_required: true,
  verified_legal_identity: false,
  customer_relationship_established: false
};

const trademark: DataEngineDiscoveredTrademarkCandidateV1 = {
  candidate_type: 'DISCOVERED_TRADEMARK',
  trademark_candidate_id: 'cn-trademark-12345678',
  applicant: {
    applicant_candidate_id: applicant.applicant_candidate_id,
    source_reference: applicant.source_reference
  },
  jurisdiction: 'CN',
  mark_text: 'ORBIT',
  application_number: '12345678',
  registration_number: null,
  classes: [9],
  source_reference: {
    owner: 'MARKORBIT_DATA_ENGINE',
    authority: 'DATA_ENGINE_FACT_READ_MODEL',
    jurisdiction: 'CN',
    source_kind: 'TRADEMARK_RECORD',
    source_id: '12345678',
    source_version: 'cn-epoch-42',
    source_fingerprint_sha256: 'd'.repeat(64),
    observed_at: observedAt
  },
  official_truth_verified: false,
  legal_conclusion_created: false,
  workspace_relationship_established: false
};

const directory: WorkspaceDirectoryEntryV1 = {
  schemaVersion: 1,
  workspaceDirectoryEntryId: 'workspace-directory-entry_orbit-brand',
  workspaceId,
  version: 1,
  entryKind: 'ORGANIZATION',
  displayName: applicant.display_name,
  aliases: [],
  status: 'ACTIVE',
  roles: [],
  contactPoints: [],
  externalIdentityReferences: [
    {
      kind: 'APPLICANT_IDENTITY',
      sourceClass: 'DATA_ENGINE_CANDIDATE',
      referenceId: applicant.applicant_candidate_id,
      referenceVersion: applicant.source_reference.source_version,
      label: applicant.display_name,
      jurisdiction: 'CN',
      observedAt,
      verifiedLegalIdentityByDirectory: false,
      managedTrademarkRelationshipEstablishedByDirectory: false
    }
  ],
  provenance: {
    sourceKind: 'DATA_ENGINE',
    sourceReference: 'cn-applicant-orbit-brand@cn-epoch-42',
    capturedAt: observedAt
  },
  authorityConsequences: noWorkspaceDirectoryAuthorityConsequencesV1,
  createdAt: observedAt,
  updatedAt: observedAt,
  archivedAt: null
};

const asset: TrademarkAsset = {
  schemaVersion: 1,
  trademarkAssetId: 'trademark-asset_seed-orbit',
  workspaceId,
  version: 1,
  identity: { jurisdiction: 'CN', markText: 'ORBIT' },
  externalIdentifiers: [],
  workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: true }],
  sourceReferences: [],
  relations: [],
  workspaceTags: [],
  workspaceNotes: [],
  officialTruthVerifiedByLite: false,
  filingExecutedByLite: false,
  createdAt: observedAt,
  updatedAt: observedAt
};

const workItem: LiteWorkItemV1 = {
  schemaVersion: 1,
  liteWorkItemId: 'lite-work-item_seed-orbit',
  workspaceId,
  version: 1,
  taskType: 'GENERAL_FOLLOW_UP',
  title: 'Review ORBIT and decide the next professional action',
  priority: 'NOTICE',
  status: 'OPEN',
  source: {
    sourceClass: 'MANUAL',
    recordedByPrincipalId: 'user_seed',
    recordedAt: observedAt
  },
  relatedReferences: [],
  certifiedDeadlineReferences: [],
  observedDateCandidates: [],
  internalTiming: {
    timeClass: 'LITE_INTERNAL_OPERATIONAL',
    certifiedLegalDeadline: false
  },
  waitingSinceAt: null,
  completedAt: null,
  cancelledAt: null,
  archivedAt: null,
  archivedFrom: null,
  authorityConsequences: {
    legalDeadlineCertified: false,
    filingAuthorized: false,
    filingSubmitted: false,
    protectedActionAuthorized: false,
    providerAcceptanceCreated: false,
    providerWorkCompleted: false,
    paymentAuthorized: false,
    paymentExecuted: false,
    customerContactAuthorized: false,
    providerContactAuthorized: false,
    customerNotificationEstablished: false,
    providerResponseEstablished: false,
    externalMessageSent: false,
    ownerRecordMutated: false,
    officialTruthCreated: false,
    workCompletionRepresentsExternalSuccess: false
  },
  createdAt: observedAt,
  updatedAt: observedAt
};

function api() {
  const mocks = {
    loadPackage: vi.fn().mockResolvedValue(seedPackage()),
    loadCnAgent: vi.fn().mockResolvedValue(agent),
    loadCnAgentPortfolio: vi.fn().mockResolvedValue([agencyMark]),
    loadCnRelationships: vi.fn().mockResolvedValue([owner]),
    discoverApplicants: vi.fn().mockResolvedValue([applicant]),
    createDirectory: vi.fn().mockResolvedValue(directory),
    loadApplicantPortfolio: vi.fn().mockResolvedValue([trademark]),
    admitManagedTrademark: vi.fn().mockResolvedValue(asset),
    createFirstWorkItem: vi.fn().mockResolvedValue(workItem),
    recordFirstValue: vi.fn().mockResolvedValue({ journey: { stage: 'FIRST_VALUE_RECORDED' } })
  };
  const client: SeedReviewApi = { ...mocks };
  return { client, mocks };
}

describe('SeedReviewWorkspace', () => {
  it('requires explicit human review before Directory, MANAGED asset and first-value mutations', async () => {
    const user = userEvent.setup();
    const { client, mocks } = api();

    render(<SeedReviewWorkspace workspaceId={workspaceId} packageId={packageId} api={client} />);

    expect(await screen.findByText('Current source match:')).toBeTruthy();
    expect(mocks.loadCnAgent).toHaveBeenCalledWith('A001');
    expect(mocks.createDirectory).not.toHaveBeenCalled();
    expect(mocks.admitManagedTrademark).not.toHaveBeenCalled();
    expect(mocks.createFirstWorkItem).not.toHaveBeenCalled();
    expect(mocks.recordFirstValue).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Review the current owner' }));
    expect(await screen.findByText('Orbit Brand Co., Ltd.')).toBeTruthy();
    expect(mocks.createDirectory).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Find applicant records for this owner' }));
    expect(
      await screen.findByRole('button', { name: 'Use this applicant record in my Workspace' })
    ).toBeTruthy();
    expect(mocks.createDirectory).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: 'Use this applicant record in my Workspace' })
    );
    expect(
      await screen.findByRole('button', { name: 'Manage this trademark and start review' })
    ).toBeTruthy();
    expect(mocks.createDirectory).toHaveBeenCalledWith(packageId, applicant);
    expect(mocks.admitManagedTrademark).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: 'Manage this trademark and start review' })
    );

    expect(await screen.findByText('Your first real work item is ready')).toBeTruthy();
    expect(mocks.admitManagedTrademark).toHaveBeenCalledTimes(1);
    expect(mocks.createFirstWorkItem).toHaveBeenCalledTimes(1);
    expect(mocks.recordFirstValue).toHaveBeenCalledWith(packageId, workItem.liteWorkItemId);

    const manageOrder = mocks.admitManagedTrademark.mock.invocationCallOrder[0]!;
    const workOrder = mocks.createFirstWorkItem.mock.invocationCallOrder[0]!;
    const firstValueOrder = mocks.recordFirstValue.mock.invocationCallOrder[0]!;
    expect(manageOrder).toBeLessThan(workOrder);
    expect(workOrder).toBeLessThan(firstValueOrder);
  });

  it('fails closed when the prepared CN agent exact reference is stale', async () => {
    const { client, mocks } = api();
    mocks.loadCnAgent.mockResolvedValue({
      ...agent,
      source_reference: { ...exactAgentRef, version: '43' }
    });

    render(<SeedReviewWorkspace workspaceId={workspaceId} packageId={packageId} api={client} />);

    expect(
      await screen.findByText(
        'The prepared CN agent source record has changed since this invitation was prepared. MO stopped before using stale agency context.'
      )
    ).toBeTruthy();
    expect(mocks.loadCnAgentPortfolio).not.toHaveBeenCalled();
    expect(mocks.createDirectory).not.toHaveBeenCalled();
  });
});
