import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  InMemoryManagedCommunicationFoundationV1,
  managedCommunicationNormalizedIdsV1
} from '../src/managed-communication-foundation.js';
import {
  InMemoryManagedCommunicationSendClaimStoreV1,
  ManagedCommunicationExchangeV1,
  managedCommunicationCanonicalRfcMessageIdV1,
  type ManagedCommunicationProviderSenderV1,
  type ManagedCommunicationSendRequestV1
} from '../src/managed-communication-exchange.js';

const workspaceId = 'workspace-expert';
const accountRef = 'communication-account-expert';
const provider = 'provider-test';

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function request(overrides: Partial<ManagedCommunicationSendRequestV1> = {}) {
  return {
    schemaVersion: 1,
    accountRef,
    channel: 'EMAIL',
    participants: [
      { role: 'SENDER', address: 'operator@example.test' },
      { role: 'TO', address: 'expert@example.test' }
    ],
    subject: 'Expert question',
    textBody: 'Please answer the attached expert question.',
    attachments: [
      {
        attachmentRef: 'question-evidence',
        fileName: 'question.txt',
        mediaType: 'text/plain',
        sizeBytes: 8,
        sha256: sha('question')
      }
    ],
    ...overrides
  } as ManagedCommunicationSendRequestV1;
}

async function setup(sender: ManagedCommunicationProviderSenderV1) {
  const foundation = new InMemoryManagedCommunicationFoundationV1();
  await foundation.registerAccount({
    workspaceId,
    accountRef,
    channel: 'EMAIL',
    provider,
    providerAccountRef: 'provider-account-expert',
    now: '2026-08-27T04:00:00.000Z'
  });
  const claims = new InMemoryManagedCommunicationSendClaimStoreV1();
  const exchange = new ManagedCommunicationExchangeV1({
    foundation,
    claims,
    sender,
    now: () => '2026-08-27T04:01:00.000Z',
    ownerTokenFactory: () => 'owner-token-fixed'
  });
  return { exchange, foundation, claims };
}

describe('Shared Communication outbound exchange', () => {
  it('sends exactly once, durabilizes outbound evidence, and replays the receipt', async () => {
    let calls = 0;
    let providerRequest: Readonly<ManagedCommunicationSendRequestV1> | undefined;
    const { exchange, foundation, claims } = await setup({
      send: (request) => {
        calls += 1;
        providerRequest = request;
        return Promise.resolve({
          providerMessageId: 'provider-message-1',
          providerThreadId: 'provider-thread-1',
          rfcMessageId: '<provider-message-1@example.test>',
          providerReceiptRef: 'provider-receipt-1',
          acceptedAt: '2026-08-27T04:01:01.000Z'
        });
      }
    });
    const input = {
      workspaceId,
      idempotencyKey: 'expert-task-123',
      correlationId: 'expert-task-123',
      request: request()
    } as const;

    const first = await exchange.send(input);
    const replay = await exchange.send(input);

    expect(calls).toBe(1);
    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      state: 'SENT',
      provider,
      providerMessageId: 'provider-message-1',
      providerThreadId: 'provider-thread-1',
      rfcMessageId: 'provider-message-1@example.test',
      providerReceiptRef: 'provider-receipt-1',
      authority: { externalMessageSent: true }
    });
    expect(first.publicMailRef).toMatch(/^MO-[0-9A-HJKMNP-TV-Z]{26}$/u);
    expect(providerRequest?.textBody).toContain(`MO Reference: [${first.publicMailRef}]`);
    await expect(
      claims.resolveSentByRfcMessageId(workspaceId, '<provider-message-1@example.test>')
    ).resolves.toEqual(first);
    await expect(
      claims.resolveSentByRfcMessageId('workspace-other', 'provider-message-1@example.test')
    ).resolves.toBeUndefined();
    expect(managedCommunicationCanonicalRfcMessageIdV1('<provider-message-1@example.test>')).toBe(
      'provider-message-1@example.test'
    );
    const persisted = await foundation.resolveMessage(workspaceId, accountRef, first.messageId);
    expect(persisted.direction).toBe('OUTBOUND');
    expect(persisted.threadRef).toBe(first.threadRef);
    expect(persisted.textBody).toContain(`MO Reference: [${first.publicMailRef}]`);
    expect(persisted.attachments[0]?.sha256).toBe(sha('question'));
  });

  it('keeps the public reference inside a complete HTML document body', async () => {
    let providerRequest: Readonly<ManagedCommunicationSendRequestV1> | undefined;
    const { exchange } = await setup({
      send: (sent) => {
        providerRequest = sent;
        return Promise.resolve({
          providerMessageId: 'provider-message-html',
          providerThreadId: 'provider-thread-html',
          providerReceiptRef: 'provider-receipt-html',
          acceptedAt: '2026-08-27T04:01:01.000Z'
        });
      }
    });
    const htmlRequest = request({ htmlBody: '<html><body><p>Hello</p></body></html>' });
    delete htmlRequest.textBody;
    const receipt = await exchange.send({
      workspaceId,
      idempotencyKey: 'expert-task-html',
      correlationId: 'expert-task-html',
      request: htmlRequest
    });

    expect(providerRequest?.htmlBody).toBe(
      `<html><body><p>Hello</p><p>MO Reference: [${receipt.publicMailRef}]</p></body></html>`
    );
  });

  it('rejects idempotency reuse with changed content without a second provider call', async () => {
    let calls = 0;
    const { exchange } = await setup({
      send: () => {
        calls += 1;
        return Promise.resolve({
          providerMessageId: `provider-message-${calls}`,
          providerThreadId: 'provider-thread-1',
          providerReceiptRef: `provider-receipt-${calls}`,
          acceptedAt: '2026-08-27T04:01:01.000Z'
        });
      }
    });
    await exchange.send({
      workspaceId,
      idempotencyKey: 'expert-task-123',
      correlationId: 'expert-task-123',
      request: request()
    });
    await expect(
      exchange.send({
        workspaceId,
        idempotencyKey: 'expert-task-123',
        correlationId: 'expert-task-123',
        request: request({ subject: 'Changed question' })
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(calls).toBe(1);
  });

  it('fails closed after provider uncertainty and blocks automatic resend', async () => {
    let calls = 0;
    const { exchange } = await setup({
      send: () => {
        calls += 1;
        return Promise.reject(new Error('network outcome unknown'));
      }
    });
    const input = {
      workspaceId,
      idempotencyKey: 'expert-task-uncertain',
      correlationId: 'expert-task-uncertain',
      request: request()
    } as const;

    await expect(exchange.send(input)).rejects.toMatchObject({
      code: 'RECONCILIATION_REQUIRED',
      retryable: false
    });
    await expect(exchange.send(input)).rejects.toMatchObject({
      code: 'RECONCILIATION_REQUIRED'
    });
    expect(calls).toBe(1);
  });

  it('requires provider reply identity to remain on the requested durable thread', async () => {
    const existing = managedCommunicationNormalizedIdsV1({
      workspaceId,
      accountRef,
      provider,
      providerMessageId: 'original-message',
      providerThreadId: 'original-thread'
    });
    let calls = 0;
    const { exchange } = await setup({
      send: () => {
        calls += 1;
        return Promise.resolve({
          providerMessageId: 'provider-reply-1',
          providerThreadId: 'different-thread',
          providerReceiptRef: 'provider-receipt-reply',
          acceptedAt: '2026-08-27T04:01:01.000Z'
        });
      }
    });

    await expect(
      exchange.send({
        workspaceId,
        idempotencyKey: 'expert-task-reply',
        correlationId: 'expert-task-reply',
        request: request({ replyToThreadRef: existing.threadRef })
      })
    ).rejects.toMatchObject({ code: 'RECONCILIATION_REQUIRED' });
    expect(calls).toBe(1);
  });

  it('treats malformed provider RFC Message-ID as optional evidence after acceptance', async () => {
    const { exchange, claims } = await setup({
      send: () =>
        Promise.resolve({
          providerMessageId: 'provider-message-malformed-rfc',
          providerThreadId: 'provider-thread-malformed-rfc',
          rfcMessageId: '<not-an-rfc-message-id>',
          providerReceiptRef: 'provider-receipt-malformed-rfc',
          acceptedAt: '2026-08-27T04:01:01.000Z'
        })
    });

    const receipt = await exchange.send({
      workspaceId,
      idempotencyKey: 'expert-task-malformed-rfc',
      correlationId: 'expert-task-malformed-rfc',
      request: request()
    });

    expect(receipt.state).toBe('SENT');
    expect(receipt.providerMessageId).toBe('provider-message-malformed-rfc');
    expect(receipt).not.toHaveProperty('rfcMessageId');
    await expect(
      claims.resolveSentByRfcMessageId(workspaceId, 'missing@example.test')
    ).resolves.toBeUndefined();
  });

  it('rejects attachment references without immutable checksums before dispatch', async () => {
    let calls = 0;
    const { exchange } = await setup({
      send: () => {
        calls += 1;
        return Promise.reject(new Error('must not run'));
      }
    });
    await expect(
      exchange.send({
        workspaceId,
        idempotencyKey: 'expert-task-bad-attachment',
        correlationId: 'expert-task-bad-attachment',
        request: request({ attachments: [{ attachmentRef: 'missing-sha' }] })
      })
    ).rejects.toMatchObject({ code: 'INVALID_SEND_REQUEST' });
    expect(calls).toBe(0);
  });
});
