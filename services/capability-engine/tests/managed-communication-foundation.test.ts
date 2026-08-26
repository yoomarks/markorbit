import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { ManagedCommunicationMessageV1 } from '@markorbit/contracts/managed-communication';
import {
  InMemoryManagedCommunicationFoundationV1,
  managedCommunicationNormalizedIdsV1
} from '../src/managed-communication-foundation.js';

const workspaceId = 'workspace_communication_a';
const accountRef = 'communication-account_primary';
const provider = 'provider-test';

function sha(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function message(overrides: Partial<ManagedCommunicationMessageV1> = {}): ManagedCommunicationMessageV1 {
  const providerMessageId = overrides.providerObservation?.providerMessageId ?? 'provider-message-1';
  const providerThreadId = overrides.providerObservation?.providerThreadId ?? 'provider-thread-1';
  const ids = managedCommunicationNormalizedIdsV1({
    workspaceId,
    accountRef,
    provider,
    providerMessageId,
    providerThreadId
  });
  return {
    schemaVersion: 1,
    messageId: ids.messageId,
    accountRef,
    threadRef: ids.threadRef,
    channel: 'EMAIL',
    direction: 'INBOUND',
    participants: [
      { role: 'SENDER', address: 'sender@example.test' },
      { role: 'TO', address: 'receiver@example.test' }
    ],
    subject: 'Durable communication observation',
    textBody: 'Normalized body',
    attachments: [
      {
        attachmentRef: 'attachment-1',
        fileName: 'evidence.txt',
        mediaType: 'text/plain',
        sizeBytes: 8,
        sha256: sha('evidence')
      }
    ],
    occurredAt: '2026-08-26T04:20:00.000Z',
    providerObservation: {
      provider,
      providerMessageId,
      providerThreadId,
      observedAt: '2026-08-26T04:20:01.000Z'
    },
    ...overrides
  };
}

async function foundation() {
  const store = new InMemoryManagedCommunicationFoundationV1();
  await store.registerAccount({
    workspaceId,
    accountRef,
    channel: 'EMAIL',
    provider,
    providerAccountRef: 'provider-account-primary',
    now: '2026-08-26T04:19:00.000Z'
  });
  return store;
}

describe('MO-CAP-003 durable Managed Communication foundation', () => {
  it('admits once, replays exactly, and keeps all authority consequences false', async () => {
    const store = await foundation();
    const command = {
      workspaceId,
      accountRef,
      idempotencyKey: 'communication-import-1',
      message: message(),
      now: '2026-08-26T04:20:02.000Z'
    } as const;

    const first = await store.admitObservation(command);
    const replay = await store.admitObservation(command);

    expect(first.disposition).toBe('ADMITTED');
    expect(replay.disposition).toBe('REPLAYED');
    expect(replay.message).toEqual(first.message);
    expect(replay.authority).toEqual({
      externalMessageSent: false,
      customerTruthMutated: false,
      matterTruthMutated: false,
      legalTruthCreated: false,
      knowledgeApproved: false,
      professionalDecisionCreated: false
    });
  });

  it('fails closed for conflicting idempotency and provider-message replay', async () => {
    const store = await foundation();
    await store.admitObservation({
      workspaceId,
      accountRef,
      idempotencyKey: 'communication-import-1',
      message: message(),
      now: '2026-08-26T04:20:02.000Z'
    });

    await expect(
      store.admitObservation({
        workspaceId,
        accountRef,
        idempotencyKey: 'communication-import-1',
        message: message({ subject: 'Conflicting subject' }),
        now: '2026-08-26T04:20:03.000Z'
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    await expect(
      store.admitObservation({
        workspaceId,
        accountRef,
        idempotencyKey: 'communication-import-2',
        message: message({ subject: 'Conflicting provider observation' }),
        now: '2026-08-26T04:20:04.000Z'
      })
    ).rejects.toMatchObject({ code: 'PROVIDER_OBSERVATION_CONFLICT' });
  });

  it('requires deterministic normalized identities and attachment checksums', async () => {
    const store = await foundation();
    await expect(
      store.admitObservation({
        workspaceId,
        accountRef,
        idempotencyKey: 'communication-import-bad-id',
        message: message({ messageId: 'caller-selected-message-id' }),
        now: '2026-08-26T04:20:02.000Z'
      })
    ).rejects.toMatchObject({ code: 'INVALID_OBSERVATION' });

    const noChecksum = message();
    noChecksum.attachments = [{ attachmentRef: 'attachment-without-checksum' }];
    await expect(
      store.admitObservation({
        workspaceId,
        accountRef,
        idempotencyKey: 'communication-import-no-checksum',
        message: noChecksum,
        now: '2026-08-26T04:20:03.000Z'
      })
    ).rejects.toMatchObject({ code: 'INVALID_OBSERVATION' });
  });

  it('enforces workspace/account isolation for messages and checkpoints', async () => {
    const store = await foundation();
    const admitted = await store.admitObservation({
      workspaceId,
      accountRef,
      idempotencyKey: 'communication-import-1',
      message: message(),
      now: '2026-08-26T04:20:02.000Z'
    });
    await store.saveCheckpoint({
      workspaceId,
      accountRef,
      checkpointRef: 'checkpoint-1',
      providerCursor: 'opaque-provider-cursor-1',
      observedAt: '2026-08-26T04:21:00.000Z',
      now: '2026-08-26T04:21:01.000Z'
    });

    await expect(
      store.resolveMessage('workspace_communication_b', accountRef, admitted.message.messageId)
    ).rejects.toMatchObject({ code: 'MESSAGE_NOT_FOUND' });
    await expect(
      store.latestCheckpoint('workspace_communication_b', accountRef)
    ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });

    const checkpoint = await store.latestCheckpoint(workspaceId, accountRef);
    expect(checkpoint).toMatchObject({
      checkpointRef: 'checkpoint-1',
      providerCursor: 'opaque-provider-cursor-1'
    });
  });

  it('fails closed when a checkpoint reference is rebound to another cursor', async () => {
    const store = await foundation();
    const first = await store.saveCheckpoint({
      workspaceId,
      accountRef,
      checkpointRef: 'checkpoint-1',
      providerCursor: 'opaque-provider-cursor-1',
      observedAt: '2026-08-26T04:21:00.000Z',
      now: '2026-08-26T04:21:01.000Z'
    });
    const replay = await store.saveCheckpoint({
      workspaceId,
      accountRef,
      checkpointRef: 'checkpoint-1',
      providerCursor: 'opaque-provider-cursor-1',
      observedAt: '2026-08-26T04:21:00.000Z',
      now: '2026-08-26T04:22:01.000Z'
    });
    expect(replay.providerCursor).toBe(first.providerCursor);

    await expect(
      store.saveCheckpoint({
        workspaceId,
        accountRef,
        checkpointRef: 'checkpoint-1',
        providerCursor: 'different-provider-cursor',
        observedAt: '2026-08-26T04:21:00.000Z',
        now: '2026-08-26T04:23:01.000Z'
      })
    ).rejects.toMatchObject({ code: 'CHECKPOINT_CONFLICT' });
  });
});
