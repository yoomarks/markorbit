import { afterEach, describe, expect, it } from 'vitest';
import {
  encodeInternalWorkspacePrincipal,
  type FormalMatter,
  type FormalMatterId,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type {
  CurrentLifecycleView,
  LifecycleEventProjection
} from '@markorbit/contracts/evidence-lifecycle';
import {
  createServiceRuntime,
  type ServiceRuntime
} from '@markorbit/service-kit';
import type { FormalMatterRepository } from '../src/formal-matter.js';
import type { LifecycleProjectionService } from '../src/lifecycle-projection.js';
import type { RecommendedActionService } from '../src/recommended-action.js';
import { createMarkRegLifecycleSurfaceRoutes } from '../src/lifecycle-surface-http.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const otherWorkspaceId = '33333333-3333-4333-8333-333333333333';
const formalMatterId = 'formal-matter_examination-http' as FormalMatterId;
const secret = 'examination-stage-internal-service-secret-32-bytes';
const sha = (character: string) => character.repeat(64);
const active: ServiceRuntime[] = [];

afterEach(async () => {
  await Promise.all(active.splice(0).map((runtime) => runtime.stop()));
});

function principal(
  permissions: WorkspacePrincipal['permissions'],
  workspace = workspaceId
) {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_examination',
    userId: 'user_examination',
    workspaceId: workspace,
    membershipId: 'membership_examination',
    role: 'MATTER_MANAGER',
    permissions,
    sessionExpiresAt: '2026-09-06T00:00:00.000Z'
  } satisfies WorkspacePrincipal;
}

const currentEvent: LifecycleEventProjection = {
  schemaVersion: 1,
  lifecycleEventId: 'lifecycle-event_examination-http',
  workspaceId,
  formalMatter: { id: formalMatterId, version: 1 },
  version: 3,
  source: {
    reviewedSourceAdmission: {
      id: 'reviewed-source-admission_examination-http',
      version: 2
    },
    admissionFingerprintSha256: sha('a'),
    evidenceReviewDecision: {
      id: 'evidence-review-decision_examination-http',
      version: 2
    },
    evidenceReceipt: { id: 'evidence-receipt_examination-http', version: 4 },
    providerReturn: { id: 'provider-return_examination-http', version: 5 },
    formalMatter: { id: formalMatterId, version: 1 }
  },
  state: 'CUSTOMER_ACTION_NEEDED',
  eventCode: 'EXAMINATION_CUSTOMER_ACTION_NEEDED',
  customerSafeLabel: 'Customer action needed',
  customerSafeSummary: 'Reviewed evidence requires customer attention.',
  occurredAt: '2026-09-05T01:00:00.000Z',
  projectedAt: '2026-09-05T01:01:00.000Z',
  lifecycleEventFingerprintSha256: sha('b'),
  officialStatusVerified: false,
  correlationId: 'correlation_examination-http' as never
};

const currentView: CurrentLifecycleView = {
  schemaVersion: 1,
  lifecycleViewId: 'lifecycle-view_examination-http',
  workspaceId,
  formalMatter: { id: formalMatterId, version: 1 },
  version: 6,
  currentEvent: { id: currentEvent.lifecycleEventId, version: currentEvent.version },
  currentEventFingerprintSha256: currentEvent.lifecycleEventFingerprintSha256,
  state: currentEvent.state,
  customerSafeLabel: currentEvent.customerSafeLabel,
  customerSafeSummary: currentEvent.customerSafeSummary,
  lifecycleViewFingerprintSha256: sha('c'),
  officialStatusVerified: false,
  updatedAt: '2026-09-05T01:01:00.000Z'
};

function headers(value: WorkspacePrincipal, suppliedSecret = secret) {
  return {
    'x-markorbit-internal-authorization': suppliedSecret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
    'x-markorbit-workspace-id': value.workspaceId
  };
}

async function stack(
  input: {
    lifecycleFailure?: boolean;
    noMatter?: boolean;
    noLifecycle?: boolean;
  } = {}
) {
  const formalMatters = {
    findById: (requestedWorkspace: string, id: string) =>
      Promise.resolve(
        !input.noMatter && requestedWorkspace === workspaceId && id === formalMatterId
          ? ({ formalMatterId, workspaceId, version: 1 } as FormalMatter)
          : null
      )
  } as unknown as FormalMatterRepository;
  const lifecycle = {
    getCurrentView: () =>
      input.lifecycleFailure
        ? Promise.reject(new Error('lifecycle offline'))
        : Promise.resolve(
            input.noLifecycle ? undefined : structuredClone(currentView)
          ),
    listEvents: () =>
      input.lifecycleFailure
        ? Promise.reject(new Error('lifecycle offline'))
        : Promise.resolve(
            input.noLifecycle ? [] : [structuredClone(currentEvent)]
          )
  } as unknown as LifecycleProjectionService;
  const recommendations = {} as RecommendedActionService;
  const runtime = createServiceRuntime(
    { name: 'markreg-examination-http-test', port: 0, version: '1' },
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

const endpoint = (base: string) =>
  `${base}/internal/v1/formal-matters/${formalMatterId}/examination`;

describe('Examination Stage V1 internal owner route', () => {
  it(
    'returns exact governed Examination projection through the production lifecycle surface wiring',
    async () => {
      const base = await stack();
      const response = await fetch(endpoint(base), {
        headers: headers(principal(['matter:read']))
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        examination: {
          schemaVersion: 1,
          workspaceId,
          formalMatter: { id: formalMatterId, version: 1 },
          status: 'ESTABLISHED',
          current: {
            eventCode: 'EXAMINATION_CUSTOMER_ACTION_NEEDED',
            lifecycleView: {
              id: currentView.lifecycleViewId,
              version: currentView.version,
              fingerprintSha256: currentView.lifecycleViewFingerprintSha256
            },
            lifecycleEvent: {
              id: currentEvent.lifecycleEventId,
              version: currentEvent.version,
              fingerprintSha256: currentEvent.lifecycleEventFingerprintSha256
            },
            source: {
              reviewedSourceAdmission: {
                id: currentEvent.source.reviewedSourceAdmission.id,
                version: 2,
                fingerprintSha256: sha('a')
              },
              providerReturn: currentEvent.source.providerReturn
            },
            sourceCurrentness: 'CURRENT',
            officialStatusVerified: false
          },
          deadline: null,
          deadlineStatus: 'UNAVAILABLE',
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
    }
  );

  it('keeps successful known absence as HTTP 200 NOT_ESTABLISHED', async () => {
    const base = await stack({ noLifecycle: true });
    const response = await fetch(endpoint(base), {
      headers: headers(principal(['matter:read']))
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      examination: { status: 'NOT_ESTABLISHED', current: null, history: [] }
    });
  });

  it(
    'requires trusted internal authorization and encoded Workspace Principal',
    async () => {
      const base = await stack();
      const wrongSecret = await fetch(endpoint(base), {
        headers: headers(
          principal(['matter:read']),
          'wrong-secret-that-is-still-long-enough-000'
        )
      });
      expect(wrongSecret.status).toBe(401);
      expect(await wrongSecret.json()).toMatchObject({
        code: 'UNTRUSTED_INTERNAL_CALLER'
      });

      const missingPrincipal = await fetch(endpoint(base), {
        headers: {
          'x-markorbit-internal-authorization': secret,
          'x-markorbit-workspace-id': workspaceId
        }
      });
      expect(missingPrincipal.status).toBe(401);
      expect(await missingPrincipal.json()).toMatchObject({
        code: 'INVALID_INTERNAL_PRINCIPAL'
      });
    }
  );

  it(
    'fails privacy-safe on authoritative Workspace mismatch and requires matter:read',
    async () => {
      const base = await stack();
      const workspaceMismatchHeaders = headers(principal(['matter:read']));
      workspaceMismatchHeaders['x-markorbit-workspace-id'] = otherWorkspaceId;
      const mismatch = await fetch(endpoint(base), {
        headers: workspaceMismatchHeaders
      });
      expect(mismatch.status).toBe(404);
      expect(await mismatch.json()).toMatchObject({ code: 'WORKSPACE_MISMATCH' });

      const denied = await fetch(endpoint(base), {
        headers: headers(principal(['review:read']))
      });
      expect(denied.status).toBe(403);
      expect(await denied.json()).toMatchObject({ code: 'PERMISSION_DENIED' });
    }
  );

  it(
    'returns privacy-safe 404 for missing or cross-Workspace Formal Matter',
    async () => {
      const base = await stack({ noMatter: true });
      const response = await fetch(endpoint(base), {
        headers: headers(principal(['matter:read']))
      });
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: 'FORMAL_MATTER_NOT_FOUND' });
    }
  );

  it(
    'returns retryable 503 when lifecycle persistence is unavailable instead of fabricating absence',
    async () => {
      const base = await stack({ lifecycleFailure: true });
      const response = await fetch(endpoint(base), {
        headers: headers(principal(['matter:read']))
      });
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        code: 'EXAMINATION_TRUTH_UNAVAILABLE',
        retryable: true
      });
    }
  );
});
