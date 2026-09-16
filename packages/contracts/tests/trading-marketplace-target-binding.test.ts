import { describe, expect, it } from 'vitest';
import {
  noTradingMarketplaceTargetBindingAuthorityConsequencesV1,
  parseTradingMarketplaceTargetBindingV1
} from '../src/trading-marketplace-target-binding.js';

const active = {
  schemaVersion: 1,
  tradingMarketplaceTargetBindingId: 'trading-marketplace-target-binding_shop-1',
  version: 1,
  workspaceId: '12121212-1212-4121-8121-121212121212',
  identity: {
    marketplaceId: 'SHOPIFY',
    externalAccountId: 'acct_123',
    externalStoreId: 'store_456',
    displayLabel: 'Orbit Goods',
    handle: 'orbit-goods'
  },
  lifecycle: 'ACTIVE',
  connection: { sourceKind: 'MARKETPLACE_AUTH', evidenceRefs: ['connection-evidence_1'] },
  createdAt: '2026-09-16T01:00:00.000Z',
  lastVerifiedAt: '2026-09-16T01:01:00.000Z',
  updatedAt: '2026-09-16T01:02:00.000Z',
  authority: noTradingMarketplaceTargetBindingAuthorityConsequencesV1
} as const;

describe('Trading marketplace target binding contract', () => {
  it('parses safe target identity without creating publication authority', () => {
    const parsed = parseTradingMarketplaceTargetBindingV1(active);
    expect(parsed).toEqual(active);
    expect(parsed.authority).toEqual(noTradingMarketplaceTargetBindingAuthorityConsequencesV1);
  });

  it.each(['accessToken', 'clientSecret', 'cookie', 'credential', 'providerEndpoint'])(
    'rejects forbidden secret/provider field %s anywhere in the binding',
    (field) => {
      expect(() =>
        parseTradingMarketplaceTargetBindingV1({ ...active, metadata: { [field]: 'secret' } })
      ).toThrow(/unsupported fields|forbidden secret\/provider material/iu);
      expect(() =>
        parseTradingMarketplaceTargetBindingV1({
          ...active,
          identity: { ...active.identity, [field]: 'secret' }
        })
      ).toThrow(/forbidden secret\/provider material/iu);
    }
  );

  it('requires lifecycle timestamps to match stale and revoked state', () => {
    expect(() => parseTradingMarketplaceTargetBindingV1({ ...active, lifecycle: 'STALE' })).toThrow(
      /requires staleAt/iu
    );
    expect(() =>
      parseTradingMarketplaceTargetBindingV1({ ...active, lifecycle: 'REVOKED' })
    ).toThrow(/requires revokedAt/iu);
    expect(
      parseTradingMarketplaceTargetBindingV1({
        ...active,
        lifecycle: 'STALE',
        staleAt: '2026-09-16T01:03:00.000Z',
        updatedAt: '2026-09-16T01:04:00.000Z'
      }).lifecycle
    ).toBe('STALE');
  });

  it('requires stale and revoked transitions to fit inside the binding timeline', () => {
    expect(() =>
      parseTradingMarketplaceTargetBindingV1({
        ...active,
        lifecycle: 'STALE',
        staleAt: '2026-09-16T01:05:00.000Z',
        updatedAt: '2026-09-16T01:04:00.000Z'
      })
    ).toThrow(/staleAt cannot be after updatedAt/iu);

    expect(() =>
      parseTradingMarketplaceTargetBindingV1({
        ...active,
        lifecycle: 'REVOKED',
        staleAt: '2026-09-16T01:04:00.000Z',
        revokedAt: '2026-09-16T01:03:00.000Z',
        updatedAt: '2026-09-16T01:05:00.000Z'
      })
    ).toThrow(/staleAt cannot be after revokedAt/iu);
  });

  it('rejects authority escalation and duplicate evidence', () => {
    expect(() =>
      parseTradingMarketplaceTargetBindingV1({
        ...active,
        authority: { ...active.authority, protectedActionAuthorized: true }
      })
    ).toThrow(/must be false/iu);
    expect(() =>
      parseTradingMarketplaceTargetBindingV1({
        ...active,
        connection: { ...active.connection, evidenceRefs: ['e1', 'e1'] }
      })
    ).toThrow(/duplicates/iu);
  });
});
