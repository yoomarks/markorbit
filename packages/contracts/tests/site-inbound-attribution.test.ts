import { describe, expect, it } from 'vitest';
import {
  noSiteInboundAcquisitionAuthorityConsequencesV1,
  parseSiteInboundAcquisitionV1,
  siteInboundAcquisitionFingerprintSha256V1
} from '../src/site-inbound-attribution.js';

const value = (attributionState: 'ATTRIBUTED' | 'DIRECT' | 'UNATTRIBUTED' | 'UNKNOWN') => {
  const material = {
    schemaVersion: 1 as const,
    attributionState,
    landingPath: '/services/us-trademark-registration',
    ...(attributionState === 'ATTRIBUTED'
      ? {
          source: 'ai-answer',
          campaign: 'us-filing-guide',
          referrerHostname: 'example-search.test',
          contentRef: {
            owner: 'LITE' as const,
            kind: 'PUBLISH_PACKAGE' as const,
            id: 'publish-package_us-filing',
            version: 3,
            fingerprintSha256: 'a'.repeat(64)
          }
        }
      : {}),
    observedAt: '2026-09-17T00:00:00.000Z',
    authorityConsequences: noSiteInboundAcquisitionAuthorityConsequencesV1
  };
  return {
    ...material,
    fingerprintSha256: siteInboundAcquisitionFingerprintSha256V1(material)
  };
};

describe('Site inbound acquisition V1', () => {
  it.each(['ATTRIBUTED', 'DIRECT', 'UNATTRIBUTED', 'UNKNOWN'] as const)(
    'preserves explicit %s without creating identity or conversion truth',
    (state) => {
      expect(parseSiteInboundAcquisitionV1(value(state))).toMatchObject({
        attributionState: state,
        authorityConsequences: {
          customerIdentityEstablished: false,
          conversionCreated: false,
          causalReturnOnInvestmentClaimed: false
        }
      });
    }
  );

  it('rejects arbitrary query material and fingerprint drift', () => {
    expect(() =>
      parseSiteInboundAcquisitionV1({ ...value('ATTRIBUTED'), rawUrl: 'secret' })
    ).toThrow(/unsupported fields/);
    expect(() =>
      parseSiteInboundAcquisitionV1({ ...value('ATTRIBUTED'), fingerprintSha256: 'b'.repeat(64) })
    ).toThrow(/fingerprint mismatch/);
  });
});
