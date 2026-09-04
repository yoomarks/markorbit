import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from './client.js';
import { createDurablePreparationClient } from './durable-preparation.js';

const lock = {
  schemaVersion: 1 as const,
  preparationLockId: 'preparation-lock_exact' as const,
  workspaceId: '11111111-1111-4111-8111-111111111111',
  version: 1 as const,
  source: {
    documentPackageId: 'document-package_exact' as const,
    documentPackageVersion: 7,
    canonicalEvidenceHash: 'a'.repeat(64),
    formalMatterId: 'formal-matter_exact' as const,
    formalMatterVersion: 1,
    formalMatterHash: 'b'.repeat(64),
    professionalReviewCaseId: 'professional-review_exact' as const,
    reviewVersion: 4,
    completedDecisionId: 'decision_exact',
    completedDecisionHash: 'c'.repeat(64),
    instructionEntryCount: 0,
    instructionEntries: [],
    instructionSetHash: 'd'.repeat(64)
  },
  lockPayloadHash: 'e'.repeat(64),
  createdBy: 'user_exact',
  createdAt: '2026-09-04T08:00:00.000Z',
  authority: {
    filingAuthorizationCreated: false as const,
    executionReleaseCreated: false as const,
    externalFilingCreated: false as const,
    paymentCreated: false as const,
    providerContacted: false as const,
    officialTruthCreated: false as const
  }
};

describe('durable Preparation browser client', () => {
  it('creates from exact package version/hash and keeps idempotency out of browser body', async () => {
    const post = vi.fn().mockResolvedValue(lock);
    const api = { post, get: vi.fn(), patch: vi.fn() } as unknown as ApiClient;
    const client = createDurablePreparationClient(api);

    await client.create({
      documentPackageId: 'document-package_exact',
      expectedDocumentPackageVersion: 7,
      expectedCanonicalEvidenceHash: 'a'.repeat(64),
      idempotencyKey: 'prepare-lock-exact-7',
      correlationId: 'correlation_exact'
    });

    expect(post).toHaveBeenCalledWith(
      '/api/markreg/preparation-locks',
      {
        documentPackageId: 'document-package_exact',
        expectedDocumentPackageVersion: 7,
        expectedCanonicalEvidenceHash: 'a'.repeat(64)
      },
      {
        'Idempotency-Key': 'prepare-lock-exact-7',
        'X-Correlation-ID': 'correlation_exact'
      }
    );
    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body).not.toHaveProperty('instructionLedgerId');
    expect(body).not.toHaveProperty('workspaceId');
    expect(body).not.toHaveProperty('actor');
  });

  it('reads and validates the same durable lock identity without reposting create', async () => {
    const post = vi.fn().mockResolvedValue(lock);
    const get = vi.fn().mockResolvedValue(lock);
    const api = { post, get, patch: vi.fn() } as unknown as ApiClient;
    const client = createDurablePreparationClient(api);

    await client.get('preparation-lock_exact');
    await client.validateCurrent('preparation-lock_exact');

    expect(get).toHaveBeenCalledWith('/api/markreg/preparation-locks/preparation-lock_exact');
    expect(post).toHaveBeenCalledWith(
      '/api/markreg/preparation-locks/preparation-lock_exact/validate-current',
      {},
      {}
    );
    expect(post).not.toHaveBeenCalledWith('/api/markreg/preparation-locks', expect.anything(), expect.anything());
  });
});
