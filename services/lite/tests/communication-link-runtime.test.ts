import { describe, expect, it, vi } from 'vitest';
import type { WorkspacePrincipal } from '@markorbit/contracts';
import { noCommunicationLinkAuthorityConsequencesV1 } from '@markorbit/contracts/communication-link';
import {
  CommunicationLinkRuntimeError,
  CommunicationLinkService,
  DurableCommunicationLinkThreadAssociationLookup,
  materializeArchivedCommunicationLinkV1,
  materializeCommunicationLinkV1,
  type CreateCommunicationLinkCommand,
  type PostgresCommunicationLinkStore
} from '../src/communication-link.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const principal: WorkspacePrincipal = {
  kind: 'WORKSPACE',
  userId: 'user_link_owner',
  sessionId: 'session_link_owner',
  sessionExpiresAt: '2030-01-01T00:00:00.000Z',
  workspaceId,
  membershipId: 'membership_link_owner',
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
  providerMessageId: 'provider-message-1',
  observedAt: '2026-09-11T04:00:00.000Z'
};
const target = {
  targetKind: 'TRADEMARK_ASSET' as const,
  owner: 'LITE' as const,
  workspaceId,
  trademarkAssetId: 'trademark-asset_1' as const,
  version: 3
};
const command: CreateCommunicationLinkCommand = {
  workspaceId,
  actorPrincipalId: principal.userId,
  idempotencyKey: 'link-create-1',
  source,
  target,
  decisionStatus: 'CONFIRMED',
  decisionBasis: 'MANUAL',
  reason: 'Reviewed by case owner',
  evidenceReferences: []
};

function link(id = 'communication-link_1') {
  return materializeCommunicationLinkV1(
    command,
    '2026-09-11T04:05:00.000Z',
    id as `communication-link_${string}`
  );
}

describe('Communication Link durable runtime semantics', () => {
  it('materializes one HUMAN ACTIVE decision with zero downstream authority', () => {
    const item = link();
    expect(item).toMatchObject({ workspaceId, version: 1, lifecycle: 'ACTIVE', archivedAt: null });
    expect(item.decision).toMatchObject({
      status: 'CONFIRMED',
      basis: 'MANUAL',
      authority: 'HUMAN',
      decidedByPrincipalId: principal.userId
    });
    expect(item.authorityConsequences).toEqual(noCommunicationLinkAuthorityConsequencesV1);
    expect(Object.values(item.authorityConsequences).every((value) => value === false)).toBe(true);
  });

  it('archives immutably with exact CAS and rejects repeated/stale archive', () => {
    const active = link();
    const archived = materializeArchivedCommunicationLinkV1(
      active,
      {
        workspaceId,
        communicationLinkId: active.communicationLinkId,
        expectedVersion: 1,
        idempotencyKey: 'archive-1'
      },
      '2026-09-11T04:10:00.000Z'
    );
    expect(archived).toMatchObject({
      version: 2,
      lifecycle: 'ARCHIVED',
      archivedAt: '2026-09-11T04:10:00.000Z'
    });
    expect(archived.decision).toEqual(active.decision);
    expect(() =>
      materializeArchivedCommunicationLinkV1(
        archived,
        {
          workspaceId,
          communicationLinkId: active.communicationLinkId,
          expectedVersion: 2,
          idempotencyKey: 'archive-2'
        },
        '2026-09-11T04:11:00.000Z'
      )
    ).toThrow('Only an ACTIVE');
    expect(() =>
      materializeArchivedCommunicationLinkV1(
        active,
        {
          workspaceId,
          communicationLinkId: active.communicationLinkId,
          expectedVersion: 9,
          idempotencyKey: 'archive-stale'
        },
        '2026-09-11T04:11:00.000Z'
      )
    ).toThrow('Expected Communication Link version');
  });

  it('feeds #1103 only ACTIVE THREAD CONFIRMED HUMAN Trademark Asset decisions', async () => {
    const confirmed = link('communication-link_confirmed');
    const rejected = materializeCommunicationLinkV1(
      { ...command, decisionStatus: 'REJECTED', idempotencyKey: 'reject' },
      '2026-09-11T04:06:00.000Z',
      'communication-link_rejected'
    );
    const messageOnly = materializeCommunicationLinkV1(
      { ...command, source: { ...source, scope: 'MESSAGE' }, idempotencyKey: 'message' },
      '2026-09-11T04:07:00.000Z',
      'communication-link_message'
    );
    const archived = materializeArchivedCommunicationLinkV1(
      confirmed,
      {
        workspaceId,
        communicationLinkId: confirmed.communicationLinkId,
        expectedVersion: 1,
        idempotencyKey: 'archive'
      },
      '2026-09-11T04:08:00.000Z'
    );
    const store = {
      lookupThreadLinks: vi.fn().mockResolvedValue([confirmed, rejected, messageOnly, archived])
    };
    const lookup = new DurableCommunicationLinkThreadAssociationLookup(store);
    await expect(
      lookup.lookup({ workspaceId, accountRef: source.accountRef, threadRef: source.threadRef })
    ).resolves.toEqual([
      {
        associationReference: confirmed.communicationLinkId,
        workspaceId,
        accountRef: source.accountRef,
        threadRef: source.threadRef,
        status: 'CONFIRMED',
        confirmationAuthority: 'HUMAN',
        target: { id: target.trademarkAssetId, version: target.version }
      }
    ]);
  });

  it('checks exact command replay before owner currentness validation', async () => {
    const existing = link('communication-link_replay');
    const store = {
      replayCreate: vi.fn().mockResolvedValue(existing),
      create: vi.fn(),
      archive: vi.fn(),
      getExact: vi.fn(),
      getLatest: vi.fn(),
      listLatest: vi.fn()
    } as unknown as PostgresCommunicationLinkStore;
    const validator = {
      validateCreate: vi
        .fn()
        .mockRejectedValue(new CommunicationLinkRuntimeError('TARGET_VERSION_STALE', 'stale'))
    };
    const service = new CommunicationLinkService(store, validator);
    await expect(service.create(command, principal)).resolves.toEqual(existing);
    expect(validator.validateCreate).not.toHaveBeenCalled();
    expect(
      (store as unknown as { create: ReturnType<typeof vi.fn> }).create
    ).not.toHaveBeenCalled();
  });
});
