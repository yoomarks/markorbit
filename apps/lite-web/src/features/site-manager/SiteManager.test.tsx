// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  SiteConfigurationVersionV1,
  SiteHostBindingV1,
  SiteInstallationV1
} from '@markorbit/contracts/site';
import { SiteManagerHttpError, type SiteManagerClient } from '../../api/site-manager.js';
import { SiteManager } from './SiteManager.js';

const workspaceId = 'workspace_site_manager';
const installation: SiteInstallationV1 = {
  schemaVersion: 1,
  siteId: 'site_manager',
  workspaceId,
  coreSiteInstallationRef: { installationId: 'install_manager', version: 2 },
  version: 4,
  kind: 'WORKSPACE_BRANDED',
  lifecycle: 'ACTIVE',
  currentConfigurationVersion: 3,
  effectiveAt: '2026-09-15T00:00:00.000Z',
  recordedAt: '2026-09-15T00:00:00.000Z',
  sourceRef: 'test:site-manager'
};
const configuration: SiteConfigurationVersionV1 = {
  schemaVersion: 1,
  siteId: installation.siteId,
  workspaceId,
  version: 3,
  brand: {
    displayName: 'Orbit IP',
    logoAssetRef: 'asset_logo',
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
    fulfillmentOwnerRef: 'markreg:fulfillment',
    referralSourceRef: 'referral:partner'
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
  contentSlots: [
    {
      slot: 'home.hero',
      route: '/',
      locale: 'en-US',
      title: 'Orbit IP home',
      publishPackageRef: { id: 'publish_home', version: 3 },
      contentFingerprintSha256: 'a'.repeat(64)
    }
  ],
  attributionPolicyRef: { id: 'attribution_default', version: 1 },
  recordedAt: '2026-09-15T00:00:00.000Z',
  sourceRef: 'test:site-manager'
};

const binding: SiteHostBindingV1 = {
  schemaVersion: 1,
  bindingId: 'site_host_manager',
  siteId: installation.siteId,
  workspaceId,
  normalizedHostname: 'brand.example.com',
  bindingType: 'PRIMARY',
  version: 2,
  status: 'ACTIVE',
  verificationMethod: 'DNS_TXT',
  verificationEvidenceRef: 'dns:proof',
  verifiedAt: '2026-09-15T00:00:00.000Z',
  effectiveFrom: '2026-09-15T00:00:00.000Z',
  recordedAt: '2026-09-15T00:00:00.000Z'
};
function client(overrides: Partial<SiteManagerClient> = {}): SiteManagerClient {
  return {
    list: vi.fn(() => Promise.resolve([installation])),
    configuration: vi.fn(() => Promise.resolve(configuration)),
    hostBindings: vi.fn(() => Promise.resolve([binding])),
    reviseConfiguration: vi.fn(() => Promise.resolve({ ...installation, version: 5 })),
    createHostBinding: vi.fn(() => Promise.resolve(binding)),
    activate: vi.fn(() => Promise.resolve({ installation, binding })),
    suspend: vi.fn(() => Promise.resolve({ ...installation, lifecycle: 'SUSPENDED' as const })),
    ...overrides
  };
}

afterEach(() => cleanup());

describe('Site Manager', () => {
  it('renders exact owner state and previews current durable projection without publishing', async () => {
    const reviseConfiguration = vi.fn(() => Promise.resolve({ ...installation, version: 5 }));
    const activate = vi.fn(() => Promise.resolve({ installation, binding }));
    const api = client({ reviseConfiguration, activate });
    render(<SiteManager workspaceId={workspaceId} client={api} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Site Manager' })).toBeVisible();
    expect(screen.getByText('workspace_relationship')).toBeVisible();
    expect(screen.getByText('brand.example.com')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Preview current projection' }));
    expect(
      screen.getByRole('heading', { name: 'Current durable projection preview' })
    ).toBeVisible();
    expect(screen.getByLabelText('Current durable Site projection preview')).toHaveTextContent(
      'Orbit IP'
    );
    expect(screen.getByText(/Preview only.*config v3/)).toBeVisible();
    expect(reviseConfiguration).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });
  it('fails closed when current domain state cannot be loaded', async () => {
    const api = client({
      hostBindings: vi.fn(() =>
        Promise.reject(
          new SiteManagerHttpError(503, 'SITE_RUNTIME_UNAVAILABLE', 'Host state unavailable.', true)
        )
      )
    });
    render(<SiteManager workspaceId={workspaceId} client={api} />);
    expect(await screen.findByText('Domain state unavailable')).toBeVisible();
    expect(
      screen.getByText(/No domain, verification, activation, or preview state is inferred/)
    ).toBeVisible();
    expect(screen.queryByLabelText('Hostname')).not.toBeInTheDocument();
  });

  it('requires explicit acknowledgement before revising an active Site', async () => {
    const reviseConfiguration = vi.fn(() => Promise.resolve({ ...installation, version: 5 }));
    const api = client({ reviseConfiguration });
    render(<SiteManager workspaceId={workspaceId} client={api} />);
    await screen.findByRole('heading', { level: 1, name: 'Site Manager' });
    const save = screen.getByRole('button', { name: 'Save configuration version' });
    expect(save).toBeDisabled();
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: 'I understand this revision requires a separate activation step.'
      })
    );
    expect(save).toBeEnabled();
    await userEvent.click(save);
    await waitFor(() => expect(reviseConfiguration).toHaveBeenCalledTimes(1));
    expect(reviseConfiguration).toHaveBeenCalledWith(
      installation.siteId,
      installation.version,
      expect.objectContaining({ sourceRef: `lite:site-manager:${workspaceId}` }),
      expect.stringContaining('site-manager:configuration:site_manager:')
    );
  });
  it('preserves hostname input when a binding command fails', async () => {
    const api = client({
      createHostBinding: vi.fn(() =>
        Promise.reject(new SiteManagerHttpError(409, 'CONFLICT', 'Site state changed.'))
      )
    });
    render(<SiteManager workspaceId={workspaceId} client={api} />);
    await screen.findByRole('heading', { level: 1, name: 'Site Manager' });
    const hostname = screen.getByLabelText('Hostname');
    await userEvent.type(hostname, 'new.example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add pending binding' }));
    expect(await screen.findByText('Site state changed')).toBeVisible();
    expect(hostname).toHaveValue('new.example.com');
    expect(screen.getByRole('button', { name: 'Reload current state' })).toBeVisible();
  });
});
