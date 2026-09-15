import type { ResolvedPublicSiteV1 } from '@markorbit/contracts/site';

function site(
  siteId: `site_${string}`,
  hostname: string,
  displayName: string,
  primaryColor: string,
  accentColor: string,
  channel: 'MARKREG_DIRECT' | 'MARKREG_WHITE_LABEL',
  relationshipModel: 'DIRECT' | 'WHITE_LABEL'
): ResolvedPublicSiteV1 {
  return {
    schemaVersion: 1,
    siteId,
    siteVersion: 2,
    configurationVersion: 1,
    hostBindingVersion: 3,
    hostname,
    brand: {
      displayName,
      theme: { primaryColor, accentColor, colorMode: 'LIGHT' }
    },
    localization: {
      defaultLocale: 'en-US',
      supportedLocales: ['en-US'],
      defaultMarket: 'US',
      jurisdictions: ['US']
    },
    services: [
      {
        productRef: { owner: 'MARKREG', productId: 'product_trademark', version: 7 },
        visibility: 'PUBLIC',
        locales: ['en-US'],
        markets: ['US'],
        channel,
        relationshipModel,
        fulfillmentMode: 'MARKREG'
      }
    ],
    contentSlots: [
      {
        slot: 'home.hero',
        route: '/',
        locale: 'en-US',
        title:
          relationshipModel === 'DIRECT'
            ? 'Protect the name you are building.'
            : 'Trademark guidance for growing brands.',
        description:
          relationshipModel === 'DIRECT'
            ? 'Build a clear filing plan, review the evidence, and stay in control of every formal step.'
            : 'Move from an early question to a reviewable plan without losing your customer relationship.',
        publishPackageRef: { id: `publish_${siteId}`, version: 1 },
        contentFingerprintSha256: relationshipModel === 'DIRECT' ? 'a'.repeat(64) : 'b'.repeat(64)
      }
    ],
    currentness: {
      hostBindingCurrent: true,
      configurationCurrent: true,
      coreSiteInstallationCurrent: true,
      entitlementsCurrent: true,
      observedAt: '2026-09-16T00:00:00.000Z'
    }
  };
}

export const markRegReferenceSite = site(
  'site_markreg_reference',
  'markreg.com',
  'MarkReg',
  '#173f35',
  '#d9a441',
  'MARKREG_DIRECT',
  'DIRECT'
);

export const northstarPilotSite = site(
  'site_northstar_pilot',
  'trademarks.northstar.example',
  'Northstar Brand Desk',
  '#253a6f',
  '#ea7652',
  'MARKREG_WHITE_LABEL',
  'WHITE_LABEL'
);
