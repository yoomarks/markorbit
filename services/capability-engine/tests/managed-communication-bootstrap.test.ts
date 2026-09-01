import { describe, expect, it, vi } from 'vitest';
import type { ManagedCommunicationMessageV1 } from '@markorbit/contracts/managed-communication';
import type { JsonRequest } from '@markorbit/service-kit';
import {
  MANAGED_COMMUNICATION_ACCOUNT_REF_ENV,
  MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF_ENV,
  MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV,
  MANAGED_COMMUNICATION_PROVIDER_ENV,
  MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV,
  MANAGED_COMMUNICATION_WORKSPACE_ID_ENV,
  resolveManagedCommunicationRuntimeConfigV1
} from '../src/managed-communication-bootstrap.js';
import { createManagedCommunicationRoutesV1 } from '../src/managed-communication-http.js';
import type { ManagedCommunicationInboundIngestionV1 } from '../src/managed-communication-inbound.js';

const secret = 'managed-communication-internal-secret-at-least-32-bytes';

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    [MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV]: '1',
    [MANAGED_COMMUNICATION_WORKSPACE_ID_ENV]: 'workspace_bootstrap',
    [MANAGED_COMMUNICATION_ACCOUNT_REF_ENV]: 'communication-account_bootstrap',
    [MANAGED_COMMUNICATION_PROVIDER_ENV]: 'provider-bootstrap',
    [MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF_ENV]: 'provider-account-bootstrap',
    ...overrides
  };
}

function message(): ManagedCommunicationMessageV1 {
  return {
    schemaVersion: 1,
    messageId: 'commmsg_bootstrap',
    accountRef: 'communication-account_bootstrap',
    threadRef: 'commthread_bootstrap',
    channel: 'EMAIL',
    direction: 'INBOUND',
    participants: [
      { role: 'SENDER', address: 'expert@example.test' },
      { role: 'TO', address: 'markorbit@example.test' }
    ],
    subject: 'Expert reply',
    textBody: 'Provider-neutral inbound evidence.',
    attachments: [],
    occurredAt: '2026-09-01T12:00:00.000Z',
    providerObservation: {
      provider: 'provider-bootstrap',
      providerMessageId: 'provider-message-bootstrap',
      providerThreadId: 'provider-thread-bootstrap',
      observedAt: '2026-09-01T12:00:01.000Z'
    }
  };
}

function request(body: unknown): JsonRequest {
  return {
    method: 'POST',
    path: '/internal/v1/managed-communication/observations',
    params: {},
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-workspace-id': 'workspace_bootstrap',
      'idempotency-key': 'inbound-bootstrap-1'
    },
    body
  };
}

describe('Managed Communication production bootstrap gates', () => {
  it('is explicitly disabled by default and rejects invalid or incomplete enablement', () => {
    expect(resolveManagedCommunicationRuntimeConfigV1({})).toBeNull();
    expect(() =>
      resolveManagedCommunicationRuntimeConfigV1({
        [MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV]: '1'
      })
    ).toThrow(/requires MO_MANAGED_COMMUNICATION_RUNTIME_ENABLED=1/u);
    expect(() =>
      resolveManagedCommunicationRuntimeConfigV1({
        [MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV]: 'yes'
      })
    ).toThrow(/must be exactly '0' or '1'/u);
    expect(() =>
      resolveManagedCommunicationRuntimeConfigV1({
        [MANAGED_COMMUNICATION_RUNTIME_ENABLED_ENV]: '1'
      })
    ).toThrow(/MO_MANAGED_COMMUNICATION_WORKSPACE_ID is required/u);
  });

  it('resolves only bounded account identity and keeps provider dispatch separately authorized', () => {
    expect(resolveManagedCommunicationRuntimeConfigV1(environment())).toEqual({
      workspaceId: 'workspace_bootstrap',
      accountRef: 'communication-account_bootstrap',
      provider: 'provider-bootstrap',
      providerAccountRef: 'provider-account-bootstrap',
      providerDispatchAuthorized: false
    });
    expect(
      resolveManagedCommunicationRuntimeConfigV1(
        environment({ [MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV]: '1' })
      )
    ).toMatchObject({ providerDispatchAuthorized: true });
  });

  it('exposes inbound and thread resolution without exposing outbound send when no sender exists', async () => {
    let captured: Readonly<ManagedCommunicationInboundIngestionV1> | undefined;
    const ingest = vi.fn((input: Readonly<ManagedCommunicationInboundIngestionV1>) => {
      captured = input;
      return Promise.resolve({
        schemaVersion: 1 as const,
        observationDisposition: 'ADMITTED' as const,
        exactEvidenceDisposition: 'ADMITTED' as const,
        message: message(),
        exactEvidence: {
          schemaVersion: 1 as const,
          evidenceRef: 'commevidence_bootstrap',
          sha256: 'a'.repeat(64),
          mediaType: 'message/rfc822',
          sizeBytes: 12,
          observedAt: '2026-09-01T12:00:01.000Z',
          provider: 'provider-bootstrap',
          providerMessageId: 'provider-message-bootstrap',
          headers: [],
          metadata: {}
        },
        authority: {
          externalMessageSent: false as const,
          customerTruthMutated: false as const,
          matterTruthMutated: false as const,
          legalTruthCreated: false as const,
          knowledgeApproved: false as const,
          professionalDecisionCreated: false as const
        }
      });
    });
    const routes = createManagedCommunicationRoutesV1({
      internalServiceSecret: secret,
      inbound: { ingest },
      threadReader: { resolveThread: vi.fn().mockResolvedValue([]) },
      exactEvidence: { resolveExactEvidence: vi.fn().mockResolvedValue(undefined) }
    });

    expect(routes.map((route) => route.path)).toEqual([
      '/internal/v1/managed-communication/observations',
      '/internal/v1/managed-communication/thread-resolutions'
    ]);
    expect(routes.some((route) => route.path.endsWith('/sends'))).toBe(false);

    const inbound = routes.find((route) => route.path.endsWith('/observations'))!;
    const raw = Buffer.from('exact-provider-message', 'utf8');
    const response = await inbound.handle(
      request({
        message: message(),
        exactEvidence: {
          rawPayloadBase64: raw.toString('base64'),
          mediaType: 'message/rfc822',
          headers: [{ name: 'message-id', value: '<provider-message-bootstrap>' }],
          metadata: { mailbox: 'inbox' }
        }
      })
    );

    expect(response.status).toBe(200);
    expect(ingest).toHaveBeenCalledTimes(1);
    expect(captured).toMatchObject({
      workspaceId: 'workspace_bootstrap',
      idempotencyKey: 'inbound-bootstrap-1',
      message: { direction: 'INBOUND' },
      exactEvidence: { mediaType: 'message/rfc822' }
    });
    expect(Buffer.from(captured!.exactEvidence.rawPayload)).toEqual(raw);
  });

  it('rejects non-canonical exact evidence transport before invoking inbound authority', async () => {
    const ingest = vi.fn();
    const routes = createManagedCommunicationRoutesV1({
      internalServiceSecret: secret,
      inbound: { ingest }
    });
    const inbound = routes[0]!;

    await expect(
      inbound.handle(
        request({
          message: message(),
          exactEvidence: {
            rawPayloadBase64: 'not base64!',
            mediaType: 'message/rfc822',
            headers: []
          }
        })
      )
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_COMMUNICATION_EXACT_EVIDENCE' });
    expect(ingest).not.toHaveBeenCalled();
  });

  it('preserves the legacy outbound requirement that send bindings carry thread/evidence support', () => {
    expect(() =>
      createManagedCommunicationRoutesV1({
        internalServiceSecret: secret,
        threadReader: { resolveThread: vi.fn().mockResolvedValue([]) }
      })
    ).toThrow(/threadReader and exactEvidence resolver must be configured together/u);
  });
});
