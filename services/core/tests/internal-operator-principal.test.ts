import { AuthenticationError, type CommercialAdminAccountView } from '@markorbit/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  createEnvironmentCognitiveReadGrantSourceV1,
  createEnvironmentDataReadGrantSourceV1,
  type CognitiveReadGrantSourceV1,
  type DataReadGrantSourceV1,
  InternalOperatorPrincipalResolverV1,
  StaticCognitiveReadGrantSourceV1,
  StaticDataReadGrantSourceV1
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
    displayName: 'Control Plane Operator',
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
  cognitiveReadGrants: CognitiveReadGrantSourceV1 = new StaticCognitiveReadGrantSourceV1([userId]),
  inspected: CommercialAdminAccountView | null = account(),
  dataReadGrants: DataReadGrantSourceV1 = new StaticDataReadGrantSourceV1([userId])
) {
  const resolveSession = vi.fn(() => Promise.resolve(session));
  const inspectAccount = vi.fn(() => Promise.resolve(inspected));
  return {
    resolveSession,
    inspectAccount,
    service: new InternalOperatorPrincipalResolverV1({
      authentication: { resolveSession },
      accountAccess: { inspectAccount },
      cognitiveReadGrants,
      dataReadGrants
    })
  };
}

describe('explicit Control Plane read Internal Operator grant resolution', () => {
  it('preserves token-only cognitive resolution as a cognitive-only principal', async () => {
    const { service } = resolver();

    await expect(service.resolve('raw-session-token')).resolves.toEqual({
      kind: 'INTERNAL_OPERATOR',
      sessionId: session.sessionId,
      userId,
      capabilities: ['control-plane:cognitive:read'],
      sessionExpiresAt: session.sessionExpiresAt
    });
  });

  it('issues a Data-only principal only for an exact explicit Data grant and request', async () => {
    const { service } = resolver();

    await expect(service.resolve('raw-session-token', 'control-plane:data:read')).resolves.toEqual({
      kind: 'INTERNAL_OPERATOR',
      sessionId: session.sessionId,
      userId,
      capabilities: ['control-plane:data:read'],
      sessionExpiresAt: session.sessionExpiresAt
    });
  });

  it('does not let active INTERNAL/commercial authority imply the requested Control Plane read', async () => {
    const { service } = resolver(
      new StaticCognitiveReadGrantSourceV1([otherUserId]),
      account(),
      new StaticDataReadGrantSourceV1([otherUserId])
    );

    await expect(service.resolve('raw-session-token')).rejects.toMatchObject({
      code: 'PERMISSION_DENIED'
    });
    await expect(
      service.resolve('raw-session-token', 'control-plane:data:read')
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('keeps cognitive resolution independent from missing or malformed Data grant truth', async () => {
    const missingData = resolver(
      new StaticCognitiveReadGrantSourceV1([userId]),
      account(),
      createEnvironmentDataReadGrantSourceV1(undefined)
    ).service;
    await expect(missingData.resolve('raw-session-token')).resolves.toMatchObject({
      capabilities: ['control-plane:cognitive:read']
    });

    const malformedData = resolver(
      new StaticCognitiveReadGrantSourceV1([userId]),
      account(),
      createEnvironmentDataReadGrantSourceV1(
        JSON.stringify({
          schemaVersion: 1,
          grants: [{ userId, capabilities: ['control-plane:data:operate'] }]
        })
      )
    ).service;
    await expect(malformedData.resolve('raw-session-token')).resolves.toMatchObject({
      capabilities: ['control-plane:cognitive:read']
    });
  });

  it('keeps Data resolution independent from missing or malformed cognitive grant truth', async () => {
    const missingCognitive = resolver(
      createEnvironmentCognitiveReadGrantSourceV1(undefined),
      account(),
      new StaticDataReadGrantSourceV1([userId])
    ).service;
    await expect(
      missingCognitive.resolve('raw-session-token', 'control-plane:data:read')
    ).resolves.toMatchObject({ capabilities: ['control-plane:data:read'] });

    const malformedCognitive = resolver(
      createEnvironmentCognitiveReadGrantSourceV1(
        JSON.stringify({
          schemaVersion: 1,
          grants: [{ userId, capabilities: ['commercial-admin:read'] }]
        })
      ),
      account(),
      new StaticDataReadGrantSourceV1([userId])
    ).service;
    await expect(
      malformedCognitive.resolve('raw-session-token', 'control-plane:data:read')
    ).resolves.toMatchObject({ capabilities: ['control-plane:data:read'] });
  });

  it('rejects non-INTERNAL account classification before consulting grants', async () => {
    const cognitiveGrants = { hasGrant: vi.fn(() => Promise.resolve(true)) };
    const dataGrants = { hasGrant: vi.fn(() => Promise.resolve(true)) };
    const { service } = resolver(
      cognitiveGrants,
      account({ accountType: 'PROFESSIONAL' }),
      dataGrants
    );

    await expect(
      service.resolve('raw-session-token', 'control-plane:data:read')
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(cognitiveGrants.hasGrant).not.toHaveBeenCalled();
    expect(dataGrants.hasGrant).not.toHaveBeenCalled();
  });

  it('preserves invalid, expired, revoked and disabled session failures from authentication', async () => {
    const failure = new AuthenticationError('SESSION_REVOKED', 'Session is revoked.');
    const resolveSession = vi.fn(() => Promise.reject(failure));
    const service = new InternalOperatorPrincipalResolverV1({
      authentication: { resolveSession },
      accountAccess: { inspectAccount: vi.fn() },
      cognitiveReadGrants: new StaticCognitiveReadGrantSourceV1([userId]),
      dataReadGrants: new StaticDataReadGrantSourceV1([userId])
    });

    await expect(service.resolve('revoked-token', 'control-plane:data:read')).rejects.toBe(failure);
  });

  it('fails explicitly when the requested grant source is missing or malformed', async () => {
    const missingCognitive = resolver(
      createEnvironmentCognitiveReadGrantSourceV1(undefined)
    ).service;
    await expect(missingCognitive.resolve('raw-session-token')).rejects.toMatchObject({
      code: 'AUTHENTICATION_SERVICE_UNAVAILABLE'
    });

    const malformedCognitive = resolver(
      createEnvironmentCognitiveReadGrantSourceV1(
        JSON.stringify({
          schemaVersion: 1,
          grants: [{ userId, capabilities: ['commercial-admin:read'] }]
        })
      )
    ).service;
    await expect(malformedCognitive.resolve('raw-session-token')).rejects.toMatchObject({
      code: 'AUTHENTICATION_SERVICE_UNAVAILABLE'
    });

    const missingData = resolver(
      new StaticCognitiveReadGrantSourceV1([userId]),
      account(),
      createEnvironmentDataReadGrantSourceV1(undefined)
    ).service;
    await expect(
      missingData.resolve('raw-session-token', 'control-plane:data:read')
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_SERVICE_UNAVAILABLE' });

    const malformedData = resolver(
      new StaticCognitiveReadGrantSourceV1([userId]),
      account(),
      createEnvironmentDataReadGrantSourceV1(
        JSON.stringify({
          schemaVersion: 1,
          grants: [{ userId, capabilities: ['control-plane:cognitive:read'] }]
        })
      )
    ).service;
    await expect(
      malformedData.resolve('raw-session-token', 'control-plane:data:read')
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_SERVICE_UNAVAILABLE' });
  });

  it('accepts only strict exact-user grant configuration for each read plane', async () => {
    const cognitive = createEnvironmentCognitiveReadGrantSourceV1(
      JSON.stringify({
        schemaVersion: 1,
        grants: [{ userId, capabilities: ['control-plane:cognitive:read'] }]
      })
    );
    const data = createEnvironmentDataReadGrantSourceV1(
      JSON.stringify({
        schemaVersion: 1,
        grants: [{ userId, capabilities: ['control-plane:data:read'] }]
      })
    );

    await expect(cognitive.hasGrant(userId)).resolves.toBe(true);
    await expect(cognitive.hasGrant(otherUserId)).resolves.toBe(false);
    await expect(data.hasGrant(userId)).resolves.toBe(true);
    await expect(data.hasGrant(otherUserId)).resolves.toBe(false);
  });
});
