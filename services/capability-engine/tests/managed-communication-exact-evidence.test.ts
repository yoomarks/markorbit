import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InMemoryManagedCommunicationExactEvidenceStoreV1 } from '../src/managed-communication-exact-evidence.js';

const workspaceId = 'workspace_exact_evidence';
const accountRef = 'communication-account_primary';
const messageId = 'commmsg_exact_001';
const provider = 'provider-test';
const providerMessageId = 'provider-message-001';

function raw(value = 'Received: by provider\r\nMessage-ID: <001@example.test>\r\n\r\nExact body') {
  return new TextEncoder().encode(value);
}

function store() {
  const value = new InMemoryManagedCommunicationExactEvidenceStoreV1();
  value.registerNormalizedMessage({
    workspaceId,
    accountRef,
    messageId,
    provider,
    providerMessageId
  });
  return value;
}

function admission(overrides: Partial<Parameters<ReturnType<typeof store>['admitExactEvidence']>[0]> = {}) {
  return {
    workspaceId,
    accountRef,
    messageId,
    provider,
    providerMessageId,
    rawPayload: raw(),
    mediaType: 'message/rfc822',
    observedAt: '2026-08-27T06:00:00.000Z',
    headers: [
      { name: 'Message-ID', value: '<001@example.test>' },
      { name: 'From', value: 'expert@example.test' },
      { name: 'To', value: 'knowledge@example.test' }
    ],
    metadata: { transport: 'EMAIL', source: 'provider-webhook' },
    now: '2026-08-27T06:00:01.000Z',
    ...overrides
  } as const;
}

describe('Managed Communication immutable exact evidence', () => {
  it('admits exact bytes once and returns a stable digest/ref on replay', async () => {
    const value = store();
    const first = await value.admitExactEvidence(admission());
    const replay = await value.admitExactEvidence(admission({ now: '2026-08-27T06:00:02.000Z' }));

    expect(first.disposition).toBe('ADMITTED');
    expect(replay.disposition).toBe('REPLAYED');
    expect(replay.evidence).toEqual(first.evidence);
    expect(first.evidence.sha256).toBe(createHash('sha256').update(raw()).digest('hex'));
    expect(first.evidence.evidenceRef).toMatch(/^commevidence_[a-f0-9]{40}$/u);
    expect(first.evidence.headers.map((header) => header.name)).toEqual(['from', 'message-id', 'to']);
  });

  it('fails closed if the same normalized message is rebound to different raw bytes', async () => {
    const value = store();
    await value.admitExactEvidence(admission());
    await expect(
      value.admitExactEvidence(admission({ rawPayload: raw('different exact provider bytes') }))
    ).rejects.toMatchObject({ code: 'EXACT_EVIDENCE_CONFLICT' });
  });

  it('requires normalized provider provenance to match before exact evidence can be bound', async () => {
    const value = store();
    await expect(
      value.admitExactEvidence(admission({ providerMessageId: 'other-provider-message' }))
    ).rejects.toMatchObject({ code: 'PROVENANCE_MISMATCH' });
  });

  it('rejects credential/session headers from durable evidence metadata', async () => {
    const value = store();
    await expect(
      value.admitExactEvidence(
        admission({ headers: [{ name: 'Authorization', value: 'Bearer must-not-persist' }] })
      )
    ).rejects.toMatchObject({ code: 'INVALID_EXACT_EVIDENCE' });
  });
});
