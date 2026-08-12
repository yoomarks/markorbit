import { afterEach, describe, expect, it } from 'vitest';
import type { AuthenticationService } from '../src/auth.js';
import { createRuntime } from '../src/index.js';
import { MemoryKnowledgeIntakeRepository } from '../src/knowledge-intake.js';

const secret = 'm7-wp04-core-source-secret-32-bytes';
const workspaceId = '89898989-8989-4898-8989-898989898989';
const readyPackageId = 'rdp_m7-wp04-governed-source';
const runtimes: ReturnType<typeof createRuntime>[] = [];

async function start() {
  const knowledgeIntakes = new MemoryKnowledgeIntakeRepository();
  const runtime = createRuntime({
    port: 0,
    authentication: {} as AuthenticationService,
    knowledgeIntakes,
    internalServiceSecret: secret
  });
  await runtime.start();
  runtimes.push(runtime);
  return { runtime, knowledgeIntakes };
}

afterEach(async () => Promise.all(runtimes.splice(0).map((runtime) => runtime.stop())));

describe('Core accepted Knowledge Product-loop source boundary', () => {
  it('returns only the exact accepted Workspace-scoped ReadyPackage provenance', async () => {
    const { runtime, knowledgeIntakes } = await start();
    const intake = {
      intakeId: '89898989-8989-4898-8989-898989898990',
      idempotencyKey: 'm7-wp04-source-intake',
      request: {
        readyPackageId,
        workspaceId,
        digest: 'a'.repeat(64),
        evidence: {
          artifactIds: ['raw-artifact_m7-wp04-source'],
          stagingDocumentId: 'staging-document_m7-wp04-source'
        },
        submittedAt: '2026-08-12T10:30:00.000Z'
      },
      requestSha256: 'b'.repeat(64),
      status: 'RECEIVED' as const,
      receivedAt: '2026-08-12T10:31:00.000Z'
    };
    await knowledgeIntakes.createOrFind(intake);

    const pending = await fetch(
      `http://127.0.0.1:${runtime.listeningPort}/internal/knowledge/ready-packages/${readyPackageId}/product-loop-source`,
      {
        headers: {
          'x-markorbit-internal-authorization': secret,
          'x-markorbit-workspace-id': workspaceId
        }
      }
    );
    expect(pending.status).toBe(404);

    await knowledgeIntakes.markAccepted(intake.intakeId);
    const accepted = await fetch(
      `http://127.0.0.1:${runtime.listeningPort}/internal/knowledge/ready-packages/${readyPackageId}/product-loop-source`,
      {
        headers: {
          'x-markorbit-internal-authorization': secret,
          'x-markorbit-workspace-id': workspaceId
        }
      }
    );
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({
      source: {
        schemaVersion: 1,
        owner: 'CORE',
        kind: 'KNOWLEDGE_READY_PACKAGE',
        sourceId: readyPackageId,
        sourceVersion: 'CORE_ACCEPTED_V1',
        sourceFingerprintSha256: intake.requestSha256,
        observedAt: intake.receivedAt
      }
    });

    const otherWorkspace = await fetch(
      `http://127.0.0.1:${runtime.listeningPort}/internal/knowledge/ready-packages/${readyPackageId}/product-loop-source`,
      {
        headers: {
          'x-markorbit-internal-authorization': secret,
          'x-markorbit-workspace-id': '90909090-9090-4909-8909-909090909090'
        }
      }
    );
    expect(otherWorkspace.status).toBe(404);
  });

  it('rejects an untrusted internal caller', async () => {
    const { runtime } = await start();
    const response = await fetch(
      `http://127.0.0.1:${runtime.listeningPort}/internal/knowledge/ready-packages/${readyPackageId}/product-loop-source`,
      { headers: { 'x-markorbit-workspace-id': workspaceId } }
    );
    expect(response.status).toBe(401);
  });
});
