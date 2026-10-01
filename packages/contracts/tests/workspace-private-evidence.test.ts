import { describe, expect, it } from 'vitest';
import {
  assertWorkspacePrivateDocumentBindingV1,
  materializeCaseEvidenceBinderV1,
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
