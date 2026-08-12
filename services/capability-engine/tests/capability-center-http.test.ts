import { describe, expect, it } from 'vitest';
import {
  capabilityLearningNoAuthorityConsequences,
  encodeInternalWorkspacePrincipal,
  type CapabilityProfileProjection,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import { createCapabilityCenterRoutes } from '../src/capability-center-http.js';
import type { PostgresCapabilityObservationLedger } from '../src/capability-observation-ledger.js';
import type { PostgresPrivateReflectionCandidateService } from '../src/private-reflection-candidate.js';
import type { PostgresReflectionDispositionProfileService } from '../src/reflection-disposition-profile.js';

const secret = 'wp06-capability-center-test-secret-32-bytes';
const workspaceId = '39393939-3939-4393-8393-393939393939';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  sessionId: 'session_wp06_center',
  userId: 'user_wp06_center',
  workspaceId,
  membershipId: 'membership_wp06_center',
  role: 'REVIEWER',
  permissions: ['workspace:read', 'review:perform'],
  sessionExpiresAt: '2030-01-01T00:00:00.000Z'
};
const profile: CapabilityProfileProjection = {
  schemaVersion: 1,
  capabilityProfileProjectionId: 'capability-profile_test',
  workspaceId,
  subjectUserId: principal.userId,
  version: 1,
  runtimeCapability: { id: 'runtime-capability_test', version: 1 },
  evidenceCount: 0,
  acceptedReflections: [],
  visibility: 'PRIVATE',
  numericProfessionalScore: null,
  verifiedBadge: false,
  generatedAt: '2026-08-12T02:00:00.000Z',
  authority: capabilityLearningNoAuthorityConsequences
};

function route() {
  const ledger = {
    listLedgerForSubject: (workspace: string, subject: string) => {
      expect(workspace).toBe(workspaceId);
      expect(subject).toBe(principal.userId);
      return Promise.resolve([]);
    }
  } as unknown as PostgresCapabilityObservationLedger;
  const candidates = {
    findVersion: () => Promise.resolve(undefined)
  } as unknown as PostgresPrivateReflectionCandidateService;
  const reflections = {
    listProfiles: (value: WorkspacePrincipal) => {
      expect(value.userId).toBe(principal.userId);
      return Promise.resolve([profile]);
    },
    getTwin: () => Promise.resolve(undefined)
  } as unknown as PostgresReflectionDispositionProfileService;
  return createCapabilityCenterRoutes({
    internalServiceSecret: secret,
    ledger,
    candidates,
    reflections,
    now: () => '2026-08-12T02:05:00.000Z'
  })[0]!;
}

describe('Capability Engine private Capability Center route', () => {
  it('derives Workspace and subject only from the trusted Core Principal', async () => {
    const result = await route().handle({
      method: 'GET',
      path: '/internal/v1/capability-center',
      params: {},
      query: {},
      headers: {
        'x-markorbit-internal-authorization': secret,
        'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
        'x-markorbit-workspace-id': workspaceId
      },
      body: undefined
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      workspaceId,
      subjectUserId: principal.userId,
      visibility: 'PRIVATE',
      pendingCandidates: []
    });
  });

  it('redacts cross-Workspace private state as not found', async () => {
    await expect(
      route().handle({
        method: 'GET',
        path: '/internal/v1/capability-center',
        params: {},
        query: {},
        headers: {
          'x-markorbit-internal-authorization': secret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
          'x-markorbit-workspace-id': '40404040-4040-4404-8404-404040404040'
        },
        body: undefined
      })
    ).rejects.toMatchObject({ status: 404, code: 'PRIVATE_STATE_NOT_FOUND' });
  });
});
