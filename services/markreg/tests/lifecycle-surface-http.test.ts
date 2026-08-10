import { afterEach, describe, expect, it } from 'vitest';
import {
  encodeInternalWorkspacePrincipal,
  type FormalMatter,
  type FormalMatterId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type {
  CurrentLifecycleView,
  LifecycleEventProjection,
  RecommendedAction
} from '@markorbit/contracts/evidence-lifecycle';
import { createServiceRuntime, type ServiceRuntime } from '@markorbit/service-kit';
import type { FormalMatterRepository } from '../src/formal-matter.js';
import type { LifecycleProjectionService } from '../src/lifecycle-projection.js';
import {
  RecommendedActionError,
  type RecommendedActionCustomerProjection,
  type RecommendedActionService
} from '../src/recommended-action.js';
import { createMarkRegLifecycleSurfaceRoutes } from '../src/lifecycle-surface-http.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
const formalMatterId = 'formal-matter_wp06' as FormalMatterId;
const secret = 'm5-wp06-internal-service-secret-32-bytes-minimum';
const sha = (character: string) => character.repeat(64);
const active: ServiceRuntime[] = [];

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

function principal(permissions: WorkspacePrincipal['permissions'], workspace = workspaceId) {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_wp06',
    userId: 'user_wp06',
    workspaceId: workspace,
    membershipId: 'membership_wp06',
    role: 'MATTER_MANAGER',
    permissions,
    sessionExpiresAt: '2026-08-11T00:00:00.000Z'
  } satisfies WorkspacePrincipal;
}

const view: CurrentLifecycleView = {
  schemaVersion: 1,
  lifecycleViewId: 'lifecycle-view_wp06',
  workspaceId,
  formalMatter: { id: formalMatterId, version: 1 },
  version: 2,
  currentEvent: { id: 'lifecycle-event_wp06', version: 1 },
  currentEventFingerprintSha256: sha('a'),
  state: 'CUSTOMER_ACTION_NEEDED',
  customerSafeLabel: 'Action required',
  customerSafeSummary: 'Please review the requested information.',
  lifecycleViewFingerprintSha256: sha('b'),
  officialStatusVerified: false,
  updatedAt: '2026-08-10T03:00:00.000Z'
};

const event: LifecycleEventProjection = {
  schemaVersion: 1,
  lifecycleEventId: 'lifecycle-event_wp06',
  workspaceId,
  formalMatter: { id: formalMatterId, version: 1 },
  version: 1,
  source: {
    reviewedSourceAdmission: { id: 'reviewed-source-admission_wp06', version: 1 },
    admissionFingerprintSha256: sha('c'),
    evidenceReviewDecision: { id: 'evidence-review-decision_wp06', version: 1 },
    evidenceReceipt: { id: 'evidence-receipt_wp06', version: 1 },
    providerReturn: { id: 'provider-return_wp06', version: 1 },
    formalMatter: { id: formalMatterId, version: 1 }
  },
  state: 'CUSTOMER_ACTION_NEEDED',
  eventCode: 'CUSTOMER_INPUT_REQUIRED',
  customerSafeLabel: 'Action required',
  customerSafeSummary: 'Please review the requested information.',
  occurredAt: '2026-08-10T02:59:00.000Z',
  projectedAt: '2026-08-10T03:00:00.000Z',
  lifecycleEventFingerprintSha256: sha('d'),
  officialStatusVerified: false,
  correlationId: 'correlation_wp06'
};

const action: RecommendedAction = {
  schemaVersion: 1,
  recommendedActionId: 'recommended-action_wp06',
  workspaceId,
  formalMatter: { id: formalMatterId, version: 1 },
  version: 3,
  sourceLifecycleView: { id: view.lifecycleViewId, version: view.version },
  sourceLifecycleViewFingerprintSha256: view.lifecycleViewFingerprintSha256,
  policyVersion: 'recommended-action-policy-v1',
  actionCode: 'CUSTOMER_ACTION_REQUIRED',
  title: 'Review required action',
  explanation: 'Please review the requested information.',
  timingBasis: 'No deadline inferred.',
  status: 'OPEN',
  recommendedActionFingerprintSha256: sha('e'),
  executionAuthorized: false,
  createdAt: '2026-08-10T03:00:00.000Z',
  updatedAt: '2026-08-10T03:00:00.000Z'
};

const customerAction: RecommendedActionCustomerProjection = {
  recommendedActionId: action.recommendedActionId,
  formalMatter: action.formalMatter,
  version: action.version,
  title: action.title,
  explanation: action.explanation,
  timingBasis: action.timingBasis,
  status: action.status,
  executionAuthorized: false,
  updatedAt: action.updatedAt
};

async function stack(options?: { noAction?: boolean; staleMutation?: boolean }) {
  const formalMatters = {
    findById: async (requestedWorkspace: string, id: string) =>
      requestedWorkspace === workspaceId && id === formalMatterId
        ? ({ formalMatterId, workspaceId } as FormalMatter)
        : null
  } as unknown as FormalMatterRepository;
  const lifecycle = {
    getCurrentView: async () => structuredClone(view),
    listEvents: async () => [structuredClone(event)]
  } as unknown as LifecycleProjectionService;
  const recommendations = {
    getCustomerProjection: async () => (options?.noAction ? null : structuredClone(customerAction)),
    getForOperations: async () => structuredClone(action),
    transition: async () => {
      if (options?.staleMutation)
        throw new RecommendedActionError(
          'VERSION_CONFLICT',
          'Recommended Action version changed before transition.'
        );
      return {
        sourceLifecycleView: action.sourceLifecycleView,
        sourceLifecycleViewFingerprintSha256: action.sourceLifecycleViewFingerprintSha256,
        policyVersion: action.policyVersion,
        action: { ...structuredClone(action), status: 'ACKNOWLEDGED' as const, version: 4 }
      };
    }
  } as unknown as RecommendedActionService;
  const runtime = createServiceRuntime(
    { name: 'markreg-wp06-surface-test', port: 0, version: '1' },
    {
      routes: createMarkRegLifecycleSurfaceRoutes({
        internalServiceSecret: secret,
        formalMatterRepository: formalMatters,
        lifecycleServiceFor: () => lifecycle,
        recommendedActionServiceFor: () => recommendations
      })
    }
  );
  active.push(runtime);
  await runtime.start();
  return `http://127.0.0.1:${runtime.listeningPort}`;
}

function headers(value: WorkspacePrincipal) {
  return {
    'content-type': 'application/json',
    'x-markorbit-internal-authorization': secret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
    'x-markorbit-workspace-id': value.workspaceId
  };
}

describe('M5-WP-06 MarkReg lifecycle surfaces', () => {
  it('returns a customer-safe bounded lifecycle without internal provenance', async () => {
    const base = await stack();
    const response = await fetch(`${base}/v1/formal-matters/${formalMatterId}/lifecycle`, {
      headers: headers(principal(['matter:read']))
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      lifecycle: {
        lifecycleViewId: view.lifecycleViewId,
        customerSafeLabel: view.customerSafeLabel,
        officialStatusVerified: false
      },
      timeline: [
        {
          lifecycleEventId: event.lifecycleEventId,
          customerSafeSummary: event.customerSafeSummary,
          officialStatusVerified: false
        }
      ],
      recommendedAction: {
        recommendedActionId: action.recommendedActionId,
        executionAuthorized: false
      },
      noAction: false
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('admissionFingerprintSha256');
    expect(serialized).not.toContain('sourceLifecycleViewFingerprintSha256');
    expect(serialized).not.toContain('correlation_wp06');
  });

  it('shows an explicit no-action customer state when no current recommendation exists', async () => {
    const base = await stack({ noAction: true });
    const response = await fetch(`${base}/v1/formal-matters/${formalMatterId}/lifecycle`, {
      headers: headers(principal(['matter:read']))
    });
    expect(await response.json()).toMatchObject({ recommendedAction: null, noAction: true });
  });

  it('requires review:perform for Operations provenance and fails closed across Workspaces', async () => {
    const base = await stack();
    const denied = await fetch(
      `${base}/v1/operations/formal-matters/${formalMatterId}/lifecycle-provenance`,
      { headers: headers(principal(['matter:read', 'review:read'])) }
    );
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'PERMISSION_DENIED' });

    const crossWorkspacePrincipal = principal(['review:perform'], otherWorkspaceId);
    const crossWorkspace = await fetch(
      `${base}/v1/operations/formal-matters/${formalMatterId}/lifecycle-provenance`,
      { headers: headers(crossWorkspacePrincipal) }
    );
    expect(crossWorkspace.status).toBe(404);
    expect(await crossWorkspace.json()).toMatchObject({ code: 'FORMAL_MATTER_NOT_FOUND' });
  });

  it('preserves stale Recommended Action rejection without executing anything', async () => {
    const base = await stack({ staleMutation: true });
    const response = await fetch(
      `${base}/v1/recommended-actions/${action.recommendedActionId}/transition`,
      {
        method: 'POST',
        headers: headers(principal(['matter:manage'])),
        body: JSON.stringify({
          expectedVersion: 2,
          targetStatus: 'ACKNOWLEDGED',
          idempotencyKey: 'wp06-stale-action',
          correlationId: 'correlation_wp06_action'
        })
      }
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'VERSION_CONFLICT' });
  });
});
