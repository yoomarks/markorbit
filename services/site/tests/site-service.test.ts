import { describe, expect, it } from 'vitest';
import type { SiteRuntimeCommercialAccessV1 } from '@markorbit/contracts/site';
import {
  InMemorySiteRepositoryV1,
  SiteServiceError,
  SiteServiceV1,
  type SiteCommercialAuthorityV1,
  type SiteConfigurationInputV1
} from '../src/site-service.js';

const now = '2026-09-15T00:00:00.000Z';

function configuration(workspaceId: string, displayName: string): SiteConfigurationInputV1 {
  return {
    brand: {
      displayName,
      theme: { primaryColor: '#102030', accentColor: '#abcdef', colorMode: 'LIGHT' }
    },
    localization: {
      defaultLocale: 'en-US',
      supportedLocales: ['en-US'],
      defaultMarket: 'US',
      jurisdictions: ['US']
    },
    roles: {
      surfaceOwnerWorkspaceId: workspaceId,
      customerRelationshipWorkspaceId: `relationship_${workspaceId}`,
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
        pricingPolicyRefs: [{ id: 'markreg_price_policy', version: 2 }],
        fulfillment: { mode: 'MARKREG' }
      }
    ],
    contentSlots: [
      {
        slot: 'home.hero',
        route: '/',
        locale: 'en-US',
        title: `${displayName} home`,
        publishPackageRef: { id: 'publish_home', version: 3 },
        contentFingerprintSha256: 'a'.repeat(64)
      }
    ],
    sourceRef: `test:${workspaceId}`
  };
}

class CurrentCommercialAuthority implements SiteCommercialAuthorityV1 {
  denied = false;
  assertCurrentAccess(input: {
    workspaceId: string;
    installationId: string;
    installationVersion: number;
    entitlementKeys: readonly string[];
    asOf: string;
  }): Promise<SiteRuntimeCommercialAccessV1> {
    if (this.denied)
      throw new SiteServiceError('COMMERCIAL_ACCESS_DENIED', 'commercial access revoked');
    return Promise.resolve({
      schemaVersion: 1,
      workspaceId: input.workspaceId,
      installationRef: {
        installationId: input.installationId,
        version: input.installationVersion
      },
      entitlementRefs: input.entitlementKeys.map((key) => ({
        key,
        contributingGrantRefs: [{ grantId: `grant_${key}`, version: 1 }],
        resolvedAt: input.asOf
      })),
      currentAt: input.asOf
    });
  }
}

function setup() {
  const repository = new InMemorySiteRepositoryV1();
  const authority = new CurrentCommercialAuthority();
  let id = 0;
  const service = new SiteServiceV1(
    repository,
    authority,
    () => new Date(now),
    () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`
  );
  return { repository, authority, service };
}

async function activeSite(
  service: SiteServiceV1,
  workspaceId: string,
  hostname: string,
  suffix: string
) {
  const installation = await service.create({
    workspaceId,
    kind: 'WORKSPACE_BRANDED',
    coreSiteInstallationRef: { installationId: `install_${suffix}`, version: 1 },
    configuration: configuration(workspaceId, `Site ${suffix}`),
    sourceRef: `test:${suffix}`,
    idempotencyKey: `create-${suffix}`
  });
  const pending = await service.createHostBinding({
    workspaceId,
    siteId: installation.siteId,
    expectedSiteVersion: 1,
    hostname,
    bindingType: 'PRIMARY',
    verificationMethod: 'DNS_TXT',
    idempotencyKey: `bind-${suffix}`
  });
  const verified = await service.verifyHostBinding({
    workspaceId,
    bindingId: pending.bindingId,
    expectedBindingVersion: 1,
    verificationEvidenceRef: `dns-proof:${suffix}`,
    idempotencyKey: `verify-${suffix}`
  });
  return service.activate({
    workspaceId,
    siteId: installation.siteId,
    expectedSiteVersion: 1,
    bindingId: verified.bindingId,
    expectedBindingVersion: 2,
    idempotencyKey: `activate-${suffix}`
  });
}

describe('Workspace Site installation runtime', () => {
  it('resolves two Workspace Sites independently while reusing MarkReg Product truth', async () => {
    const { service } = setup();
    await activeSite(service, 'workspace_a', 'A.Example.com.', 'a');
    await activeSite(service, 'workspace_b', 'b.example.com', 'b');
    const first = await service.resolve('a.example.com:443', now);
    const second = await service.resolve('b.example.com', now);
    expect(first.publicSite.brand.displayName).toBe('Site a');
    expect(second.publicSite.brand.displayName).toBe('Site b');
    expect(first.publicSite.services[0]?.productRef).toEqual(
      second.publicSite.services[0]?.productRef
    );
    expect(first.requestContext.workspaceId).toBe('workspace_a');
    expect(second.requestContext.workspaceId).toBe('workspace_b');
    expect(first.publicSite).not.toHaveProperty('workspaceId');
    expect(first.publicSite).not.toHaveProperty('roles');
    expect(first.publicSite.services[0]).not.toHaveProperty('pricingPolicyRefs');
    expect(first.publicSite.services[0]).not.toHaveProperty('merchantOwnerRef');
  });

  it('fails closed for unknown, unverified and commercially revoked hosts', async () => {
    const { service, authority } = setup();
    const installation = await service.create({
      workspaceId: 'workspace_a',
      kind: 'WORKSPACE_BRANDED',
      coreSiteInstallationRef: { installationId: 'install_a', version: 1 },
      configuration: configuration('workspace_a', 'Site a'),
      sourceRef: 'test:a',
      idempotencyKey: 'create-a'
    });
    await service.createHostBinding({
      workspaceId: 'workspace_a',
      siteId: installation.siteId,
      expectedSiteVersion: 1,
      hostname: 'pending.example.com',
      bindingType: 'PRIMARY',
      verificationMethod: 'DNS_TXT',
      idempotencyKey: 'bind-pending'
    });
    await expect(service.resolve('unknown.example.com', now)).rejects.toMatchObject({
      code: 'HOST_NOT_ACTIVE'
    });
    await expect(service.resolve('pending.example.com', now)).rejects.toMatchObject({
      code: 'HOST_NOT_ACTIVE'
    });
    await activeSite(service, 'workspace_b', 'active.example.com', 'b');
    authority.denied = true;
    await expect(service.resolve('active.example.com', now)).rejects.toMatchObject({
      code: 'COMMERCIAL_ACCESS_DENIED'
    });
  });

  it('enforces Workspace ownership, optimistic concurrency and idempotency', async () => {
    const { service } = setup();
    const command = {
      workspaceId: 'workspace_a',
      kind: 'WORKSPACE_BRANDED' as const,
      coreSiteInstallationRef: { installationId: 'install_a', version: 1 },
      configuration: configuration('workspace_a', 'Site a'),
      sourceRef: 'test:a',
      idempotencyKey: 'create-a'
    };
    const first = await service.create(command);
    expect(await service.create(command)).toEqual(first);
    await expect(service.create({ ...command, sourceRef: 'changed' })).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSE'
    });
    await expect(
      service.reviseConfiguration({
        workspaceId: 'workspace_b',
        siteId: first.siteId,
        expectedSiteVersion: 1,
        configuration: configuration('workspace_b', 'Wrong owner'),
        idempotencyKey: 'cross-workspace'
      })
    ).rejects.toMatchObject({ code: 'WORKSPACE_MISMATCH' });
    await expect(
      service.createHostBinding({
        workspaceId: 'workspace_a',
        siteId: first.siteId,
        expectedSiteVersion: 2,
        hostname: 'stale.example.com',
        bindingType: 'PRIMARY',
        verificationMethod: 'DNS_TXT',
        idempotencyKey: 'stale'
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('keeps one active owner for an exact normalized hostname', async () => {
    const { service } = setup();
    await activeSite(service, 'workspace_a', 'shared.example.com', 'a');
    await expect(
      activeSite(service, 'workspace_b', 'SHARED.EXAMPLE.COM.', 'b')
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('fails closed while suspended and can revalidate an active binding after configuration revision', async () => {
    const { service } = setup();
    const active = await activeSite(service, 'workspace_a', 'lifecycle.example.com', 'a');
    const suspendCommand = {
      workspaceId: 'workspace_a',
      siteId: active.installation.siteId,
      expectedSiteVersion: active.installation.version,
      reasonRef: 'operator:maintenance',
      idempotencyKey: 'suspend-a'
    } as const;
    const suspended = await service.suspend(suspendCommand);
    expect(suspended.lifecycle).toBe('SUSPENDED');
    expect(await service.suspend(suspendCommand)).toEqual(suspended);
    await expect(service.resolve('lifecycle.example.com', now)).rejects.toMatchObject({
      code: 'SITE_NOT_ACTIVE'
    });

    const revised = await service.reviseConfiguration({
      workspaceId: 'workspace_a',
      siteId: suspended.siteId,
      expectedSiteVersion: suspended.version,
      configuration: configuration('workspace_a', 'Revised site'),
      idempotencyKey: 'revise-a'
    });
    const reactivated = await service.activate({
      workspaceId: 'workspace_a',
      siteId: revised.siteId,
      expectedSiteVersion: revised.version,
      bindingId: active.binding.bindingId,
      expectedBindingVersion: active.binding.version,
      idempotencyKey: 'reactivate-a'
    });
    expect(reactivated.installation.lifecycle).toBe('ACTIVE');
    expect((await service.resolve('lifecycle.example.com', now)).publicSite.brand.displayName).toBe(
      'Revised site'
    );
  });
});
