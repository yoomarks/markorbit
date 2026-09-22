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

function resolvedJson(value: unknown, status = 200): Promise<Response> {
  return Promise.resolve(json(value, status));
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.toString() : input.url;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function exactInboundCorrelation() {
  return Object.freeze({
    schemaVersion: 1 as const,
    method: 'PUBLIC_MAIL_REF' as const,
    disposition: 'RESOLVED' as const,
    confidence: 'EXACT' as const,
    rfcMessageIds: Object.freeze([]),
    publicMailRefs: Object.freeze(['MO-00000000000000000000000001']),
    sendIds: Object.freeze(['commsend_00000000000000000000000000000001']),
    outboundMessageIds: Object.freeze(['message-outbound-1']),
    outboundThreadRefs: Object.freeze(['thread-outbound-1']),
    sourceFields: Object.freeze(['TEXT_BODY' as const]),
    outboundThreadRef: 'thread-outbound-1',
    authority: Object.freeze({
      customerTruthMutated: false as const,
      matterTruthMutated: false as const,
      legalTruthCreated: false as const,
      knowledgeApproved: false as const,
      professionalDecisionCreated: false as const
    })
  });
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

class FlakyRecordingExactEvidenceStore extends RecordingExactEvidenceStore {
  private failuresRemaining = 1;

  override admitExactEvidence(
    input: ManagedCommunicationExactEvidenceAdmissionV1
  ): Promise<ManagedCommunicationExactEvidenceAdmissionOutcomeV1> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      return Promise.reject(new Error('simulated exact evidence persistence failure'));
    }
    return super.admitExactEvidence(input);
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

function gmailAccount() {
  return {
    schemaVersion: 1 as const,
    workspaceId,
    accountRef,
    channel: 'EMAIL' as const,
    provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
    providerAccountRef,
    createdAt: '2026-09-01T14:00:00.000Z'
  };
}

async function foundationWithCheckpoint(providerCursor = '200') {
  const foundation = new InMemoryManagedCommunicationFoundationV1();
  await foundation.registerAccount({
    workspaceId,
    accountRef,
    channel: 'EMAIL',
    provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
    providerAccountRef,
    now: '2026-09-01T14:00:00.000Z'
  });
  await foundation.saveCheckpoint({
    workspaceId,
    accountRef,
    checkpointRef: `gmail-history:${providerCursor}`,
    providerCursor,
    observedAt: '2026-09-01T14:00:00.000Z',
    now: '2026-09-01T14:00:00.000Z'
  });
  return foundation;
}

describe('Gmail Managed Communication provider adapter', () => {
  it('performs no network activity until invoked and caches OAuth access tokens', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      calls.push(url);
      if (url === 'https://oauth2.googleapis.com/token') {
        return resolvedJson({ access_token: 'access-token-test-only', expires_in: 3600 });
      }
      if (url === 'https://gmail.googleapis.com/gmail/v1/users/me/profile') {
        return resolvedJson({ historyId: '100' });
      }
      return Promise.reject(new Error(`Unexpected provider request: ${url}`));
    }) as typeof fetch;

    const client = new GmailManagedCommunicationClientV1(config, fetchImpl, () => 10_000);
    expect(calls).toEqual([]);
    await expect(client.profile()).resolves.toEqual({ historyId: '100' });
    await expect(client.profile()).resolves.toEqual({ historyId: '100' });
    const tokenCalls = calls.filter((url) => url === 'https://oauth2.googleapis.com/token');
    const profileCalls = calls.filter((url) => url.endsWith('/users/me/profile'));
    expect(tokenCalls).toHaveLength(1);
    expect(profileCalls).toHaveLength(2);
  });

  it('builds deterministic reply MIME and returns stable Gmail send identities', async () => {
    const requests: Readonly<{ url: string; init?: RequestInit }>[] = [];
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      requests.push({ url, ...(init ? { init } : {}) });
      if (url === 'https://oauth2.googleapis.com/token') {
        return resolvedJson({ access_token: 'access-token-test-only', expires_in: 3600 });
      }
      if (url.includes('/users/me/threads/gmail-thread-1?')) {
        return resolvedJson({
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
      }
      if (url.endsWith('/users/me/messages/send')) {
        return resolvedJson({ id: 'gmail-message-out-1', threadId: 'gmail-thread-1' });
      }
      if (url.endsWith('/users/me/messages/gmail-message-out-1?format=full')) {
        return resolvedJson({
          id: 'gmail-message-out-1',
          threadId: 'gmail-thread-1',
          payload: {
            headers: [{ name: 'Message-ID', value: '<gmail-out-1@example.test>' }]
          }
        });
      }
      return Promise.reject(new Error(`Unexpected provider request: ${url}`));
    }) as typeof fetch;
    const client = new GmailManagedCommunicationClientV1(config, fetchImpl, () => 20_000);
    const resolveThread = ({ threadRef }: { threadRef: string }) => {
      expect(threadRef).toBe('commthread_existing');
      return Promise.resolve('gmail-thread-1');
    };
    const sender = new GmailManagedCommunicationSenderV1(
      client,
      resolveThread,
      () => '2026-09-01T14:10:00.000Z'
    );
    const receipt = await sender.send(sendRequest({ replyToThreadRef: 'commthread_existing' }), {
      sendId: 'commsend_reply_test',
      workspaceId,
      account: gmailAccount(),
      correlationId: 'gmail-provider-test'
    });

    expect(receipt).toEqual({
      providerMessageId: 'gmail-message-out-1',
      providerThreadId: 'gmail-thread-1',
      rfcMessageId: '<gmail-out-1@example.test>',
      providerReceiptRef: 'gmail://users/me/messages/gmail-message-out-1',
      acceptedAt: '2026-09-01T14:10:00.000Z'
    });
    const sendCall = requests.find((request) => request.url.endsWith('/users/me/messages/send'));
    expect(sendCall).toBeDefined();
    const sendBody = sendCall?.init?.body;
    if (typeof sendBody !== 'string')
      throw new TypeError('Expected Gmail send body to be JSON text.');
    const body = JSON.parse(sendBody) as { raw: string; threadId?: string };
    expect(body.threadId).toBe('gmail-thread-1');
    const raw = Buffer.from(body.raw, 'base64url').toString('utf8');
    expect(raw).toContain('In-Reply-To: <prior@example.test>');
    expect(raw).toContain('References: <root@example.test> <prior@example.test>');
    expect(raw).toContain('Subject: =?UTF-8?B?');
    expect(raw).toContain('Please reply to this test message.');
    expect(raw).not.toContain(config.clientSecret);
    expect(raw).not.toContain(config.refreshToken);
  });

  it('preserves an accepted Gmail send when RFC Message-ID enrichment is unavailable', async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === 'https://oauth2.googleapis.com/token') {
        return resolvedJson({ access_token: 'access-token-test-only', expires_in: 3600 });
      }
      if (url.endsWith('/users/me/messages/send')) {
        return resolvedJson({ id: 'gmail-message-no-rfc', threadId: 'gmail-thread-no-rfc' });
      }
      if (url.endsWith('/users/me/messages/gmail-message-no-rfc?format=full')) {
        return resolvedJson({ error: 'temporary metadata failure' }, 503);
      }
      return Promise.reject(new Error(`Unexpected provider request: ${url}`));
    }) as typeof fetch;
    const sender = new GmailManagedCommunicationSenderV1(
      new GmailManagedCommunicationClientV1(config, fetchImpl, () => 21_000),
      undefined,
      () => '2026-09-01T14:11:00.000Z'
    );

    await expect(
      sender.send(sendRequest(), {
        sendId: 'commsend_no_rfc_gmail',
        workspaceId,
        account: gmailAccount(),
        correlationId: 'gmail-no-rfc'
      })
    ).resolves.toEqual({
      providerMessageId: 'gmail-message-no-rfc',
      providerThreadId: 'gmail-thread-no-rfc',
      providerReceiptRef: 'gmail://users/me/messages/gmail-message-no-rfc',
      acceptedAt: '2026-09-01T14:11:00.000Z'
    });
  });

  it('fails closed when Gmail RFC enrichment returns a different sent-message identity', async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === 'https://oauth2.googleapis.com/token') {
        return resolvedJson({ access_token: 'access-token-test-only', expires_in: 3600 });
      }
      if (url.endsWith('/users/me/messages/send')) {
        return resolvedJson({ id: 'gmail-message-stable', threadId: 'gmail-thread-stable' });
      }
      if (url.endsWith('/users/me/messages/gmail-message-stable?format=full')) {
        return resolvedJson({
          id: 'gmail-message-drifted',
          threadId: 'gmail-thread-stable',
          payload: {
            headers: [{ name: 'Message-ID', value: '<gmail-stable@example.test>' }]
          }
        });
      }
      return Promise.reject(new Error(`Unexpected provider request: ${url}`));
    }) as typeof fetch;
    const sender = new GmailManagedCommunicationSenderV1(
      new GmailManagedCommunicationClientV1(config, fetchImpl, () => 21_500),
      undefined,
      () => '2026-09-01T14:11:30.000Z'
    );

    await expect(
      sender.send(sendRequest(), {
        sendId: 'commsend_gmail_identity_drift',
        workspaceId,
        account: gmailAccount(),
        correlationId: 'gmail-identity-drift'
      })
    ).rejects.toThrow('Gmail sent-message identity changed during RFC evidence lookup.');
  });

  it('fails closed on header injection and unsupported outbound attachments', () => {
    const injected = sendRequest({ subject: 'safe\r\nBcc: attacker@example.test' });
    const buildInjected = () =>
      buildGmailManagedCommunicationMimeV1(injected, 'commsend_header_injection');
    expect(buildInjected).toThrow(/CR\/LF/u);
    const withAttachment = sendRequest({
      attachments: [
        {
          attachmentRef: 'attachment_test',
          fileName: 'test.txt',
          mediaType: 'text/plain',
          sizeBytes: 4,
          sha256: 'a'.repeat(64)
        }
      ]
    });
    const buildAttachment = () =>
      buildGmailManagedCommunicationMimeV1(withAttachment, 'commsend_attachment');
    expect(buildAttachment).toThrow(/governed byte resolver/u);
  });

  it('advances history, ignores self mail, and admits exact raw evidence without sensitive headers', async () => {
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

    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === 'https://oauth2.googleapis.com/token') {
        return resolvedJson({ access_token: 'access-token-test-only', expires_in: 3600 });
      }
      if (url.endsWith('/users/me/profile')) return resolvedJson({ historyId: '100' });
      if (url.includes('/users/me/history?')) {
        const parsed = new URL(url);
        historyStarts.push(parsed.searchParams.get('startHistoryId') ?? '');
        return resolvedJson({
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
      if (url.includes('/messages/gmail-self-1?format=full')) {
        return resolvedJson({
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
      }
      if (url.includes('/messages/gmail-inbound-1?format=full')) {
        return resolvedJson({
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
                  data: Buffer.from('Normalized inbound body.', 'utf8').toString('base64url')
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
      }
      if (url.includes('/messages/gmail-inbound-1?format=raw')) {
        return resolvedJson({
          id: 'gmail-inbound-1',
          threadId: 'gmail-thread-inbound-1',
          raw: Buffer.from(rawMessage, 'utf8').toString('base64url')
        });
      }
      return Promise.reject(new Error(`Unexpected provider request: ${url}`));
    }) as typeof fetch;

    const client = new GmailManagedCommunicationClientV1(config, fetchImpl, () => 30_000);
    let timestampIndex = 0;
    const timestamps = [
      '2026-09-01T14:20:00.000Z',
      '2026-09-01T14:21:00.000Z',
      '2026-09-01T14:22:00.000Z',
      '2026-09-01T14:23:00.000Z'
    ];
    const correlate = vi.fn(() => Promise.resolve(exactInboundCorrelation()));
    const inbound = new GmailManagedCommunicationInboundV1({
      client,
      foundation,
      exactEvidence,
      correlation: { correlate },
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
    expect(correlate).toHaveBeenCalledTimes(1);

    const ids = managedCommunicationNormalizedIdsV1({
      workspaceId,
      accountRef,
      provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
      providerMessageId: 'gmail-inbound-1',
      providerThreadId: 'gmail-thread-inbound-1'
    });
    const normalized = await foundation.resolveMessage(workspaceId, accountRef, ids.messageId);
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
    expect(firstEvidence.metadata).toMatchObject({
      gmailMessageId: 'gmail-inbound-1',
      gmailThreadId: 'gmail-thread-inbound-1',
      gmailHistoryId: '101',
      moCorrelationSchemaVersion: '1',
      moCorrelationMethod: 'PUBLIC_MAIL_REF',
      moCorrelationDisposition: 'RESOLVED',
      moCorrelationConfidence: 'EXACT',
      moCorrelationOutboundThreadRef: 'thread-outbound-1',
      moCorrelationAuthority: 'NO_AUTHORITY'
    });
    expect(firstEvidence.headers).toEqual(
      expect.arrayContaining([
        { name: 'From', value: 'Expert <expert@example.test>' },
        { name: 'X-Trace-Id', value: 'trace-safe-1' }
      ])
    );
    const headerNames = firstEvidence.headers.map((item) => item.name.toLowerCase());
    expect(headerNames).not.toContain('authorization');
    expect(headerNames).not.toContain('cookie');
    const persistedProjection = JSON.stringify({ normalized, firstEvidence });
    expect(persistedProjection).not.toContain(config.clientSecret);
    expect(persistedProjection).not.toContain(config.refreshToken);
    expect(persistedProjection).not.toContain('access-token-test-only');
    expect(persistedProjection).not.toContain('must-not-persist');
  });

  it.each(['full', 'attachment', 'raw'] as const)(
    'advances history without admission when Gmail %s snapshot disappears with 404',
    async (vanishedStage) => {
      const foundation = await foundationWithCheckpoint();
      const exactEvidence = new RecordingExactEvidenceStore();
      const admitObservation = vi.spyOn(foundation, 'admitObservation');
      const fetchImpl = vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url === 'https://oauth2.googleapis.com/token') {
          return resolvedJson({ access_token: 'access-token-test-only', expires_in: 3600 });
        }
        if (url.includes('/users/me/history?')) {
          return resolvedJson({
            historyId: '201',
            history: [{ messagesAdded: [{ message: { id: 'gmail-vanished-1' } }] }]
          });
        }
        if (url.includes('/messages/gmail-vanished-1?format=full')) {
          if (vanishedStage === 'full') return resolvedJson({ error: 'gone' }, 404);
          return resolvedJson({
            id: 'gmail-vanished-1',
            threadId: 'gmail-thread-vanished-1',
            historyId: '201',
            payload: {
              mimeType: 'multipart/mixed',
              headers: [
                { name: 'From', value: 'Expert <expert@example.test>' },
                { name: 'To', value: providerAccountRef }
              ],
              parts:
                vanishedStage === 'attachment'
                  ? [
                      {
                        partId: '1',
                        mimeType: 'text/plain',
                        filename: 'proof.txt',
                        body: { attachmentId: 'attachment-vanished-1' }
                      }
                    ]
                  : [
                      {
                        partId: '0',
                        mimeType: 'text/plain',
                        body: { data: Buffer.from('body').toString('base64url') }
                      }
                    ]
            }
          });
        }
        if (url.includes('/messages/gmail-vanished-1/attachments/attachment-vanished-1')) {
          return resolvedJson({ error: 'gone' }, 404);
        }
        if (url.includes('/messages/gmail-vanished-1?format=raw')) {
          return vanishedStage === 'raw'
            ? resolvedJson({ error: 'gone' }, 404)
            : resolvedJson({
                id: 'gmail-vanished-1',
                threadId: 'gmail-thread-vanished-1',
                raw: Buffer.from('raw').toString('base64url')
              });
        }
        return Promise.reject(new Error(`Unexpected provider request: ${url}`));
      }) as typeof fetch;
      const inbound = new GmailManagedCommunicationInboundV1({
        client: new GmailManagedCommunicationClientV1(config, fetchImpl, () => 40_000),
        foundation,
        exactEvidence,
        workspaceId,
        accountRef,
        now: () => '2026-09-01T14:30:00.000Z'
      });

      const result = await inbound.syncOnce();
      expect(result).toEqual({ initialized: false, imported: 0, providerCursor: '201' });
      expect(admitObservation).not.toHaveBeenCalled();
      expect(exactEvidence.admissions).toHaveLength(0);
      expect((await foundation.latestCheckpoint(workspaceId, accountRef))?.providerCursor).toBe(
        '201'
      );
    }
  );

  it('resumes safely when exact evidence persistence fails after Gmail message admission', async () => {
    const foundation = await foundationWithCheckpoint('300');
    const exactEvidence = new FlakyRecordingExactEvidenceStore();
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === 'https://oauth2.googleapis.com/token') {
        return resolvedJson({ access_token: 'access-token-test-only', expires_in: 3600 });
      }
      if (url.includes('/users/me/history?')) {
        return resolvedJson({
          historyId: '301',
          history: [{ messagesAdded: [{ message: { id: 'gmail-recovery-1' } }] }]
        });
      }
      if (url.includes('/messages/gmail-recovery-1?format=full')) {
        return resolvedJson({
          id: 'gmail-recovery-1',
          threadId: 'gmail-thread-recovery-1',
          historyId: '301',
          payload: {
            mimeType: 'text/plain',
            headers: [
              { name: 'From', value: 'Expert <expert@example.test>' },
              { name: 'To', value: providerAccountRef }
            ],
            body: { data: Buffer.from('body').toString('base64url') }
          }
        });
      }
      if (url.includes('/messages/gmail-recovery-1?format=raw')) {
        return resolvedJson({
          id: 'gmail-recovery-1',
          threadId: 'gmail-thread-recovery-1',
          raw: Buffer.from('raw').toString('base64url')
        });
      }
      return Promise.reject(new Error(`Unexpected provider request: ${url}`));
    }) as typeof fetch;
    let timestampIndex = 0;
    const timestamps = ['2026-09-01T14:40:00.000Z', '2026-09-01T14:41:00.000Z'];
    const inbound = new GmailManagedCommunicationInboundV1({
      client: new GmailManagedCommunicationClientV1(config, fetchImpl, () => 42_000),
      foundation,
      exactEvidence,
      workspaceId,
      accountRef,
      now: () => timestamps[timestampIndex++] ?? '2026-09-01T14:42:00.000Z'
    });

    await expect(inbound.syncOnce()).rejects.toThrow(
      'simulated exact evidence persistence failure'
    );
    expect((await foundation.latestCheckpoint(workspaceId, accountRef))?.providerCursor).toBe(
      '300'
    );
    const ids = managedCommunicationNormalizedIdsV1({
      workspaceId,
      accountRef,
      provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
      providerMessageId: 'gmail-recovery-1',
      providerThreadId: 'gmail-thread-recovery-1'
    });
    const storedAfterFailure = await foundation.resolveMessage(
      workspaceId,
      accountRef,
      ids.messageId
    );
    expect(storedAfterFailure.providerObservation.observedAt).toBe('2026-09-01T14:40:00.000Z');

    await expect(inbound.syncOnce()).resolves.toEqual({
      initialized: false,
      imported: 0,
      providerCursor: '301'
    });
    expect(exactEvidence.admissions).toHaveLength(1);
    expect(exactEvidence.admissions[0]!.observedAt).toBe('2026-09-01T14:40:00.000Z');
    expect((await foundation.latestCheckpoint(workspaceId, accountRef))?.providerCursor).toBe(
      '301'
    );
  });

  it('does not swallow non-absence Managed Communication owner read failures', async () => {
    const foundation = await foundationWithCheckpoint('400');
    const exactEvidence = new RecordingExactEvidenceStore();
    vi.spyOn(foundation, 'resolveMessage').mockRejectedValueOnce(
      new Error('simulated owner read failure')
    );
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === 'https://oauth2.googleapis.com/token') {
        return resolvedJson({ access_token: 'access-token-test-only', expires_in: 3600 });
      }
      if (url.includes('/users/me/history?')) {
        return resolvedJson({
          historyId: '401',
          history: [{ messagesAdded: [{ message: { id: 'gmail-owner-error-1' } }] }]
        });
      }
      if (url.includes('/messages/gmail-owner-error-1?format=full')) {
        return resolvedJson({
          id: 'gmail-owner-error-1',
          threadId: 'gmail-thread-owner-error-1',
          historyId: '401',
          payload: {
            mimeType: 'text/plain',
            headers: [
              { name: 'From', value: 'Expert <expert@example.test>' },
              { name: 'To', value: providerAccountRef }
            ],
            body: { data: Buffer.from('body').toString('base64url') }
          }
        });
      }
      if (url.includes('/messages/gmail-owner-error-1?format=raw')) {
        return resolvedJson({
          id: 'gmail-owner-error-1',
          threadId: 'gmail-thread-owner-error-1',
          raw: Buffer.from('raw').toString('base64url')
        });
      }
      return Promise.reject(new Error(`Unexpected provider request: ${url}`));
    }) as typeof fetch;
    const inbound = new GmailManagedCommunicationInboundV1({
      client: new GmailManagedCommunicationClientV1(config, fetchImpl, () => 43_000),
      foundation,
      exactEvidence,
      workspaceId,
      accountRef,
      now: () => '2026-09-01T14:50:00.000Z'
    });

    await expect(inbound.syncOnce()).rejects.toThrow('simulated owner read failure');
    expect(exactEvidence.admissions).toHaveLength(0);
    expect((await foundation.latestCheckpoint(workspaceId, accountRef))?.providerCursor).toBe(
      '400'
    );
  });

  it('keeps history checkpoint stable when Gmail raw snapshot fails non-terminally', async () => {
    const foundation = await foundationWithCheckpoint();
    const exactEvidence = new RecordingExactEvidenceStore();
    const admitObservation = vi.spyOn(foundation, 'admitObservation');
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === 'https://oauth2.googleapis.com/token') {
        return resolvedJson({ access_token: 'access-token-test-only', expires_in: 3600 });
      }
      if (url.includes('/users/me/history?')) {
        return resolvedJson({
          historyId: '201',
          history: [{ messagesAdded: [{ message: { id: 'gmail-retryable-1' } }] }]
        });
      }
      if (url.includes('/messages/gmail-retryable-1?format=full')) {
        return resolvedJson({
          id: 'gmail-retryable-1',
          threadId: 'gmail-thread-retryable-1',
          historyId: '201',
          payload: {
            mimeType: 'text/plain',
            headers: [
              { name: 'From', value: 'Expert <expert@example.test>' },
              { name: 'To', value: providerAccountRef }
            ],
            body: { data: Buffer.from('body').toString('base64url') }
          }
        });
      }
      if (url.includes('/messages/gmail-retryable-1?format=raw')) {
        return resolvedJson({ error: 'unavailable' }, 503);
      }
      return Promise.reject(new Error(`Unexpected provider request: ${url}`));
    }) as typeof fetch;
    const inbound = new GmailManagedCommunicationInboundV1({
      client: new GmailManagedCommunicationClientV1(config, fetchImpl, () => 41_000),
      foundation,
      exactEvidence,
      workspaceId,
      accountRef,
      now: () => '2026-09-01T14:31:00.000Z'
    });

    await expect(inbound.syncOnce()).rejects.toMatchObject({ status: 503 });
    expect(admitObservation).not.toHaveBeenCalled();
    expect(exactEvidence.admissions).toHaveLength(0);
    expect((await foundation.latestCheckpoint(workspaceId, accountRef))?.providerCursor).toBe(
      '200'
    );
  });
});
