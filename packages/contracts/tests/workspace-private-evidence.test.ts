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
  it('materializes accepted evidence by reference without copying content', () => {
    const binder = materializeCaseEvidenceBinderV1({
      workspaceId: 'workspace-a',
      caseId: 'case_1',
      bindings: [base, { ...base, bindingId: 'wpe_2', workspaceId: 'workspace-b' }],
      materializedAt: '2026-09-22T01:00:00Z'
    });
    expect(binder.evidence).toEqual([base]);
    expect(JSON.stringify(binder)).not.toContain('content');
  });
});
