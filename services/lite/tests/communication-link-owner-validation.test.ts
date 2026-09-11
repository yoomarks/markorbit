import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import {
  HttpManagedCommunicationLinkSourceReader,
  HttpMarkRegCommunicationLinkTargetReader,
  ProductionCommunicationLinkOwnerValidator
} from '../src/communication-link-owner-validation.js';

const workspaceId = '44444444-4444-4444-8444-444444444444';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_owner_validation',
  sessionId: 'session_owner_validation',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_owner_validation',
  role: 'MATTER_MANAGER',
  permissions: ['workspace:read', 'matter:manage']
};
const source = {
  owner: 'MANAGED_COMMUNICATION' as const,
  scope: 'THREAD' as const,
  accountRef: 'communication-account_1',
  messageId: 'message_1',
  threadRef: 'thread_1',
  provider: 'MICROSOFT_GRAPH',
  providerMessageId: 'provider-1',
  observedAt: '2026-09-11T04:00:00.000Z'
};
const normalizedMessage = {
  schemaVersion: 1 as const,
  messageId: 'message_1',
  accountRef: 'communication-account_1',
  threadRef: 'thread_1',
  channel: 'EMAIL' as const,
  direction: 'INBOUND' as const,
  participants: [{ role: 'SENDER' as const, address: 'sender@example.com' }],
  attachments: [],
  occurredAt: '2026-09-11T03:59:00.000Z',
  providerObservation: {
    provider: 'MICROSOFT_GRAPH',
    providerMessageId: 'provider-1',
    observedAt: '2026-09-11T04:00:00.000Z'
  }
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('Communication Link owner currentness validation', () => {
  it('accepts only the exact Managed Communication reviewed-message anchor', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      response({
        workspaceId,
        accountRef: source.accountRef,
        threadRef: source.threadRef,
        messages: [normalizedMessage]
      })
    );
    const reader = new HttpManagedCommunicationLinkSourceReader(
      'http://capability',
      'x'.repeat(40),
      fetcher
    );
    await expect(reader.validate(workspaceId, source)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(
      'http://capability/internal/v1/managed-communication/thread-resolutions',
      expect.objectContaining({ method: 'POST' })
    );
  });
  it('fails closed when provider lineage drifts or owner is unavailable', async () => {
    const drift = vi.fn().mockResolvedValue(
      response({
        workspaceId,
        accountRef: source.accountRef,
        threadRef: source.threadRef,
        messages: [
          {
            ...normalizedMessage,
            providerObservation: {
              ...normalizedMessage.providerObservation,
              providerMessageId: 'other'
            }
          }
        ]
      })
    );
    await expect(
      new HttpManagedCommunicationLinkSourceReader('http://cap', 'x'.repeat(40), drift).validate(
        workspaceId,
        source
      )
    ).rejects.toMatchObject({ code: 'SOURCE_MISMATCH' });
    const unavailable = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(
      new HttpManagedCommunicationLinkSourceReader(
        'http://cap',
        'x'.repeat(40),
        unavailable
      ).validate(workspaceId, source)
    ).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE', retryable: true });
  });
  it('requires exact MarkReg version and Production Intake fingerprint', async () => {
    const target = {
      targetKind: 'PRODUCTION_INTAKE' as const,
      owner: 'MARKREG' as const,
      workspaceId,
      intakeId: 'production-intake_1' as const,
      version: 4,
      fingerprintSha256: 'a'.repeat(64)
    };
    const ok = vi
      .fn()
      .mockResolvedValue(
        response({ intake: { workspaceId, version: 4, fingerprintSha256: 'a'.repeat(64) } })
      );
    await expect(
      new HttpMarkRegCommunicationLinkTargetReader('http://markreg', 'x'.repeat(40), ok).validate(
        principal,
        target
      )
    ).resolves.toBeUndefined();
    const stale = vi
      .fn()
      .mockResolvedValue(
        response({ intake: { workspaceId, version: 5, fingerprintSha256: 'a'.repeat(64) } })
      );
    await expect(
      new HttpMarkRegCommunicationLinkTargetReader(
        'http://markreg',
        'x'.repeat(40),
        stale
      ).validate(principal, target)
    ).rejects.toMatchObject({ code: 'TARGET_VERSION_STALE' });
    const drift = vi
      .fn()
      .mockResolvedValue(
        response({ intake: { workspaceId, version: 4, fingerprintSha256: 'b'.repeat(64) } })
      );
    await expect(
      new HttpMarkRegCommunicationLinkTargetReader(
        'http://markreg',
        'x'.repeat(40),
        drift
      ).validate(principal, target)
    ).rejects.toMatchObject({ code: 'TARGET_VERSION_STALE' });
  });
  it('validates current Trademark Asset locally and fails Directory while owner runtime is absent', async () => {
    const sourceReader = { validate: vi.fn().mockResolvedValue(undefined) };
    const assets = {
      get: vi
        .fn()
        .mockResolvedValue({ workspaceId, trademarkAssetId: 'trademark-asset_1', version: 3 })
    };
    const markreg = { validate: vi.fn().mockResolvedValue(undefined) };
    const validator = new ProductionCommunicationLinkOwnerValidator(
      sourceReader as never,
      assets,
      markreg as never
    );
    await expect(
      validator.validateCreate({
        workspaceId,
        source,
        target: {
          targetKind: 'TRADEMARK_ASSET',
          owner: 'LITE',
          workspaceId,
          trademarkAssetId: 'trademark-asset_1',
          version: 3
        },
        principal
      })
    ).resolves.toBeUndefined();
    await expect(
      validator.validateCreate({
        workspaceId,
        source,
        target: {
          targetKind: 'TRADEMARK_ASSET',
          owner: 'LITE',
          workspaceId,
          trademarkAssetId: 'trademark-asset_1',
          version: 2
        },
        principal
      })
    ).rejects.toMatchObject({ code: 'TARGET_VERSION_STALE' });
    await expect(
      validator.validateCreate({
        workspaceId,
        source,
        target: {
          targetKind: 'WORKSPACE_DIRECTORY_ENTRY',
          owner: 'LITE',
          workspaceId,
          workspaceDirectoryEntryId: 'workspace-directory-entry_1',
          version: 1
        },
        principal
      })
    ).rejects.toMatchObject({ code: 'TARGET_OWNER_UNAVAILABLE', retryable: true });
  });
  it('does not collapse owner unavailable into target not found', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ code: 'PERSISTENCE_UNAVAILABLE' }, 503));
    const target = {
      targetKind: 'CUSTOMER_RELATIONSHIP' as const,
      owner: 'MARKREG' as const,
      workspaceId,
      customerRelationshipId: 'customer-relationship_1' as const,
      version: 1
    };
    await expect(
      new HttpMarkRegCommunicationLinkTargetReader(
        'http://markreg',
        'x'.repeat(40),
        fetcher
      ).validate(principal, target)
    ).rejects.toMatchObject({ code: 'TARGET_UNAVAILABLE', status: 503, retryable: true });
  });
});
