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
import { reconcileGmailManagedCommunicationProviderMessageV1 } from '../src/managed-communication-gmail-reconciliation.js';
import {
  GmailManagedCommunicationClientV1,
  GMAIL_MANAGED_COMMUNICATION_PROVIDER
} from '../src/managed-communication-gmail.js';

const workspaceId = 'workspace_gmail_reconciliation_test';
const accountRef = 'communication-account_gmail_reconciliation_test';
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

async function foundation(providerAccount = providerAccountRef) {
  const value = new InMemoryManagedCommunicationFoundationV1();
  await value.registerAccount({
    workspaceId,
    accountRef,
    channel: 'EMAIL',
    provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
    providerAccountRef: providerAccount,
    now: '2026-09-02T06:00:00.000Z'
  });
  await value.saveCheckpoint({
    workspaceId,
    accountRef,
    checkpointRef: 'gmail-history:4504417',
    providerCursor: '4504417',
    observedAt: '2026-09-02T06:01:00.000Z',
    now: '2026-09-02T06:01:00.000Z'
  });
  return value;
}

describe('Gmail Managed Communication explicit provider-message reconciliation', () => {
  it('imports exact evidence once, replays idempotently, and preserves the durable checkpoint', async () => {
    const store = await foundation();
    const exactEvidence = new RecordingExactEvidenceStore();
    const rawMessage = [
      'From: Expert <expert@example.test>',
      `To: ${providerAccountRef}`,
      'Subject: Reconciled inbound reply',
      '',
      'Reconciled provider raw body.'
    ].join('\r\n');
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === 'https://oauth2.googleapis.com/token') {
        return Promise.resolve(json({ access_token: 'access-token-test-only', expires_in: 3600 }));
      }
      if (url.includes('/messages/gmail-reconcile-1?format=full')) {
        return Promise.resolve(
          json({
            id: 'gmail-reconcile-1',
            threadId: 'gmail-thread-reconcile-1',
            historyId: '4504413',
            internalDate: '1788330657000',
            payload: {
              mimeType: 'text/plain',
              headers: [
                { name: 'From', value: 'Expert <expert@example.test>' },
                { name: 'To', value: providerAccountRef },
                { name: 'Subject', value: 'Reconciled inbound reply' },
                { name: 'Authorization', value: 'Bearer must-not-persist' },
                { name: 'X-Trace-Id', value: 'trace-reconcile-1' }
              ],
              body: {
                data: Buffer.from('Reconciled normalized body.', 'utf8').toString('base64url')
              }
            }
          })
        );
      }
      if (url.includes('/messages/gmail-reconcile-1?format=raw')) {
        return Promise.resolve(
          json({
            id: 'gmail-reconcile-1',
            threadId: 'gmail-thread-reconcile-1',
            raw: Buffer.from(rawMessage, 'utf8').toString('base64url')
          })
        );
      }
      return Promise.reject(new Error(`Unexpected provider request: ${url}`));
    }) as typeof fetch;
    const client = new GmailManagedCommunicationClientV1(config, fetchImpl, () => 30_000);

    const first = await reconcileGmailManagedCommunicationProviderMessageV1({
      client,
      foundation: store,
      exactEvidence,
      workspaceId,
      accountRef,
      providerMessageId: 'gmail-reconcile-1',
      now: () => '2026-09-02T06:02:00.000Z'
    });
    const providerCallsAfterFirst = fetchImpl.mock.calls.length;
    const replay = await reconcileGmailManagedCommunicationProviderMessageV1({
      client,
      foundation: store,
      exactEvidence,
      workspaceId,
      accountRef,
      providerMessageId: 'gmail-reconcile-1',
      now: () => '2026-09-02T06:03:00.000Z'
    });

    expect(first).toEqual({ initialized: false, imported: 1, providerCursor: '4504417' });
    expect(replay).toEqual({ initialized: false, imported: 0, providerCursor: '4504417' });
    expect(fetchImpl).toHaveBeenCalledTimes(providerCallsAfterFirst);
    await expect(store.latestCheckpoint(workspaceId, accountRef)).resolves.toMatchObject({
      checkpointRef: 'gmail-history:4504417',
      providerCursor: '4504417',
      observedAt: '2026-09-02T06:01:00.000Z'
    });

    const ids = managedCommunicationNormalizedIdsV1({
      workspaceId,
      accountRef,
      provider: GMAIL_MANAGED_COMMUNICATION_PROVIDER,
      providerMessageId: 'gmail-reconcile-1',
      providerThreadId: 'gmail-thread-reconcile-1'
    });
    const normalized = await store.resolveMessage(workspaceId, accountRef, ids.messageId);
    expect(normalized).toMatchObject({
      messageId: ids.messageId,
      threadRef: ids.threadRef,
      direction: 'INBOUND',
      subject: 'Reconciled inbound reply',
      textBody: 'Reconciled normalized body.',
      providerObservation: {
        provider: 'GMAIL',
        providerMessageId: 'gmail-reconcile-1',
        providerThreadId: 'gmail-thread-reconcile-1'
      }
    });

    expect(exactEvidence.admissions).toHaveLength(1);
    expect(Buffer.from(exactEvidence.admissions[0]!.rawPayload).toString('utf8')).toBe(rawMessage);
    expect(exactEvidence.admissions[0]!.mediaType).toBe('message/rfc822');
    expect(exactEvidence.admissions[0]!.metadata).toEqual({
      gmailMessageId: 'gmail-reconcile-1',
      gmailThreadId: 'gmail-thread-reconcile-1',
      gmailHistoryId: '4504413'
    });
    const headerNames = exactEvidence.admissions[0]!.headers.map((item) => item.name.toLowerCase());
    expect(headerNames).not.toContain('authorization');
  });

  it('skips a self-sent provider message without evidence admission', async () => {
    const store = await foundation();
    const exactEvidence = new RecordingExactEvidenceStore();
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url === 'https://oauth2.googleapis.com/token') {
        return Promise.resolve(json({ access_token: 'access-token-test-only', expires_in: 3600 }));
      }
      if (url.includes('/messages/gmail-self-reconcile?format=full')) {
        return Promise.resolve(
          json({
            id: 'gmail-self-reconcile',
            threadId: 'gmail-thread-self-reconcile',
            payload: {
              mimeType: 'text/plain',
              headers: [
                { name: 'From', value: providerAccountRef },
                { name: 'To', value: 'expert@example.test' }
              ],
              body: { data: Buffer.from('self mail').toString('base64url') }
            }
          })
        );
      }
      return Promise.reject(new Error(`Unexpected provider request: ${url}`));
    }) as typeof fetch;
    const client = new GmailManagedCommunicationClientV1(config, fetchImpl, () => 40_000);

    await expect(
      reconcileGmailManagedCommunicationProviderMessageV1({
        client,
        foundation: store,
        exactEvidence,
        workspaceId,
        accountRef,
        providerMessageId: 'gmail-self-reconcile'
      })
    ).resolves.toEqual({ initialized: false, imported: 0, providerCursor: '4504417' });
    expect(exactEvidence.admissions).toEqual([]);
  });

  it('fails closed before provider access when the durable Gmail account binding mismatches', async () => {
    const store = await foundation('other-operator@example.test');
    const exactEvidence = new RecordingExactEvidenceStore();
    const fetchImpl = vi.fn(() =>
      Promise.reject(new Error('provider access must not occur'))
    ) as typeof fetch;
    const client = new GmailManagedCommunicationClientV1(config, fetchImpl);

    await expect(
      reconcileGmailManagedCommunicationProviderMessageV1({
        client,
        foundation: store,
        exactEvidence,
        workspaceId,
        accountRef,
        providerMessageId: 'gmail-mismatch'
      })
    ).rejects.toThrow(/does not match configured Gmail/u);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
