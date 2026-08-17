import { afterEach, describe, expect, it } from 'vitest';
import type { ReadyPackageContentExportV1 } from '@markorbit/contracts/knowledge-content-export';
import type { AuthenticationService } from '../src/auth.js';
import { createRuntime } from '../src/index.js';
import { MemoryKnowledgeReadyPackageContentRepository } from '../src/knowledge-content.js';
import { MemoryKnowledgeIntakeRepository } from '../src/knowledge-intake.js';

const secret = 'm9-wp02-core-daily-source-secret';
const workspaceId = '74747474-7474-4747-8747-747474747474';
const otherWorkspaceId = '75757575-7575-4757-8757-757575757575';
const readyPackageId = 'rdp_m9-wp02-core-source';
const intakeId = '76767676-7676-4767-8767-767676767676';
const runtimes: ReturnType<typeof createRuntime>[] = [];

const contentExport: ReadyPackageContentExportV1 = {
  contractVersion: '1.0',
  objectType: 'READY_PACKAGE_CONTENT_EXPORT',
  readyPackageId,
  knowledgeWorkspaceId: 'wsp_01H00000000000000000000099',
  readyPackageDigest: 'a'.repeat(64),
  provenance: {
    sourceId: 'src_01H00000000000000000000099',
    conversionRunId: 'cvr_01H00000000000000000000099',
    verificationId: 'svr_01H00000000000000000000099',
    verificationOutcome: 'PASS',
    capturedAt: '2026-08-18T03:00:00.000Z',
    converter: { converterId: 'markdown', version: '1.0.0' },
    legalTruthVerified: false
  },
  rawArtifact: {
    artifactId: 'art_01H00000000000000000000099',
    sha256: 'b'.repeat(64),
    sizeBytes: 100,
    mimeType: 'text/html',
    originalName: 'uspto-source.html'
  },
  stagingDocument: {
    documentId: 'std_01H00000000000000000000099',
    sha256: 'c'.repeat(64),
    sizeBytes: 85,
    mediaType: 'text/markdown',
    encoding: 'utf-8',
    content: '# USPTO notice\n\nThe USPTO published a trademark filing notice.\n'
  }
};

async function start() {
  const knowledgeIntakes = new MemoryKnowledgeIntakeRepository();
  const knowledgeContents = new MemoryKnowledgeReadyPackageContentRepository();
  const runtime = createRuntime({
    port: 0,
    authentication: {} as AuthenticationService,
    knowledgeIntakes,
    knowledgeContents,
    internalServiceSecret: secret
  });
  await runtime.start();
  runtimes.push(runtime);
  return { runtime, knowledgeIntakes, knowledgeContents };
}

async function seed(
  knowledgeIntakes: MemoryKnowledgeIntakeRepository,
  knowledgeContents: MemoryKnowledgeReadyPackageContentRepository
) {
  await knowledgeIntakes.createOrFind({
    intakeId,
    idempotencyKey: 'm9-wp02-intake',
    request: {
      readyPackageId,
      workspaceId,
      digest: contentExport.readyPackageDigest,
      evidence: {
        artifactIds: [contentExport.rawArtifact.artifactId],
        stagingDocumentId: contentExport.stagingDocument.documentId
      },
      submittedAt: '2026-08-18T03:01:00.000Z'
    },
    requestSha256: 'd'.repeat(64),
    status: 'RECEIVED',
    receivedAt: '2026-08-18T03:02:00.000Z'
  });
  await knowledgeContents.createOrFind({
    intakeId,
    workspaceId,
    readyPackageId,
    export: contentExport,
    exportSha256: 'e'.repeat(64),
    consumedAt: '2026-08-18T03:03:00.000Z'
  });
}

afterEach(async () => Promise.all(runtimes.splice(0).map((runtime) => runtime.stop())));

describe('Core accepted Knowledge Daily source boundary', () => {
  it('returns exact accepted content and export provenance only after acceptance', async () => {
    const { runtime, knowledgeIntakes, knowledgeContents } = await start();
    await seed(knowledgeIntakes, knowledgeContents);
    const url = `http://127.0.0.1:${runtime.listeningPort}/internal/knowledge/ready-packages/${readyPackageId}/daily-source`;
    const headers = {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-workspace-id': workspaceId
    };

    expect((await fetch(url, { headers })).status).toBe(404);
    await knowledgeIntakes.markAccepted(intakeId);
    const response = await fetch(url, { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      schemaVersion: 1,
      readyPackageId,
      source: {
        schemaVersion: 1,
        owner: 'CORE',
        kind: 'KNOWLEDGE_READY_PACKAGE',
        sourceId: readyPackageId,
        sourceVersion: 'CORE_CONTENT_V1',
        sourceFingerprintSha256: 'e'.repeat(64),
        observedAt: '2026-08-18T03:03:00.000Z'
      },
      content: {
        mediaType: 'text/markdown',
        encoding: 'utf-8',
        sha256: contentExport.stagingDocument.sha256,
        content: contentExport.stagingDocument.content,
        originalName: contentExport.rawArtifact.originalName,
        capturedAt: contentExport.provenance.capturedAt,
        legalTruthVerified: false
      }
    });
  });

  it('fails closed across Workspace boundaries and for untrusted callers', async () => {
    const { runtime, knowledgeIntakes, knowledgeContents } = await start();
    await seed(knowledgeIntakes, knowledgeContents);
    await knowledgeIntakes.markAccepted(intakeId);
    const url = `http://127.0.0.1:${runtime.listeningPort}/internal/knowledge/ready-packages/${readyPackageId}/daily-source`;
    const other = await fetch(url, {
      headers: {
        'x-markorbit-internal-authorization': secret,
        'x-markorbit-workspace-id': otherWorkspaceId
      }
    });
    expect(other.status).toBe(404);
    expect(
      (
        await fetch(url, {
          headers: { 'x-markorbit-workspace-id': workspaceId }
        })
      ).status
    ).toBe(401);
  });
});
