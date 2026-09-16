import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  APPLICANT_PORTFOLIO_TRADEMARK_CANDIDATE_TYPE,
  type DataEngineApplicantCandidateReferenceV1,
  type DataEngineDiscoveredTrademarkCandidateV1
} from '@markorbit/contracts/data-engine-applicant-discovery';
import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_SOURCE_OWNER
} from '@markorbit/contracts/data-engine';
import type {
  ProtectionMonitoringCandidateV1,
  ProtectionMonitoringDecisionV1
} from '@markorbit/contracts/protection-monitoring';
import {
  ProtectionMonitoringService,
  protectionMonitoringTextScoreBasisPointsV1,
  type ProtectionMonitoringError,
  type ProtectionMonitoringRepository,
  type ProtectionMonitoringOpportunityWriter
} from '../src/protection-monitoring.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_1',
  workspaceId,
  membershipId: 'membership_1',
  userId: 'user_1',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage'],
  sessionExpiresAt: '2026-09-18T00:00:00.000Z'
};
const source = {
  owner: DATA_ENGINE_SOURCE_OWNER,
  authority: DATA_ENGINE_FACT_AUTHORITY,
  jurisdiction: 'CN',
  source_kind: 'TRADEMARK_RECORD',
  source_id: 'row_1',
  source_version: 'v1',
  source_fingerprint_sha256: `sha256:${'a'.repeat(64)}`,
  observed_at: '2026-09-17T00:00:00.000Z'
} as const;
const applicant: DataEngineApplicantCandidateReferenceV1 = {
  applicant_candidate_id: 'applicant_1',
  source_reference: { ...source, source_kind: 'APPLICANT_IDENTITY', source_id: 'applicant-row' }
};
const trademark: DataEngineDiscoveredTrademarkCandidateV1 = {
  candidate_type: APPLICANT_PORTFOLIO_TRADEMARK_CANDIDATE_TYPE,
  trademark_candidate_id: 'tm_1',
  applicant,
  jurisdiction: 'CN',
  mark_text: 'Mark Orbit',
  application_number: 'CN1',
  registration_number: null,
  classes: [9, 42],
  source_reference: source,
  official_truth_verified: false,
  legal_conclusion_created: false,
  workspace_relationship_established: false
};
const asset = {
  schemaVersion: 1,
  trademarkAssetId: 'trademark-asset_1',
  workspaceId,
  version: 2,
  identity: { jurisdiction: 'CN', markText: 'MARKORBIT' },
  externalIdentifiers: [],
  workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: false }],
  sourceReferences: [],
  relations: [],
  workspaceTags: [],
  workspaceNotes: [],
  officialTruthVerifiedByLite: false,
  filingExecutedByLite: false,
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-17T00:00:00.000Z'
} as const;
const watch = {
  schemaVersion: 1,
  workspaceWatchTargetId: 'workspace-watch-target_1',
  workspaceId,
  version: 3,
  status: 'ACTIVE',
  purpose: 'ENFORCEMENT',
  target: { targetKind: 'APPLICANT', applicant },
  userConfirmed: true,
  createdByPrincipalId: 'user_1',
  authorityConsequences: {
    verifiedApplicantIdentityEstablished: false,
    customerRelationshipEstablished: false,
    trademarkAssetCreated: false,
    managedRelationshipEstablished: false,
    representedRelationshipEstablished: false,
    ownedRelationshipEstablished: false,
    automaticTrademarkAdmissionAuthorized: false,
    officialTruthCreated: false,
    legalConclusionCreated: false,
    protectedActionAuthorized: false,
    externalActionAuthorized: false
  },
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-17T00:00:00.000Z',
  archivedAt: null
} as const;

function repository(): ProtectionMonitoringRepository {
  let candidate: ProtectionMonitoringCandidateV1 | undefined;
  let decision: ProtectionMonitoringDecisionV1 | undefined;
  return {
    create(value) {
      candidate = value;
      return Promise.resolve(value);
    },
    get(_workspace, id) {
      return Promise.resolve(
        candidate?.protectionMonitoringCandidateId === id ? candidate : undefined
      );
    },
    decision() {
      return Promise.resolve(decision);
    },
    decide(value) {
      decision = value;
      return Promise.resolve(value);
    },
    attachActionCandidate(_workspace, _id, opportunity) {
      decision = { ...decision!, actionCandidate: opportunity };
      return Promise.resolve(decision);
    }
  };
}
function harness(mark = trademark) {
  const repo = repository();
  const createCandidateFromVerifiedSources: ProtectionMonitoringOpportunityWriter['createCandidateFromVerifiedSources'] =
    vi.fn(() =>
      Promise.resolve({ opportunityCandidateId: 'opportunity-candidate_1', version: 1 } as never)
    );
  const service = new ProtectionMonitoringService(
    { get: vi.fn(() => Promise.resolve(asset as never)) },
    { getLatest: vi.fn(() => Promise.resolve(watch as never)) },
    {
      readTrademark: vi.fn(() =>
        Promise.resolve({ fact_state: 'observed', payload: { results: [mark] } } as never)
      )
    },
    repo,
    { createCandidateFromVerifiedSources },
    () => '2026-09-17T01:00:00.000Z',
    {
      candidate: () => 'protection-monitoring-candidate_1',
      decision: () => 'protection-monitoring-decision_1'
    }
  );
  return { service, createCandidateFromVerifiedSources };
}

describe('Protection Monitoring V1', () => {
  it('admits exact Watch/Data Engine evidence, requires HUMAN ACTION, and prepares the existing service candidate', async () => {
    const { service, createCandidateFromVerifiedSources } = harness();
    const candidate = await service.admit({
      principal,
      asset: { id: asset.trademarkAssetId, version: 2 },
      watchTarget: { id: watch.workspaceWatchTargetId, version: 3 },
      applicant,
      trademark,
      idempotencyKey: 'admit-1'
    });
    expect(candidate.relevance.scoreBasisPoints).toBe(10_000);
    expect(candidate.authorityConsequences.infringementConcluded).toBe(false);
    const decision = await service.decide({
      principal,
      candidate: { id: candidate.protectionMonitoringCandidateId, version: 1 },
      expectedCandidateFingerprintSha256: candidate.candidateFingerprintSha256,
      disposition: 'ACTION',
      rationale: 'Professional review recommends offering a bounded assessment.',
      idempotencyKey: 'decision-1'
    });
    expect(decision.legalConclusionCreated).toBe(false);
    const routed = await service.prepareActionCandidate(
      principal,
      candidate.protectionMonitoringCandidateId,
      'action-1'
    );
    expect(routed.actionCandidate).toEqual({ id: 'opportunity-candidate_1', version: 1 });
    expect(createCandidateFromVerifiedSources).toHaveBeenCalledOnce();
    const routedCommand = vi.mocked(createCandidateFromVerifiedSources).mock.calls[0]![0];
    expect(routedCommand.workspaceId).toBe(workspaceId);
    expect(routedCommand.sources.map((source) => source.kind)).toEqual([
      'TRADEMARK_CONTEXT',
      'DATA_ENGINE_APPLICANT_DISCOVERY'
    ]);
  });

  it('does not admit a weak text match as a conflict conclusion', async () => {
    const weak = { ...trademark, mark_text: 'Completely Different' };
    const { service } = harness(weak);
    await expect(
      service.admit({
        principal,
        asset: { id: asset.trademarkAssetId, version: 2 },
        watchTarget: { id: watch.workspaceWatchTargetId, version: 3 },
        applicant,
        trademark: weak,
        idempotencyKey: 'weak'
      })
    ).rejects.toMatchObject({ code: 'NOT_RELEVANT' } satisfies Partial<ProtectionMonitoringError>);
  });

  it('uses a deterministic bounded text method', () => {
    expect(protectionMonitoringTextScoreBasisPointsV1('MARK ORBIT', 'mark-orbit')).toBe(10_000);
    expect(protectionMonitoringTextScoreBasisPointsV1('alpha', 'omega')).toBeLessThan(5_000);
  });
});
