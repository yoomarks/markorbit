import { describe, expect, it, vi } from 'vitest';
import {
  encodeInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import type {
  CreatorPreference,
  ProductPreferenceEvent
} from '@markorbit/contracts/daily-workspace';
import {
  createProductPreferenceRoutes,
  type ProductPreferenceRecorder
} from '../src/preference-http.js';

const secret = 'm9-wp07-preference-http-internal-secret-0123456789';
const workspaceId = '93939393-9393-4939-8939-939393939393';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_m9_wp07_http',
  sessionId: 'session_m9_wp07_http',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_m9_wp07_http',
  role: 'READ_ONLY',
  permissions: ['workspace:read']
};

const event: ProductPreferenceEvent = {
  schemaVersion: 1,
  productPreferenceEventId: 'product-preference-event_http',
  workspaceId,
  subjectUserId: principal.userId,
  kind: 'SAVED',
  targetType: 'DAILY_ORBIT_ITEM',
  targetId: 'daily-orbit-item_http',
  targetVersion: 1,
  recordedAt: '2026-08-18T06:30:00.000Z',
  externalActionExecutedByMarkOrbit: false,
  externalOutcomeVerifiedByMarkOrbit: false,
  capabilityVerified: false
};
const preference: CreatorPreference = {
  schemaVersion: 1,
  creatorPreferenceId: 'creator-preference_http',
  workspaceId,
  subjectUserId: principal.userId,
  version: 1,
  source: 'PRODUCT_FEEDBACK',
  primaryJurisdictions: ['US'],
  professionalTopics: ['trademark'],
  targetAudiences: [],
  preferredPlatforms: [],
  tonePreferences: [],
  capabilityVerified: false,
  updatedAt: event.recordedAt
};

function request(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return {
    method: 'POST' as const,
    path: '/v1/product-preference-events',
    params: {},
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
      'x-markorbit-workspace-id': workspaceId,
      'idempotency-key': 'wp07-http-1',
      ...headers
    },
    body
  };
}

function route(recorder: ProductPreferenceRecorder) {
  const found = createProductPreferenceRoutes({ internalServiceSecret: secret, service: recorder })[0];
  if (!found) throw new Error('Product preference route missing.');
  return found;
}

describe('M9-WP07 Product preference HTTP boundary', () => {
  it('derives subject identity from the trusted Workspace Principal', async () => {
    const record = vi.fn(() => Promise.resolve({ event, preference }));
    const recorder: ProductPreferenceRecorder = { record };

    const result = await route(recorder).handle(
      request({
        kind: 'SAVED',
        targetType: 'DAILY_ORBIT_ITEM',
        targetId: 'daily-orbit-item_http',
        targetVersion: 1
      })
    );

    expect(result.status).toBe(201);
    expect(record).toHaveBeenCalledWith({
      workspaceId,
      subjectUserId: principal.userId,
      kind: 'SAVED',
      targetType: 'DAILY_ORBIT_ITEM',
      targetId: 'daily-orbit-item_http',
      targetVersion: 1,
      idempotencyKey: 'wp07-http-1'
    });
  });

  it('rejects browser-authored preference context before the Product service runs', async () => {
    const record = vi.fn(() => Promise.resolve({ event, preference }));
    const recorder: ProductPreferenceRecorder = { record };

    await expect(
      route(recorder).handle(
        request({
          kind: 'SAVED',
          targetType: 'DAILY_ORBIT_ITEM',
          targetId: 'daily-orbit-item_http',
          targetVersion: 1,
          jurisdictions: ['US']
        })
      )
    ).rejects.toMatchObject({
      status: 400,
      code: 'PREFERENCE_CONTEXT_SPOOF_REJECTED'
    });
    expect(record).not.toHaveBeenCalled();
  });

  it('fails closed when the trusted principal lacks workspace:read', async () => {
    const record = vi.fn(() => Promise.resolve({ event, preference }));
    const recorder: ProductPreferenceRecorder = { record };
    const denied = {
      ...principal,
      permissions: []
    } satisfies WorkspacePrincipal;

    await expect(
      route(recorder).handle(
        request(
          {
            kind: 'SAVED',
            targetType: 'DAILY_ORBIT_ITEM',
            targetId: 'daily-orbit-item_http',
            targetVersion: 1
          },
          { 'x-markorbit-principal': encodeInternalWorkspacePrincipal(denied) }
        )
      )
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(record).not.toHaveBeenCalled();
  });
});
