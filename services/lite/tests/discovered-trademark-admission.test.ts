import { describe, expect, it, vi } from 'vitest';
import {
  APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND,
  APPLICANT_PORTFOLIO_TRADEMARK_CANDIDATE_TYPE,
  noApplicantDiscoveryAuthorityConsequencesV1,
  type ApplicantPortfolioEnvelopeV1,
  type DataEngineApplicantCandidateReferenceV1,
  type DataEngineDiscoveredTrademarkCandidateV1
} from '@markorbit/contracts/data-engine-applicant-discovery';
import { DATA_ENGINE_DISCOVERY_CONTRACT_VERSION } from '@markorbit/contracts/data-engine-discovery';
import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER
} from '@markorbit/contracts/data-engine';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { DiscoveredTrademarkAdmissionService } from '../src/discovered-trademark-admission.js';
import type {
  DiscoveredTrademarkAdmissionError,
  ExactDiscoveredTrademarkReader
} from '../src/discovered-trademark-admission.js';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const SHA = `sha256:${'a'.repeat(64)}`;
const OBSERVED_AT = '2026-09-15T01:00:00.000Z';

const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session-1',
  userId: 'user-1',
  workspaceId: WORKSPACE_ID,
  membershipId: 'membership-1',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage'],
  sessionExpiresAt: '2026-09-16T00:00:00.000Z'
};

const applicant: DataEngineApplicantCandidateReferenceV1 = {
  applicant_candidate_id: 'applicant-1',
  source_reference: {
    owner: DATA_ENGINE_SOURCE_OWNER,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    jurisdiction: 'US',
    source_kind: 'APPLICANT_IDENTITY',
    source_id: 'applicant-source-1',
    source_version: 'M1.9-test',
    source_fingerprint_sha256: SHA,
    observed_at: OBSERVED_AT
  }
};

const trademark: DataEngineDiscoveredTrademarkCandidateV1 = {
  candidate_type: APPLICANT_PORTFOLIO_TRADEMARK_CANDIDATE_TYPE,
  trademark_candidate_id: 'trademark-1',
  applicant,
  jurisdiction: 'US',
  mark_text: 'ACME',
  application_number: '99123456',
  registration_number: null,
  classes: [9],
  source_reference: {
    owner: DATA_ENGINE_SOURCE_OWNER,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    jurisdiction: 'US',
    source_kind: 'TRADEMARK_RECORD',
    source_id: 'trademark-source-1',
    source_version: 'M1.9-test',
    source_fingerprint_sha256: SHA,
    observed_at: OBSERVED_AT
  },
  official_truth_verified: false,
  legal_conclusion_created: false,
  workspace_relationship_established: false
};

function envelope(
  candidate: DataEngineDiscoveredTrademarkCandidateV1 = trademark
): ApplicantPortfolioEnvelopeV1 {
  const query = {
    contract_version: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
    request_context: { requester_workspace_id: WORKSPACE_ID, request_id: 'admission-1' },
    applicant,
    ordering: ['trademark_candidate_id ASC'] as const,
    ranking_authority: 'NONE' as const,
    limits: { page_size: 1, max_results: 500 as const },
    query_hash: SHA
  };
  const sourceSnapshot = { source_version: 'M1.9-test', observed_at: OBSERVED_AT };
  return {
    contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    engine_version: 'M1.9-engine',
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    jurisdiction: 'US',
    resource_kind: APPLICANT_PORTFOLIO_DISCOVERY_RESOURCE_KIND,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    legal_conclusion: false,
    fact_state: 'observed',
    payload: {
      query,
      source_snapshot: sourceSnapshot,
      results: [candidate],
      next_cursor: null,
      provenance: {
        query_hash: SHA,
        request_context: query.request_context,
        source_snapshot: sourceSnapshot,
        engine_version: 'M1.9-engine',
        result_count: 1,
        has_more: false,
        query
      },
      authority_consequences: noApplicantDiscoveryAuthorityConsequencesV1
    }
  };
}

function harness(ownerEnvelope: ApplicantPortfolioEnvelopeV1 = envelope()) {
  const entry = {
    workspaceId: WORKSPACE_ID,
    status: 'ACTIVE',
    externalIdentityReferences: [
      {
        kind: 'APPLICANT_IDENTITY',
        sourceClass: 'DATA_ENGINE_CANDIDATE',
        referenceId: applicant.applicant_candidate_id,
        referenceVersion: applicant.source_reference.source_version,
        jurisdiction: 'US',
        observedAt: OBSERVED_AT
      }
    ]
  };
  const getExact = vi.fn(() => Promise.resolve(entry as never));
  const readTrademark = vi.fn<ExactDiscoveredTrademarkReader['readTrademark']>(() =>
    Promise.resolve(ownerEnvelope)
  );
  const admitted = new Map<string, unknown>();
  const admit = vi.fn((command: { idempotencyKey: string }) => {
    if (!admitted.has(command.idempotencyKey)) admitted.set(command.idempotencyKey, command);
    return Promise.resolve(admitted.get(command.idempotencyKey) as never);
  });
  const service = new DiscoveredTrademarkAdmissionService(
    { getExact },
    { readTrademark },
    { admit },
    () => '2026-09-15T02:00:00.000Z'
  );
  return { service, getExact, readTrademark, admit };
}

function command() {
  return {
    principal,
    directory: {
      workspaceDirectoryEntryId: 'workspace-directory-entry_client-1' as const,
      version: 2
    },
    applicant,
    trademark,
    decision: 'MANAGED' as const,
    idempotencyKey: 'admission-1'
  };
}

describe('Discovered Trademark explicit MANAGED admission', () => {
  it('re-reads one exact owner candidate and admits only a MANAGED asset with exact lineage', async () => {
    const { service, getExact, readTrademark, admit } = harness();

    await service.admit(command());

    expect(getExact).toHaveBeenCalledWith(WORKSPACE_ID, 'workspace-directory-entry_client-1', 2);
    const ownerRequest = readTrademark.mock.calls[0]![0];
    expect(ownerRequest.requestContext.requester_workspace_id).toBe(WORKSPACE_ID);
    expect(ownerRequest.requestContext.request_id).toMatch(/^admission-[0-9a-f]{64}$/);
    expect(ownerRequest.applicant).toEqual(applicant);
    expect(admit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        workspaceRelationships: [expect.objectContaining({ kind: 'MANAGED' })],
        externalIdentifiers: [
          expect.objectContaining({
            kind: 'APPLICATION_NUMBER',
            value: '99123456',
            officialTruthVerifiedByLite: false
          })
        ]
      })
    );
    const assetInput = admit.mock.calls[0]![0] as never as {
      workspaceRelationships: Array<{ kind: string }>;
      sourceReferences: Array<{ owner: string; sourceFingerprintSha256: string }>;
    };
    expect(assetInput.workspaceRelationships.map(({ kind }) => kind)).toEqual(['MANAGED']);
    expect(assetInput.sourceReferences.map(({ owner }) => owner).sort()).toEqual([
      'DATA_ENGINE',
      'WORKSPACE_USER'
    ]);
    expect(assetInput.sourceReferences[0]?.sourceFingerprintSha256).not.toContain('sha256:');
  });

  it('uses the Asset owner idempotency boundary for exact replay', async () => {
    const { service, admit } = harness();
    const first = await service.admit(command());
    const replay = await service.admit(command());

    expect(replay).toBe(first);
    expect(admit).toHaveBeenCalledTimes(2);
    expect(admit.mock.calls.every(([input]) => input.idempotencyKey === 'admission-1')).toBe(true);
  });

  it('fails closed before owner read when the Directory applicant binding is ambiguous or mismatched', async () => {
    const { service, readTrademark } = harness();
    const mismatched = command();
    mismatched.applicant = {
      ...applicant,
      applicant_candidate_id: 'another-applicant'
    };

    await expect(service.admit(mismatched)).rejects.toMatchObject({
      code: 'DIRECTORY_REFERENCE_MISMATCH'
    } satisfies Partial<DiscoveredTrademarkAdmissionError>);
    expect(readTrademark).not.toHaveBeenCalled();
  });

  it('does not mutate an Asset when the exact owner read reports stale or missing data', async () => {
    const unavailable = { ...envelope(), fact_state: 'not_found' as const, payload: null };
    const { service, admit } = harness(unavailable);

    await expect(service.admit(command())).rejects.toMatchObject({
      code: 'OWNER_READ_NOT_CURRENT'
    } satisfies Partial<DiscoveredTrademarkAdmissionError>);
    expect(admit).not.toHaveBeenCalled();
  });

  it('requires the trusted principal to hold matter:manage', async () => {
    const { service, getExact } = harness();
    const forbidden = command();
    forbidden.principal = { ...principal, permissions: ['workspace:read'] };

    await expect(service.admit(forbidden)).rejects.toMatchObject({
      code: 'PERMISSION_DENIED'
    } satisfies Partial<DiscoveredTrademarkAdmissionError>);
    expect(getExact).not.toHaveBeenCalled();
  });
});
