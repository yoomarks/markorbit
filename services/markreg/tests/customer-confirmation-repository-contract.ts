import { describe, expect, it } from 'vitest';
import {
  CustomerConfirmationError,
  hashSnapshot,
  type AcceptedQuoteSnapshot,
  type CustomerConfirmationRecord,
  type CustomerConfirmationRepository
} from '../src/customer-confirmation.js';
export const contractWorkspace = '11111111-1111-4111-8111-111111111111';
export const contractSnapshot: AcceptedQuoteSnapshot = {
  schemaVersion: 1,
  quoteId: 'quote_contract',
  quoteVersion: 'v1',
  planId: 'plan_contract',
  planVersion: 'v1',
  currency: 'USD',
  totalMinor: 100,
  lineItems: [
    { code: 'SERVICE', description: 'Service', category: 'SERVICE_FEE', amountMinor: 100 }
  ],
  termsVersion: 'v1',
  acknowledgementCodes: ['NO_FILING'],
  selectedOptionCode: 'A',
  recommendationId: 'recommendation_contract',
  assumptions: [],
  limitations: ['Not a filing.']
};
export function contractRecord(suffix = 'one'): CustomerConfirmationRecord {
  return {
    confirmationId: `confirmation_${suffix}`,
    workspaceId: contractWorkspace,
    sourceQuoteId: contractSnapshot.quoteId,
    sourceQuoteVersion: contractSnapshot.quoteVersion,
    status: 'CONFIRMED',
    version: 1,
    snapshotSchemaVersion: 1,
    sourceSnapshot: structuredClone(contractSnapshot),
    sourceSnapshotHash: hashSnapshot(contractSnapshot),
    acceptedAt: '2026-07-31T12:00:00.000Z',
    updatedAt: '2026-07-31T12:00:00.000Z',
    withdrawnAt: null
  };
}
export function runCustomerConfirmationRepositoryContract(
  name: string,
  factory: () => Promise<CustomerConfirmationRepository>
) {
  describe(`${name} Customer Confirmation repository contract`, () => {
    it('creates and exactly reloads all source and snapshot evidence', async () => {
      const r = await factory(),
        v = contractRecord();
      expect(await r.create(v)).toEqual(v);
      expect(await r.findById(v.workspaceId, v.confirmationId)).toEqual(v);
      expect(await r.findBySource(v.workspaceId, v.sourceQuoteId, v.sourceQuoteVersion)).toEqual(v);
    });
    it('fails closed across Workspaces and for missing records', async () => {
      const r = await factory(),
        v = contractRecord();
      await r.create(v);
      expect(await r.findById('22222222-2222-4222-8222-222222222222', v.confirmationId)).toBeNull();
      expect(await r.findById(v.workspaceId, 'confirmation_missing')).toBeNull();
    });
    it('returns immutable nested snapshot clones', async () => {
      const r = await factory(),
        v = await r.create(contractRecord());
      (v.sourceSnapshot.lineItems as unknown as { code: string }[])[0]!.code = 'MUTATED';
      expect(
        (await r.findById(v.workspaceId, v.confirmationId))!.sourceSnapshot.lineItems[0]!.code
      ).toBe('SERVICE');
    });
    it('rejects duplicate source identity/version deterministically', async () => {
      const r = await factory(),
        v = contractRecord();
      await r.create(v);
      await expect(
        r.create({ ...v, confirmationId: 'confirmation_duplicate' })
      ).rejects.toMatchObject({ code: 'CUSTOMER_CONFIRMATION_DUPLICATE' });
    });
    it('withdraws atomically and retains immutable acceptance evidence', async () => {
      const r = await factory(),
        v = await r.create(contractRecord());
      const w = await r.withdraw(v.workspaceId, v.confirmationId, 1, '2026-07-31T13:00:00.000Z');
      expect(w).toMatchObject({
        status: 'WITHDRAWN',
        version: 2,
        acceptedAt: v.acceptedAt,
        withdrawnAt: '2026-07-31T13:00:00.000Z',
        sourceSnapshotHash: v.sourceSnapshotHash
      });
      expect(await r.findById(v.workspaceId, v.confirmationId)).toEqual(w);
    });
    it('rejects stale and repeated withdrawal and never rewrites withdrawnAt', async () => {
      const r = await factory(),
        v = await r.create(contractRecord());
      await expect(
        r.withdraw(v.workspaceId, v.confirmationId, 2, '2026-07-31T13:00:00.000Z')
      ).rejects.toMatchObject({ code: 'CUSTOMER_CONFIRMATION_STALE_VERSION' });
      await r.withdraw(v.workspaceId, v.confirmationId, 1, '2026-07-31T13:00:00.000Z');
      await expect(
        r.withdraw(v.workspaceId, v.confirmationId, 2, '2026-07-31T14:00:00.000Z')
      ).rejects.toMatchObject({ code: 'CUSTOMER_CONFIRMATION_WITHDRAWN' });
      expect((await r.findById(v.workspaceId, v.confirmationId))!.withdrawnAt).toBe(
        '2026-07-31T13:00:00.000Z'
      );
    });
    it('rejects forged hashes on write', async () => {
      const r = await factory();
      await expect(
        r.create({ ...contractRecord(), sourceSnapshotHash: '0'.repeat(64) })
      ).rejects.toBeInstanceOf(CustomerConfirmationError);
    });
  });
}
