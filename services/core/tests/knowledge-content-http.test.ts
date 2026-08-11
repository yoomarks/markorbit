import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { CoreIntakeRequest } from '@markorbit/contracts';
import type { AuthenticationService } from '../src/auth.js';
import { createRuntime } from '../src/index.js';
import {
  MemoryKnowledgeContentExportRepository,
  fingerprintReadyPackageContentExportV1,
  type ReadyPackageContentExportV1
} from '../src/knowledge-content.js';
import { MemoryKnowledgeIntakeRepository } from '../src/knowledge-intake.js';

const secret = 's'.repeat(32);
const workspaceId = '018f0000-0000-7000-8000-000000000202';
const suffix = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const markdown = '# Knowledge\n' + 'x'.repeat(70 * 1024);
const stagingSha256 = createHash('sha256').update(markdown, 'utf8').digest('hex');
const readyPackageDigest = 'a'.repeat(64);
const rawArtifactSha256 = 'b'.repeat(64);
const readyPackageId = `rdp_${suffix}`;
const artifactId = `art_${suffix}`;
const stagingDocumentId = `std_${suffix}`;

const intakeRequest: CoreIntakeRequest = {
  readyPackageId,
  workspaceId,
  digest: readyPackageDigest,
  evidence: { artifactIds: [artifactId], stagingDocumentId },
  submittedAt: '2026-08-11T04:00:00.000Z'
};

const contentExport: ReadyPackageContentExportV1 = {
  contractVersion: '1.0',
  objectType: 'READY_PACKAGE_CONTENT_EXPORT',
  readyPackageId,
  knowledgeWorkspaceId: `wsp_${suffix}`,
  readyPackageDigest,
  provenance: {
    sourceId: `src_${suffix}`,
    conversionRunId: `cvr_${suffix}`,
    verificationId: `svr_${suffix}`,
    verificationOutcome: 'PASS',
    capturedAt: '2026-08-11T03:59:00.000Z',
    converter: { converterId: 'canonical-markdown', version: '1.0.0' },
    legalTruthVerified: false
  },
  rawArtifact: {
    artifactId,
    sha256: rawArtifactSha256,
    sizeBytes: 123,
    mimeType: 'text/html',
    originalName: 'source.html'
  },
  stagingDocument: {
    documentId: stagingDocumentId,
    sha256: stagingSha256,
    sizeBytes: Buffer.byteLength(markdown, 'utf8'),
    mediaType: 'text/markdown',
    encoding: 'utf-8',
    content: markdown
  }
};

const runtimes: ReturnType<typeof createRuntime>[] = [];
async function start() {
  const knowledgeIntakes = new MemoryKnowledgeIntakeRepository();
  const knowledgeContentExports = new MemoryKnowledgeContentExportRepository();
  const runtime = createRuntime({
    port: 0,
    authentication: {} as AuthenticationService,
    workspaces: {
      findById: async (id) => {
        await Promise.resolve();
        return id === workspaceId ? ({ workspaceId } as never) : null;
      }
    },
    knowledgeIntakes,
    knowledgeContentExports,
    internalServiceSecret: secret
  });
  await runtime.start();
  runtimes.push(runtime);
  return { runtime, knowledgeIntakes, knowledgeContentExports };
}

async function createIntake(runtime: ReturnType<typeof createRuntime>) {
  const response = await fetch(
    `http://127.0.0.1:${runtime.listeningPort}/internal/knowledge/ready-packages/intakes`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'content-intake',
        'x-markorbit-internal-authorization': secret
      },
      body: JSON.stringify(intakeRequest)
    }
  );
  return (await response.json()) as { intakeId: string; status: string; readyPackageId: string };
}

async function postContent(
  runtime: ReturnType<typeof createRuntime>,
  intakeId: string,
  value: unknown = contentExport,
  authorization: string | null = secret
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authorization !== null) headers['x-markorbit-internal-authorization'] = authorization;
  const response = await fetch(
    `http://127.0.0.1:${runtime.listeningPort}/internal/knowledge/ready-packages/intakes/${intakeId}/content-exports`,
    { method: 'POST', headers, body: JSON.stringify(value) }
  );
  return { response, json: (await response.json()) as Record<string, unknown> };
}

afterEach(async () => Promise.all(runtimes.splice(0).map((runtime) => runtime.stop())));

describe('ReadyPackage Content Export V1 Core consumption boundary', () => {
  it('persists the immutable export, preserves Markdown bytes, and accepts the intake', async () => {
    const { runtime, knowledgeIntakes, knowledgeContentExports } = await start();
    const intake = await createIntake(runtime);
    expect(intake.status).toBe('RECEIVED');
    expect(Buffer.byteLength(JSON.stringify(contentExport), 'utf8')).toBeGreaterThan(64 * 1024);

    const consumed = await postContent(runtime, intake.intakeId);
    expect(consumed.response.status).toBe(201);
    expect(Object.keys(consumed.json).sort()).toEqual(['intakeId', 'readyPackageId', 'status']);
    expect(consumed.json).toEqual({
      intakeId: intake.intakeId,
      status: 'ACCEPTED',
      readyPackageId
    });
    expect((await knowledgeIntakes.findById(intake.intakeId))?.status).toBe('ACCEPTED');
    const stored = await knowledgeContentExports.findByIntakeId(intake.intakeId);
    expect(stored?.contentExport.stagingDocument.content).toBe(markdown);
    expect(stored?.exportSha256).toBe(fingerprintReadyPackageContentExportV1(contentExport));
  });

  it('replays the exact export without duplicating durable content', async () => {
    const { runtime, knowledgeContentExports } = await start();
    const intake = await createIntake(runtime);
    const first = await postContent(runtime, intake.intakeId);
    const replay = await postContent(runtime, intake.intakeId);
    expect(first.response.status).toBe(201);
    expect(replay.response.status).toBe(200);
    expect(replay.json).toEqual(first.json);
    expect(knowledgeContentExports.count()).toBe(1);
  });

  it('rejects content that does not match the frozen intake evidence', async () => {
    const { runtime, knowledgeContentExports } = await start();
    const intake = await createIntake(runtime);
    const mismatch = await postContent(runtime, intake.intakeId, {
      ...contentExport,
      readyPackageDigest: 'c'.repeat(64)
    });
    expect(mismatch.response.status).toBe(409);
    expect(mismatch.json.code).toBe('KNOWLEDGE_CONTENT_EXPORT_INTAKE_MISMATCH');
    expect(knowledgeContentExports.count()).toBe(0);
  });

  it('rejects staging content whose bytes no longer match the exported hash and size', async () => {
    const { runtime, knowledgeContentExports } = await start();
    const intake = await createIntake(runtime);
    const invalid = await postContent(runtime, intake.intakeId, {
      ...contentExport,
      stagingDocument: { ...contentExport.stagingDocument, content: '# Changed\n' }
    });
    expect(invalid.response.status).toBe(400);
    expect(invalid.json.code).toBe('KNOWLEDGE_CONTENT_EXPORT_INTEGRITY_INVALID');
    expect(knowledgeContentExports.count()).toBe(0);
  });

  it('conflicts if an intake already owns a different otherwise-valid immutable export', async () => {
    const { runtime, knowledgeContentExports } = await start();
    const intake = await createIntake(runtime);
    await postContent(runtime, intake.intakeId);
    const changed = {
      ...contentExport,
      rawArtifact: { ...contentExport.rawArtifact, originalName: 'renamed-source.html' }
    };
    const conflict = await postContent(runtime, intake.intakeId, changed);
    expect(conflict.response.status).toBe(409);
    expect(conflict.json.code).toBe('KNOWLEDGE_CONTENT_EXPORT_IMMUTABILITY_CONFLICT');
    expect(knowledgeContentExports.count()).toBe(1);
  });

  it('rejects unknown intakes and invalid internal authentication', async () => {
    const { runtime } = await start();
    const missing = await postContent(runtime, crypto.randomUUID());
    expect(missing.response.status).toBe(404);
    expect(missing.json.code).toBe('KNOWLEDGE_INTAKE_NOT_FOUND');

    const intake = await createIntake(runtime);
    const unauthorized = await postContent(runtime, intake.intakeId, contentExport, 'wrong-secret');
    expect(unauthorized.response.status).toBe(401);
    expect(unauthorized.json.code).toBe('INTERNAL_SERVICE_UNAUTHORIZED');
  });
});
