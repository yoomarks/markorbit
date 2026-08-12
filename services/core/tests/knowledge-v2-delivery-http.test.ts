import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  serializeReadyPackageContentExportV2,
  type ReadyPackageContentExportV2,
  type ReadyPackageV2DeliveryRequestV1
} from '@markorbit/contracts';
import type { AuthenticationService } from '../src/auth.js';
import { createRuntime } from '../src/index.js';
import { MemoryKnowledgeV2DeliveryRepository } from '../src/knowledge-v2-delivery.js';

const secret = 'v'.repeat(32);
const workspaceId = '018f0000-0000-7000-8000-000000000222';
const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const runtimes: ReturnType<typeof createRuntime>[] = [];

function contentExport(
  content = '# Frozen V2\n\nVault-origin content.\n'
): ReadyPackageContentExportV2 {
  const contentSha256 = sha256(Buffer.from(content, 'utf8'));
  return {
    contractVersion: '2.0',
    objectType: 'READY_PACKAGE_CONTENT_EXPORT',
    readyPackageId: 'rdp_01H00000000000000000000022',
    knowledgeWorkspaceId: 'wsp_01H00000000000000000000022',
    readyPackageDigest: 'a'.repeat(64),
    canonicalDocument: {
      documentId: 'cdd_01H00000000000000000000022',
      promotedAt: '2026-08-12T02:00:00.000Z'
    },
    provenance: {
      origin: {
        kind: 'VAULT_IMPORT',
        inspectionRunId: 'vin_01H00000000000000000000022',
        importIntentId: 'vmi_01H00000000000000000000022',
        importExecutionId: 'vie_01H00000000000000000000022',
        vaultStagingDocumentId: 'vst_01H00000000000000000000022',
        verificationId: 'vsv_01H00000000000000000000022',
        verificationOutcome: 'PASS',
        finalizationId: 'vsf_01H00000000000000000000022',
        rootFingerprintSha256: 'b'.repeat(64),
        binding: {
          bindingId: 'vlt_01H00000000000000000000022',
          revision: 1,
          relativeRoot: 'workspace'
        },
        vaultRelativePath: 'workspace/frozen.md',
        bindingRelativePath: 'frozen.md',
        observedAt: '2026-08-12T01:00:00.000Z',
        reviewedAt: '2026-08-12T01:10:00.000Z',
        importedAt: '2026-08-12T01:20:00.000Z',
        verifiedAt: '2026-08-12T01:30:00.000Z'
      },
      legalTruthVerified: false
    },
    content: {
      sha256: contentSha256,
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      contentAddressedRef: `cas:sha256:${contentSha256}`,
      mediaType: 'text/markdown',
      encoding: 'utf-8',
      content
    }
  };
}

function delivery(exported = contentExport()): ReadyPackageV2DeliveryRequestV1 {
  return {
    protocolVersion: '1.0',
    objectType: 'READY_PACKAGE_V2_DELIVERY_REQUEST',
    deliveryId: 'rvd_01H00000000000000000000022',
    readyPackageId: exported.readyPackageId,
    knowledgeWorkspaceId: exported.knowledgeWorkspaceId,
    target: { service: 'MARKORBIT_CORE', workspaceId },
    readyPackageDigest: exported.readyPackageDigest,
    contentExportSha256: sha256(serializeReadyPackageContentExportV2(exported)),
    contentExport: exported,
    submittedAt: '2026-08-12T02:10:00.000Z'
  };
}

async function start(repository = new MemoryKnowledgeV2DeliveryRepository()) {
  const runtime = createRuntime({
    port: 0,
    authentication: {} as AuthenticationService,
    workspaces: {
      findById: async (id) => {
        await Promise.resolve();
        return id.toLowerCase() === workspaceId ? ({ workspaceId } as never) : null;
      }
    },
    knowledgeV2Deliveries: repository,
    internalServiceSecret: secret
  });
  await runtime.start();
  runtimes.push(runtime);
  return { runtime, repository };
}

async function postRaw(
  runtime: ReturnType<typeof createRuntime>,
  rawBody: string,
  options: { protocol?: string | null; key?: string | null; auth?: string | null } = {}
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const protocol = options.protocol === undefined ? '1.0' : options.protocol;
  const key =
    options.key === undefined
      ? 'ready-package-v2-delivery:rvd_01H00000000000000000000022'
      : options.key;
  const auth = options.auth === undefined ? secret : options.auth;
  if (protocol !== null) headers['x-markorbit-ready-package-v2-delivery-protocol'] = protocol;
  if (key !== null) headers['idempotency-key'] = key;
  if (auth !== null) headers['x-markorbit-internal-authorization'] = auth;
  const response = await fetch(
    `http://127.0.0.1:${runtime.listeningPort}/internal/knowledge/ready-packages/v2/deliveries`,
    { method: 'POST', headers, body: rawBody }
  );
  return { response, json: (await response.json()) as Record<string, unknown> };
}

afterEach(async () => Promise.all(runtimes.splice(0).map((runtime) => runtime.stop())));

describe('ReadyPackage V2 delivery HTTP boundary', () => {
  it('persists RECEIVED and echoes SHA-256 of the exact received bytes', async () => {
    const { runtime, repository } = await start();
    const raw = JSON.stringify(delivery(), null, 2);
    const result = await postRaw(runtime, raw);
    expect(result.response.status).toBe(201);
    expect(Object.keys(result.json).sort()).toEqual([
      'deliveryId',
      'objectType',
      'protocolVersion',
      'readyPackageId',
      'requestSha256',
      'status'
    ]);
    expect(result.json).toEqual({
      protocolVersion: '1.0',
      objectType: 'READY_PACKAGE_V2_DELIVERY_RESULT',
      deliveryId: 'rvd_01H00000000000000000000022',
      readyPackageId: 'rdp_01H00000000000000000000022',
      status: 'RECEIVED',
      requestSha256: sha256(raw)
    });
    expect(repository.count()).toBe(1);
  });

  it('replays the same exact request across a service restart without duplicate persistence', async () => {
    const repository = new MemoryKnowledgeV2DeliveryRepository();
    const raw = JSON.stringify(delivery(), null, 2);
    const firstRuntime = (await start(repository)).runtime;
    const first = await postRaw(firstRuntime, raw);
    await firstRuntime.stop();
    const secondRuntime = (await start(repository)).runtime;
    const replay = await postRaw(secondRuntime, raw);
    expect(first.response.status).toBe(201);
    expect(replay.response.status).toBe(200);
    expect(replay.json).toEqual(first.json);
    expect(repository.count()).toBe(1);
  });

  it('fails closed when the same key carries semantically equal but byte-different JSON', async () => {
    const { runtime, repository } = await start();
    const value = delivery();
    expect((await postRaw(runtime, JSON.stringify(value))).response.status).toBe(201);
    const conflict = await postRaw(runtime, JSON.stringify(value, null, 2));
    expect(conflict.response.status).toBe(409);
    expect(conflict.json.code).toBe('KNOWLEDGE_V2_IDEMPOTENCY_CONFLICT');
    expect(repository.count()).toBe(1);
  });

  it.each([null, '2.0'])('requires explicit protocol 1.0', async (protocol) => {
    const { runtime, repository } = await start();
    const result = await postRaw(runtime, JSON.stringify(delivery()), { protocol });
    expect(result.response.status).toBe(409);
    expect(result.json.code).toBe('KNOWLEDGE_V2_PROTOCOL_MISMATCH');
    expect(repository.count()).toBe(0);
  });

  it('requires the idempotency key to match the frozen delivery identity', async () => {
    const { runtime, repository } = await start();
    const result = await postRaw(runtime, JSON.stringify(delivery()), { key: 'wrong-key' });
    expect(result.response.status).toBe(409);
    expect(result.json.code).toBe('KNOWLEDGE_V2_IDEMPOTENCY_KEY_MISMATCH');
    expect(repository.count()).toBe(0);
  });

  it('rejects excess keys rather than coercing the V2 envelope', async () => {
    const { runtime, repository } = await start();
    const result = await postRaw(runtime, JSON.stringify({ ...delivery(), unexpected: true }));
    expect(result.response.status).toBe(400);
    expect(result.json.code).toBe('INVALID_REQUEST');
    expect(repository.count()).toBe(0);
  });

  it('rejects a missing target Core Workspace before persistence', async () => {
    const { runtime, repository } = await start();
    const value = delivery();
    value.target.workspaceId = crypto.randomUUID();
    const result = await postRaw(runtime, JSON.stringify(value));
    expect(result.response.status).toBe(404);
    expect(result.json.code).toBe('WORKSPACE_NOT_FOUND');
    expect(repository.count()).toBe(0);
  });

  it('rejects a content export digest mismatch before persistence', async () => {
    const { runtime, repository } = await start();
    const value = delivery();
    value.contentExportSha256 = 'f'.repeat(64);
    const result = await postRaw(runtime, JSON.stringify(value));
    expect(result.response.status).toBe(409);
    expect(result.json.code).toBe('KNOWLEDGE_V2_CONTENT_EXPORT_DIGEST_MISMATCH');
    expect(repository.count()).toBe(0);
  });

  it('rejects Markdown digest evidence that is internally inconsistent', async () => {
    const { runtime, repository } = await start();
    const exported = contentExport();
    exported.content.sha256 = 'c'.repeat(64);
    exported.content.contentAddressedRef = `cas:sha256:${exported.content.sha256}`;
    const value = delivery(exported);
    const result = await postRaw(runtime, JSON.stringify(value));
    expect(result.response.status).toBe(409);
    expect(result.json.code).toBe('KNOWLEDGE_V2_CONTENT_DIGEST_MISMATCH');
    expect(repository.count()).toBe(0);
  });

  it.each([null, 'wrong-secret'])('preserves internal auth as the outer boundary', async (auth) => {
    const { runtime, repository } = await start();
    const result = await postRaw(runtime, JSON.stringify(delivery()), { auth });
    expect(result.response.status).toBe(401);
    expect(repository.count()).toBe(0);
  });
});
