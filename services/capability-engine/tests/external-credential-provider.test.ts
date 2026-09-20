import { describe, expect, it, vi } from 'vitest';
import {
  CoreBackedExternalCredentialProviderV1,
  ExternalCredentialProviderError
} from '../src/external-credential-provider.js';

const internalSecret = 'capability-core-resolution-secret-32-bytes';
const request = {
  callerService: 'CAPABILITY_ENGINE' as const,
  credential: {
    owner: 'CORE_IDENTITY' as const,
    credentialBindingId: 'external-credential-binding_provider' as const,
    version: 4
  },
  expectedWorkspaceId: '11111111-1111-4111-8111-111111111111',
  expectedProvider: 'TEST_PROVIDER',
  expectedExternalAccountRef: 'account-primary',
  expectedSecretKind: 'BASIC' as const,
  requiredCapabilityId: 'capability.messages.send',
  requiredCapabilityVersion: '1.0.0',
  implementationProfileId: 'implementation-profile_test-provider-v1',
  implementationProfileVersion: 2,
  correlationId: 'correlation-provider-1',
  approvedUsage: 'APPROVED_PROVIDER_ADAPTER_AUTHENTICATION' as const
};

function response(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    credentialBindingId: request.credential.credentialBindingId,
    bindingVersion: request.credential.version,
    secret: { kind: 'BASIC', username: 'bounded-user', password: 'bounded-password' },
    createsProviderSelectionAuthority: false,
    createsImplementationSelectionAuthority: false,
    createsExecutionAuthority: false,
    authorizesProtectedAction: false,
    ...overrides
  };
}

describe('Core-backed external credential provider', () => {
  it('uses the fixed trusted owner route and scopes material to one callback', async () => {
    const observed = vi.fn();
    const fetcher: typeof fetch = (input, init) => {
      observed(input, init);
      expect(input).toBe('http://core.test/internal/v1/external-credentials/resolve');
      expect(init).toMatchObject({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': internalSecret
        }
      });
      expect(typeof init?.body).toBe('string');
      expect(JSON.parse(init?.body as string)).toEqual(request);
      return Promise.resolve(new Response(JSON.stringify(response()), { status: 200 }));
    };
    const provider = new CoreBackedExternalCredentialProviderV1(
      'http://core.test/',
      internalSecret,
      fetcher
    );
    const consume = vi.fn((material: { kind: string }) =>
      Promise.resolve(`${material.kind}:consumed`)
    );
    await expect(provider.withCredential(request, consume)).resolves.toBe('BASIC:consumed');
    expect(consume).toHaveBeenCalledOnce();
    expect(observed).toHaveBeenCalledOnce();
    expect(provider).not.toHaveProperty('credential');
  });

  it.each([
    [{ bindingVersion: 5 }, 'INVALID_RESOLUTION_RESPONSE'],
    [{ createsExecutionAuthority: true }, 'INVALID_RESOLUTION_RESPONSE'],
    [{ endpoint: 'https://arbitrary.invalid' }, 'INVALID_RESOLUTION_RESPONSE'],
    [
      { secret: { kind: 'BASIC', username: 'user', password: 'pass', authorization: 'bad' } },
      'INVALID_RESOLUTION_RESPONSE'
    ]
  ] as const)('rejects unbounded or mismatched responses %o', async (change, code) => {
    const fetcher: typeof fetch = () =>
      Promise.resolve(new Response(JSON.stringify(response(change)), { status: 200 }));
    const provider = new CoreBackedExternalCredentialProviderV1(
      'http://core.test',
      internalSecret,
      fetcher
    );
    const consume = vi.fn();
    await expect(provider.withCredential(request, consume)).rejects.toMatchObject({ code });
    expect(consume).not.toHaveBeenCalled();
  });

  it('maps owner denial and outage without echoing owner payloads', async () => {
    const denied: typeof fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ message: 'contains-provider-secret' }), { status: 409 })
      );
    await expect(
      new CoreBackedExternalCredentialProviderV1(
        'http://core.test',
        internalSecret,
        denied
      ).withCredential(request, vi.fn())
    ).rejects.toMatchObject({ code: 'CREDENTIAL_RESOLUTION_DENIED' });
    const outage: typeof fetch = () => Promise.reject(new Error('network details'));
    const promise = new CoreBackedExternalCredentialProviderV1(
      'http://core.test',
      internalSecret,
      outage
    ).withCredential(request, vi.fn());
    await expect(promise).rejects.toBeInstanceOf(ExternalCredentialProviderError);
    await expect(promise).rejects.toMatchObject({
      code: 'CREDENTIAL_RESOLUTION_UNAVAILABLE',
      retryable: true
    });
  });
});
