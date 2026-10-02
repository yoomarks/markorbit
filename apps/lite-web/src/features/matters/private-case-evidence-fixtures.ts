import type { FormalMatter } from '@markorbit/contracts';
import type {
  WorkspacePrivateCaseEvidenceReadResultV1,
  WorkspacePrivateCaseEvidenceReferenceListV1
} from '@markorbit/contracts/workspace-private-evidence';
import type { MatterWorkspaceClient } from '../../api/matters.js';

const sha = (digit: string) => digit.repeat(64);

export const privateEvidenceMatter = {
  formalMatterId: 'formal-matter_fixture-private-1452',
  workspaceId: '018f0000-0000-7000-8000-000000001450'
} as unknown as FormalMatter;

export const privateEvidenceReferences: WorkspacePrivateCaseEvidenceReferenceListV1 = {
  protocolVersion: '1.0',
  objectType: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_REFERENCE_LIST',
  workspaceId: privateEvidenceMatter.workspaceId,
  caseId: privateEvidenceMatter.formalMatterId,
  caseVersion: 3,
  caseSnapshotSha256: sha('1'),
  materializedAt: '2026-10-03T08:30:00.000Z',
  items: [
    {
      bindingId: '018f0000-0000-7000-8000-000000001452',
      bindingVersion: 2,
      knowledgeWorkspaceId: 'wsp_fixture_private_1452',
      readyPackageId: 'rdp_fixture_private_1452',
      caseId: privateEvidenceMatter.formalMatterId,
      caseVersion: 3,
      caseSnapshotSha256: sha('1'),
      sourceLocators: ['chunk:office-action:refusal-basis'],
      methodProvenanceRefs: ['method://oa/exact-private-read-v1'],
      status: 'ACCEPTED',
      acceptedAt: '2026-10-03T08:20:00.000Z',
      currentness: { formalMatter: 'CURRENT', coreKnowledgeEvidence: 'CURRENT' },
      consequences: {
        officialTruthCreated: false,
        filingAuthorized: false,
        externalActionAuthorized: false
      }
    }
  ]
};

export const privateEvidenceRead: WorkspacePrivateCaseEvidenceReadResultV1 = {
  protocolVersion: '1.0',
  objectType: 'WORKSPACE_PRIVATE_CASE_EVIDENCE_READ_RESULT',
  binding: {
    bindingId: privateEvidenceReferences.items[0]!.bindingId,
    bindingVersion: privateEvidenceReferences.items[0]!.bindingVersion,
    caseId: privateEvidenceMatter.formalMatterId,
    caseVersion: 3,
    caseSnapshotSha256: sha('1')
  },
  authority: {
    coreWorkspaceId: privateEvidenceMatter.workspaceId,
    knowledgeWorkspaceId: 'wsp_fixture_private_1452',
    userId: '018f0000-0000-7000-8000-000000001451',
    membershipId: '018f0000-0000-7000-8000-000000001453',
    verifiedAt: '2026-10-03T08:30:00.000Z',
    expiresAt: '2026-10-03T08:31:00.000Z'
  },
  lineage: {
    readyPackageId: 'rdp_fixture_private_1452',
    readyPackageDigest: sha('2'),
    coreIntakeId: 'intake_fixture_private_1452',
    contentExportSha256: sha('3'),
    rawArtifactId: 'artifact_fixture_private_1452',
    rawArtifactSha256: sha('4')
  },
  document: {
    documentId: 'document_fixture_private_1452',
    artifactVersion: 4,
    stagingDocumentId: 'staging_fixture_private_1452',
    canonicalSha256: sha('5'),
    stagingSha256: sha('5'),
    documentSha256: sha('6'),
    indexedAt: '2026-10-03T08:29:00.000Z'
  },
  currentness: {
    workspaceAuthority: 'CURRENT',
    formalMatter: 'CURRENT',
    coreKnowledgeEvidence: 'CURRENT',
    knowledgeRetrieval: 'CURRENT',
    documentVersion: 'CURRENT'
  },
  locatorSemantics: {
    basis: 'RETRIEVAL_CHUNK',
    pageNumbers: 'UNAVAILABLE',
    textOffsets: 'UNAVAILABLE'
  },
  chunks: [
    {
      locator: 'chunk:office-action:refusal-basis',
      chunkId: 'chunk:office-action:refusal-basis',
      ordinal: 0,
      headingPath: ['Office action', 'Refusal basis'],
      text: 'The examining attorney states the exact refusal basis in this private source chunk.',
      contentSha256: sha('7'),
      contentKind: 'CANONICAL_MARKDOWN_CHUNK',
      pageNumber: null,
      textStartOffset: null,
      textEndOffset: null
    }
  ],
  consequences: {
    officialTruthCreated: false,
    filingAuthorized: false,
    externalActionAuthorized: false
  }
};

export function privateEvidenceClient(
  overrides: Partial<MatterWorkspaceClient> = {}
): MatterWorkspaceClient {
  return {
    list: () => Promise.reject(new Error('Not used by the focused private evidence fixture.')),
    load: () => Promise.reject(new Error('Not used by the focused private evidence fixture.')),
    startProfessionalReview: () =>
      Promise.reject(new Error('Not used by the focused private evidence fixture.')),
    listPrivateEvidence: () => Promise.resolve(privateEvidenceReferences),
    readPrivateEvidence: () => Promise.resolve(privateEvidenceRead),
    ...overrides
  };
}
