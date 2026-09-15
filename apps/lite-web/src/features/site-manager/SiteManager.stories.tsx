import type { Meta, StoryObj } from '@storybook/react';
import type {
  SiteConfigurationVersionV1,
  SiteHostBindingV1,
  SiteInstallationV1
} from '@markorbit/contracts/site';
import { SiteManagerHttpError, type SiteManagerClient } from '../../api/site-manager.js';
import { SiteManager } from './SiteManager.js';

const workspaceId = 'workspace_site_story';
const installation: SiteInstallationV1 = {
  schemaVersion: 1,
  siteId: 'site_story',
  workspaceId,
  coreSiteInstallationRef: { installationId: 'install_story', version: 1 },
  version: 2,
  kind: 'WORKSPACE_BRANDED',
  lifecycle: 'ACTIVE',
  currentConfigurationVersion: 2,
  effectiveAt: '2026-09-15T00:00:00.000Z',
  recordedAt: '2026-09-15T00:00:00.000Z',
  sourceRef: 'story:site'
};

const configuration: SiteConfigurationVersionV1 = {
  schemaVersion: 1,
  siteId: installation.siteId,
  workspaceId,
  version: 2,
  brand: {
    displayName: 'Orbit IP',
    theme: { primaryColor: '#102030', accentColor: '#abcdef', colorMode: 'LIGHT' }
  },
  localization: {
    defaultLocale: 'en-US',
    supportedLocales: ['en-US', 'zh-CN'],
    defaultMarket: 'US',
    jurisdictions: ['US']
  },
  roles: {
    surfaceOwnerWorkspaceId: workspaceId,
    customerRelationshipWorkspaceId: 'workspace_relationship',
    offerOwnerRef: 'markreg:catalog',
    merchantOwnerRef: 'payment:markreg',
    fulfillmentOwnerRef: 'markreg:fulfillment'
  },
  services: [
    {
      productRef: { owner: 'MARKREG', productId: 'product_trademark', version: 7 },
      visibility: 'PUBLIC',
      locales: ['en-US'],
      markets: ['US'],
      channel: 'MARKREG_WHITE_LABEL',
      relationshipModel: 'WHITE_LABEL',
      pricingPolicyRefs: [{ id: 'price_policy_us', version: 2 }],
      fulfillment: { mode: 'MARKREG' }
    }
  ],
  contentSlots: [],
  recordedAt: '2026-09-15T00:00:00.000Z',
  sourceRef: 'story:site-config'
};
const binding: SiteHostBindingV1 = {
  schemaVersion: 1,
  bindingId: 'site_host_story',
  siteId: installation.siteId,
  workspaceId,
  normalizedHostname: 'brand.example.com',
  bindingType: 'PRIMARY',
  version: 2,
  status: 'ACTIVE',
  verificationMethod: 'DNS_TXT',
  verificationEvidenceRef: 'dns:story',
  verifiedAt: '2026-09-15T00:00:00.000Z',
  recordedAt: '2026-09-15T00:00:00.000Z'
};

function client(overrides: Partial<SiteManagerClient> = {}): SiteManagerClient {
  return {
    list: () => Promise.resolve([installation]),
    configuration: () => Promise.resolve(configuration),
    hostBindings: () => Promise.resolve([binding]),
    reviseConfiguration: () => Promise.resolve(installation),
    createHostBinding: () => Promise.resolve(binding),
    activate: () => Promise.resolve({ installation, binding }),
    suspend: () => Promise.resolve({ ...installation, lifecycle: 'SUSPENDED' as const }),
    ...overrides
  };
}

const meta = {
  title: 'Lite/Site Manager',
  component: SiteManager,
  args: { workspaceId }
} satisfies Meta<typeof SiteManager>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = { args: { client: client() } };
export const Empty: Story = {
  args: { client: client({ list: () => Promise.resolve([]) }) }
};
export const Loading: Story = {
  args: {
    client: client({ list: () => new Promise<readonly SiteInstallationV1[]>(() => undefined) })
  }
};
export const PermissionDenied: Story = {
  args: {
    client: client({
      list: () =>
        Promise.reject(
          new SiteManagerHttpError(
            403,
            'PERMISSION_DENIED',
            'workspace:read permission is required.'
          )
        )
    })
  }
};
export const PartialDomainUnavailable: Story = {
  args: {
    client: client({
      hostBindings: () =>
        Promise.reject(
          new SiteManagerHttpError(503, 'SITE_RUNTIME_UNAVAILABLE', 'Host state unavailable.', true)
        )
    })
  }
};
