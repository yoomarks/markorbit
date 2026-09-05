import {
  encodeInternalOperatorPrincipal,
  encodeInternalWorkspacePrincipal
} from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import { describe, expect, it, vi } from 'vitest';
import { createCapabilityCognitiveReadRoutesV1 } from '../src/capability-cognitive-read-http.js';

const secret = 'capability-cognitive-read-secret-32-bytes';
const projection = {
  schemaVersion: 1 as const,
  generatedAt: '2026-09-04T16:00:00.000Z',
  source: {
    domain: 'CAPABILITY_ENGINE' as const,
    authority: 'RUNTIME_CAPABILITY_AND_IMPLEMENTATION_PROFILE_REGISTRIES' as const,
    availability: 'AVAILABLE' as const
  },
  sourceAdmissionPolicySource: {
    domain: 'CAPABILITY_ENGINE' as const,
    authority: 'SOURCE_ADMISSION_POLICY_CATALOG' as const,
    availability: 'AVAILABLE' as const
  },
  runtimeCapabilities: [],
  implementationProfiles: [],
  sourceAdmissionPolicies: [],
  catalogIntegrity: {
    status: 'CATALOG_HEALTHY' as const,
    snapshotFingerprintSha256: 'c'.repeat(64),
    auditFingerprintSha256: 'd'.repeat(64),
    findings: [],
    authority: {
      productionSourceAdmitted: false as const,
      implementationSelected: false as const,
      productStateCreated: false as const,
      brainGapCreated: false as const,
      methodImprovementTriggerCreated: false as const,
      researchMissionCreated: false as const,
      officialTruthCreated: false as const,
      automaticRemediationExecuted: false as const
    }
  },
  sourcePolicyBindingIntegrity: {
    status: 'SOURCE_POLICY_BINDINGS_HEALTHY' as const,
    snapshotFingerprintSha256: 'e'.repeat(64),
    auditFingerprintSha256: 'f'.repeat(64),
    findings: [],
    authority: {
      productionSourceAdmitted: false as const,
      sourceAdmissionEvaluated: false as const,
      methodCurrentnessEvaluated: false as const,
      referenceCurrentnessEvaluated: false as const,
      implementationSelected: false as const,
      policyMutated: false as const,
      productStateCreated: false as const,
      brainGapCreated: false as const,
      methodImprovementTriggerCreated: false as const,
      researchMissionCreated: false as const,
      officialTruthCreated: false as const,
      automaticRemediationExecuted: false as const
    }
  },
  summary: {
    runtimeCapabilityCount: 0,
    implementationProfileCount: 0,
    approvedImplementationProfileCount: 0,
    retiredImplementationProfileCount: 0,
    sourceAdmissionPolicyCount: 0,
    productionAdmissibleSourcePolicyCount: 0,
    pilotSourcePolicyCount: 0,
    fixtureTestSourcePolicyCount: 0,
    unsupportedSourcePolicyCount: 0
  }
};

function operator(
  capabilities: readonly (
    'commercial-admin:read' | 'commercial-admin:operate' | 'control-plane:cognitive:read'
  )[]
): string {
  return encodeInternalOperatorPrincipal({
    kind: 'INTERNAL_OPERATOR',
    sessionId: 'session-capability-cognitive',
    userId: 'operator-1',
    capabilities,
    sessionExpiresAt: '2026-09-05T00:00:00.000Z'
  });
}

function request(principal?: string, includeAuthorization = true): JsonRequest {
  return {
    method: 'GET',
    path: '/internal/control-plane/cognitive/capabilities',
    params: {},
    query: {},
    headers: {
      ...(includeAuthorization ? { 'x-markorbit-internal-authorization': secret } : {}),
      ...(principal ? { 'x-markorbit-principal': principal } : {})
    },
    body: undefined
  };
}

function route(read = vi.fn(() => Promise.resolve(projection))) {
  return {
    read,
    route: createCapabilityCognitiveReadRoutesV1({
      service: { read },
      internalServiceSecret: secret
    })[0]!
  };
}

describe('Capability cognitive read HTTP authority', () => {
  it('allows only a trusted Internal Operator with exact cognitive read authority', async () => {
    const { read, route: cognitiveRoute } = route();
    await expect(
      cognitiveRoute.handle(request(operator(['control-plane:cognitive:read'])))
    ).resolves.toEqual({ status: 200, body: projection });
    expect(read).toHaveBeenCalledOnce();
  });

  it('rejects missing internal service identity before owner reads', async () => {
    const { read, route: cognitiveRoute } = route();
    await expect(
      cognitiveRoute.handle(request(operator(['control-plane:cognitive:read']), false))
    ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    ['missing principal', undefined],
    ['malformed principal', 'not-a-principal']
  ])('rejects %s before owner reads', async (_label, principal) => {
    const { read, route: cognitiveRoute } = route();
    await expect(cognitiveRoute.handle(request(principal))).rejects.toMatchObject({ status: 401 });
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    ['no capabilities', []],
    ['commercial read only', ['commercial-admin:read']],
    ['commercial operate only', ['commercial-admin:operate']],
    ['both commercial capabilities', ['commercial-admin:read', 'commercial-admin:operate']]
  ] as const)('does not let %s imply cognitive authority', async (_label, capabilities) => {
    const { read, route: cognitiveRoute } = route();
    await expect(cognitiveRoute.handle(request(operator(capabilities)))).rejects.toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED'
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('fails closed for an unknown operator capability vocabulary', async () => {
    const { read, route: cognitiveRoute } = route();
    const unknown = Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        principal: {
          kind: 'INTERNAL_OPERATOR',
          sessionId: 'session-capability-cognitive',
          userId: 'operator-1',
          capabilities: ['control-plane:cognitive:read', 'capability:manage'],
          sessionExpiresAt: '2026-09-05T00:00:00.000Z'
        }
      }),
      'utf8'
    ).toString('base64url');
    await expect(cognitiveRoute.handle(request(unknown))).rejects.toMatchObject({ status: 401 });
    expect(read).not.toHaveBeenCalled();
  });

  it('does not accept Workspace authority as cognitive operator authority', async () => {
    const { read, route: cognitiveRoute } = route();
    const workspacePrincipal = encodeInternalWorkspacePrincipal({
      kind: 'WORKSPACE',
      sessionId: 'session-1',
      userId: 'operator-1',
      workspaceId: 'workspace-1',
      membershipId: 'membership-1',
      role: 'WORKSPACE_ADMIN',
      permissions: ['workspace:read'],
      sessionExpiresAt: '2026-09-05T00:00:00.000Z'
    });
    await expect(cognitiveRoute.handle(request(workspacePrincipal))).rejects.toMatchObject({
      status: 401
    });
    expect(read).not.toHaveBeenCalled();
  });
});
