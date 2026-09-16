import {
  businessAttributionFingerprintSha256V1,
  noBusinessAttributionAuthorityConsequencesV1,
  parseBusinessAttributionLinkV1,
  type BusinessAttributionLinkV1
} from '../src/business-attribution.js';
import { describe, expect, it } from 'vitest';

const at = '2026-09-16T08:00:00.000Z';
const ref = (owner: string, kind: string, id: string, version: number | string, sha: string) => ({
  owner,
  kind,
  id,
  version,
  fingerprintSha256: sha.repeat(64),
  observedAt: at
});
function portfolioGrowthFixture(): BusinessAttributionLinkV1 {
  const value = {
    schemaVersion: 1 as const,
    businessAttributionLinkId: 'business-attribution_portfolio-growth-fixture' as const,
    workspaceId: '11111111-1111-4111-8111-111111111111',
    version: 1 as const,
    motionKind: 'PORTFOLIO_GROWTH' as const,
    sourceRefs: [
      ref('LITE', 'TRADEMARK_ASSET', 'trademark-asset_existing-customer', 3, 'a'),
      ref(
        'LITE',
        'TRADEMARK_ASSET_MANAGEMENT_SIGNAL',
        'trademark-asset-management-signal_attention',
        3,
        'b'
      ),
      ref('MARKREG', 'CUSTOMER_RELATIONSHIP', 'customer-relationship_existing', 2, 'c')
    ],
    touchpointRefs: [
      ref('LITE', 'OPPORTUNITY_CANDIDATE', 'opportunity-candidate_portfolio', 1, 'd'),
      ref('LITE', 'OPPORTUNITY_QUALIFICATION_DECISION', 'opportunity-qualification_human', 1, 'e'),
      ref('LITE', 'PREPARED_CLIENT_NOTIFICATION', 'prepared-action_client-review', 1, 'f'),
      ref(
        'CAPABILITY_ENGINE',
        'MANAGED_COMMUNICATION_MESSAGE',
        'managed-message_client',
        'provider-message-7',
        '1'
      )
    ],
    downstreamRef: ref(
      'MARKREG',
      'FORMAL_TRADEMARK_SERVICE_OPPORTUNITY',
      'trademark-service-opportunity_accepted',
      1,
      '2'
    ),
    attributionState: 'ATTRIBUTED' as const,
    evidenceBasis: 'EXACT_LINEAGE' as const,
    evaluatedAt: at,
    recordedByPrincipalId: 'user_professional',
    authorityConsequences: noBusinessAttributionAuthorityConsequencesV1
  };
  return {
    ...value,
    businessAttributionFingerprintSha256: businessAttributionFingerprintSha256V1(value)
  };
}

describe('BusinessAttributionLinkV1', () => {
  it('preserves the exact G2 source, human review, governed engagement and MarkReg outcome lineage', () => {
    const parsed = parseBusinessAttributionLinkV1(portfolioGrowthFixture());
    expect(parsed.motionKind).toBe('PORTFOLIO_GROWTH');
    expect(parsed.sourceRefs.map((item) => item.kind)).toEqual([
      'TRADEMARK_ASSET',
      'TRADEMARK_ASSET_MANAGEMENT_SIGNAL',
      'CUSTOMER_RELATIONSHIP'
    ]);
    expect(parsed.touchpointRefs.map((item) => item.kind)).toContain(
      'OPPORTUNITY_QUALIFICATION_DECISION'
    );
    expect(parsed.touchpointRefs.map((item) => item.kind)).toContain(
      'MANAGED_COMMUNICATION_MESSAGE'
    );
    expect(parsed.downstreamRef).toMatchObject({
      owner: 'MARKREG',
      kind: 'FORMAL_TRADEMARK_SERVICE_OPPORTUNITY'
    });
    expect(Object.values(parsed.authorityConsequences)).toEqual(expect.arrayContaining([false]));
  });

  it('keeps unknown/no-conversion state explicit without fabricating a downstream owner', () => {
    const fixture = portfolioGrowthFixture();
    const {
      downstreamRef: _downstreamRef,
      businessAttributionFingerprintSha256: _fingerprint,
      ...base
    } = fixture;
    expect(_downstreamRef).toBeDefined();
    expect(_fingerprint).toMatch(/^[0-9a-f]{64}$/u);
    const value = { ...base, attributionState: 'UNKNOWN' as const };
    const parsed = parseBusinessAttributionLinkV1({
      ...value,
      businessAttributionFingerprintSha256: businessAttributionFingerprintSha256V1(value)
    });
    expect(parsed.attributionState).toBe('UNKNOWN');
    expect(parsed.downstreamRef).toBeUndefined();
  });

  it('supports bounded content-led lineage without granting publication or conversion authority', () => {
    const fixture = portfolioGrowthFixture();
    const { businessAttributionFingerprintSha256: _fingerprint, ...base } = fixture;
    expect(_fingerprint).toMatch(/^[0-9a-f]{64}$/u);
    const value = {
      ...base,
      motionKind: 'CONTENT_LED_DEMAND' as const,
      sourceRefs: [ref('LITE', 'PUBLISH_PACKAGE', 'publish-package_reviewed', 1, 'a')],
      touchpointRefs: [
        ref('LITE', 'CONTENT_USE_FEEDBACK', 'product-loop-feedback_manual', 1, 'b'),
        ref('LITE', 'SITE_INBOUND_ATTRIBUTION', 'business-attribution_site', 1, 'c')
      ]
    };
    const parsed = parseBusinessAttributionLinkV1({
      ...value,
      businessAttributionFingerprintSha256: businessAttributionFingerprintSha256V1(value)
    });
    expect(parsed.motionKind).toBe('CONTENT_LED_DEMAND');
    expect(parsed.sourceRefs[0]?.kind).toBe('PUBLISH_PACKAGE');
    expect(parsed.authorityConsequences.conversionCreated).toBe(false);
    expect(parsed.authorityConsequences.causalReturnOnInvestmentClaimed).toBe(false);
  });

  it('rejects fingerprint drift and any claimed authority consequence', () => {
    expect(() =>
      parseBusinessAttributionLinkV1({
        ...portfolioGrowthFixture(),
        businessAttributionFingerprintSha256: '9'.repeat(64)
      })
    ).toThrow(/fingerprint mismatch/iu);
    expect(() =>
      parseBusinessAttributionLinkV1({
        ...portfolioGrowthFixture(),
        authorityConsequences: {
          ...noBusinessAttributionAuthorityConsequencesV1,
          conversionCreated: true
        }
      })
    ).toThrow(/must remain false/iu);
  });
});
