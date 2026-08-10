import { afterEach, describe, expect, it } from 'vitest';
import type { CoreIntakeRequest } from '@markorbit/contracts';
import type { AuthenticationService } from '../src/auth.js';
import { createRuntime } from '../src/index.js';
import { MemoryKnowledgeIntakeRepository } from '../src/knowledge-intake.js';

const secret = 's'.repeat(32);
const workspaceId = '018f0000-0000-7000-8000-000000000002';
const valid: CoreIntakeRequest = {
  readyPackageId: 'ready-package_one',
  workspaceId,
  digest: 'digest-one',
  evidence: { artifactIds: [], stagingDocumentId: 'staging-one' },
  submittedAt: '2026-08-10T12:00:00.000Z'
};
const runtimes: ReturnType<typeof createRuntime>[] = [];

async function start(repository = new MemoryKnowledgeIntakeRepository()) {
  const runtime = createRuntime({
    port: 0,
    authentication: {} as AuthenticationService,
    workspaces: {
      findById: async (id) => {
        await Promise.resolve();
        return id === workspaceId ? ({ workspaceId } as never) : null;
      }
    },
    knowledgeIntakes: repository,
    internalServiceSecret: secret
  });
  await runtime.start();
  runtimes.push(runtime);
  return { runtime, repository };
}
async function post(
  runtime: ReturnType<typeof createRuntime>,
  request: unknown = valid,
  key: string | null = 'key-one',
  authorization: string | null = secret
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key !== null) headers['idempotency-key'] = key;
  if (authorization !== null) headers['x-markorbit-internal-authorization'] = authorization;
  const response = await fetch(
    `http://127.0.0.1:${runtime.listeningPort}/internal/knowledge/ready-packages/intakes`,
    { method: 'POST', headers, body: JSON.stringify(request) }
  );
  return { response, json: (await response.json()) as Record<string, unknown> };
}
afterEach(async () => Promise.all(runtimes.splice(0).map((runtime) => runtime.stop())));

describe('Knowledge ReadyPackage intake HTTP boundary', () => {
  it('creates RECEIVED with the exact result shape and persists one intake', async () => {
    const { runtime, repository } = await start();
    const result = await post(runtime);
    expect(result.response.status).toBe(201);
    expect(Object.keys(result.json).sort()).toEqual(['intakeId', 'readyPackageId', 'status']);
    expect(result.json).toMatchObject({ status: 'RECEIVED', readyPackageId: valid.readyPackageId });
    expect(repository.count()).toBe(1);
  });

  it.each([null, 'wrong-secret'])('rejects missing or invalid internal auth', async (auth) => {
    const { runtime, repository } = await start();
    expect((await post(runtime, valid, 'key', auth)).response.status).toBe(401);
    expect(repository.count()).toBe(0);
  });

  it('requires a non-empty Idempotency-Key', async () => {
    const { runtime } = await start();
    for (const key of [null, '   ']) {
      const result = await post(runtime, valid, key);
      expect(result.response.status).toBe(400);
      expect(result.json.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    }
  });

  it('rejects malformed JSON', async () => {
    const { runtime } = await start();
    const response = await fetch(
      `http://127.0.0.1:${runtime.listeningPort}/internal/knowledge/ready-packages/intakes`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'malformed',
          'x-markorbit-internal-authorization': secret
        },
        body: '{'
      }
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it.each([
    null,
    { ...valid, unexpected: true },
    { ...valid, evidence: null },
    { ...valid, evidence: { ...valid.evidence, artifactIds: [''] } },
    { ...valid, submittedAt: 'not-a-date' }
  ])('rejects malformed or non-contract bodies', async (request) => {
    const { runtime } = await start();
    const result = await post(runtime, request);
    expect(result.response.status).toBe(400);
    expect(result.json.code).toBe('INVALID_REQUEST');
  });

  it('rejects a nonexistent workspace without persistence', async () => {
    const { runtime, repository } = await start();
    const result = await post(runtime, { ...valid, workspaceId: crypto.randomUUID() });
    expect(result.response.status).toBe(404);
    expect(result.json.code).toBe('WORKSPACE_NOT_FOUND');
    expect(repository.count()).toBe(0);
  });

  it('rejects a non-UUID standalone Knowledge workspace ID before persistence', async () => {
    const { runtime, repository } = await start();
    const result = await post(runtime, {
      ...valid,
      workspaceId: 'wsp_01H00000000000000000000000'
    });
    expect(result.response.status).toBe(400);
    expect(result.json.code).toBe('INVALID_REQUEST');
    expect(repository.count()).toBe(0);
  });

  it('replays the original intake across a service restart without a duplicate', async () => {
    const repository = new MemoryKnowledgeIntakeRepository();
    const firstRuntime = (await start(repository)).runtime;
    const first = await post(firstRuntime);
    await firstRuntime.stop();
    const secondRuntime = (await start(repository)).runtime;
    const replay = await post(secondRuntime);
    expect(replay.response.status).toBe(200);
    expect(replay.json).toEqual(first.json);
    expect(repository.count()).toBe(1);
  });

  it.each([
    { ...valid, readyPackageId: 'ready-package_two' },
    { ...valid, digest: 'digest-two' },
    { ...valid, evidence: { artifactIds: ['artifact-two'], stagingDocumentId: 'staging-two' } },
    { ...valid, submittedAt: '2026-08-10T12:00:01.000Z' }
  ])('conflicts when the same key has a different normalized request', async (changed) => {
    const { runtime, repository } = await start();
    await post(runtime);
    const conflict = await post(runtime, changed);
    expect(conflict.response.status).toBe(409);
    expect(conflict.json.code).toBe('KNOWLEDGE_INTAKE_IDEMPOTENCY_CONFLICT');
    expect(repository.count()).toBe(1);
  });
});
