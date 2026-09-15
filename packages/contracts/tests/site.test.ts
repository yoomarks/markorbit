import { describe, expect, it } from 'vitest';
import {
  noSiteConfigurationAuthorityConsequencesV1,
  type SiteConfigurationVersionV1
} from '../src/site.js';

describe('Workspace Site V1 contract', () => {
  it('keeps configuration separate from business and authority outcomes', () => {
    expect(noSiteConfigurationAuthorityConsequencesV1).toEqual({
      customerRelationshipCreated: false,
      quotePublished: false,
      paymentAuthorized: false,
      providerSelected: false,
      protectedActionAuthorized: false,
      workspaceMembershipGranted: false,
      brandingIdentityVerified: false
    });
  });

  it('represents service and content truth through exact owner references', () => {
    const fixture: SiteConfigurationVersionV1 = {
      schemaVersion: 1,
      siteId: 'site_fixture',
      workspaceId: 'workspace_fixture',
      version: 1,
      brand: {
        displayName: 'Fixture Site',
        theme: { primaryColor: '#102030', accentColor: '#abcdef', colorMode: 'LIGHT' }
      },
      localization: {
        defaultLocale: 'en-US',
        supportedLocales: ['en-US'],
        defaultMarket: 'US',
        jurisdictions: ['US']
      },
      roles: {
        surfaceOwnerWorkspaceId: 'workspace_fixture',
        customerRelationshipWorkspaceId: 'workspace_relationship',
        offerOwnerRef: 'markreg:catalog',
        merchantOwnerRef: 'payment:markreg',
        fulfillmentOwnerRef: 'markreg:fulfillment'
      },
      services: [
        {
          productRef: { owner: 'MARKREG', productId: 'product_trademark', version: 4 },
          visibility: 'PUBLIC',
          locales: ['en-US'],
          markets: ['US'],
          channel: 'MARKREG_WHITE_LABEL',
          relationshipModel: 'WHITE_LABEL',
          pricingPolicyRefs: [{ id: 'price_policy', version: 2 }],
          fulfillment: { mode: 'MARKREG' }
        }
      ],
      contentSlots: [
        {
          slot: 'home.hero',
          route: '/',
          locale: 'en-US',
          title: 'Trademark filing',
          publishPackageRef: { id: 'publish_package', version: 3 },
          contentFingerprintSha256: 'a'.repeat(64)
        }
      ],
      recordedAt: '2026-09-15T00:00:00.000Z',
      sourceRef: 'fixture:site-contract'
    };
    expect(fixture.services[0]?.productRef).toEqual({
      owner: 'MARKREG',
      productId: 'product_trademark',
      version: 4
    });
    expect(fixture).not.toHaveProperty('customer');
    expect(fixture).not.toHaveProperty('quote');
    expect(fixture).not.toHaveProperty('payment');
  });
});
