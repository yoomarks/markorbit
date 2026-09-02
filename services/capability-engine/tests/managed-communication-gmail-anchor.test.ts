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
import { syncGmailManagedCommunicationInboundFromAnchorV1 } from '../src/managed-communication-gmail-anchor.js';
import {
  GmailManagedCommunicationClientV1,
  GmailManagedCommunicationInboundV1,
  GMAIL_MANAGED_COMMUNICATION_PROVIDER
} from '../src/managed-communication-gmail.js';

const workspaceId = 'workspace_gmail_anchor_test';
const accountRef = 'communication-account_gmail_anchor_test';
const providerAccountRef = 'operator@example.test';
const anchorProviderMessageId = 'gmail-outbound-anchor';
const providerThreadId = 'gmail-live-thread';
const replyProviderMessageId = 'gmail-inbound-reply';
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

async function foundation() {
  const value = new InMemoryManagedCommunicationFoundationV1();
  await value.registerAccount({
    workspaceId,
    accountRef,
    channel: 'EMAIL',
    provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
    providerAccountRef,
    now: '2026-09-02T03:45:00.000Z'
  });
  return value;
}

function clientAndInbound(
  foundationStore: InMemoryManagedCommunicationFoundationV1,
  exactEvidence: RecordingExactEvidenceStore
) {
  const historyStarts: string[] = [];
  const rawReply = [
    'From: Expert <expert@example.test>',
    `To: ${providerAccountRef}`,
    'Subject: Re: MarkOrbit Gmail Live Pilot',
    '',
    'MarkOrbit Gmail live pilot reply confirmed.'
  ].join('\r\n');

  const fetchImpl = vi.fn((input: RequestInfo | URL) => {
    const url = requestUrl(input);
    if (url === 'https://oauth2.googleapis.com/token') {
      return resolvedJson({ access_token: 'access-token-test-only', expires_in: 3600 });
    }
    if (url.includes(`/messages/${anchorProviderMessageId}?format=full`)) {
      return resolvedJson({
        id: anchorProviderMessageId,
        threadId: providerThreadId,
        historyId: '100',
        internalDate: '1788320947000',
        payload: {
          mimeType: 'text/plain',
          headers: [
            { name: 'From', value: providerAccountRef },
            { name: 'To', value: 'expert@example.test' },
            { name: 'Subject', value: 'MarkOrbit Gmail Live Pilot' }
          ],
          body: { data: Buffer.from('Please reply.', 'utf8').toString('base64url') }
        }
      });
    }
    if (url.includes('/users/me/history?')) {
      const parsed = new URL(url);
      const start = parsed.searchParams.get('startHistoryId') ?? '';
      historyStarts.push(start);
      if (start === '100') {
        return resolvedJson({
          historyId: '101',
          history: [
            {
              messagesAdded: [
                { message: { id: anchorProviderMessageId } },
                { message: { id: replyProviderMessageId } }
              ]
            }
          ]
        });
      }
      return resolvedJson({ historyId: '101', history: [] });
    }
    if (url.includes(`/messages/${replyProviderMessageId}?format=full`)) {
      return resolvedJson({
        id: replyProviderMessageId,
        threadId: providerThreadId,
        historyId: '101',
        internalDate: '1788321000000',
        payload: {
          mimeType: 'text/plain',
          headers: [
            { name: 'From', value: 'Expert <expert@example.test>' },
            { name: 'To', value: providerAccountRef },
            { name: 'Subject', value: 'Re: MarkOrbit Gmail Live Pilot' },
            { name: 'Authorization', value: 'Bearer must-not-persist' },
            { name: 'X-Trace-Id', value: 'trace-anchor-1' }
          ],
          body: {
            data: Buffer.from('MarkOrbit Gmail live pilot reply confirmed.', 'utf8').toString(
              'base64url'
            )
          }
        }
      });
    }
    if (url.includes(`/messages/${replyProviderMessageId}?format=raw`)) {
      return resolvedJson({
        id: replyProviderMessageId,
        threadId: providerThreadId,
        raw: Buffer.from(rawReply, 'utf8').toString('base64url')
      });
    }
    return Promise.reject(new Error(`Unexpected provider request: ${url}`));
  }) as typeof fetch;

  const client = new GmailManagedCommunicationClientV1(config, fetchImpl, () => 30_000);
  const inbound = new GmailManagedCommunicationInboundV1({
    client,
    foundation: foundationStore,
    exactEvidence,
    workspaceId,
    accountRef,
    now: () => '2026-09-02T03:50:00.000Z'
  });
  return { client, inbound, historyStarts, rawReply };
}

describe('anchored Gmail Managed Communication inbound synchronization', () => {
  it('anchors before an existing reply, admits exact evidence, and replays without duplication', async () => {
    const foundationStore = await foundation();
    const exactEvidence = new RecordingExactEvidenceStore();
    const { client, inbound, historyStarts, rawReply } = clientAndInbound(
      foundationStore,
      exactEvidence
    );

    await expect(
      syncGmailManagedCommunicationInboundFromAnchorV1({
        client,
        inbound,
        foundation: foundationStore,
        workspaceId,
        accountRef,
        anchorProviderMessageId,
        now: () => '2026-09-02T03:49:30.000Z'
      })
    ).resolves.toEqual({ initialized: false, imported: 1, providerCursor: '101' });

    const replyIds = managedCommunicationNormalizedIdsV1({
      workspaceId,
      accountRef,
      provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
      providerMessageId: replyProviderMessageId,
      providerThreadId
    });
    const outboundIds = managedCommunicationNormalizedIdsV1({
      workspaceId,
      accountRef,
      provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
      providerMessageId: anchorProviderMessageId,
      providerThreadId
    });
    expect(replyIds.threadRef).toBe(outboundIds.threadRef);

    const normalized = await foundationStore.resolveMessage(
      workspaceId,
      accountRef,
      replyIds.messageId
    );
    expect(normalized.direction).toBe('INBOUND');
    expect(normalized.textBody).toBe('MarkOrbit Gmail live pilot reply confirmed.');
    expect(normalized.threadRef).toBe(outboundIds.threadRef);

    const evidence = await exactEvidence.resolveExactEvidence({
      workspaceId,
      accountRef,
      messageId: replyIds.messageId
    });
    expect(evidence).toMatchObject({
      mediaType: 'message/rfc822',
      provider: 'GMAIL',
      providerMessageId: replyProviderMessageId,
      metadata: {
        gmailMessageId: replyProviderMessageId,
        gmailThreadId: providerThreadId,
        gmailHistoryId: '101'
      }
    });
    expect(evidence?.sha256).toBe(sha256(Buffer.from(rawReply, 'utf8')));
    const headerNames = evidence?.headers.map((item) => item.name.toLowerCase()) ?? [];
    expect(headerNames).not.toContain('authorization');
    expect(exactEvidence.admissions).toHaveLength(1);

    await expect(inbound.syncOnce()).resolves.toEqual({
      initialized: false,
      imported: 0,
      providerCursor: '101'
    });
    expect(historyStarts).toEqual(['100', '101']);
    expect(exactEvidence.admissions).toHaveLength(1);
  });

  it('fails closed instead of replacing a different existing provider cursor', async () => {
    const foundationStore = await foundation();
    await foundationStore.saveCheckpoint({
      workspaceId,
      accountRef,
      checkpointRef: 'gmail-history:999',
      providerCursor: '999',
      observedAt: '2026-09-02T03:48:00.000Z',
      now: '2026-09-02T03:48:00.000Z'
    });
    const exactEvidence = new RecordingExactEvidenceStore();
    const { client, inbound } = clientAndInbound(foundationStore, exactEvidence);

    await expect(
      syncGmailManagedCommunicationInboundFromAnchorV1({
        client,
        inbound,
        foundation: foundationStore,
        workspaceId,
        accountRef,
        anchorProviderMessageId
      })
    ).rejects.toThrow('refuses to replace an existing different provider cursor');
    expect(exactEvidence.admissions).toHaveLength(0);
  });
});
