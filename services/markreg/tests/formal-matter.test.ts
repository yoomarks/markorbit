import { describe, expect, it } from 'vitest';
import { InMemoryFormalMatterRepository, FormalMatterError } from '../src/formal-matter.js';
import type { FormalMatter } from '@markorbit/contracts';

const matter = (id = 'formal-matter_one'): FormalMatter => ({
  schemaVersion: 1,
  formalMatterId: id as never,
  workspaceId: '00000000-0000-4000-8000-000000000001',
  kind: 'TRADEMARK_REGISTRATION',
  status: 'OPEN',
  version: 1,
  sourceCustomerConfirmationId: 'confirmation_one',
  sourceCustomerConfirmationVersion: 2,
  sourceMatterDraftId: 'matter-draft_one',
  sourceMatterDraftVersion: 4,
  sourceQuoteId: 'quote_one',
  sourceQuoteVersion: 'quote-v1',
  sourceSnapshot: {
    schemaVersion: 1,
    customerConfirmation: { id: 'confirmation_one', version: 2, status: 'CONFIRMED' },
    quote: { id: 'quote_one', version: 'quote-v1', currency: 'USD', totalMinor: 100 },
    matterDraft: {
      id: 'matter-draft_one',
      version: 4,
      status: 'READY_FOR_PROFESSIONAL_REVIEW',
      readiness: {
        evaluatedAt: '2026-01-01T00:00:00.000Z',
        readyForProfessionalReview: true,
        checks: []
      }
    },
    preparation: { classes: [9], documentReferences: [] }
  },
  snapshotSchemaVersion: 1,
  snapshotSha256: 'a'.repeat(64),
  createdByUserId: 'user_one',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});
const audit = (value: FormalMatter) => ({
  workspaceId: value.workspaceId,
  formalMatterId: value.formalMatterId,
  action: 'FORMAL_MATTER_CREATED' as const,
  actorId: 'user_one',
  createdAt: value.createdAt
});
describe('Formal Matter atomic repository', () => {
  it('coalesces concurrent identical commands into exactly one Matter and evidence set', async () => {
    const repository = new InMemoryFormalMatterRepository();
    const value = matter();
    const results = await Promise.all([
      repository.createAtomically(value, 'key', 'fingerprint', audit(value)),
      repository.createAtomically(value, 'key', 'fingerprint', audit(value))
    ]);
    expect(results[0].formalMatterId).toBe(results[1].formalMatterId);
    expect(repository.evidence()).toEqual({ matters: 1, idempotency: 1, audits: 1 });
  });
  it('rejects conflicting key reuse and a second key for an exact single-use Draft version', async () => {
    const repository = new InMemoryFormalMatterRepository();
    const value = matter();
    await repository.createAtomically(value, 'key', 'one', audit(value));
    await expect(
      repository.createAtomically(value, 'key', 'two', audit(value))
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' } satisfies Partial<FormalMatterError>);
    const other = matter('formal-matter_two');
    await expect(
      repository.createAtomically(other, 'other', 'two', audit(other))
    ).rejects.toMatchObject({ code: 'DUPLICATE_SOURCE' } satisfies Partial<FormalMatterError>);
    expect(repository.evidence()).toEqual({ matters: 1, idempotency: 1, audits: 1 });
  });
});
