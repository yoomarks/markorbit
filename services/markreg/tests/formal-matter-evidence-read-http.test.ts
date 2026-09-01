import { afterEach, describe, expect, it } from 'vitest';
import {
  encodeInternalWorkspacePrincipal,
  type FormalMatterId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createFormalMatterEvidenceReadRoutes } from '../src/formal-matter-evidence-read-http.js';
import {
  FormalMatterEvidenceReadError,
  type FormalMatterEvidenceReadService
} from '../src/formal-matter-evidence-read.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
const formalMatterId = 'formal-matter_evidence-http' as FormalMatterId;
const secret = 'markreg-evidence-read-internal-secret-32-bytes-minimum';
const active: ServiceRuntime[] = [];

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

function principal(workspace = workspaceId): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_evidence_http',
    userId: 'user_evidence_http',
    workspaceId: workspace,
    membershipId: 'membership_evidence_http',
    role: 'MATTER_MANAGER',
    permissions: ['workspace:read', 'matter:read', 'document-package:read'],
    sessionExpiresAt: '2026-09-02T00:00:00.000Z'
  };
}

function headers(value: WorkspacePrincipal) {
  return {
    'x-markorbit-internal-authorization': secret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
    'x-markorbit-workspace-id': value.workspaceId
  };
}

async function stack(options?: { missing?: boolean }) {
  let capturedQuery: unknown;
  const service = {
    getForMatter: (
      _principal: WorkspacePrincipal,
      _formalMatterId: FormalMatterId,
      query: unknown
    ) => {
      capturedQuery = query;
      if (options?.missing)
        return Promise.reject(
          new FormalMatterEvidenceReadError(
            'FORMAL_MATTER_NOT_FOUND',
            'Formal Matter was not found.',
            404
          )
        );
      return Promise.resolve({
        schemaVersion: 1,
        workspaceId,
        formalMatter: { formalMatterId, version: 3, snapshotSha256: 'a'.repeat(64) },
        documentPackages: { items: [], returned: 0, total: 0, truncated: false, limit: 50 },
        lifecycle: { current: null, events: [], total: 0, truncated: false, limit: 100 },
        intelligence: { items: [], total: 0 },
        semantics: { readOnly: true, officialTruth: false },
        authorityConsequences: { filingSubmitted: false, paymentCreated: false }
      });
    }
  } as unknown as Pick<FormalMatterEvidenceReadService, 'getForMatter'>;
  const runtime = createServiceRuntime(
    { name: 'markreg-evidence-read-http-test', port: 0, version: '1' },
    {
      routes: createFormalMatterEvidenceReadRoutes({
        internalServiceSecret: secret,
        service
      })
    }
  );
  active.push(runtime);
  await runtime.start();
  return {
    base: `http://127.0.0.1:${runtime.listeningPort}`,
    query: () => capturedQuery
  };
}

describe('Formal Matter Evidence Read HTTP', () => {
  it('returns the internal projection and forwards bounded intelligence query controls', async () => {
    const runtime = await stack();
    const response = await fetch(
      `${runtime.base}/internal/v1/formal-matters/${formalMatterId}/evidence?page=2&pageSize=10&reviewHistoryLimit=4`,
      { headers: headers(principal()) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      workspaceId,
      formalMatter: { formalMatterId },
      semantics: { readOnly: true },
      authorityConsequences: { filingSubmitted: false, paymentCreated: false }
    });
    expect(runtime.query()).toEqual({ page: 2, pageSize: 10, reviewHistoryLimit: 4 });
  });

  it('requires trusted internal authorization and an exact Workspace header', async () => {
    const runtime = await stack();
    const untrusted = await fetch(
      `${runtime.base}/internal/v1/formal-matters/${formalMatterId}/evidence`,
      {
        headers: {
          ...headers(principal()),
          'x-markorbit-internal-authorization': 'wrong-secret'
        }
      }
    );
    expect(untrusted.status).toBe(401);
    expect(await untrusted.json()).toMatchObject({ code: 'UNTRUSTED_INTERNAL_CALLER' });

    const mismatch = await fetch(
      `${runtime.base}/internal/v1/formal-matters/${formalMatterId}/evidence`,
      {
        headers: {
          ...headers(principal()),
          'x-markorbit-workspace-id': otherWorkspaceId
        }
      }
    );
    expect(mismatch.status).toBe(404);
    expect(await mismatch.json()).toMatchObject({ code: 'WORKSPACE_MISMATCH' });
  });

  it('preserves missing Matter and malformed pagination as distinct failures', async () => {
    const missingRuntime = await stack({ missing: true });
    const missing = await fetch(
      `${missingRuntime.base}/internal/v1/formal-matters/${formalMatterId}/evidence`,
      { headers: headers(principal()) }
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: 'FORMAL_MATTER_NOT_FOUND' });

    const runtime = await stack();
    const invalid = await fetch(
      `${runtime.base}/internal/v1/formal-matters/${formalMatterId}/evidence?page=not-a-number`,
      { headers: headers(principal()) }
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: 'INVALID_REQUEST' });
  });
});
