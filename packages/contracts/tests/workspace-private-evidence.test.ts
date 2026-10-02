import { describe, expect, it } from 'vitest';
import {
  assertWorkspacePrivateCaseEvidenceReadGrantV1,
  assertWorkspacePrivateDocumentBindingV1,
  materializeCaseEvidenceBinderV1,
  type WorkspacePrivateCaseEvidenceReadGrantV1,
  type WorkspacePrivateDocumentBindingV1
} from '../src/workspace-private-evidence.js';

const base: WorkspacePrivateDocumentBindingV1 = {
  bindingId: 'wpe_1',
  workspaceId: 'workspace-a',
  knowledgeWorkspaceId: 'wsp_private',
  readyPackageId: 'rdp_1',
  canonicalDocumentId: 'cdd_1',
  artifactRefs: ['art_1'],
  targetKind: 'TRADEMARK',
  targetId: 'tm_1',
  status: 'ACCEPTED',
  confidence: 0.98,
  reviewRequired: false,
  provenanceClass: 'USER_CONFIRMED',
  sourceLocators: ['page:1'],
  methodProvenanceRefs: ['method:classifier@1'],
  acceptedAt: '2026-09-22T00:00:00Z'
};
describe('workspace private evidence', () => {
  it('rejects private evidence masquerading as global fact', () =>
    expect(() =>
      assertWorkspacePrivateDocumentBindingV1({ ...base, provenanceClass: 'DATA_ENGINE_FACT' })
    ).toThrow(/cannot claim/));
  it('requires review for suggested matches', () =>
    expect(() =>
      assertWorkspacePrivateDocumentBindingV1({
        ...base,
        status: 'SUGGESTED',
        reviewRequired: false,
        provenanceClass: 'INFERRED_CANDIDATE'
      })
    ).toThrow(/require review/));
  it('materializes only evidence explicitly accepted for the exact case by reference', () => {
    const caseEvidence: WorkspacePrivateDocumentBindingV1 = {
      ...base,
      bindingId: 'case-evidence',
      targetKind: 'CASE',
      targetId: 'case_1'
    };
    const binder = materializeCaseEvidenceBinderV1({
      workspaceId: 'workspace-a',
      caseId: 'case_1',
      bindings: [
        caseEvidence,
        base,
        { ...base, bindingId: 'entity-evidence', targetKind: 'ENTITY', targetId: 'entity_1' },
        { ...caseEvidence, bindingId: 'other-case', targetId: 'case_2' },
        { ...caseEvidence, bindingId: 'other-workspace', workspaceId: 'workspace-b' },
        { ...caseEvidence, bindingId: 'suggestion', status: 'SUGGESTED', reviewRequired: true },
        { ...caseEvidence, bindingId: 'rejected', status: 'REJECTED' }
      ],
      materializedAt: '2026-09-22T01:00:00Z'
    });
    expect(binder.evidence).toEqual([caseEvidence]);
    expect(JSON.stringify(binder)).not.toContain('content');
  });

  it('does not treat a Workspace-wide trademark or entity binding as proof of case membership', () => {
    const binder = materializeCaseEvidenceBinderV1({
      workspaceId: 'workspace-a',
      caseId: 'case_2',
      bindings: [
        base,
        { ...base, bindingId: 'wpe_entity', targetKind: 'ENTITY', targetId: 'entity_1' }
      ],
      materializedAt: '2026-09-22T01:00:00Z'
    });
    expect(binder.evidence).toEqual([]);
  });
});

const readGrant: WorkspacePrivateCaseEvidenceReadGrantV1 = {
  protocolVersion: '1.0',
  objectType: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_GRANT',
  bindingId: '018f0000-0000-7000-8000-000000001452',
  bindingVersion: 2,
  workspaceId: '018f0000-0000-7000-8000-000000001450',
  userId: '018f0000-0000-7000-8000-000000001451',
  membershipId: '018f0000-0000-7000-8000-000000001453',
  knowledgeWorkspaceId: 'wsp_01ARZ3NDEKTSV4RRFFQ69G5FAV',
  readyPackageId: 'rdp_01ARZ3NDEKTSV4RRFFQ69G5FAV',
  readyPackageDigest: '1'.repeat(64),
  coreIntakeId: '018f0000-0000-7000-8000-000000001454',
  contentExportSha256: '5'.repeat(64),
  stagingDocumentId: 'std_01ARZ3NDEKTSV4RRFFQ69G5FAV',
  stagingSha256: '2'.repeat(64),
  rawArtifactId: 'art_01ARZ3NDEKTSV4RRFFQ69G5FAV',
  rawArtifactSha256: '3'.repeat(64),
  caseId: 'formal-matter_oa-1452',
  caseVersion: 1,
  caseSnapshotSha256: '4'.repeat(64),
  sourceLocators: ['chunk:1'],
  authoritySnapshot: {
    workspaceVersion: 1,
    userVersion: 1,
    membershipVersion: 1
  },
  currentness: {
    workspaceAuthority: 'CURRENT',
    formalMatter: 'CURRENT',
    coreKnowledgeEvidence: 'CURRENT',
    knowledgeRetrieval: 'MUST_VERIFY'
  },
  consequences: {
    officialTruthCreated: false,
    filingAuthorized: false,
    externalActionAuthorized: false
  },
  verifiedAt: '2026-09-30T14:30:00.000Z',
  expiresAt: '2026-09-30T14:31:00.000Z'
};

describe('workspace private Case evidence read grant', () => {
  it('accepts only a bounded currentness proof that still requires Knowledge retrieval verification', () => {
    expect(() => assertWorkspacePrivateCaseEvidenceReadGrantV1(readGrant)).not.toThrow();
  });

  it('rejects forged content identity and grants that claim retrieval currentness without verification', () => {
    expect(() =>
      assertWorkspacePrivateCaseEvidenceReadGrantV1({
        ...readGrant,
        stagingSha256: 'not-a-sha'
      })
    ).toThrow(/invalid/u);
    expect(() =>
      assertWorkspacePrivateCaseEvidenceReadGrantV1({
        ...readGrant,
        currentness: { ...readGrant.currentness, knowledgeRetrieval: 'CURRENT' }
      })
    ).toThrow(/invalid/u);
    expect(() =>
      assertWorkspacePrivateCaseEvidenceReadGrantV1({
        ...readGrant,
        expiresAt: readGrant.verifiedAt
      })
    ).toThrow(/invalid/u);
  });
});
