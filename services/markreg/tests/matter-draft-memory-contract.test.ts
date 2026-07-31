import { describe, expect, it } from 'vitest';
import type { MatterDraftRecord, MatterDraftRepository } from '../src/matter-draft.js';
import { InMemoryMatterDraftRepository } from '../src/matter-draft.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const record = (): MatterDraftRecord => ({
  schemaVersion: 1,
  matterDraftId: 'matter-draft_contract',
  workspaceId,
  customerConfirmationId: 'confirmation_contract',
  customerConfirmationVersion: 1,
  sourceQuoteId: 'quote_contract',
  sourceQuoteVersion: 'quote-v1',
  preparation: { classes: [], documentReferences: [] },
  instructionCompleteness: 'INCOMPLETE',
  documentReadiness: 'MISSING',
  readiness: {
    evaluatedAt: '2026-07-31T12:00:00.000Z',
    checks: [],
    readyForProfessionalReview: false
  },
  missingInformation: ['APPLICANT_IDENTITY_PRESENT'],
  status: 'NEEDS_INFORMATION',
  version: 1,
  createdAt: '2026-07-31T12:00:00.000Z',
  updatedAt: '2026-07-31T12:00:00.000Z'
});

function contract(name: string, factory: () => Promise<MatterDraftRepository>) {
  describe(`${name} Matter Draft repository contract`, () => {
    it('creates and reloads exact durable preparation evidence', async () => {
      const repository = await factory(),
        value = record();
      expect(await repository.create(value)).toEqual(value);
      expect(await repository.findById(workspaceId, value.matterDraftId)).toEqual(value);
    });
    it('fails closed across Workspaces', async () => {
      const repository = await factory(),
        value = record();
      await repository.create(value);
      expect(
        await repository.findById('22222222-2222-4222-8222-222222222222', value.matterDraftId)
      ).toBeNull();
    });
    it('increments through a winning update and rejects the stale writer', async () => {
      const repository = await factory(),
        value = await repository.create(record());
      const winning = {
        ...value,
        version: 2,
        preparation: { ...value.preparation, applicantName: 'Orbit Ltd' },
        updatedAt: '2026-07-31T13:00:00.000Z'
      };
      expect((await repository.update(workspaceId, value.matterDraftId, 1, winning)).version).toBe(
        2
      );
      await expect(
        repository.update(workspaceId, value.matterDraftId, 1, winning)
      ).rejects.toMatchObject({ code: 'MATTER_DRAFT_STALE_VERSION' });
      expect(
        (await repository.findById(workspaceId, value.matterDraftId))?.preparation.applicantName
      ).toBe('Orbit Ltd');
    });
  });
}
contract('in-memory', () => Promise.resolve(new InMemoryMatterDraftRepository()));
