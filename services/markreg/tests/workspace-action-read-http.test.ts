import { afterEach, describe, expect, it } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import { createMarkRegWorkspaceActionReadRoutes } from '../src/workspace-action-read-http.js';
import {
  WorkspaceActionReadService,
  type WorkspaceActionSourceReader,
  type WorkspaceActionSourceRecord
} from '../src/workspace-action-read.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
const secret = 'workspace-action-internal-service-secret-32-bytes';
const active: ServiceRuntime[] = [];

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

function principal(permissions: WorkspacePrincipal['permissions'], workspace = workspaceId) {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_workspace-action',
    userId: 'user_workspace-action',
    workspaceId: workspace,
    membershipId: 'membership_workspace-action',
    role: 'MATTER_MANAGER',
    permissions,
    sessionExpiresAt: '2026-09-07T00:00:00.000Z'
  } satisfies WorkspacePrincipal;
}

function headers(value: WorkspacePrincipal, suppliedSecret = secret) {
  return {
    'x-markorbit-internal-authorization': suppliedSecret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
    'x-markorbit-workspace-id': value.workspaceId
  };
}

const sourceRecord: WorkspaceActionSourceRecord = {
  formalMatter: {
    id: 'formal-matter_workspace-action',
    version: 1,
    trademark: 'ORBIT',
    applicant: 'Orbit Inc.',
    jurisdiction: 'US',
    updatedAt: '2026-09-05T10:00:00.000Z'
  },
  lifecycle: {
    id: 'lifecycle-view_workspace-action',
    version: 2,
    fingerprintSha256: 'a'.repeat(64),
    formalMatterVersion: 1,
    currentEvent: {
      id: 'lifecycle-event_workspace-action',
      version: 3,
      fingerprintSha256: 'b'.repeat(64)
    },
    state: 'CUSTOMER_ACTION_NEEDED',
    customerSafeLabel: 'Customer action needed',
    customerSafeSummary: 'Reviewed evidence requires customer attention.',
    officialStatusVerified: false,
    updatedAt: '2026-09-05T10:00:00.000Z'
  },
  currentEvent: {
    id: 'lifecycle-event_workspace-action',
    version: 3,
    fingerprintSha256: 'b'.repeat(64),
    formalMatterVersion: 1,
    state: 'CUSTOMER_ACTION_NEEDED',
    eventCode: 'EXAMINATION_CUSTOMER_ACTION_NEEDED',
    officialStatusVerified: false
  },
  recommendedAction: {
    id: 'recommended-action_workspace-action',
    version: 1,
    formalMatterVersion: 1,
    sourceLifecycleView: {
      id: 'lifecycle-view_workspace-action',
      version: 2,
      fingerprintSha256: 'a'.repeat(64)
    },
    title: 'Review required action',
    explanation: 'Current governed lifecycle truth requires customer attention.',
    timingBasis: 'No governed due date is present; no deadline is inferred.',
    status: 'OPEN',
    executionAuthorized: false,
    updatedAt: '2026-09-05T10:00:00.000Z'
  }
};

async function stack(input: { failure?: boolean; records?: readonly WorkspaceActionSourceRecord[] } = {}) {
  const source: WorkspaceActionSourceReader = {
    list: () =>
      input.failure
        ? Promise.reject(new Error('db offline'))
        : Promise.resolve(structuredClone(input.records ?? [sourceRecord]))
  };
  const runtime = createServiceRuntime(
    { name: 'markreg-workspace-action-http-test', port: 0, version: '1' },
    {
      routes: createMarkRegWorkspaceActionReadRoutes({
        internalServiceSecret: secret,
        service: new WorkspaceActionReadService(source, () => '2026-09-06T00:00:00.000Z')
      })
    }
  );
  active.push(runtime);
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}

describe('Workspace Action Projection V1 internal owner route', () => {
  it('returns one bounded owner projection and preserves no-authority semantics', async () => {
    const base = await stack();
    const response = await fetch(`${base}/internal/v1/workspace-actions`, {
      headers: headers(principal(['matter:read']))
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      workspaceActions: {
        schemaVersion: 1,
        workspaceId,
        needsAttention: [
          {
            formalMatter: {
              id: 'formal-matter_workspace-action',
              trademark: 'ORBIT',
              jurisdiction: 'US'
            },
            currentness: 'CURRENT',
            attentionStatus: 'OPEN',
            recommendedAction: {
              id: 'recommended-action_workspace-action',
              status: 'OPEN',
              executionAuthorized: false
            },
            examination: {
              status: 'ESTABLISHED',
              eventCode: 'EXAMINATION_CUSTOMER_ACTION_NEEDED',
              deadline: null,
              deadlineStatus: 'UNAVAILABLE',
              officialStatusVerified: false
            },
            officialStatusVerified: false
          }
        ],
        officialStatusVerified: false,
        authorityConsequences: {
          filingAuthorized: false,
          filingSubmitted: false,
          paymentCreated: false,
          providerContacted: false,
          officialTruthCreated: false
        }
      }
    });
  });

  it('requires trusted internal authorization and encoded Workspace Principal', async () => {
    const base = await stack();
    const wrongSecret = await fetch(`${base}/internal/v1/workspace-actions`, {
      headers: headers(principal(['matter:read']), 'wrong-secret-that-is-still-long-enough-000')
    });
    expect(wrongSecret.status).toBe(401);
    expect(await wrongSecret.json()).toMatchObject({ code: 'UNTRUSTED_INTERNAL_CALLER' });

    const missingPrincipal = await fetch(`${base}/internal/v1/workspace-actions`, {
      headers: {
        'x-markorbit-internal-authorization': secret,
        'x-markorbit-workspace-id': workspaceId
      }
    });
    expect(missingPrincipal.status).toBe(401);
    expect(await missingPrincipal.json()).toMatchObject({ code: 'INVALID_INTERNAL_PRINCIPAL' });
  });

  it('is privacy-safe on Workspace mismatch and requires matter:read', async () => {
    const base = await stack();
    const mismatchHeaders = headers(principal(['matter:read']));
    mismatchHeaders['x-markorbit-workspace-id'] = otherWorkspaceId;
    const mismatch = await fetch(`${base}/internal/v1/workspace-actions`, {
      headers: mismatchHeaders
    });
    expect(mismatch.status).toBe(404);
    expect(await mismatch.json()).toMatchObject({ code: 'WORKSPACE_MISMATCH' });

    const denied = await fetch(`${base}/internal/v1/workspace-actions`, {
      headers: headers(principal(['review:read']))
    });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('keeps successful empty Workspace distinct from source failure', async () => {
    const emptyBase = await stack({ records: [] });
    const empty = await fetch(`${emptyBase}/internal/v1/workspace-actions`, {
      headers: headers(principal(['matter:read']))
    });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toMatchObject({
      workspaceActions: {
        needsAttention: [],
        waitingOrInProgress: [],
        recentlyChanged: []
      }
    });

    const failedBase = await stack({ failure: true });
    const failed = await fetch(`${failedBase}/internal/v1/workspace-actions`, {
      headers: headers(principal(['matter:read']))
    });
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({
      code: 'WORKSPACE_ACTION_TRUTH_UNAVAILABLE',
      retryable: true
    });
  });

  it('does not expose a mutation route', async () => {
    const base = await stack();
    const response = await fetch(`${base}/internal/v1/workspace-actions`, {
      method: 'POST',
      headers: {
        ...headers(principal(['matter:read'])),
        'content-type': 'application/json'
      },
      body: JSON.stringify({ workspaceId: otherWorkspaceId })
    });
    expect(response.status).toBe(404);
  });
});
