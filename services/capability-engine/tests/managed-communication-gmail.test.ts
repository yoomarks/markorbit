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
import type {
  ManagedCommunicationSendRequestV1
} from '../src/managed-communication-exchange.js';
import {
  buildGmailManagedCommunicationMimeV1,
  GmailManagedCommunicationClientV1,
  GmailManagedCommunicationInboundV1,
  GmailManagedCommunicationSenderV1,
  GMAIL_MANAGED_COMMUNICATION_PROVIDER
} from '../src/managed-communication-gmail.js';

const workspaceId = 'workspace_gmail_provider_test';
const accountRef = 'communication-account_gmail_provider_test';
const providerAccountRef = 'operator@example.test';
const config = Object.freeze({
  clientId: 'client-id-test-only',
  clientSecret: 'client-secret-test-only',
  refreshToken: 'refresh-token-test-only',
  providerAccountRef
});

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
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
    return Promise.resolve(
      Object.freeze({ schemaVersion: 1, disposition: 'ADMITTED', evidence })
    );
  }

  resolveExactEvidence(input: {
    workspaceId: string;
    accountRef: string;
    messageId: string;
  }): Promise<ManagedCommunicationExactEvidenceRefV1 | undefined> {
    return Promise.resolve(
      this.rows.get(`${input.workspaceId}\u0000${input.accountRef}\u0000${input.messageId}`)
    );
  }
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
    subject: 'Provider adapter test',
    textBody: 'Please reply to this test message.',
    attachments: [],
    ...overrides
  };
}

describe('Gmail Managed Communication provider adapter', () => {
  it('performs no network activity until invoked and caches OAuth access tokens', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url === 'https://oauth2.googleapis.com/token')
        return json({ access_token: 'access-token-test-only', expires_in: 3600 });
      if (url === 'https://gmail.googleapis.com/gmail/v1/users/me/profile')
        return json({ historyId: '100' });
      throw new Error(`Unexpected provider request: ${url}`);
    }) as typeof fetch;

    const client = new GmailManagedCommunicationClientV1(config, fetchImpl, () => 10_000);
    expect(calls).toEqual([]);

    await expect(client.profile()).resolves.toEqual({ historyId: '100' });
    await expect(client.profile()).resolves.toEqual({ historyId: '100' });

    expect(
      calls.filter((url) => url === 'https://oauth2.googleapis.com/token')
    ).toHaveLength(1);
    expect(
      calls.filter(
        (url) => url === 'https://gmail.googleapis.com/gmail/v1/users/me/profile'
      )
    ).toHaveLength(2);
  });

  it('builds deterministic reply MIME and returns stable Gmail send identities', async () => {
    const requests: Readonly<{ url: string; init?: RequestInit }>[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, ...(init ? { init } : {}) });
      if (url === 'https://oauth2.googleapis.com/token')
        return json({ access_token: 'access-token-test-only', expires_in: 3600 });
      if (url.includes('/users/me/threads/gmail-thread-1?'))
        return json({
          messages: [
            {
              payload: {
                headers: [
                  { name: 'Message-ID', value: '<prior@example.test>' },
                  { name: 'References', value: '<root@example.test>' },
                  { name: 'Subject', value: 'Prior subject' }
                ]
              }
            }
          ]
        });
      if (url.endsWith('/users/me/messages/send'))
        return json({ id: 'gmail-message-out-1', threadId: 'gmail-thread-1' });
      throw new Error(`Unexpected provider request: ${url}`);
    }) as typeof fetch;
    const client = new GmailManagedCommunicationClientV1(config, fetchImpl, () => 20_000);
    const sender = new GmailManagedCommunicationSenderV1(
      client,
      async ({ threadRef }) => {
        expect(threadRef).toBe('commthread_existing');
        return 'gmail-thread-1';
      },
      () => '2026-09-01T14:10:00.000Z'
    );

    const receipt = await sender.send(
      sendRequest({ replyToThreadRef: 'commthread_existing' }),
      {
        sendId: 'commsend_reply_test',
        workspaceId,
        account: {
          schemaVersion: 1,
          workspaceId,
          accountRef,
          channel: 'EMAIL',
          provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
          providerAccountRef,
          createdAt: '2026-09-01T14:00:00.000Z'
        },
        correlationId: 'gmail-provider-test'
      }
    );

    expect(receipt).toEqual({
      providerMessageId: 'gmail-message-out-1',
      providerThreadId: 'gmail-thread-1',
      providerReceiptRef: 'gmail://users/me/messages/gmail-message-out-1',
      acceptedAt: '2026-09-01T14:10:00.000Z'
    });
    const sendCall = requests.find((request) => request.url.endsWith('/users/me/messages/send'));
    expect(sendCall).toBeDefined();
    const body = JSON.parse(String(sendCall?.init?.body)) as {
      raw: string;
      threadId?: string;
    };
    expect(body.threadId).toBe('gmail-thread-1');
    const raw = Buffer.from(body.raw, 'base64url').toString('utf8');
    expect(raw).toContain('In-Reply-To: <prior@example.test>');
    expect(raw).toContain('References: <root@example.test> <prior@example.test>');
    expect(raw).toContain('Subject: =?UTF-8?B?');
    expect(raw).toContain('Please reply to this test message.');
    expect(raw).not.toContain(config.clientSecret);
    expect(raw).not.toContain(config.refreshToken);
  });

  it('fails closed on header injection and unsupported outbound attachments before dispatch', () => {
    expect(() =>
      buildGmailManagedCommunicationMimeV1(
        sendRequest({ subject: 'safe\r\nBcc: attacker@example.test' }),
        'commsend_header_injection'
      )
    ).toThrow(/CR\/LF/u);
    expect(() =>
      buildGmailManagedCommunicationMimeV1(
        sendRequest({
          attachments: [
            {
              attachmentRef: 'attachment_test',
              fileName: 'test.txt',
              mediaType: 'text/plain',
              sizeBytes: 4,
              sha256: 'a'.repeat(64)
            }
          ]
        }),
        'commsend_attachment_test'
      )
    ).toThrow(/governed byte resolver/u);
  });

  it(
    'advances Gmail history checkpoints, ignores self mail, and admits exact raw inbound evidence without sensitive headers',
    async () => {
      const foundation = new InMemoryManagedCommunicationFoundationV1();
      await foundation.registerAccount({
        workspaceId,
        accountRef,
        channel: 'EMAIL',
        provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
        providerAccountRef,
        now: '2026-09-01T14:00:00.000Z'
      });
      const exactEvidence = new RecordingExactEvidenceStore();
      const rawMessage = [
        'From: Expert <expert@example.test>',
        `To: ${providerAccountRef}`,
        'Subject: Exact inbound reply',
        '',
        'Exact provider raw body.'
      ].join('\r\n');
      const inlineAttachment = Buffer.from('attachment-bytes', 'utf8');
      const historyStarts: string[] = [];

      const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === 'https://oauth2.googleapis.com/token')
          return json({ access_token: 'access-token-test-only', expires_in: 3600 });
        if (url.endsWith('/users/me/profile')) return json({ historyId: '100' });
        if (url.includes('/users/me/history?')) {
          const parsed = new URL(url);
          historyStarts.push(parsed.searchParams.get('startHistoryId') ?? '');
          return json({
            historyId: '101',
            history: [
              {
                messagesAdded: [
                  { message: { id: 'gmail-self-1' } },
                  { message: { id: 'gmail-inbound-1' } },
                  { message: { id: 'gmail-inbound-1' } }
                ]
              }
            ]
          });
        }
        if (url.includes('/messages/gmail-self-1?format=full'))
          return json({
            id: 'gmail-self-1',
            threadId: 'gmail-thread-self',
            internalDate: '1788271800000',
            payload: {
              mimeType: 'text/plain',
              headers: [
                { name: 'From', value: providerAccountRef },
                { name: 'To', value: 'expert@example.test' }
              ],
              body: {
                data: Buffer.from('self message', 'utf8').toString('base64url')
              }
            }
          });
        if (url.includes('/messages/gmail-inbound-1?format=full'))
          return json({
            id: 'gmail-inbound-1',
            threadId: 'gmail-thread-inbound-1',
            historyId: '101',
            internalDate: '1788271860000',
            payload: {
              mimeType: 'multipart/mixed',
              headers: [
                { name: 'From', value: 'Expert <expert@example.test>' },
                { name: 'To', value: providerAccountRef },
                { name: 'Subject', value: 'Exact inbound reply' },
                { name: 'Authorization', value: 'Bearer must-not-persist' },
                { name: ' Cookie ', value: 'session=must-not-persist' },
                { name: 'X-Trace-Id', value: 'trace-safe-1' }
              ],
              parts: [
                {
                  partId: '0',
                  mimeType: 'text/plain',
                  body: {
                    data: Buffer.from('Normalized inbound body.', 'utf8').toString(
                      'base64url'
                    )
                  }
                },
                {
                  partId: '1',
                  mimeType: 'text/plain',
                  filename: 'proof.txt',
                  body: { data: inlineAttachment.toString('base64url') }
                }
              ]
            }
          });
        if (url.includes('/messages/gmail-inbound-1?format=raw'))
          return json({
            id: 'gmail-inbound-1',
            threadId: 'gmail-thread-inbound-1',
            raw: Buffer.from(rawMessage, 'utf8').toString('base64url')
          });
        throw new Error(`Unexpected provider request: ${url}`);
      }) as typeof fetch;

      const client = new GmailManagedCommunicationClientV1(config, fetchImpl, () => 30_000);
      let timestampIndex = 0;
      const timestamps = [
        '2026-09-01T14:20:00.000Z',
        '2026-09-01T14:21:00.000Z',
        '2026-09-01T14:22:00.000Z',
        '2026-09-01T14:23:00.000Z'
      ];
      const inbound = new GmailManagedCommunicationInboundV1({
        client,
        foundation,
        exactEvidence,
        workspaceId,
        accountRef,
        now: () => timestamps[timestampIndex++] ?? '2026-09-01T14:24:00.000Z'
      });

      await expect(inbound.syncOnce()).resolves.toEqual({
        initialized: true,
        imported: 0,
        providerCursor: '100'
      });
      await expect(inbound.syncOnce()).resolves.toEqual({
        initialized: false,
        imported: 1,
        providerCursor: '101'
      });
      await expect(inbound.syncOnce()).resolves.toEqual({
        initialized: false,
        imported: 0,
        providerCursor: '101'
      });

      expect(historyStarts).toEqual(['100', '101']);
      const ids = managedCommunicationNormalizedIdsV1({
        workspaceId,
        accountRef,
        provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
        providerMessageId: 'gmail-inbound-1',
        providerThreadId: 'gmail-thread-inbound-1'
      });
      const normalized = await foundation.resolveMessage(
        workspaceId,
        accountRef,
        ids.messageId
      );
      expect(normalized.textBody).toBe('Normalized inbound body.');
      expect(normalized.attachments).toEqual([
        {
          attachmentRef: 'gmail:gmail-inbound-1:part:1',
          fileName: 'proof.txt',
          mediaType: 'text/plain',
          sizeBytes: inlineAttachment.byteLength,
          sha256: sha256(inlineAttachment)
        }
      ]);

      expect(exactEvidence.admissions).toHaveLength(2);
      const firstEvidence = exactEvidence.admissions[0]!;
      expect(Buffer.from(firstEvidence.rawPayload).toString('utf8')).toBe(rawMessage);
      expect(firstEvidence.provider).toBe(GMAIL_MANAGED_COMMUNICATION_PROVIDER);
      expect(firstEvidence.providerMessageId).toBe('gmail-inbound-1');
      expect(firstEvidence.metadata).toEqual({
        gmailMessageId: 'gmail-inbound-1',
        gmailThreadId: 'gmail-thread-inbound-1',
        gmailHistoryId: '101'
      });
      expect(firstEvidence.headers).toEqual(
        expect.arrayContaining([
          { name: 'From', value: 'Expert <expert@example.test>' },
          { name: 'X-Trace-Id', value: 'trace-safe-1' }
        ])
      );
      expect(
        firstEvidence.headers.map((header) => header.name.toLowerCase())
      ).not.toContain('authorization');
      expect(
        firstEvidence.headers.map((header) => header.name.toLowerCase())
      ).not.toContain('cookie');
      const persistedProjection = JSON.stringify({ normalized, firstEvidence });
      expect(persistedProjection).not.toContain(config.clientSecret);
      expect(persistedProjection).not.toContain(config.refreshToken);
      expect(persistedProjection).not.toContain('access-token-test-only');
      expect(persistedProjection).not.toContain('must-not-persist');
    }
  );
});
