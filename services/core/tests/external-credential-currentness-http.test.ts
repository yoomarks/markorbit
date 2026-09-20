import { describe, expect, it, vi } from 'vitest';
import { createExternalCredentialCurrentnessRoutesV1 } from '../src/external-credential-currentness-http.js';

const secret = 'internal-secret-at-least-thirty-two-bytes-long';
const requestBody = {
  credential: {
    owner: 'CORE_IDENTITY',
    credentialBindingId: 'external-credential-binding_http',
    version: 1
  },
  expectedWorkspaceId: '11111111-1111-4111-8111-111111111111',
  expectedProvider: 'TEST',
  expectedExternalAccountRef: 'account',
  expectedSecretKind: 'API_KEY',
  requiredCapabilityId: 'capability.test'
};

describe('external credential currentness HTTP boundary', () => {
  it('requires trusted internal authorization and forwards only safe metadata', async () => {
    const assess = vi.fn(() =>
      Promise.resolve({
        schemaVersion: 1,
        credential: requestBody.credential,
        state: 'CURRENT',
        checkedAt: '2026-09-20T10:00:00.000Z',
        exposesSecretMaterial: false,
        createsExecutionAuthority: false
      })
    );
    const route = createExternalCredentialCurrentnessRoutesV1({
      internalServiceSecret: secret,
      currentness: { assess } as never
    })[0]!;
    await expect(route.handle({ headers: {}, body: requestBody } as never)).rejects.toMatchObject({
      status: 401
    });
    const response = await route.handle({
      headers: { 'x-markorbit-internal-authorization': secret },
      body: requestBody
    } as never);
    expect(response).toMatchObject({ status: 200 });
    expect(assess).toHaveBeenCalledWith(requestBody);
    expect(JSON.stringify(response)).not.toMatch(/api-value|password|ciphertext/iu);
    await expect(
      route.handle({
        headers: { 'x-markorbit-internal-authorization': secret },
        body: { ...requestBody, token: 'must-not-enter' }
      } as never)
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  });
});
