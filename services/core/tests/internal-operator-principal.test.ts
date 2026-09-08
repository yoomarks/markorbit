import { AuthenticationError, type CommercialAdminAccountView } from '@markorbit/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  createEnvironmentCognitiveReadGrantSourceV1,
  createEnvironmentDataReadGrantSourceV1,
  createEnvironmentExecutionAdminReadGrantSourceV1,
  createEnvironmentKnowledgeReadGrantSourceV1,
  createEnvironmentSystemAdminReadGrantSourceV1,
  createEnvironmentWorkspaceAdminReadGrantSourceV1,
  createEnvironmentWorkspaceAdminManageGrantSourceV1,
  type CognitiveReadGrantSourceV1,
  type DataReadGrantSourceV1,
  type ExecutionAdminReadGrantSourceV1,
  type KnowledgeReadGrantSourceV1,
  type LiteAdminReadGrantSourceV1,
  type SystemAdminReadGrantSourceV1,
  type WorkspaceAdminReadGrantSourceV1,
  type WorkspaceAdminManageGrantSourceV1,
  InternalOperatorPrincipalResolverV1,
  StaticCognitiveReadGrantSourceV1,
  StaticDataReadGrantSourceV1,
  StaticExecutionAdminReadGrantSourceV1,
  StaticKnowledgeReadGrantSourceV1,
  StaticLiteAdminReadGrantSourceV1,
  StaticSystemAdminReadGrantSourceV1,
  StaticWorkspaceAdminReadGrantSourceV1,
  StaticWorkspaceAdminManageGrantSourceV1
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
  dataReadGrants: DataReadGrantSourceV1 = new StaticDataReadGrantSourceV1([userId]),
  knowledgeReadGrants: KnowledgeReadGrantSourceV1 = new StaticKnowledgeReadGrantSourceV1([userId]),
  workspaceAdminReadGrants: WorkspaceAdminReadGrantSourceV1 = new StaticWorkspaceAdminReadGrantSourceV1(
    [userId]
  ),
  workspaceAdminManageGrants: WorkspaceAdminManageGrantSourceV1 = new StaticWorkspaceAdminManageGrantSourceV1(
    [userId]
  ),
  liteAdminReadGrants: LiteAdminReadGrantSourceV1 = new StaticLiteAdminReadGrantSourceV1([userId]),
  executionAdminReadGrants: ExecutionAdminReadGrantSourceV1 = new StaticExecutionAdminReadGrantSourceV1(
    [userId]
  ),
  systemAdminReadGrants: SystemAdminReadGrantSourceV1 = new StaticSystemAdminReadGrantSourceV1([
    userId
  ])
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
      dataReadGrants,
      knowledgeReadGrants,
      workspaceAdminReadGrants,
      workspaceAdminManageGrants,
      liteAdminReadGrants,
      executionAdminReadGrants,
      systemAdminReadGrants
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

  it('issues a Knowledge-only principal only for an exact explicit Knowledge grant and request', async () => {
    const { service } = resolver();

    await expect(
      service.resolve('raw-session-token', 'control-plane:knowledge:read')
    ).resolves.toEqual({
      kind: 'INTERNAL_OPERATOR',
      sessionId: session.sessionId,
      userId,
      capabilities: ['control-plane:knowledge:read'],
      sessionExpiresAt: session.sessionExpiresAt
    });
  });

  it('issues a Lite-Admin-only principal only for an exact explicit Lite grant', async () => {
    const { service } = resolver();
    await expect(service.resolve('raw-session-token', 'lite-admin:read')).resolves.toEqual({
      kind: 'INTERNAL_OPERATOR',
      sessionId: session.sessionId,
      userId,
      capabilities: ['lite-admin:read'],
      sessionExpiresAt: session.sessionExpiresAt
    });
  });

  it('issues an Execution-Admin-only principal only for an exact explicit Execution grant', async () => {
    const { service } = resolver();
    await expect(service.resolve('raw-session-token', 'execution-admin:read')).resolves.toEqual({
      kind: 'INTERNAL_OPERATOR',
      sessionId: session.sessionId,
      userId,
      capabilities: ['execution-admin:read'],
      sessionExpiresAt: session.sessionExpiresAt
    });
  });

  it('issues a System-Admin-only principal only for an exact explicit System grant', async () => {
    const { service } = resolver();
    await expect(service.resolve('raw-session-token', 'system-admin:read')).resolves.toEqual({
      kind: 'INTERNAL_OPERATOR',
      sessionId: session.sessionId,
      userId,
      capabilities: ['system-admin:read'],
      sessionExpiresAt: session.sessionExpiresAt
    });
  });

  it('issues a Workspace-Admin-only principal only for an exact explicit grant', async () => {
    const { service } = resolver();

    await expect(service.resolve('raw-session-token', 'workspace-admin:read')).resolves.toEqual({
      kind: 'INTERNAL_OPERATOR',
      sessionId: session.sessionId,
      userId,
      capabilities: ['workspace-admin:read'],
      sessionExpiresAt: session.sessionExpiresAt
    });
  });

  it('issues a Workspace-Admin-manage-only principal only for an exact explicit manage grant', async () => {
    const { service } = resolver();

    await expect(service.resolve('raw-session-token', 'workspace-admin:manage')).resolves.toEqual({
      kind: 'INTERNAL_OPERATOR',
      sessionId: session.sessionId,
      userId,
      capabilities: ['workspace-admin:manage'],
      sessionExpiresAt: session.sessionExpiresAt
    });
  });

  it('does not let Workspace Admin read imply Workspace Admin manage', async () => {
    const { service } = resolver(
      new StaticCognitiveReadGrantSourceV1([userId]),
      account(),
      new StaticDataReadGrantSourceV1([userId]),
      new StaticKnowledgeReadGrantSourceV1([userId]),
      new StaticWorkspaceAdminReadGrantSourceV1([userId]),
      new StaticWorkspaceAdminManageGrantSourceV1([otherUserId])
    );

    await expect(
      service.resolve('raw-session-token', 'workspace-admin:manage')
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('does not let INTERNAL, Commercial or Control Plane authority imply Workspace Admin read', async () => {
    const { service } = resolver(
      new StaticCognitiveReadGrantSourceV1([userId]),
      account(),
      new StaticDataReadGrantSourceV1([userId]),
      new StaticKnowledgeReadGrantSourceV1([userId]),
      new StaticWorkspaceAdminReadGrantSourceV1([otherUserId])
    );

    await expect(
      service.resolve('raw-session-token', 'workspace-admin:read')
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED'
    });
  });

  it('does not let active INTERNAL/commercial authority imply the requested Control Plane read', async () => {
    const { service } = resolver(
      new StaticCognitiveReadGrantSourceV1([otherUserId]),
      account(),
      new StaticDataReadGrantSourceV1([otherUserId]),
      new StaticKnowledgeReadGrantSourceV1([otherUserId])
    );

    await expect(service.resolve('raw-session-token')).rejects.toMatchObject({
      code: 'PERMISSION_DENIED'
    });
    await expect(
      service.resolve('raw-session-token', 'control-plane:data:read')
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(
      service.resolve('raw-session-token', 'control-plane:knowledge:read')
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

  it('keeps Knowledge resolution independent from cognitive and Data grant truth', async () => {
    const missingCognitiveAndData = resolver(
      createEnvironmentCognitiveReadGrantSourceV1(undefined),
      account(),
      createEnvironmentDataReadGrantSourceV1(undefined),
      new StaticKnowledgeReadGrantSourceV1([userId])
    ).service;

    await expect(
      missingCognitiveAndData.resolve('raw-session-token', 'control-plane:knowledge:read')
    ).resolves.toMatchObject({ capabilities: ['control-plane:knowledge:read'] });
  });

  it('rejects non-INTERNAL account classification before consulting grants', async () => {
    const cognitiveGrants = { hasGrant: vi.fn(() => Promise.resolve(true)) };
    const dataGrants = { hasGrant: vi.fn(() => Promise.resolve(true)) };
    const knowledgeGrants = { hasGrant: vi.fn(() => Promise.resolve(true)) };
    const workspaceAdminGrants = { hasGrant: vi.fn(() => Promise.resolve(true)) };
    const { service } = resolver(
      cognitiveGrants,
      account({ accountType: 'PROFESSIONAL' }),
      dataGrants,
      knowledgeGrants,
      workspaceAdminGrants
    );

    await expect(
      service.resolve('raw-session-token', 'control-plane:data:read')
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(cognitiveGrants.hasGrant).not.toHaveBeenCalled();
    expect(dataGrants.hasGrant).not.toHaveBeenCalled();
    expect(knowledgeGrants.hasGrant).not.toHaveBeenCalled();
    expect(workspaceAdminGrants.hasGrant).not.toHaveBeenCalled();
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

    const missingKnowledge = resolver(
      new StaticCognitiveReadGrantSourceV1([userId]),
      account(),
      new StaticDataReadGrantSourceV1([userId]),
      createEnvironmentKnowledgeReadGrantSourceV1(undefined)
    ).service;
    await expect(
      missingKnowledge.resolve('raw-session-token', 'control-plane:knowledge:read')
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_SERVICE_UNAVAILABLE' });

    const malformedKnowledge = resolver(
      new StaticCognitiveReadGrantSourceV1([userId]),
      account(),
      new StaticDataReadGrantSourceV1([userId]),
      createEnvironmentKnowledgeReadGrantSourceV1(
        JSON.stringify({
          schemaVersion: 1,
          grants: [{ userId, capabilities: ['control-plane:data:read'] }]
        })
      )
    ).service;
    await expect(
      malformedKnowledge.resolve('raw-session-token', 'control-plane:knowledge:read')
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_SERVICE_UNAVAILABLE' });
  });

  it('fails closed when Workspace Admin grant truth is missing or malformed', async () => {
    const missing = resolver(
      new StaticCognitiveReadGrantSourceV1([userId]),
      account(),
      new StaticDataReadGrantSourceV1([userId]),
      new StaticKnowledgeReadGrantSourceV1([userId]),
      createEnvironmentWorkspaceAdminReadGrantSourceV1(undefined)
    ).service;
    await expect(
      missing.resolve('raw-session-token', 'workspace-admin:read')
    ).rejects.toMatchObject({
      code: 'AUTHENTICATION_SERVICE_UNAVAILABLE'
    });

    const malformed = resolver(
      new StaticCognitiveReadGrantSourceV1([userId]),
      account(),
      new StaticDataReadGrantSourceV1([userId]),
      new StaticKnowledgeReadGrantSourceV1([userId]),
      createEnvironmentWorkspaceAdminReadGrantSourceV1(
        JSON.stringify({
          schemaVersion: 1,
          grants: [{ userId, capabilities: ['control-plane:knowledge:read'] }]
        })
      )
    ).service;
    await expect(
      malformed.resolve('raw-session-token', 'workspace-admin:read')
    ).rejects.toMatchObject({
      code: 'AUTHENTICATION_SERVICE_UNAVAILABLE'
    });
  });

  it('fails closed when Workspace Admin manage grant truth is missing or malformed', async () => {
    const missing = resolver(
      new StaticCognitiveReadGrantSourceV1([userId]),
      account(),
      new StaticDataReadGrantSourceV1([userId]),
      new StaticKnowledgeReadGrantSourceV1([userId]),
      new StaticWorkspaceAdminReadGrantSourceV1([userId]),
      createEnvironmentWorkspaceAdminManageGrantSourceV1(undefined)
    ).service;
    await expect(
      missing.resolve('raw-session-token', 'workspace-admin:manage')
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_SERVICE_UNAVAILABLE' });

    const malformed = resolver(
      new StaticCognitiveReadGrantSourceV1([userId]),
      account(),
      new StaticDataReadGrantSourceV1([userId]),
      new StaticKnowledgeReadGrantSourceV1([userId]),
      new StaticWorkspaceAdminReadGrantSourceV1([userId]),
      createEnvironmentWorkspaceAdminManageGrantSourceV1(
        JSON.stringify({
          schemaVersion: 1,
          grants: [{ userId, capabilities: ['workspace-admin:read'] }]
        })
      )
    ).service;
    await expect(
      malformed.resolve('raw-session-token', 'workspace-admin:manage')
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

    const executionAdmin = createEnvironmentExecutionAdminReadGrantSourceV1(
      JSON.stringify({
        schemaVersion: 1,
        grants: [{ userId, capabilities: ['execution-admin:read'] }]
      })
    );
    const systemAdmin = createEnvironmentSystemAdminReadGrantSourceV1(
      JSON.stringify({
        schemaVersion: 1,
        grants: [{ userId, capabilities: ['system-admin:read'] }]
      })
    );
    const knowledge = createEnvironmentKnowledgeReadGrantSourceV1(
      JSON.stringify({
        schemaVersion: 1,
        grants: [{ userId, capabilities: ['control-plane:knowledge:read'] }]
      })
    );
    const workspaceAdmin = createEnvironmentWorkspaceAdminReadGrantSourceV1(
      JSON.stringify({
        schemaVersion: 1,
        grants: [{ userId, capabilities: ['workspace-admin:read'] }]
      })
    );
    const workspaceAdminManage = createEnvironmentWorkspaceAdminManageGrantSourceV1(
      JSON.stringify({
        schemaVersion: 1,
        grants: [{ userId, capabilities: ['workspace-admin:manage'] }]
      })
    );

    await expect(cognitive.hasGrant(userId)).resolves.toBe(true);
    await expect(cognitive.hasGrant(otherUserId)).resolves.toBe(false);
    await expect(data.hasGrant(userId)).resolves.toBe(true);
    await expect(data.hasGrant(otherUserId)).resolves.toBe(false);
    await expect(executionAdmin.hasGrant(userId)).resolves.toBe(true);
    await expect(executionAdmin.hasGrant(otherUserId)).resolves.toBe(false);
    await expect(systemAdmin.hasGrant(userId)).resolves.toBe(true);
    await expect(systemAdmin.hasGrant(otherUserId)).resolves.toBe(false);
    await expect(knowledge.hasGrant(userId)).resolves.toBe(true);
    await expect(knowledge.hasGrant(otherUserId)).resolves.toBe(false);
    await expect(workspaceAdmin.hasGrant(userId)).resolves.toBe(true);
    await expect(workspaceAdmin.hasGrant(otherUserId)).resolves.toBe(false);
    await expect(workspaceAdminManage.hasGrant(userId)).resolves.toBe(true);
    await expect(workspaceAdminManage.hasGrant(otherUserId)).resolves.toBe(false);
  });
});
