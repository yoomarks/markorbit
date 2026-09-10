import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  InMemoryManagedCommunicationFoundationV1,
  managedCommunicationNormalizedIdsV1
} from '../src/managed-communication-foundation.js';
import type {
  ManagedCommunicationExactEvidenceAdmissionOutcomeV1,
  ManagedCommunicationExactEvidenceAdmissionV1,
  ManagedCommunicationExactEvidenceRefV1,
  ManagedCommunicationExactEvidenceStoreV1
} from '../src/managed-communication-exact-evidence.js';
import type { ManagedCommunicationSendRequestV1 } from '../src/managed-communication-exchange.js';
import {
  MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
  MicrosoftGraphManagedCommunicationClientV1,
  MicrosoftGraphManagedCommunicationError,
  MicrosoftGraphManagedCommunicationInboundV1,
  MicrosoftGraphManagedCommunicationSenderV1,
  MicrosoftGraphRefreshTokenProviderV1
} from '../src/managed-communication-microsoft-graph.js';

const workspaceId = 'workspace_msgraph_provider_test';
const accountRef = 'communication-account_msgraph_provider_test';
const providerAccountRef = 'operator@example.test';
const observedAt = '2026-09-10T01:00:00.000Z';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function empty(status = 202): Response {
  return new Response(null, { status });
}

function bytes(value: string, status = 200): Response {
  return new Response(Buffer.from(value, 'utf8'), { status });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.toString() : input.url;
}

function sha256(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

class RecordingExactEvidenceStore implements ManagedCommunicationExactEvidenceStoreV1 {
  readonly admissions: ManagedCommunicationExactEvidenceAdmissionV1[] = [];
  private readonly rows = new Map<string, ManagedCommunicationExactEvidenceRefV1>();

  admitExactEvidence(
    input: ManagedCommunicationExactEvidenceAdmissionV1
  ): Promise<ManagedCommunicationExactEvidenceAdmissionOutcomeV1> {
    this.admissions.push({
      ...input,
      rawPayload: Uint8Array.from(input.rawPayload),
      headers: input.headers.map((header) => ({ ...header })),
      ...(input.metadata ? { metadata: { ...input.metadata } } : {})
    });
    const key = `${input.workspaceId}\u0000${input.accountRef}\u0000${input.messageId}`;
    const existing = this.rows.get(key);
    if (existing) {
      return Promise.resolve(
        Object.freeze({ schemaVersion: 1, disposition: 'REPLAYED', evidence: existing })
      );
    }
    const evidenceSha256 = sha256(input.rawPayload);
    const evidence = Object.freeze({
      schemaVersion: 1 as const,
      evidenceRef: `commevidence_test_${evidenceSha256.slice(0, 20)}`,
      sha256: evidenceSha256,
      mediaType: input.mediaType,
      sizeBytes: input.rawPayload.byteLength,
      observedAt: input.observedAt,
      provider: input.provider,
      providerMessageId: input.providerMessageId,
      headers: Object.freeze(input.headers.map((header) => Object.freeze({ ...header }))),
      metadata: Object.freeze({ ...(input.metadata ?? {}) })
    });
    this.rows.set(key, evidence);
    return Promise.resolve(Object.freeze({ schemaVersion: 1, disposition: 'ADMITTED', evidence }));
  }

  resolveExactEvidence(input: {
    workspaceId: string;
    accountRef: string;
    messageId: string;
  }): Promise<ManagedCommunicationExactEvidenceRefV1 | undefined> {
    const key = `${input.workspaceId}\u0000${input.accountRef}\u0000${input.messageId}`;
    return Promise.resolve(this.rows.get(key));
  }
}

function tokenProvider(token = 'graph-access-token-test-only') {
  return { accessToken: vi.fn(() => Promise.resolve(token)) };
}

function account() {
  return {
    schemaVersion: 1 as const,
    workspaceId,
    accountRef,
    channel: 'EMAIL' as const,
    provider: MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
    providerAccountRef,
    createdAt: observedAt
  };
}

function sendRequest(
  overrides: Partial<ManagedCommunicationSendRequestV1> = {}
): ManagedCommunicationSendRequestV1 {
  return {
    schemaVersion: 1,
    accountRef,
    channel: 'EMAIL',
    participants: [
      { role: 'SENDER', address: providerAccountRef, displayName: 'Operator' },
      { role: 'TO', address: 'expert@example.test', displayName: 'Expert' }
    ],
    subject: 'Microsoft Graph provider test',
    textBody: 'Please review this test message.',
    attachments: [],
    ...overrides
  };
}

async function registeredFoundation() {
  const foundation = new InMemoryManagedCommunicationFoundationV1();
  await foundation.registerAccount({
    workspaceId,
    accountRef,
    channel: 'EMAIL',
    provider: MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
    providerAccountRef,
    now: observedAt
  });
  return foundation;
}

function graphProfile() {
  return { id: 'graph-user-1', mail: providerAccountRef, userPrincipalName: providerAccountRef };
}

function inboundMessage() {
  return {
    id: 'graph-message-1',
    conversationId: 'graph-conversation-1',
    internetMessageId: '<graph-message-1@example.test>',
    receivedDateTime: '2026-09-10T01:01:00Z',
    subject: 'Incoming trademark instruction',
    body: { contentType: 'html', content: '<p>Please review 98554243.</p>' },
    from: { emailAddress: { name: 'Foreign Counsel', address: 'counsel@example.test' } },
    toRecipients: [{ emailAddress: { name: 'Operator', address: providerAccountRef } }],
    ccRecipients: [{ emailAddress: { address: 'team@example.test' } }],
    bccRecipients: [],
    replyTo: [{ emailAddress: { address: 'reply@example.test' } }],
    hasAttachments: true,
    internetMessageHeaders: [
      { name: 'X-Trace-Id', value: 'trace-safe-1' },
      { name: 'Authorization', value: 'Bearer must-not-persist' },
      { name: 'Cookie', value: 'session=must-not-persist' }
    ]
  };
}

describe('Microsoft Graph Managed Communication provider adapter', () => {
  it('refreshes and caches Microsoft OAuth access tokens without exposing credentials', async () => {
    const requests: Readonly<{ url: string; body?: BodyInit | null }>[] = [];
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: requestUrl(input), ...(init?.body ? { body: init.body } : {}) });
      return Promise.resolve(json({ access_token: 'access-token-result', expires_in: 3600 }));
    }) as typeof fetch;
    const provider = new MicrosoftGraphRefreshTokenProviderV1(
      {
        tenantId: 'common',
        clientId: 'client-id-test-only',
        clientSecret: 'client-secret-test-only',
        refreshToken: 'refresh-token-test-only'
      },
      fetchImpl,
      () => 10_000
    );

    await expect(provider.accessToken()).resolves.toBe('access-token-result');
    await expect(provider.accessToken()).resolves.toBe('access-token-result');
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token');
    const tokenBody = requests[0]?.body;
    if (typeof tokenBody !== 'string') throw new TypeError('Expected OAuth form body text.');
    expect(tokenBody).toContain('refresh_token=refresh-token-test-only');
  });

  it('prepares outbound mail with zero Microsoft network activity, then creates and sends an immutable draft on dispatch', async () => {
    const calls: string[] = [];
    const tokens = tokenProvider();
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      calls.push(url);
      const headers = new Headers(init?.headers);
      expect(headers.get('prefer')).toBe('IdType="ImmutableId"');
      if (url.includes('/v1.0/me?$select=')) return Promise.resolve(json(graphProfile()));
      if (url.endsWith('/v1.0/me/messages')) {
        return Promise.resolve(
          json({ id: 'immutable-draft-1', conversationId: 'graph-conversation-out-1' }, 201)
        );
      }
      if (url.endsWith('/v1.0/me/messages/immutable-draft-1/send')) {
        return Promise.resolve(empty());
      }
      return Promise.reject(new Error(`Unexpected Graph request: ${url}`));
    }) as typeof fetch;
    const client = new MicrosoftGraphManagedCommunicationClientV1(tokens, fetchImpl);
    const sender = new MicrosoftGraphManagedCommunicationSenderV1(
      client,
      undefined,
      () => '2026-09-10T01:02:00.000Z'
    );

    const prepared = await sender.prepare(sendRequest(), {
      sendId: 'commsend_graph_1',
      workspaceId,
      account: account(),
      correlationId: 'graph-send-test'
    });
    expect(calls).toEqual([]);
    expect(tokens.accessToken).not.toHaveBeenCalled();

    await expect(prepared.dispatch()).resolves.toEqual({
      providerMessageId: 'immutable-draft-1',
      providerThreadId: 'graph-conversation-out-1',
      providerReceiptRef: 'msgraph://me/messages/immutable-draft-1',
      acceptedAt: '2026-09-10T01:02:00.000Z'
    });
    expect(calls).toHaveLength(3);
  });

  it('uses exact provider message resolution for replies and fails closed when it is unavailable', async () => {
    const missingClient = new MicrosoftGraphManagedCommunicationClientV1(
      tokenProvider(),
      vi.fn(() => Promise.resolve(json(graphProfile())))
    );
    const missingSender = new MicrosoftGraphManagedCommunicationSenderV1(missingClient, () =>
      Promise.resolve(undefined)
    );
    const preparedMissing = await missingSender.prepare(
      sendRequest({ replyToThreadRef: 'commthread_missing' }),
      {
        sendId: 'commsend_graph_missing',
        workspaceId,
        account: account(),
        correlationId: 'graph-reply-missing'
      }
    );
    await expect(preparedMissing.dispatch()).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const calls: string[] = [];
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      calls.push(url);
      if (url.includes('/v1.0/me?$select=')) return Promise.resolve(json(graphProfile()));
      if (url.endsWith('/messages/source-message-1/createReply')) {
        return Promise.resolve(
          json({ id: 'reply-draft-1', conversationId: 'conversation-1' }, 201)
        );
      }
      if (url.endsWith('/messages/reply-draft-1')) {
        return Promise.resolve(json({ id: 'reply-draft-1', conversationId: 'conversation-1' }));
      }
      if (url.endsWith('/messages/reply-draft-1/send')) return Promise.resolve(empty());
      return Promise.reject(new Error(`Unexpected Graph request: ${url}`));
    }) as typeof fetch;
    const sender = new MicrosoftGraphManagedCommunicationSenderV1(
      new MicrosoftGraphManagedCommunicationClientV1(tokenProvider(), fetchImpl),
      () =>
        Promise.resolve({
          providerMessageId: 'source-message-1',
          providerThreadId: 'conversation-1'
        }),
      () => '2026-09-10T01:03:00.000Z'
    );
    await expect(
      sender.send(sendRequest({ replyToThreadRef: 'commthread_existing' }), {
        sendId: 'commsend_graph_reply',
        workspaceId,
        account: account(),
        correlationId: 'graph-reply-test'
      })
    ).resolves.toMatchObject({
      providerMessageId: 'reply-draft-1',
      providerThreadId: 'conversation-1'
    });
    expect(calls.some((url) => url.endsWith('/messages/source-message-1/createReply'))).toBe(true);
  });

  it('imports a bounded initial delta round with participants, HTML, attachments and exact MIME evidence', async () => {
    const foundation = await registeredFoundation();
    const exactEvidence = new RecordingExactEvidenceStore();
    const attachment = Buffer.from('proof-attachment', 'utf8');
    const rawMime = 'MIME-Version: 1.0\r\nSubject: Incoming\r\n\r\nExact MIME body.';
    const calls: string[] = [];
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      calls.push(url);
      if (url.includes('/v1.0/me?$select=')) return Promise.resolve(json(graphProfile()));
      if (url.includes('/mailFolders/inbox/messages/delta?')) {
        const parsed = new URL(url);
        expect(parsed.searchParams.get('changeType')).toBe('created');
        expect(parsed.searchParams.get('$filter')).toContain('receivedDateTime ge');
        return Promise.resolve(
          json({
            value: [{ id: 'graph-message-1' }],
            '@odata.deltaLink':
              'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=opaque-1'
          })
        );
      }
      if (url.includes('/messages/graph-message-1?$select=')) {
        return Promise.resolve(json(inboundMessage()));
      }
      if (url.includes('/messages/graph-message-1/attachments?$select=')) {
        return Promise.resolve(
          json({
            value: [
              {
                id: 'attachment-1',
                name: 'proof.txt',
                contentType: 'text/plain',
                size: attachment.byteLength,
                isInline: false
              }
            ]
          })
        );
      }
      if (url.endsWith('/messages/graph-message-1/attachments/attachment-1/$value')) {
        return Promise.resolve(new Response(attachment));
      }
      if (url.endsWith('/messages/graph-message-1/$value')) {
        return Promise.resolve(bytes(rawMime));
      }
      return Promise.reject(new Error(`Unexpected Graph request: ${url}`));
    }) as typeof fetch;
    let nowIndex = 0;
    const times = [
      '2026-09-10T01:00:00.000Z',
      '2026-09-10T01:00:01.000Z',
      '2026-09-10T01:00:02.000Z',
      '2026-09-10T01:00:03.000Z'
    ];
    const inbound = new MicrosoftGraphManagedCommunicationInboundV1({
      client: new MicrosoftGraphManagedCommunicationClientV1(tokenProvider(), fetchImpl),
      foundation,
      exactEvidence,
      workspaceId,
      accountRef,
      now: () => times[nowIndex++] ?? '2026-09-10T01:00:04.000Z'
    });

    const result = await inbound.syncOnce();
    expect(result.initialized).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.providerCursor).toContain('$deltatoken=opaque-1');

    const ids = managedCommunicationNormalizedIdsV1({
      workspaceId,
      accountRef,
      provider: MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
      providerMessageId: 'graph-message-1',
      providerThreadId: 'graph-conversation-1'
    });
    const normalized = await foundation.resolveMessage(workspaceId, accountRef, ids.messageId);
    expect(normalized).toMatchObject({
      direction: 'INBOUND',
      subject: 'Incoming trademark instruction',
      htmlBody: '<p>Please review 98554243.</p>',
      occurredAt: '2026-09-10T01:01:00.000Z',
      providerObservation: {
        provider: MICROSOFT_GRAPH_MANAGED_COMMUNICATION_PROVIDER,
        providerMessageId: 'graph-message-1',
        providerThreadId: 'graph-conversation-1'
      }
    });
    expect(normalized.attachments).toEqual([
      expect.objectContaining({
        attachmentRef: 'msgraph:graph-message-1:attachment-1',
        fileName: 'proof.txt',
        sha256: sha256(attachment)
      })
    ]);
    expect(normalized.participants.map((item) => item.role)).toEqual([
      'SENDER',
      'TO',
      'CC',
      'REPLY_TO'
    ]);
    expect(exactEvidence.admissions).toHaveLength(1);
    expect(Buffer.from(exactEvidence.admissions[0]!.rawPayload).toString('utf8')).toBe(rawMime);
    expect(exactEvidence.admissions[0]!.headers).toEqual([
      { name: 'X-Trace-Id', value: 'trace-safe-1' }
    ]);
    expect(JSON.stringify(exactEvidence.admissions[0])).not.toContain('must-not-persist');
    expect(calls.some((url) => url.endsWith('/messages/graph-message-1/$value'))).toBe(true);
  });

  it('replays the same provider message idempotently and preserves the original evidence observation time', async () => {
    const foundation = await registeredFoundation();
    const exactEvidence = new RecordingExactEvidenceStore();
    await foundation.saveCheckpoint({
      workspaceId,
      accountRef,
      checkpointRef: 'msgraph-delta:before-replay',
      providerCursor:
        'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=before-replay',
      observedAt,
      now: observedAt
    });
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes('/v1.0/me?$select=')) return Promise.resolve(json(graphProfile()));
      if (url.includes('/mailFolders/inbox/messages/delta?$deltatoken=')) {
        return Promise.resolve(
          json({
            value: [{ id: 'graph-message-1' }],
            '@odata.deltaLink':
              'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=after-replay'
          })
        );
      }
      if (url.includes('/messages/graph-message-1?$select=')) {
        return Promise.resolve(json({ ...inboundMessage(), hasAttachments: false }));
      }
      if (url.endsWith('/messages/graph-message-1/$value')) return Promise.resolve(bytes('raw'));
      return Promise.reject(new Error(`Unexpected Graph request: ${url}`));
    }) as typeof fetch;
    const inbound = new MicrosoftGraphManagedCommunicationInboundV1({
      client: new MicrosoftGraphManagedCommunicationClientV1(tokenProvider(), fetchImpl),
      foundation,
      exactEvidence,
      workspaceId,
      accountRef,
      now: () => '2026-09-10T01:05:00.000Z'
    });

    await expect(inbound.syncOnce()).resolves.toMatchObject({ imported: 1 });
    await foundation.saveCheckpoint({
      workspaceId,
      accountRef,
      checkpointRef: 'msgraph-delta:force-replay',
      providerCursor:
        'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=before-replay',
      observedAt: '2026-09-10T01:06:00.000Z',
      now: '2026-09-10T01:06:00.000Z'
    });
    await expect(inbound.syncOnce()).resolves.toMatchObject({ imported: 0 });
    expect(exactEvidence.admissions).toHaveLength(2);
    expect(exactEvidence.admissions[0]!.observedAt).toBe(exactEvidence.admissions[1]!.observedAt);
  });

  it('does not advance the durable checkpoint when message admission fails', async () => {
    const foundation = await registeredFoundation();
    const cursor =
      'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=stable';
    await foundation.saveCheckpoint({
      workspaceId,
      accountRef,
      checkpointRef: 'msgraph-delta:stable',
      providerCursor: cursor,
      observedAt,
      now: observedAt
    });
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes('/v1.0/me?$select=')) return Promise.resolve(json(graphProfile()));
      if (url.includes('$deltatoken=stable')) {
        return Promise.resolve(
          json({
            value: [{ id: 'broken-message' }],
            '@odata.deltaLink':
              'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=must-not-save'
          })
        );
      }
      if (url.includes('/messages/broken-message?$select=')) {
        return Promise.resolve(json({ id: 'broken-message', conversationId: 'thread-no-sender' }));
      }
      return Promise.reject(new Error(`Unexpected Graph request: ${url}`));
    }) as typeof fetch;
    const inbound = new MicrosoftGraphManagedCommunicationInboundV1({
      client: new MicrosoftGraphManagedCommunicationClientV1(tokenProvider(), fetchImpl),
      foundation,
      exactEvidence: new RecordingExactEvidenceStore(),
      workspaceId,
      accountRef,
      now: () => '2026-09-10T01:07:00.000Z'
    });

    await expect(inbound.syncOnce()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    const checkpoint = await foundation.latestCheckpoint(workspaceId, accountRef);
    expect(checkpoint?.providerCursor).toBe(cursor);
  });

  it.each([
    [401, 'AUTHENTICATION_FAILURE', false],
    [403, 'PERMISSION_DENIED', false],
    [409, 'CONFLICT', true],
    [429, 'RATE_LIMITED', true],
    [503, 'PROVIDER_UNAVAILABLE', true]
  ] as const)('classifies Graph HTTP %s explicitly', async (status, code, retryable) => {
    const client = new MicrosoftGraphManagedCommunicationClientV1(
      tokenProvider(),
      vi.fn(() => Promise.resolve(json({ error: 'test' }, status)))
    );
    await expect(client.profile()).rejects.toMatchObject({ code, retryable });
  });

  it('treats an expired delta cursor explicitly and never fabricates an empty-success sync', async () => {
    const foundation = await registeredFoundation();
    const cursor =
      'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$deltatoken=expired';
    await foundation.saveCheckpoint({
      workspaceId,
      accountRef,
      checkpointRef: 'msgraph-delta:expired',
      providerCursor: cursor,
      observedAt,
      now: observedAt
    });
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.includes('/v1.0/me?$select=')) return Promise.resolve(json(graphProfile()));
      if (url.includes('$deltatoken=expired')) return Promise.resolve(json({}, 410));
      return Promise.reject(new Error(`Unexpected Graph request: ${url}`));
    }) as typeof fetch;
    const inbound = new MicrosoftGraphManagedCommunicationInboundV1({
      client: new MicrosoftGraphManagedCommunicationClientV1(tokenProvider(), fetchImpl),
      foundation,
      exactEvidence: new RecordingExactEvidenceStore(),
      workspaceId,
      accountRef
    });

    await expect(inbound.syncOnce()).rejects.toMatchObject({
      code: 'INVALID_DELTA',
      retryable: false
    });
    expect((await foundation.latestCheckpoint(workspaceId, accountRef))?.providerCursor).toBe(
      cursor
    );
  });

  it('fails closed when the authenticated Microsoft mailbox differs from the durable account binding', async () => {
    const foundation = await registeredFoundation();
    const client = new MicrosoftGraphManagedCommunicationClientV1(
      tokenProvider(),
      vi.fn(() => Promise.resolve(json({ id: 'graph-user-other', mail: 'different@example.test' })))
    );
    const inbound = new MicrosoftGraphManagedCommunicationInboundV1({
      client,
      foundation,
      exactEvidence: new RecordingExactEvidenceStore(),
      workspaceId,
      accountRef
    });
    await expect(inbound.syncOnce()).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
  });

  it('rejects outbound attachments until a governed byte resolver exists', async () => {
    const sender = new MicrosoftGraphManagedCommunicationSenderV1(
      new MicrosoftGraphManagedCommunicationClientV1(tokenProvider())
    );
    await expect(
      sender.prepare(
        sendRequest({
          attachments: [
            {
              attachmentRef: 'attachment_test',
              fileName: 'proof.txt',
              mediaType: 'text/plain',
              sizeBytes: 4,
              sha256: 'a'.repeat(64)
            }
          ]
        }),
        {
          sendId: 'commsend_graph_attachment',
          workspaceId,
          account: account(),
          correlationId: 'graph-attachment-test'
        }
      )
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_ATTACHMENT' });
  });

  it('marks transport failures retryable', async () => {
    const client = new MicrosoftGraphManagedCommunicationClientV1(
      tokenProvider(),
      vi.fn(() => Promise.reject(new Error('socket reset')))
    );
    try {
      await client.profile();
      throw new Error('Expected Graph transport failure.');
    } catch (error) {
      expect(error).toBeInstanceOf(MicrosoftGraphManagedCommunicationError);
      expect(error).toMatchObject({ code: 'TRANSPORT_FAILURE', retryable: true });
    }
  });
});
