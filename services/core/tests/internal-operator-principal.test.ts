import { AuthenticationError, type CommercialAdminAccountView } from '@markorbit/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  createEnvironmentCognitiveReadGrantSourceV1,
  InternalOperatorPrincipalResolverV1,
  StaticCognitiveReadGrantSourceV1
} from '../src/internal-operator-principal.js';

const userId = '018f0000-0000-7000-8000-000000000768';
const otherUserId = '018f0000-0000-7000-8000-000000000769';
const session = {
  kind: 'AUTHENTICATED_USER' as const,
  sessionId: 'session-768',
  userId,
  sessionExpiresAt: '2026-09-05T12:00:00.000Z'
};

function account(overrides: Partial<CommercialAdminAccountView> = {}): CommercialAdminAccountView {
  return {
    userId,
    email: 'operator@example.com',
    displayName: 'Cognitive Operator',
    accountType: 'INTERNAL',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    profileCreatedAt: '2026-09-01T00:00:00.000Z',
    profileUpdatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides
  };
}

function resolver(
  cognitiveReadGrants = new StaticCognitiveReadGrantSourceV1([userId]),
  inspected: CommercialAdminAccountView | null = account()
) {
  const resolveSession = vi.fn(() => Promise.resolve(session));
  const inspectAccount = vi.fn(() => Promise.resolve(inspected));
  return {
    resolveSession,
    inspectAccount,
    service: new InternalOperatorPrincipalResolverV1({
      authentication: { resolveSession },
      accountAccess: { inspectAccount },
      cognitiveReadGrants
    })
  };
}

describe('explicit cognitive read Internal Operator grant resolution', () => {
  it('issues a cognitive-only canonical Internal Operator principal for an exact explicit grant', async () => {
    const { service } = resolver();

    await expect(service.resolve('raw-session-token')).resolves.toEqual({
      kind: 'INTERNAL_OPERATOR',
      sessionId: session.sessionId,
      userId,
      capabilities: ['control-plane:cognitive:read'],
      sessionExpiresAt: session.sessionExpiresAt
    });
  });

  it('does not let active INTERNAL/commercial authority imply cognitive read', async () => {
    const { service } = resolver(new StaticCognitiveReadGrantSourceV1([otherUserId]));

    await expect(service.resolve('raw-session-token')).rejects.toMatchObject({
      code: 'PERMISSION_DENIED'
    });
  });

  it('rejects non-INTERNAL account classification before consulting cognitive grants', async () => {
    const grants = { hasGrant: vi.fn(() => Promise.resolve(true)) };
    const { service } = resolver(grants, account({ accountType: 'PROFESSIONAL' }));

    await expect(service.resolve('raw-session-token')).rejects.toMatchObject({
      code: 'PERMISSION_DENIED'
    });
    expect(grants.hasGrant).not.toHaveBeenCalled();
  });

  it('preserves invalid, expired, revoked and disabled session failures from authentication', async () => {
    const failure = new AuthenticationError('SESSION_REVOKED', 'Session is revoked.');
    const resolveSession = vi.fn(() => Promise.reject(failure));
    const service = new InternalOperatorPrincipalResolverV1({
      authentication: { resolveSession },
      accountAccess: { inspectAccount: vi.fn() },
      cognitiveReadGrants: new StaticCognitiveReadGrantSourceV1([userId])
    });

    await expect(service.resolve('revoked-token')).rejects.toBe(failure);
  });

  it('fails explicitly when the grant source is missing or malformed', async () => {
    const missing = resolver(createEnvironmentCognitiveReadGrantSourceV1(undefined)).service;
    await expect(missing.resolve('raw-session-token')).rejects.toMatchObject({
      code: 'AUTHENTICATION_SERVICE_UNAVAILABLE'
    });

    const malformed = resolver(
      createEnvironmentCognitiveReadGrantSourceV1(
        JSON.stringify({
          schemaVersion: 1,
          grants: [{ userId, capabilities: ['commercial-admin:read'] }]
        })
      )
    ).service;
    await expect(malformed.resolve('raw-session-token')).rejects.toMatchObject({
      code: 'AUTHENTICATION_SERVICE_UNAVAILABLE'
    });
  });

  it('accepts only strict exact-user cognitive grant configuration', async () => {
    const source = createEnvironmentCognitiveReadGrantSourceV1(
      JSON.stringify({
        schemaVersion: 1,
        grants: [{ userId, capabilities: ['control-plane:cognitive:read'] }]
      })
    );

    await expect(source.hasGrant(userId)).resolves.toBe(true);
    await expect(source.hasGrant(otherUserId)).resolves.toBe(false);
  });
});
