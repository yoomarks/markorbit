export const WORKSPACE_EVIDENCE_PROVENANCE_CLASSES = [
  'DATA_ENGINE_FACT',
  'WORKSPACE_EVIDENCE',
  'INFERRED_CANDIDATE',
  'USER_CONFIRMED'
] as const;
export type WorkspaceEvidenceProvenanceClass =
  (typeof WORKSPACE_EVIDENCE_PROVENANCE_CLASSES)[number];
export type WorkspacePrivateDocumentBindingV1 = Readonly<{
  bindingId: string;
  workspaceId: string;
  knowledgeWorkspaceId: string;
  readyPackageId: string;
  canonicalDocumentId: string;
  artifactRefs: readonly string[];
  targetKind: 'TRADEMARK' | 'CASE' | 'ENTITY';
  targetId: string;
  status: 'SUGGESTED' | 'ACCEPTED' | 'REJECTED';
  confidence: number;
  reviewRequired: boolean;
  provenanceClass: WorkspaceEvidenceProvenanceClass;
  sourceLocators: readonly string[];
  methodProvenanceRefs: readonly string[];
  acceptedAt?: string;
}>;
export type CaseEvidenceBinderV1 = Readonly<{
  workspaceId: string;
  caseId: string;
  materializedAt: string;
  evidence: readonly WorkspacePrivateDocumentBindingV1[];
}>;
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
export function assertWorkspacePrivateDocumentBindingV1(
  v: unknown
): asserts v is WorkspacePrivateDocumentBindingV1 {
  if (!v || typeof v !== 'object') throw new TypeError('Invalid WorkspacePrivateDocumentBindingV1');
  const x = v as Record<string, unknown>;
  if (
    !nonEmpty(x.bindingId) ||
    !nonEmpty(x.workspaceId) ||
    !nonEmpty(x.knowledgeWorkspaceId) ||
    !nonEmpty(x.readyPackageId) ||
    !nonEmpty(x.canonicalDocumentId) ||
    !nonEmpty(x.targetId)
  )
    throw new TypeError('Workspace evidence identity is required.');
  if (
    !['TRADEMARK', 'CASE', 'ENTITY'].includes(String(x.targetKind)) ||
    !['SUGGESTED', 'ACCEPTED', 'REJECTED'].includes(String(x.status))
  )
    throw new TypeError('Workspace evidence binding state is invalid.');
  if (
    typeof x.confidence !== 'number' ||
    x.confidence < 0 ||
    x.confidence > 1 ||
    typeof x.reviewRequired !== 'boolean'
  )
    throw new TypeError('Workspace evidence confidence/review state is invalid.');
  if (
    !WORKSPACE_EVIDENCE_PROVENANCE_CLASSES.includes(
      x.provenanceClass as WorkspaceEvidenceProvenanceClass
    )
  )
    throw new TypeError('Workspace evidence provenance is invalid.');
  if (
    !Array.isArray(x.artifactRefs) ||
    !Array.isArray(x.sourceLocators) ||
    !Array.isArray(x.methodProvenanceRefs)
  )
    throw new TypeError('Workspace evidence provenance references are required.');
  if (x.status === 'SUGGESTED' && !x.reviewRequired)
    throw new TypeError('Suggested evidence bindings require review.');
  if (x.provenanceClass === 'DATA_ENGINE_FACT')
    throw new TypeError('Private document bindings cannot claim DATA_ENGINE_FACT provenance.');
}
export function materializeCaseEvidenceBinderV1(input: {
  workspaceId: string;
  caseId: string;
  bindings: readonly WorkspacePrivateDocumentBindingV1[];
  materializedAt: string;
}): CaseEvidenceBinderV1 {
  const evidence = input.bindings.filter((binding) => {
    assertWorkspacePrivateDocumentBindingV1(binding);
    return (
      binding.workspaceId === input.workspaceId &&
      binding.status === 'ACCEPTED' &&
      (binding.targetKind !== 'CASE' || binding.targetId === input.caseId)
    );
  });
  return {
    workspaceId: input.workspaceId,
    caseId: input.caseId,
    materializedAt: input.materializedAt,
    evidence
  };
}
