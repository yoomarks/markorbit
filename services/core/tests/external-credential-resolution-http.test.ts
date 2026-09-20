import { describe, expect, it, vi } from 'vitest';
import { createExternalCredentialResolutionRoutesV1 } from '../src/external-credential-resolution-http.js';
import { externalCredentialApprovedUsageV1 } from '../src/external-credential-resolution.js';

const secret = 'internal-secret-at-least-thirty-two-bytes-long';
const requestBody = {
  callerService: 'CAPABILITY_ENGINE' as const,
  credential: {
    owner: 'CORE_IDENTITY',
    credentialBindingId: 'external-credential-binding_http-resolution',
    version: 1
  },
  expectedWorkspaceId: '11111111-1111-4111-8111-111111111111',
  expectedProvider: 'TEST',
  expectedExternalAccountRef: 'account',
  expectedSecretKind: 'STATIC_BEARER',
  requiredCapabilityId: 'capability.test',
  requiredCapabilityVersion: '1.0.0',
  implementationProfileId: 'implementation-profile_test-v1',
  implementationProfileVersion: 1,
  correlationId: 'correlation-http-1',
  approvedUsage: externalCredentialApprovedUsageV1
};

describe('external credential resolution HTTP boundary', () => {
  it('is trusted-only, exact-field-only, and returns no authority', async () => {
    const resolve = vi.fn(() =>
      Promise.resolve({
        schemaVersion: 1,
        credentialBindingId: requestBody.credential.credentialBindingId,
        bindingVersion: 1,
        secret: { kind: 'STATIC_BEARER', token: 'ephemeral-value' },
        createsProviderSelectionAuthority: false,
        createsImplementationSelectionAuthority: false,
        createsExecutionAuthority: false,
        authorizesProtectedAction: false
      })
    );
    const route = createExternalCredentialResolutionRoutesV1({
      internalServiceSecret: secret,
      resolver: { resolve } as never
    })[0]!;
    await expect(route.handle({ headers: {}, body: requestBody } as never)).rejects.toMatchObject({
      status: 401
    });
    await expect(
      route.handle({
        headers: { 'x-markorbit-internal-authorization': secret },
        body: { ...requestBody, authorization: 'forbidden' }
      } as never)
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    const response = await route.handle({
      headers: { 'x-markorbit-internal-authorization': secret },
      body: requestBody
    } as never);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response)).toContain('"createsExecutionAuthority":false');
    expect(resolve).toHaveBeenCalledWith(requestBody);
  });
});
