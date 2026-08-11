import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import type { CoreIntakeRequest } from '@markorbit/contracts';
import type { ReadyPackageContentExportV1 } from '@markorbit/contracts/knowledge-content-export';
import type { AuthenticationService } from '../src/auth.js';
import {
  MemoryKnowledgeReadyPackageContentRepository,
  fingerprintReadyPackageContentExport
} from '../src/knowledge-content.js';
import { createRuntime } from '../src/index.js';
import { MemoryKnowledgeIntakeRepository } from '../src/knowledge-intake.js';

const secret = 's'.repeat(32);
const workspaceId = '018f0000-0000-7000-8000-000000000202';
const runtimes: ReturnType<typeof createRuntime>[] = [];

async function fixture(): Promise<ReadyPackageContentExportV1> {
  return JSON.parse(
    await readFile(
      new URL(
        '../../../packages/contracts/fixtures/ready-package-content-export-v1.json',
        import.meta.url
      ),
      'utf8'
    )
  ) as ReadyPackageContentExportV1;
}

async function start() {
  const knowledgeIntakes = new MemoryKnowledgeIntakeRepository();
  const knowledgeContents = new MemoryKnowledgeReadyPackageContentRepository();
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
    knowledgeContents,
    internalServiceSecret: secret
  });
  await runtime.start();
  runtimes.push(runtime);
  return { runtime, knowledgeIntakes, knowledgeContents };
}

async function createIntake(
  runtime: ReturnType<typeof createRuntime>,
  content: ReadyPackageContentExportV1
) {
  const request: CoreIntakeRequest = {
    readyPackageId: content.readyPackageId,
    workspaceId,
    digest: content.readyPackageDigest,
    evidence: {
      artifactIds: [content.rawArtifact.artifactId],
      stagingDocumentId: content.stagingDocument.documentId
    },
    submittedAt: '2026-08-11T01:00:00.000Z'
  };
  const response = await fetch(
    `http://127.0.0.1:${runtime.listeningPort}/internal/knowledge/ready-packages/intakes`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': `intake-${content.readyPackageId}`,
        'x-markorbit-internal-authorization': secret
      },
      body: JSON.stringify(request)
    }
  );
  expect(response.status).toBe(201);
  return (await response.json()) as { intakeId: string };
}

async function putContent(
  runtime: ReturnType<typeof createRuntime>,
  intakeId: string,
  content: unknown,
  authorization: string | null = secret
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authorization !== null) headers['x-markorbit-internal-authorization'] = authorization;
  const response = await fetch(
    `http://127.0.0.1:${runtime.listeningPort}/internal/knowledge/ready-packages/intakes/${intakeId}/content`,
    { method: 'PUT', headers, body: JSON.stringify(content) }
  );
  return { response, json: (await response.json()) as Record<string, unknown> };
}

afterEach(async () => Promise.all(runtimes.splice(0).map((runtime) => runtime.stop())));

describe('ReadyPackage content consumption HTTP boundary', () => {
  it('stores verified immutable content without changing the intake acceptance status', async () => {
    const content = await fixture();
    const { runtime, knowledgeIntakes, knowledgeContents } = await start();
    const { intakeId } = await createIntake(runtime, content);
    const result = await putContent(runtime, intakeId, content);
    expect(result.response.status).toBe(201);
    expect(result.json).toEqual({
      intakeId,
      readyPackageId: content.readyPackageId,
      status: 'STORED',
      exportSha256: fingerprintReadyPackageContentExport(content)
    });
    expect(knowledgeContents.count()).toBe(1);
    expect((await knowledgeIntakes.findById(intakeId))?.status).toBe('RECEIVED');
  });

  it('replays the exact immutable export without a duplicate', async () => {
    const content = await fixture();
    const { runtime, knowledgeContents } = await start();
    const { intakeId } = await createIntake(runtime, content);
    const first = await putContent(runtime, intakeId, content);
    const replay = await putContent(runtime, intakeId, content);
    expect(first.response.status).toBe(201);
    expect(replay.response.status).toBe(200);
    expect(replay.json).toEqual(first.json);
    expect(knowledgeContents.count()).toBe(1);
  });

  it.each([null, 'wrong-secret'])(
    'rejects missing or invalid internal auth',
    async (authorization) => {
      const content = await fixture();
      const { runtime, knowledgeContents } = await start();
      const { intakeId } = await createIntake(runtime, content);
      expect((await putContent(runtime, intakeId, content, authorization)).response.status).toBe(
        401
      );
      expect(knowledgeContents.count()).toBe(0);
    }
  );

  it('rejects content that does not match the frozen intake evidence', async () => {
    const content = await fixture();
    const { runtime, knowledgeContents } = await start();
    const { intakeId } = await createIntake(runtime, content);
    const changed = {
      ...content,
      rawArtifact: { ...content.rawArtifact, artifactId: 'art_01ARZ3NDEKTSV4RRFFQ69G5FAA' }
    };
    const result = await putContent(runtime, intakeId, changed);
    expect(result.response.status).toBe(409);
    expect(result.json.code).toBe('KNOWLEDGE_CONTENT_INTAKE_MISMATCH');
    expect(knowledgeContents.count()).toBe(0);
  });

  it('rejects canonical Markdown whose bytes do not match the frozen staging hash', async () => {
    const content = await fixture();
    const { runtime, knowledgeContents } = await start();
    const { intakeId } = await createIntake(runtime, content);
    const changed = {
      ...content,
      stagingDocument: { ...content.stagingDocument, content: '# Tampered\n' }
    };
    const result = await putContent(runtime, intakeId, changed);
    expect(result.response.status).toBe(409);
    expect(result.json.code).toBe('KNOWLEDGE_CONTENT_STAGING_INTEGRITY_MISMATCH');
    expect(knowledgeContents.count()).toBe(0);
  });

  it('rejects export provenance that does not reproduce the ReadyPackage digest', async () => {
    const content = await fixture();
    const { runtime, knowledgeContents } = await start();
    const { intakeId } = await createIntake(runtime, content);
    const changed = {
      ...content,
      provenance: {
        ...content.provenance,
        sourceId: 'src_01ARZ3NDEKTSV4RRFFQ69G5FAA'
      }
    };
    const result = await putContent(runtime, intakeId, changed);
    expect(result.response.status).toBe(409);
    expect(result.json.code).toBe('KNOWLEDGE_CONTENT_READY_PACKAGE_DIGEST_MISMATCH');
    expect(knowledgeContents.count()).toBe(0);
  });

  it('rejects content for an unknown intake before persistence', async () => {
    const content = await fixture();
    const { runtime, knowledgeContents } = await start();
    const result = await putContent(runtime, crypto.randomUUID(), content);
    expect(result.response.status).toBe(404);
    expect(result.json.code).toBe('KNOWLEDGE_INTAKE_NOT_FOUND');
    expect(knowledgeContents.count()).toBe(0);
  });

  it('rejects a different export when immutable content already exists for the intake', async () => {
    const content = await fixture();
    const { runtime, knowledgeContents } = await start();
    const { intakeId } = await createIntake(runtime, content);
    await knowledgeContents.createOrFind({
      intakeId,
      workspaceId,
      readyPackageId: content.readyPackageId,
      export: content,
      exportSha256: '0'.repeat(64),
      consumedAt: '2026-08-11T01:01:00.000Z'
    });
    const result = await putContent(runtime, intakeId, content);
    expect(result.response.status).toBe(409);
    expect(result.json.code).toBe('KNOWLEDGE_CONTENT_IMMUTABILITY_CONFLICT');
    expect(knowledgeContents.count()).toBe(1);
  });
});
