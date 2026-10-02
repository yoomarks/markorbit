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
    // A Workspace-wide TRADEMARK/ENTITY acceptance is not evidence of case membership.
    // The owning product must first accept an explicit binding to this exact case.
    return (
      binding.workspaceId === input.workspaceId &&
      binding.status === 'ACCEPTED' &&
      binding.targetKind === 'CASE' &&
      binding.targetId === input.caseId
    );
  });
  return {
    workspaceId: input.workspaceId,
    caseId: input.caseId,
    materializedAt: input.materializedAt,
    evidence
  };
}

export const WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_GRANT_PROTOCOL_VERSION = '1.0' as const;

export type WorkspacePrivateCaseEvidenceReferenceV1 = Readonly<{
  bindingId: string;
  bindingVersion: number;
  knowledgeWorkspaceId: string;
  readyPackageId: string;
  caseId: string;
  caseVersion: number;
  caseSnapshotSha256: string;
  sourceLocators: readonly string[];
  methodProvenanceRefs: readonly string[];
  status: 'ACCEPTED';
  acceptedAt: string;
  currentness: Readonly<{
    formalMatter: 'CURRENT';
    coreKnowledgeEvidence: 'CURRENT';
  }>;
  consequences: Readonly<{
    officialTruthCreated: false;
    filingAuthorized: false;
    externalActionAuthorized: false;
  }>;
}>;

export type WorkspacePrivateCaseEvidenceReferenceListV1 = Readonly<{
  protocolVersion: typeof WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_GRANT_PROTOCOL_VERSION;
  objectType: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_REFERENCE_LIST';
  workspaceId: string;
  caseId: string;
  caseVersion: number;
  caseSnapshotSha256: string;
  items: readonly WorkspacePrivateCaseEvidenceReferenceV1[];
  materializedAt: string;
}>;

export type WorkspacePrivateCaseEvidenceReadGrantV1 = Readonly<{
  protocolVersion: typeof WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_GRANT_PROTOCOL_VERSION;
  objectType: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_GRANT';
  bindingId: string;
  bindingVersion: number;
  workspaceId: string;
  userId: string;
  membershipId: string;
  knowledgeWorkspaceId: string;
  readyPackageId: string;
  readyPackageDigest: string;
  coreIntakeId: string;
  contentExportSha256: string;
  stagingDocumentId: string;
  stagingSha256: string;
  rawArtifactId: string;
  rawArtifactSha256: string;
  caseId: string;
  caseVersion: number;
  caseSnapshotSha256: string;
  sourceLocators: readonly string[];
  authoritySnapshot: Readonly<{
    workspaceVersion: number;
    userVersion: number;
    membershipVersion: number;
  }>;
  currentness: Readonly<{
    workspaceAuthority: 'CURRENT';
    formalMatter: 'CURRENT';
    coreKnowledgeEvidence: 'CURRENT';
    knowledgeRetrieval: 'MUST_VERIFY';
  }>;
  consequences: Readonly<{
    officialTruthCreated: false;
    filingAuthorized: false;
    externalActionAuthorized: false;
  }>;
  verifiedAt: string;
  expiresAt: string;
}>;

export type WorkspacePrivateCaseEvidenceReadResultV1 = Readonly<{
  protocolVersion: typeof WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_GRANT_PROTOCOL_VERSION;
  objectType: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_RESULT';
  binding: Readonly<{
    bindingId: string;
    bindingVersion: number;
    caseId: string;
    caseVersion: number;
    caseSnapshotSha256: string;
  }>;
  authority: Readonly<{
    coreWorkspaceId: string;
    knowledgeWorkspaceId: string;
    userId: string;
    membershipId: string;
    verifiedAt: string;
    expiresAt: string;
  }>;
  lineage: Readonly<{
    readyPackageId: string;
    readyPackageDigest: string;
    coreIntakeId: string;
    contentExportSha256: string;
    rawArtifactId: string;
    rawArtifactSha256: string;
  }>;
  document: Readonly<{
    documentId: string;
    artifactVersion: number;
    stagingDocumentId: string;
    canonicalSha256: string;
    stagingSha256: string;
    documentSha256: string;
    indexedAt: string;
  }>;
  currentness: Readonly<{
    workspaceAuthority: 'CURRENT';
    formalMatter: 'CURRENT';
    coreKnowledgeEvidence: 'CURRENT';
    knowledgeRetrieval: 'CURRENT';
    documentVersion: 'CURRENT';
  }>;
  locatorSemantics: Readonly<{
    basis: 'RETRIEVAL_CHUNK';
    pageNumbers: 'UNAVAILABLE';
    textOffsets: 'UNAVAILABLE';
  }>;
  chunks: readonly Readonly<{
    locator: string;
    chunkId: string;
    ordinal: number;
    headingPath: readonly string[];
    text: string;
    contentSha256: string;
    contentKind: 'CANONICAL_MARKDOWN_CHUNK';
    pageNumber: null;
    textStartOffset: null;
    textEndOffset: null;
  }>[];
  consequences: Readonly<{
    officialTruthCreated: false;
    filingAuthorized: false;
    externalActionAuthorized: false;
  }>;
}>;

const canonicalUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
const sha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const positiveVersion = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const rfc3339 = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const noAuthorityConsequences = (value: unknown): boolean =>
  record(value) &&
  value.officialTruthCreated === false &&
  value.filingAuthorized === false &&
  value.externalActionAuthorized === false;

function validReference(value: unknown): value is WorkspacePrivateCaseEvidenceReferenceV1 {
  if (!record(value) || !record(value.currentness)) return false;
  return (
    canonicalUuid(value.bindingId) &&
    positiveVersion(value.bindingVersion) &&
    nonEmpty(value.knowledgeWorkspaceId) &&
    nonEmpty(value.readyPackageId) &&
    nonEmpty(value.caseId) &&
    positiveVersion(value.caseVersion) &&
    sha256(value.caseSnapshotSha256) &&
    Array.isArray(value.sourceLocators) &&
    value.sourceLocators.length > 0 &&
    value.sourceLocators.every(nonEmpty) &&
    Array.isArray(value.methodProvenanceRefs) &&
    value.methodProvenanceRefs.every(nonEmpty) &&
    value.status === 'ACCEPTED' &&
    rfc3339(value.acceptedAt) &&
    value.currentness.formalMatter === 'CURRENT' &&
    value.currentness.coreKnowledgeEvidence === 'CURRENT' &&
    noAuthorityConsequences(value.consequences)
  );
}

export function assertWorkspacePrivateCaseEvidenceReferenceListV1(
  value: unknown
): asserts value is WorkspacePrivateCaseEvidenceReferenceListV1 {
  if (
    !record(value) ||
    value.protocolVersion !== WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_GRANT_PROTOCOL_VERSION ||
    value.objectType !== 'WORKSPACE_PRIVATE_CASE_EVIDENCE_REFERENCE_LIST' ||
    !canonicalUuid(value.workspaceId) ||
    !nonEmpty(value.caseId) ||
    !positiveVersion(value.caseVersion) ||
    !sha256(value.caseSnapshotSha256) ||
    !Array.isArray(value.items) ||
    !value.items.every(validReference) ||
    !value.items.every(
      (item) =>
        item.caseId === value.caseId &&
        item.caseVersion === value.caseVersion &&
        item.caseSnapshotSha256 === value.caseSnapshotSha256
    ) ||
    !rfc3339(value.materializedAt)
  )
    throw new TypeError('Workspace private Case evidence reference list is invalid.');
}

export function assertWorkspacePrivateCaseEvidenceReadResultV1(
  value: unknown
): asserts value is WorkspacePrivateCaseEvidenceReadResultV1 {
  if (!record(value))
    throw new TypeError('Workspace private Case evidence read result is invalid.');
  const binding = value.binding;
  const authority = value.authority;
  const lineage = value.lineage;
  const document = value.document;
  const currentness = value.currentness;
  const locatorSemantics = value.locatorSemantics;
  const chunks = value.chunks;
  if (
    value.protocolVersion !== WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_GRANT_PROTOCOL_VERSION ||
    value.objectType !== 'WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_RESULT' ||
    !record(binding) ||
    !canonicalUuid(binding.bindingId) ||
    !positiveVersion(binding.bindingVersion) ||
    !nonEmpty(binding.caseId) ||
    !positiveVersion(binding.caseVersion) ||
    !sha256(binding.caseSnapshotSha256) ||
    !record(authority) ||
    !canonicalUuid(authority.coreWorkspaceId) ||
    !nonEmpty(authority.knowledgeWorkspaceId) ||
    !canonicalUuid(authority.userId) ||
    !canonicalUuid(authority.membershipId) ||
    !rfc3339(authority.verifiedAt) ||
    !rfc3339(authority.expiresAt) ||
    Date.parse(authority.expiresAt) <= Date.parse(authority.verifiedAt) ||
    !record(lineage) ||
    !nonEmpty(lineage.readyPackageId) ||
    !sha256(lineage.readyPackageDigest) ||
    !nonEmpty(lineage.coreIntakeId) ||
    !sha256(lineage.contentExportSha256) ||
    !nonEmpty(lineage.rawArtifactId) ||
    !sha256(lineage.rawArtifactSha256) ||
    !record(document) ||
    !nonEmpty(document.documentId) ||
    !positiveVersion(document.artifactVersion) ||
    !nonEmpty(document.stagingDocumentId) ||
    !sha256(document.canonicalSha256) ||
    !sha256(document.stagingSha256) ||
    !sha256(document.documentSha256) ||
    !rfc3339(document.indexedAt) ||
    !record(currentness) ||
    currentness.workspaceAuthority !== 'CURRENT' ||
    currentness.formalMatter !== 'CURRENT' ||
    currentness.coreKnowledgeEvidence !== 'CURRENT' ||
    currentness.knowledgeRetrieval !== 'CURRENT' ||
    currentness.documentVersion !== 'CURRENT' ||
    !record(locatorSemantics) ||
    locatorSemantics.basis !== 'RETRIEVAL_CHUNK' ||
    locatorSemantics.pageNumbers !== 'UNAVAILABLE' ||
    locatorSemantics.textOffsets !== 'UNAVAILABLE' ||
    !Array.isArray(chunks) ||
    chunks.length === 0 ||
    !chunks.every(
      (chunk) =>
        record(chunk) &&
        nonEmpty(chunk.locator) &&
        nonEmpty(chunk.chunkId) &&
        Number.isSafeInteger(chunk.ordinal) &&
        Number(chunk.ordinal) >= 0 &&
        Array.isArray(chunk.headingPath) &&
        chunk.headingPath.every(nonEmpty) &&
        nonEmpty(chunk.text) &&
        sha256(chunk.contentSha256) &&
        chunk.contentKind === 'CANONICAL_MARKDOWN_CHUNK' &&
        chunk.pageNumber === null &&
        chunk.textStartOffset === null &&
        chunk.textEndOffset === null
    ) ||
    !noAuthorityConsequences(value.consequences)
  )
    throw new TypeError('Workspace private Case evidence read result is invalid.');
}

export function assertWorkspacePrivateCaseEvidenceReadGrantV1(
  value: unknown
): asserts value is WorkspacePrivateCaseEvidenceReadGrantV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Invalid WorkspacePrivateCaseEvidenceReadGrantV1');
  const item = value as Record<string, unknown>;
  const authority = item.authoritySnapshot as Record<string, unknown> | undefined;
  const currentness = item.currentness as Record<string, unknown> | undefined;
  const consequences = item.consequences as Record<string, unknown> | undefined;
  if (
    item.protocolVersion !== WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_GRANT_PROTOCOL_VERSION ||
    item.objectType !== 'WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_GRANT' ||
    !canonicalUuid(item.bindingId) ||
    !positiveVersion(item.bindingVersion) ||
    !canonicalUuid(item.workspaceId) ||
    !canonicalUuid(item.userId) ||
    !canonicalUuid(item.membershipId) ||
    !nonEmpty(item.knowledgeWorkspaceId) ||
    !nonEmpty(item.readyPackageId) ||
    !sha256(item.readyPackageDigest) ||
    !nonEmpty(item.coreIntakeId) ||
    !sha256(item.contentExportSha256) ||
    !nonEmpty(item.stagingDocumentId) ||
    !sha256(item.stagingSha256) ||
    !nonEmpty(item.rawArtifactId) ||
    !sha256(item.rawArtifactSha256) ||
    !nonEmpty(item.caseId) ||
    !positiveVersion(item.caseVersion) ||
    !sha256(item.caseSnapshotSha256) ||
    !Array.isArray(item.sourceLocators) ||
    !item.sourceLocators.every(nonEmpty) ||
    !authority ||
    !positiveVersion(authority.workspaceVersion) ||
    !positiveVersion(authority.userVersion) ||
    !positiveVersion(authority.membershipVersion) ||
    !currentness ||
    currentness.workspaceAuthority !== 'CURRENT' ||
    currentness.formalMatter !== 'CURRENT' ||
    currentness.coreKnowledgeEvidence !== 'CURRENT' ||
    currentness.knowledgeRetrieval !== 'MUST_VERIFY' ||
    !consequences ||
    consequences.officialTruthCreated !== false ||
    consequences.filingAuthorized !== false ||
    consequences.externalActionAuthorized !== false ||
    !rfc3339(item.verifiedAt) ||
    !rfc3339(item.expiresAt) ||
    Date.parse(item.expiresAt) <= Date.parse(item.verifiedAt)
  )
    throw new TypeError('Workspace private Case evidence read grant is invalid.');
}
