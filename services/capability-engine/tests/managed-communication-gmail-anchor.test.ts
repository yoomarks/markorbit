import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type {
  ManagedCommunicationExactEvidenceAdmissionOutcomeV1 as EvidenceOutcome,
  ManagedCommunicationExactEvidenceAdmissionV1 as EvidenceAdmission,
  ManagedCommunicationExactEvidenceRefV1 as EvidenceRef,
  ManagedCommunicationExactEvidenceStoreV1 as EvidenceStore
} from '../src/managed-communication-exact-evidence.js';
import {
  InMemoryManagedCommunicationFoundationV1,
  managedCommunicationNormalizedIdsV1
} from '../src/managed-communication-foundation.js';
import {
  syncGmailManagedCommunicationInboundFromAnchorV1
} from '../src/managed-communication-gmail-anchor.js';
import {
  GMAIL_MANAGED_COMMUNICATION_PROVIDER,
  GmailManagedCommunicationClientV1,
  GmailManagedCommunicationInboundV1
} from '../src/managed-communication-gmail.js';

const workspaceId = 'workspace_gmail_anchor_test';
const accountRef = 'communication-account_gmail_anchor_test';
const providerAccountRef = 'operator@example.test';
const anchorId = 'gmail-outbound-anchor';
const threadId = 'gmail-live-thread';
const replyId = 'gmail-inbound-reply';

function json(value: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  );
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.toString() : input.url;
}

class MemoryEvidenceStore implements EvidenceStore {
  readonly admissions: EvidenceAdmission[] = [];
  private readonly rows = new Map<string, EvidenceRef>();

  admitExactEvidence(input: EvidenceAdmission): Promise<EvidenceOutcome> {
    const key = `${input.workspaceId}\u0000${input.accountRef}\u0000${input.messageId}`;
    const existing = this.rows.get(key);
    if (existing) {
      return Promise.resolve({
        schemaVersion: 1,
        disposition: 'REPLAYED',
        evidence: existing
      });
    }

    this.admissions.push({
      ...input,
      rawPayload: Uint8Array.from(input.rawPayload),
      headers: input.headers.map((header) => ({ ...header })),
      ...(input.metadata ? { metadata: { ...input.metadata } } : {})
    });
    const sha256 = createHash('sha256').update(input.rawPayload).digest('hex');
    const evidence: EvidenceRef = Object.freeze({
      schemaVersion: 1,
      evidenceRef: `commevidence_anchor_${sha256.slice(0, 20)}`,
      sha256,
      mediaType: input.mediaType,
      sizeBytes: input.rawPayload.byteLength,
      observedAt: input.observedAt,
      provider: input.provider,
      providerMessageId: input.providerMessageId,
      headers: Object.freeze(
        input.headers.map((header) => Object.freeze({ ...header }))
      ),
      metadata: Object.freeze({ ...(input.metadata ?? {}) })
    });
    this.rows.set(key, evidence);
    return Promise.resolve({
      schemaVersion: 1,
      disposition: 'ADMITTED',
      evidence
    });
  }

  resolveExactEvidence(input: {
    workspaceId: string;
    accountRef: string;
    messageId: string;
  }): Promise<EvidenceRef | undefined> {
    const key = `${input.workspaceId}\u0000${input.accountRef}\u0000${input.messageId}`;
    return Promise.resolve(this.rows.get(key));
  }
}

async function createFoundation() {
  const foundation = new InMemoryManagedCommunicationFoundationV1();
  await foundation.registerAccount({
    workspaceId,
    accountRef,
    channel: 'EMAIL',
    provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
    providerAccountRef,
    now: '2026-09-02T03:45:00.000Z'
  });
  return foundation;
}

function createHarness(
  foundation: InMemoryManagedCommunicationFoundationV1,
  exactEvidence: MemoryEvidenceStore
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
      return json({ access_token: 'access-token-test-only', expires_in: 3600 });
    }
    if (url.includes(`/messages/${anchorId}?format=full`)) {
      return json({
        id: anchorId,
        threadId,
        historyId: '100',
        internalDate: '1788320947000',
        payload: {
          mimeType: 'text/plain',
          headers: [
            { name: 'From', value: providerAccountRef },
            { name: 'To', value: 'expert@example.test' },
            { name: 'Subject', value: 'MarkOrbit Gmail Live Pilot' }
          ],
          body: {
            data: Buffer.from('Please reply.', 'utf8').toString('base64url')
          }
        }
      });
    }
    if (url.includes('/users/me/history?')) {
      const start = new URL(url).searchParams.get('startHistoryId') ?? '';
      historyStarts.push(start);
      if (start === '100') {
        return json({
          historyId: '101',
          history: [
            {
              messagesAdded: [
                { message: { id: anchorId } },
                { message: { id: replyId } }
              ]
            }
          ]
        });
      }
      return json({ historyId: '101', history: [] });
    }
    if (url.includes(`/messages/${replyId}?format=full`)) {
      return json({
        id: replyId,
        threadId,
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
            data: Buffer.from(
              'MarkOrbit Gmail live pilot reply confirmed.',
              'utf8'
            ).toString('base64url')
          }
        }
      });
    }
    if (url.includes(`/messages/${replyId}?format=raw`)) {
      return json({
        id: replyId,
        threadId,
        raw: Buffer.from(rawReply, 'utf8').toString('base64url')
      });
    }
    return Promise.reject(new Error(`Unexpected provider request: ${url}`));
  }) as typeof fetch;

  const client = new GmailManagedCommunicationClientV1(
    {
      clientId: 'client-id-test-only',
      clientSecret: 'client-secret-test-only',
      refreshToken: 'refresh-token-test-only',
      providerAccountRef
    },
    fetchImpl,
    () => 30_000
  );
  const inbound = new GmailManagedCommunicationInboundV1({
    client,
    foundation,
    exactEvidence,
    workspaceId,
    accountRef,
    now: () => '2026-09-02T03:50:00.000Z'
  });
  return { client, inbound, historyStarts, rawReply };
}

describe('anchored Gmail inbound synchronization', () => {
  it('imports an anchored live reply exactly once', async () => {
    const foundation = await createFoundation();
    const exactEvidence = new MemoryEvidenceStore();
    const harness = createHarness(foundation, exactEvidence);

    await expect(
      syncGmailManagedCommunicationInboundFromAnchorV1({
        client: harness.client,
        inbound: harness.inbound,
        foundation,
        workspaceId,
        accountRef,
        anchorProviderMessageId: anchorId,
        now: () => '2026-09-02T03:49:30.000Z'
      })
    ).resolves.toEqual({
      initialized: false,
      imported: 1,
      providerCursor: '101'
    });

    const replyIds = managedCommunicationNormalizedIdsV1({
      workspaceId,
      accountRef,
      provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
      providerMessageId: replyId,
      providerThreadId: threadId
    });
    const outboundIds = managedCommunicationNormalizedIdsV1({
      workspaceId,
      accountRef,
      provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
      providerMessageId: anchorId,
      providerThreadId: threadId
    });
    expect(replyIds.threadRef).toBe(outboundIds.threadRef);

    const normalized = await foundation.resolveMessage(
      workspaceId,
      accountRef,
      replyIds.messageId
    );
    expect(normalized.direction).toBe('INBOUND');
    expect(normalized.textBody).toBe(
      'MarkOrbit Gmail live pilot reply confirmed.'
    );
    expect(normalized.threadRef).toBe(outboundIds.threadRef);

    const evidence = await exactEvidence.resolveExactEvidence({
      workspaceId,
      accountRef,
      messageId: replyIds.messageId
    });
    expect(evidence).toMatchObject({
      mediaType: 'message/rfc822',
      provider: 'GMAIL',
      providerMessageId: replyId,
      metadata: {
        gmailMessageId: replyId,
        gmailThreadId: threadId,
        gmailHistoryId: '101'
      }
    });
    expect(evidence?.sha256).toBe(
      createHash('sha256').update(harness.rawReply).digest('hex')
    );
    const sensitiveHeader = evidence?.headers.some(
      (header) => header.name.toLowerCase() === 'authorization'
    );
    expect(sensitiveHeader).toBe(false);
    expect(exactEvidence.admissions).toHaveLength(1);

    await expect(harness.inbound.syncOnce()).resolves.toEqual({
      initialized: false,
      imported: 0,
      providerCursor: '101'
    });
    expect(harness.historyStarts).toEqual(['100', '101']);
    expect(exactEvidence.admissions).toHaveLength(1);
  });

  it('rejects a conflicting existing cursor', async () => {
    const foundation = await createFoundation();
    await foundation.saveCheckpoint({
      workspaceId,
      accountRef,
      checkpointRef: 'gmail-history:999',
      providerCursor: '999',
      observedAt: '2026-09-02T03:48:00.000Z',
      now: '2026-09-02T03:48:00.000Z'
    });
    const exactEvidence = new MemoryEvidenceStore();
    const harness = createHarness(foundation, exactEvidence);

    await expect(
      syncGmailManagedCommunicationInboundFromAnchorV1({
        client: harness.client,
        inbound: harness.inbound,
        foundation,
        workspaceId,
        accountRef,
        anchorProviderMessageId: anchorId
      })
    ).rejects.toThrow(
      'refuses to replace an existing different provider cursor'
    );
    expect(exactEvidence.admissions).toHaveLength(0);
  });
});
