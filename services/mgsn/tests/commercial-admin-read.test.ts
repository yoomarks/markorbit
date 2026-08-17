import { describe, expect, it, vi } from 'vitest';
import {
  encodeInternalOperatorPrincipal,
  type InternalOperatorPrincipal
} from '@markorbit/contracts';
import type { JsonRequest } from '@markorbit/service-kit';
import {
  MgsnCommercialAdminReadService,
  type MgsnAdminProviderInspection
} from '../src/commercial-admin-read.js';
import { createMgsnCommercialAdminHttpRoutes } from '../src/commercial-admin-http.js';
import type { ProviderRegistryService } from '../src/provider-registry.js';

const secret = 'internal-secret';
const operator: InternalOperatorPrincipal = {
  kind: 'INTERNAL_OPERATOR',
  sessionId: 'session_mgsn-admin-test',
  userId: 'user_mgsn-admin-test',
  capabilities: ['commercial-admin:read'],
  sessionExpiresAt: '2099-01-01T00:00:00.000Z'
};
const provider = {
  schemaVersion: 1 as const,
  providerId: 'provider_admin-test' as const,
  providerWorkspaceId: '018f0000-0000-7000-8000-000000000701',
  displayName: 'Provider Admin Test',
  operationalStatus: 'ACTIVE' as const,
  version: 2,
  createdBy: 'user_ops-test',
  updatedBy: 'user_ops-test',
  createdAt: '2026-08-17T08:00:00.000Z',
  updatedAt: '2026-08-17T08:10:00.000Z'
};

function registry(): ProviderRegistryService {
  return {
    listProviders: () => Promise.resolve([provider]),
    getProvider: () => Promise.resolve(provider),
    listCurrentSupplyCapabilities: () => Promise.resolve([])
  } as unknown as ProviderRegistryService;
}

function request(): JsonRequest {
  return {
    method: 'GET',
    path: '/internal/commercial-admin/providers/provider_admin-test',
    body: undefined,
    params: { providerId: provider.providerId },
    query: {},
    headers: {
      'x-markorbit-internal-authorization': secret,
      'x-markorbit-principal': encodeInternalOperatorPrincipal(operator)
    }
  };
}

describe('MGSN commercial admin provider reads', () => {
  it('rejects missing commercial-admin:read before touching the Provider Registry', async () => {
    const getProvider = vi.fn(() => Promise.resolve(provider));
    const service = new MgsnCommercialAdminReadService({
      getProvider,
      listCurrentSupplyCapabilities: () => Promise.resolve([])
    } as unknown as ProviderRegistryService);

    await expect(
      service.inspectProvider({ ...operator, capabilities: [] }, provider.providerId)
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(getProvider).not.toHaveBeenCalled();
  });

  it('returns Provider Registry owner identity and current supply capabilities', async () => {
    const service = new MgsnCommercialAdminReadService(registry());
    const inspection = await service.inspectProvider(operator, provider.providerId);
    const expected: MgsnAdminProviderInspection = {
      schemaVersion: 1,
      source: { domain: 'MGSN', authority: 'PROVIDER_NETWORK' },
      provider,
      supplyCapabilities: []
    };
    expect(inspection).toEqual(expected);
  });

  it('requires trusted internal service authentication plus encoded INTERNAL operator authority', async () => {
    const route = createMgsnCommercialAdminHttpRoutes({
      service: new MgsnCommercialAdminReadService(registry()),
      internalServiceSecret: secret
    }).find((item) => item.path === '/internal/commercial-admin/providers/:providerId')!;
    const valid = request();
    await expect(
      route.handle({
        ...valid,
        headers: { ...valid.headers, 'x-markorbit-internal-authorization': 'wrong' }
      })
    ).rejects.toMatchObject({ status: 401, code: 'UNTRUSTED_INTERNAL_CALLER' });

    const response = await route.handle(valid);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      source: { domain: 'MGSN', authority: 'PROVIDER_NETWORK' },
      provider: { providerId: provider.providerId }
    });
  });
});
