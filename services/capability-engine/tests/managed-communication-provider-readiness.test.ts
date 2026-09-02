import { describe, expect, it } from 'vitest';
import { InMemoryManagedCommunicationFoundationV1 } from '../src/managed-communication-foundation.js';
import {
  InMemoryManagedCommunicationSendClaimStoreV1,
  ManagedCommunicationExchangeV1,
  type ManagedCommunicationProviderSenderV1,
  type ManagedCommunicationSendRequestV1
} from '../src/managed-communication-exchange.js';
import {
  GmailManagedCommunicationClientV1,
  GmailManagedCommunicationSenderV1
} from '../src/managed-communication-gmail.js';

const workspaceId = 'workspace-readiness';
const accountRef = 'gmail-account-readiness';
const providerAccountRef = 'operator@example.test';

function request(overrides: Partial<ManagedCommunicationSendRequestV1> = {}) {
  return {
    schemaVersion: 1,
    accountRef,
    channel: 'EMAIL',
    participants: [
      { role: 'SENDER', address: providerAccountRef },
      { role: 'TO', address: 'expert@example.test' }
    ],
    subject: 'Readiness boundary',
    textBody: 'Provider readiness must finish before delivery becomes possible.',
    attachments: [],
    ...overrides
  } as ManagedCommunicationSendRequestV1;
}

async function exchangeWith(sender: ManagedCommunicationProviderSenderV1) {
  const foundation = new InMemoryManagedCommunicationFoundationV1();
  await foundation.registerAccount({
    workspaceId,
    accountRef,
    channel: 'EMAIL',
    provider: 'GMAIL',
    providerAccountRef,
    now: '2026-09-02T13:00:00.000Z'
  });
  const claims = new InMemoryManagedCommunicationSendClaimStoreV1();
  return {
    claims,
    exchange: new ManagedCommunicationExchangeV1({
      foundation,
      claims,
      sender,
      now: () => '2026-09-02T13:01:00.000Z',
      ownerTokenFactory: (() => {
        let value = 0;
        return () => `owner-${++value}`;
      })()
    })
  };
}

function input(overrides: Partial<ManagedCommunicationSendRequestV1> = {}) {
  return {
    workspaceId,
    idempotencyKey: 'expert-task-readiness',
    correlationId: 'expert-task-readiness',
    request: request(overrides)
  } as const;
}

function gmailClient(fetchImpl: typeof fetch) {
  return new GmailManagedCommunicationClientV1(
    {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: 'refresh-token',
      providerAccountRef
    },
    fetchImpl,
    () => Date.parse('2026-09-02T13:01:00.000Z')
  );
}

describe('Managed Communication provider readiness boundary', () => {
  it('releases a CLAIMED send after readiness failure so the same key can safely reacquire the same send identity', async () => {
    let prepareCalls = 0;
    let dispatchCalls = 0;
    const preparedSendIds: string[] = [];
    const sender: ManagedCommunicationProviderSenderV1 = {
      prepare: (_request, context) => {
        prepareCalls += 1;
        preparedSendIds.push(context.sendId);
        if (prepareCalls === 1) return Promise.reject(new Error('provider auth unavailable'));
        return Promise.resolve();
      },
      send: (_request, context) => {
        dispatchCalls += 1;
        return Promise.resolve({
          providerMessageId: 'provider-message-readiness',
          providerThreadId: 'provider-thread-readiness',
          providerReceiptRef: `provider://${context.sendId}`,
          acceptedAt: '2026-09-02T13:01:01.000Z'
        });
      }
    };
    const { exchange } = await exchangeWith(sender);

    await expect(exchange.send(input())).rejects.toMatchObject({
      code: 'PROVIDER_NOT_READY',
      retryable: true
    });
    expect(dispatchCalls).toBe(0);

    const receipt = await exchange.send(input());
    expect(receipt.state).toBe('SENT');
    expect(prepareCalls).toBe(2);
    expect(dispatchCalls).toBe(1);
    expect(preparedSendIds).toHaveLength(2);
    expect(preparedSendIds[1]).toBe(preparedSendIds[0]);
  });

  it('keeps unknown senders conservative when they do not opt into readiness preparation', async () => {
    let dispatchCalls = 0;
    const { exchange } = await exchangeWith({
      send: () => {
        dispatchCalls += 1;
        return Promise.reject(new Error('unknown provider outcome'));
      }
    });

    await expect(exchange.send(input())).rejects.toMatchObject({
      code: 'RECONCILIATION_REQUIRED',
      retryable: false
    });
    await expect(exchange.send(input())).rejects.toMatchObject({
      code: 'RECONCILIATION_REQUIRED'
    });
    expect(dispatchCalls).toBe(1);
  });

  it('treats Gmail OAuth refresh failure as pre-dispatch readiness failure and never calls messages/send', async () => {
    const providerRequests: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      const value = String(url);
      providerRequests.push(value);
      if (value === 'https://oauth2.googleapis.com/token') {
        return new Response('{}', { status: 401 });
      }
      throw new Error(`Unexpected provider request: ${value}`);
    }) as typeof fetch;
    const sender = new GmailManagedCommunicationSenderV1(gmailClient(fetchImpl));
    const { exchange } = await exchangeWith(sender);

    await expect(exchange.send(input())).rejects.toMatchObject({
      code: 'PROVIDER_NOT_READY',
      retryable: true
    });
    expect(providerRequests).toEqual(['https://oauth2.googleapis.com/token']);
    expect(providerRequests.some((value) => value.includes('/users/me/messages/send'))).toBe(false);
  });

  it('prepares Gmail reply thread metadata before dispatch and reuses that preparation for exactly one messages/send call', async () => {
    const providerRequests: string[] = [];
    let metadataFails = true;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const value = String(url);
      providerRequests.push(value);
      if (value === 'https://oauth2.googleapis.com/token') {
        return Response.json({ access_token: 'access-token', expires_in: 3600 });
      }
      if (value.includes('/gmail/v1/users/me/threads/provider-thread-original?')) {
        if (metadataFails) return new Response('{}', { status: 503 });
        return Response.json({
          messages: [
            {
              payload: {
                headers: [
                  { name: 'Message-ID', value: '<original@example.test>' },
                  { name: 'References', value: '<root@example.test>' },
                  { name: 'Subject', value: 'Original subject' }
                ]
              }
            }
          ]
        });
      }
      if (value.endsWith('/gmail/v1/users/me/messages/send')) {
        expect(init?.method).toBe('POST');
        return Response.json({ id: 'provider-message-reply', threadId: 'provider-thread-original' });
      }
      throw new Error(`Unexpected provider request: ${value}`);
    }) as typeof fetch;
    const sender = new GmailManagedCommunicationSenderV1(
      gmailClient(fetchImpl),
      () => Promise.resolve('provider-thread-original'),
      () => '2026-09-02T13:01:01.000Z'
    );
    const { exchange } = await exchangeWith(sender);
    const replyRequest = input({ replyToThreadRef: 'commthread-existing' });

    await expect(exchange.send(replyRequest)).rejects.toMatchObject({
      code: 'PROVIDER_NOT_READY',
      retryable: true
    });
    expect(providerRequests.some((value) => value.includes('/users/me/messages/send'))).toBe(false);

    metadataFails = false;
    const receipt = await exchange.send(replyRequest);
    expect(receipt.providerMessageId).toBe('provider-message-reply');
    expect(receipt.providerThreadId).toBe('provider-thread-original');
    expect(providerRequests.filter((value) => value === 'https://oauth2.googleapis.com/token')).toHaveLength(1);
    expect(providerRequests.filter((value) => value.includes('/users/me/threads/'))).toHaveLength(2);
    expect(providerRequests.filter((value) => value.includes('/users/me/messages/send'))).toHaveLength(1);
  });
});
