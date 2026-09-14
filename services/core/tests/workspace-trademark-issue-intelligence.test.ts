import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ReadyPackageContentExportV1 } from '@markorbit/contracts/knowledge-content-export';
import {
  fingerprintReadyPackageContentExport,
  MemoryKnowledgeReadyPackageContentRepository,
  type KnowledgeReadyPackageContentRepository
} from '../src/knowledge-content.js';
import { MemoryKnowledgeIntakeRepository } from '../src/knowledge-intake.js';
import {
  WorkspaceTrademarkIssueIntelligenceError,
  WorkspaceTrademarkIssueIntelligenceRuntimeV1,
  type WorkspaceTrademarkIssueInterpreterV1
} from '../src/workspace-trademark-issue-intelligence.js';

const workspaceA = '018f0000-0000-7000-8000-000000000401';
const workspaceB = '018f0000-0000-7000-8000-000000000402';
const capturedAt = '2026-09-14T03:00:00.000Z';
const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

function stable(value: unknown): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
function exported(kind: 'private' | 'global', content: string): ReadyPackageContentExportV1 {
  const suffix = kind === 'private' ? '401' : '402';
  const sourceId = `src_01H00000000000000000000${suffix}`;
  const conversionRunId = `cvr_01H00000000000000000000${suffix}`;
  const verificationId = `svr_01H00000000000000000000${suffix}`;
  const artifactId = `art_01H00000000000000000000${suffix}`;
  const stagingDocumentId = `std_01H00000000000000000000${suffix}`;
  const rawArtifactSha256 = sha256(`artifact-${kind}`);
  const stagingSha256 = sha256(Buffer.from(content, 'utf8'));
  const converter = { converterId: 'markdown-normalizer', version: '1.0.0' };
  const readyPackageDigest = sha256(
    stable({
      artifactIds: [artifactId],
      stagingDocumentId,
      sourceId,
      conversionRunId,
      rawArtifactSha256,
      stagingSha256,
      verificationId,
      verificationOutcome: 'PASS',
      converter,
      capturedAt,
      legalTruthVerified: false
    })
  );
  return {
    contractVersion: '1.1',
    objectType: 'READY_PACKAGE_CONTENT_EXPORT',
    readyPackageId: `rdp_01H00000000000000000000${suffix}`,
    knowledgeWorkspaceId: kind === 'private' ? 'wsp_01H00000000000000000000401' : 'global-public',
    readyPackageDigest,
    provenance: {
      sourceId,
      conversionRunId,
      verificationId,
      verificationOutcome: 'PASS',
      capturedAt,
      converter,
      legalTruthVerified: false
    },
    rawArtifact: {
      artifactId,
      sha256: rawArtifactSha256,
      sizeBytes: 17,
      mimeType: 'application/pdf',
      originalName: `${kind}.pdf`
    },
    stagingDocument: {
      documentId: stagingDocumentId,
      sha256: stagingSha256,
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      mediaType: 'text/markdown',
      encoding: 'utf-8',
      content
    },
    sourceGovernance:
      kind === 'private'
        ? { snapshotVersion: '1.0', kind: 'STANDARD_SOURCE', sourceId }
        : {
            snapshotVersion: '1.0',
            kind: 'GLOBAL_REFERENCE',
            sourceId,
            referenceProtocolVersion: '1.0',
            sourceRole: 'IP_LEGAL_SOURCE',
            authorityTier: 'A_PLUS',
            intendedUses: ['TRADEMARK_PROFILE'],
            factEligibility: 'PRIMARY',
            verification: {
              policy: 'NOT_REQUIRED',
              verifyAgainstSourceIds: [],
              verifyAgainstJurisdictionOfficialSource: false
            },
            contentReusePolicy: 'FACT_EXTRACTION_WITH_PROVENANCE'
          }
  };
}

async function seed(
  intakes: MemoryKnowledgeIntakeRepository,
  contents: MemoryKnowledgeReadyPackageContentRepository,
  workspaceId: string,
  value: ReadyPackageContentExportV1,
  exportSha256 = fingerprintReadyPackageContentExport(value)
) {
  const intakeId = `intake-${value.readyPackageId}`;
  await intakes.createOrFind({
    intakeId,
    idempotencyKey: `idempotency-${value.readyPackageId}`,
    request: {
      readyPackageId: value.readyPackageId,
      workspaceId,
      digest: value.readyPackageDigest,
      evidence: {
        artifactIds: [value.rawArtifact.artifactId],
        stagingDocumentId: value.stagingDocument.documentId
      },
      submittedAt: '2026-09-14T03:01:00.000Z'
    },
    requestSha256: sha256(`request-${value.readyPackageId}`),
    status: 'ACCEPTED',
    receivedAt: '2026-09-14T03:02:00.000Z'
  });
  await contents.createOrFind({
    intakeId,
    workspaceId,
    readyPackageId: value.readyPackageId,
    export: value,
    exportSha256,
    consumedAt: '2026-09-14T03:03:00.000Z'
  });
}

let intakes: MemoryKnowledgeIntakeRepository;
let contents: MemoryKnowledgeReadyPackageContentRepository;
let calls: number;
let observedDocuments: readonly { content: string; knowledgeWorkspaceId: string }[];
let interpreter: WorkspaceTrademarkIssueInterpreterV1;

beforeEach(() => {
  intakes = new MemoryKnowledgeIntakeRepository();
  contents = new MemoryKnowledgeReadyPackageContentRepository();
  calls = 0;
  observedDocuments = [];
  interpreter = {
    profile: {
      profileId: 'workspace-trademark-issue-v1',
      version: '1.0.0',
      policyProfileId: 'governed-knowledge-only-v1'
    },
    async interpret(input) {
      await Promise.resolve();
      calls += 1;
      observedDocuments = input.documents.map((document) => ({
        content: document.content,
        knowledgeWorkspaceId: document.knowledgeWorkspaceId
      }));
      return {
        status: 'INTERPRETED',
        primitives: [
          {
            kind: 'REQUIREMENT',
            summary: 'A governed response requirement was identified.',
            jurisdiction: 'US',
            confidence: 0.94,
            uncertainty: 'LOW',
            evidenceRefs: input.documents.map((document) => document.evidenceId)
          }
        ],
        explanation: 'Interpreted only from the supplied governed evidence.'
      };
    }
  };
});

const runtime = () =>
  new WorkspaceTrademarkIssueIntelligenceRuntimeV1(intakes, contents, interpreter);

describe('WorkspaceTrademarkIssueIntelligenceRuntimeV1', () => {
  it('combines Workspace-private and global governed Knowledge without copying canonical content', async () => {
    const privateExport = exported('private', '# Private OA\nRequirement from client matter.');
    const globalExport = exported('global', '# Global rule\nAuthoritative trademark rule.');
    await seed(intakes, contents, workspaceA, privateExport);
    await seed(intakes, contents, workspaceA, globalExport);
    const result = await runtime().interpret({
      workspaceId: workspaceA,
      readyPackageIds: [privateExport.readyPackageId, globalExport.readyPackageId],
      generatedAt: '2026-09-14T03:05:00.000Z'
    });

    expect(calls).toBe(1);
    expect(observedDocuments).toEqual([
      {
        content: privateExport.stagingDocument.content,
        knowledgeWorkspaceId: privateExport.knowledgeWorkspaceId
      },
      { content: globalExport.stagingDocument.content, knowledgeWorkspaceId: 'global-public' }
    ]);
    expect(result.evidence.map((item) => item.knowledgeWorkspaceId)).toEqual([
      privateExport.knowledgeWorkspaceId,
      'global-public'
    ]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(privateExport.stagingDocument.content);
    expect(serialized).not.toContain(globalExport.stagingDocument.content);
    expect(result.primitives[0]?.evidenceRefs).toHaveLength(2);
  });

  it('rejects another Workspace ReadyPackage before invoking the interpreter', async () => {
    const foreign = exported('private', '# Workspace B OA\nPrivate client evidence.');
    await seed(intakes, contents, workspaceB, foreign);

    await expect(
      runtime().interpret({
        workspaceId: workspaceA,
        readyPackageIds: [foreign.readyPackageId],
        generatedAt: '2026-09-14T03:05:00.000Z'
      })
    ).rejects.toMatchObject({ code: 'READY_PACKAGE_NOT_ACCEPTED' });
    expect(calls).toBe(0);
  });

  it('rejects duplicate ReadyPackage evidence before invoking the interpreter', async () => {
    const duplicate = exported('private', '# Duplicate OA\nOne governed evidence item.');
    await seed(intakes, contents, workspaceA, duplicate);

    await expect(
      runtime().interpret({
        workspaceId: workspaceA,
        readyPackageIds: [duplicate.readyPackageId, duplicate.readyPackageId],
        generatedAt: '2026-09-14T03:05:00.000Z'
      })
    ).rejects.toMatchObject({ code: 'DUPLICATE_EVIDENCE' });
    expect(calls).toBe(0);
  });

  it('fails closed when stored ReadyPackage identity drifts from its governed export', async () => {
    const original = exported('private', '# Identity OA\nFrozen evidence identity.');
    await seed(intakes, contents, workspaceA, original);
    const mismatchedContents: KnowledgeReadyPackageContentRepository = {
      createOrFind: (candidate) => contents.createOrFind(candidate),
      async findByReadyPackage(workspaceId, readyPackageId) {
        const found = await contents.findByReadyPackage(workspaceId, readyPackageId);
        return found ? { ...found, readyPackageId: 'rdp_mismatched' } : null;
      }
    };
    const guardedRuntime = new WorkspaceTrademarkIssueIntelligenceRuntimeV1(
      intakes,
      mismatchedContents,
      interpreter
    );

    await expect(
      guardedRuntime.interpret({
        workspaceId: workspaceA,
        readyPackageIds: [original.readyPackageId],
        generatedAt: '2026-09-14T03:05:00.000Z'
      })
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_CONTENT_INTEGRITY_FAILURE' });
    expect(calls).toBe(0);
  });

  it('fails closed on content or export fingerprint drift before interpretation', async () => {
    const original = exported('private', '# Original OA\nUntampered evidence.');
    const frozenExportSha256 = fingerprintReadyPackageContentExport(original);
    const tampered = structuredClone(original);
    tampered.stagingDocument.content = '# Altered OA\nTampered after intake.';
    await seed(intakes, contents, workspaceA, tampered, frozenExportSha256);

    await expect(
      runtime().interpret({
        workspaceId: workspaceA,
        readyPackageIds: [tampered.readyPackageId],
        generatedAt: '2026-09-14T03:05:00.000Z'
      })
    ).rejects.toMatchObject({ code: 'KNOWLEDGE_CONTENT_INTEGRITY_FAILURE' });
    expect(calls).toBe(0);
  });

  it('requires governed V1.1 Knowledge evidence instead of silently accepting legacy V1', async () => {
    const legacy = structuredClone(exported('private', '# Legacy\nUngoverned content export.'));
    legacy.contractVersion = '1.0';
    delete legacy.sourceGovernance;
    await seed(intakes, contents, workspaceA, legacy);

    await expect(
      runtime().interpret({
        workspaceId: workspaceA,
        readyPackageIds: [legacy.readyPackageId],
        generatedAt: '2026-09-14T03:05:00.000Z'
      })
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof WorkspaceTrademarkIssueIntelligenceError &&
        error.code === 'KNOWLEDGE_CONTENT_NOT_GOVERNED'
    );
    expect(calls).toBe(0);
  });
});
