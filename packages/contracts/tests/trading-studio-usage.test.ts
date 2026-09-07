import { describe, expect, it } from 'vitest';
import {
  assertTradingStandardStudioRunUsageEntryV1,
  noTradingStudioUsageAuthorityConsequencesV1,
  type TradingStandardStudioRunUsageEntryV1
} from '../src/trading-studio-usage.js';

const usageEntry = (): TradingStandardStudioRunUsageEntryV1 => ({
  schemaVersion: 1,
  usageLedgerEntryId: 'usage-ledger-entry_run-1',
  userId: 'user-1',
  workspaceId: 'workspace-1',
  trademarkAsset: { id: 'trademark-asset_mark-1', version: 4 },
  studioRun: { id: 'standard-studio-run_mark-1', version: 1 },
  entitlement: {
    ownerReference: 'account-billing',
    entitlementId: 'entitlement-user-1',
    entitlementVersion: 3,
    entitlementType: 'PAID_INCLUDED'
  },
  usageUnit: 'STANDARD_STUDIO_RUN',
  amount: 1,
  idempotencyKey: 'standard-studio-run_mark-1@1',
  completedAt: '2026-09-07T12:00:00.000Z',
  recordedAt: '2026-09-07T12:00:01.000Z',
  authorityConsequences: noTradingStudioUsageAuthorityConsequencesV1
});

describe('Lite Trading Standard Studio Run usage contract', () => {
  it('records one completed trademark Studio run against an exact entitlement version', () => {
    expect(() => assertTradingStandardStudioRunUsageEntryV1(usageEntry())).not.toThrow();
    expect(usageEntry().usageUnit).toBe('STANDARD_STUDIO_RUN');
    expect(usageEntry().amount).toBe(1);
  });

  it('cannot turn images or regeneration attempts into separate usage units', () => {
    expect(() =>
      assertTradingStandardStudioRunUsageEntryV1({
        ...usageEntry(),
        usageUnit: 'IMAGE' as TradingStandardStudioRunUsageEntryV1['usageUnit']
      })
    ).toThrow(/exactly one STANDARD_STUDIO_RUN/u);
    expect(() =>
      assertTradingStandardStudioRunUsageEntryV1({
        ...usageEntry(),
        amount: 6 as TradingStandardStudioRunUsageEntryV1['amount']
      })
    ).toThrow(/exactly one STANDARD_STUDIO_RUN/u);
  });

  it('requires owner-supplied entitlement lineage and idempotent run identity', () => {
    expect(() =>
      assertTradingStandardStudioRunUsageEntryV1({
        ...usageEntry(),
        entitlement: { ...usageEntry().entitlement, entitlementVersion: '' }
      })
    ).toThrow(/entitlementVersion/u);
    expect(() =>
      assertTradingStandardStudioRunUsageEntryV1({ ...usageEntry(), idempotencyKey: '' })
    ).toThrow(/idempotencyKey/u);
  });

  it('records completion after it occurs without changing billing or product truth', () => {
    expect(() =>
      assertTradingStandardStudioRunUsageEntryV1({
        ...usageEntry(),
        recordedAt: '2026-09-07T11:59:59.000Z'
      })
    ).toThrow(/cannot precede/u);
    expect(noTradingStudioUsageAuthorityConsequencesV1).toEqual({
      studioRunCompleted: false,
      entitlementChanged: false,
      subscriptionChanged: false,
      invoiceCreated: false,
      paymentCreated: false,
      trademarkTruthMutated: false
    });
    expect(() =>
      assertTradingStandardStudioRunUsageEntryV1({
        ...usageEntry(),
        authorityConsequences: {
          ...noTradingStudioUsageAuthorityConsequencesV1,
          paymentCreated: true
        } as unknown as TradingStandardStudioRunUsageEntryV1['authorityConsequences']
      })
    ).toThrow(/paymentCreated/u);
  });
});
