/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- boundary tests intentionally capture normalized transport commands. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import type { ServiceRuntime } from '@markorbit/service-kit';
import {
  createRuntime,
  MGSN_GOVERNED_HUMAN_ACTION_HEADER,
  type MgsnGovernedHumanActionEnvelopeV1,
  type MgsnGovernedNetworkHttpServices
} from '../src/index.js';

const secret = 'mgsn-governed-network-test-secret-32-bytes';
const workspaceId = '018f0000-0000-7000-8000-000000000381';
const userId = '018f0000-0000-7000-8000-000000000394';
const membershipId = '018f0000-0000-7000-8000-000000000395';
const selectionId = 'provider-selection_http-825';
const handoffId = 'controlled-handoff_http-825';
let runtime: ServiceRuntime;
let base = '';
let captured: any;

function principal(): WorkspacePrincipal {
  return {
    kind: 'WORKSPACE',
    sessionId: 'session_http_825',
    userId,
    workspaceId,
    membershipId,
    role: 'WORKSPACE_ADMIN',
    permissions: ['execution:read', 'execution:manage'],
    sessionExpiresAt: '2026-09-05T10:00:00.000Z'
  };
}

function humanAction(
  kind: MgsnGovernedHumanActionEnvelopeV1['kind']
): MgsnGovernedHumanActionEnvelopeV1 {
  return {
    schemaVersion: 1,
    kind,
    actorKind: 'HUMAN_USER',
    workspaceId,
    userId,
    membershipId,
    principalReference: `core-principal-reference:${kind.toLowerCase()}`,
    authorityReference: `reviewed-authority:${kind.toLowerCase()}`,
    authorityVersion: 1,
    authenticatedAt: '2026-09-05T01:58:00.000Z',
    affirmativeHumanActionEvidenceReference: `human-action-evidence:${kind.toLowerCase()}`,
    payloadIdentityAuthoritative: false
  };
}

function encodeHumanAction(kind: MgsnGovernedHumanActionEnvelopeV1['kind']): string {
  return Buffer.from(JSON.stringify(humanAction(kind)), 'utf8').toString('base64url');
}

function headers(options: {
  kind?: MgsnGovernedHumanActionEnvelopeV1['kind'];
  idempotencyKey?: string;
} = {}) {
  const value = principal();
  return {
    'x-markorbit-internal-authorization': secret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(value),
    'x-markorbit-workspace-id': value.workspaceId,
    ...(options.kind
      ? { [MGSN_GOVERNED_HUMAN_ACTION_HEADER]: encodeHumanAction(options.kind) }
      : {}),
    ...(options.idempotencyKey ? { 'idempotency-key': options.idempotencyKey } : {})
  };
}

function governedServices(): MgsnGovernedNetworkHttpServices {
  return {
    providerDiscovery: {
      evaluate: (trustedPrincipal: any, request: any) => {
        captured = { kind: 'discovery', trustedPrincipal, request };
        return Promise.resolve({ schemaVersion: 1, status: 'NO_CANDIDATES' } as any);
      }
    },
    providerSelection: {
      createOrReplace: (trustedPrincipal: any, command: any) => {
        captured = { kind: 'selection-create', trustedPrincipal, command };
        return Promise.resolve({ mutation: 'CREATED', selection: { providerSelectionId: selectionId } } as any);
      },
      revoke: (trustedPrincipal: any, command: any) => {
        captured = { kind: 'selection-revoke', trustedPrincipal, command };
        return Promise.resolve({ mutation: 'REVOKED', selection: { providerSelectionId: selectionId } } as any);
      },
      validateCurrent: (trustedPrincipal: any, input: any) => {
        captured = { kind: 'selection-validate', trustedPrincipal, input };
        return Promise.resolve({ decision: 'CURRENTLY_USABLE_FOR_BOUNDED_REVIEW' } as any);
      }
    },
    controlledHandoff: {
      authorizeOrReplace: (trustedPrincipal: any, command: any) => {
        captured = { kind: 'handoff-authorize', trustedPrincipal, command };
        return Promise.resolve({ mutation: 'AUTHORIZED', envelope: { controlledHandoffId: handoffId } } as any);
      },
      revoke: (trustedPrincipal: any, command: any) => {
        captured = { kind: 'handoff-revoke', trustedPrincipal, command };
        return Promise.resolve({ mutation: 'REVOKED', envelope: { controlledHandoffId: handoffId } } as any);
      },
      validateCurrent: (trustedPrincipal: any, input: any) => {
        captured = { kind: 'handoff-validate', trustedPrincipal, input };
        return Promise.resolve({ decision: 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION' } as any);
      }
    },
    governedAllocation: {
      allocate: (command: any) => {
        captured = { kind: 'governed-allocation', command };
        return Promise.resolve({ allocation: { allocationId: 'allocation_http-825' } } as any);
      }
    }
  };
}

beforeEach(async () => {
  captured = undefined;
  runtime = createRuntime({
    port: 0,
    internalServiceSecret: secret,
    governedNetworkServices: governedServices()
  });
  await runtime.start();
  base = `http://127.0.0.1:${runtime.listeningPort}`;
});

afterEach(async () => runtime.stop());

describe('MGSN governed-network internal HTTP producer', () => {
  it('derives Discovery requester identity from the trusted Workspace Principal', async () => {
    const response = await fetch(`${base}/v1/governed-network/discovery/evaluate`, {
      method: 'POST',
      headers: { ...headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, providerDiscoveryRequestId: 'request_http-825' })
    });

    expect(response.status).toBe(200);
    expect(captured).toMatchObject({
      kind: 'discovery',
      trustedPrincipal: { workspaceId, actorId: userId },
      request: { requesterWorkspaceId: workspaceId }
    });
  });

  it('rejects browser/body authority labels even when the internal principal is trusted', async () => {
    const response = await fetch(`${base}/v1/governed-network/discovery/evaluate`, {
      method: 'POST',
      headers: { ...headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, requesterWorkspaceId: 'spoofed-workspace' })
    });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('SPOOFED_GOVERNED_NETWORK_AUTHORITY');
    expect(captured).toBeUndefined();
  });

  it('does not treat execution:manage as Human Provider Selection authority', async () => {
    const response = await fetch(`${base}/v1/governed-network/selections`, {
      method: 'POST',
      headers: { ...headers({ idempotencyKey: 'selection-no-human-action' }), 'content-type': 'application/json' },
      body: JSON.stringify({ sourceLineage: { discoveryRequest: {} } })
    });

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('GOVERNED_HUMAN_ACTION_REQUIRED');
    expect(captured).toBeUndefined();
  });

  it('binds Selection to the exact operation-scoped human action and injects trusted identity', async () => {
    const response = await fetch(`${base}/v1/governed-network/selections`, {
      method: 'POST',
      headers: {
        ...headers({ kind: 'PROVIDER_SELECTION', idempotencyKey: 'selection-create' }),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        schemaVersion: 1,
        scope: { owner: 'LITE', reference: 'need:http-825', version: 1, fingerprintSha256: '1'.repeat(64) },
        sourceLineage: { discoveryRequest: { requesterWorkspaceId: 'ignored-lineage-input' } },
        acknowledgement: { affirmativeHumanAction: true },
        expectedCurrent: { kind: 'ABSENT', expectedScopeVersion: 0 },
        commandFingerprintSha256: '2'.repeat(64),
        correlationId: 'correlation_http_825_selection'
      })
    });

    expect(response.status).toBe(201);
    expect(captured.kind).toBe('selection-create');
    expect(captured.trustedPrincipal).toMatchObject({
      workspaceId,
      actorId: userId,
      actorKind: 'HUMAN_USER',
      workspaceMembershipReference: membershipId,
      selectionAuthorityReference: 'reviewed-authority:provider_selection',
      affirmativeHumanActionEvidenceReference: 'human-action-evidence:provider_selection'
    });
    expect(captured.command).toMatchObject({
      requesterWorkspaceId: workspaceId,
      idempotencyKey: 'selection-create',
      sourceLineage: { discoveryRequest: { requesterWorkspaceId: workspaceId } },
      trustedHumanAuthority: {
        source: 'CORE_WORKSPACE_PRINCIPAL',
        requesterWorkspaceId: workspaceId,
        selectingActorId: userId,
        workspaceMembershipReference: membershipId,
        selectionAuthorityReference: 'reviewed-authority:provider_selection',
        payloadIdentityAuthoritative: false
      }
    });
  });

  it('does not allow a Selection human-action envelope to authorize Controlled Handoff', async () => {
    const response = await fetch(`${base}/v1/governed-network/handoffs`, {
      method: 'POST',
      headers: {
        ...headers({ kind: 'PROVIDER_SELECTION', idempotencyKey: 'handoff-wrong-kind' }),
        'content-type': 'application/json'
      },
      body: JSON.stringify({ privacyPreviewAcknowledgement: {} })
    });

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('INVALID_GOVERNED_HUMAN_ACTION');
    expect(captured).toBeUndefined();
  });

  it('binds Controlled Handoff to a separate human action and trusted originating Workspace', async () => {
    const response = await fetch(`${base}/v1/governed-network/handoffs`, {
      method: 'POST',
      headers: {
        ...headers({ kind: 'CONTROLLED_HANDOFF', idempotencyKey: 'handoff-authorize' }),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        schemaVersion: 1,
        privacyPreviewAcknowledgement: { originatingWorkspaceId: 'ignored-preview-input' },
        commandFingerprintSha256: '3'.repeat(64),
        correlationId: 'correlation_http_825_handoff'
      })
    });

    expect(response.status).toBe(201);
    expect(captured.kind).toBe('handoff-authorize');
    expect(captured.trustedPrincipal).toMatchObject({
      workspaceId,
      actorId: userId,
      actorKind: 'HUMAN_USER',
      handoffAuthorityReference: 'reviewed-authority:controlled_handoff',
      affirmativeHumanActionEvidenceReference: 'human-action-evidence:controlled_handoff'
    });
    expect(captured.command).toMatchObject({
      originatingWorkspaceId: workspaceId,
      idempotencyKey: 'handoff-authorize',
      privacyPreviewAcknowledgement: { originatingWorkspaceId: workspaceId },
      trustedHumanAuthority: {
        source: 'CORE_WORKSPACE_PRINCIPAL',
        originatingWorkspaceId: workspaceId,
        authorizingActorId: userId,
        workspaceMembershipReference: membershipId,
        handoffAuthorityReference: 'reviewed-authority:controlled_handoff',
        payloadIdentityAuthoritative: false
      }
    });
  });

  it('rejects artifact retrieval through generic Handoff validation transport', async () => {
    const response = await fetch(
      `${base}/v1/governed-network/handoffs/${handoffId}/validate-current`,
      {
        method: 'POST',
        headers: { ...headers(), 'content-type': 'application/json' },
        body: JSON.stringify({
          envelope: { version: 1 },
          purpose: 'HANDOFF_CONSUMPTION',
          attempt: { artifactRetrievalRequested: true }
        })
      }
    );

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ARTIFACT_RETRIEVAL_NOT_AUTHORIZED');
    expect(captured).toBeUndefined();
  });

  it('requires exact idempotency binding for governed mutations', async () => {
    const response = await fetch(`${base}/v1/governed-network/allocations`, {
      method: 'POST',
      headers: {
        ...headers({ idempotencyKey: 'header-key' }),
        'content-type': 'application/json'
      },
      body: JSON.stringify({ idempotencyKey: 'body-key' })
    });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('IDEMPOTENCY_KEY_MISMATCH');
    expect(captured).toBeUndefined();
  });

  it('routes the explicit-human-choice path only to governed Allocation with trusted identity', async () => {
    const response = await fetch(`${base}/v1/governed-network/allocations`, {
      method: 'POST',
      headers: {
        ...headers({ idempotencyKey: 'governed-allocation' }),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        servicePackageId: 'service-package_http-825',
        selection: { providerSelectionId: selectionId, version: 1, scopeVersion: 1 },
        selectionScope: {
          owner: 'LITE',
          reference: 'need:http-825',
          version: 1,
          fingerprintSha256: '1'.repeat(64)
        },
        handoffBinding: { mode: 'NONE_EXPLICIT' }
      })
    });

    expect(response.status).toBe(201);
    expect(captured).toEqual({
      kind: 'governed-allocation',
      command: expect.objectContaining({
        workspaceId,
        actorId: userId,
        idempotencyKey: 'governed-allocation',
        handoffBinding: { mode: 'NONE_EXPLICIT' }
      })
    });
  });
});
