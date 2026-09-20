import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceChannelIdentityCurrentnessRoutesV1 } from '../src/workspace-channel-identity-currentness-http.js';

const secret = 'internal-secret-at-least-thirty-two-bytes-long';
const body = {
  workspaceId: '14141414-1414-4414-8414-141414141414',
  featureKey: 'WHATSAPP_BUSINESS',
  binding: {
    id: 'workspace-channel-identity-binding_http',
    version: 1,
    fingerprintSha256: 'a'.repeat(64)
  },
  externalCredentialRequirements: {
    expectedProvider: 'WHATSAPP',
    expectedSecretKind: 'API_KEY'
  }
};

describe('Workspace Channel identity currentness HTTP boundary', () => {
  it('forwards safe external credential requirements and rejects escape hatches', async () => {
    const resolve = vi.fn(() =>
      Promise.resolve({
        schemaVersion: 1,
        workspaceId: body.workspaceId,
        featureKey: body.featureKey,
        binding: body.binding,
        state: 'CURRENT',
        reason: 'EXACT_BINDING_CURRENT',
        assessedAt: '2026-09-20T10:00:00.000Z',
        createsExecutionAuthority: false
      })
    );
    const route = createWorkspaceChannelIdentityCurrentnessRoutesV1({
      internalServiceSecret: secret,
      resolver: { resolve } as never
    })[0]!;
    await expect(route.handle({ headers: {}, body } as never)).rejects.toMatchObject({
      status: 401
    });
    await expect(
      route.handle({
        headers: { 'x-markorbit-internal-authorization': secret },
        body
      } as never)
    ).resolves.toMatchObject({ status: 200 });
    expect(resolve).toHaveBeenCalledWith(body);
    for (const field of ['apiKey', 'token', 'password', 'headers'])
      await expect(
        route.handle({
          headers: { 'x-markorbit-internal-authorization': secret },
          body: { ...body, [field]: 'forbidden' }
        } as never)
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    await expect(
      route.handle({
        headers: { 'x-markorbit-internal-authorization': secret },
        body: {
          ...body,
          externalCredentialRequirements: {
            ...body.externalCredentialRequirements,
            authorization: 'forbidden'
          }
        }
      } as never)
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    await expect(
      route.handle({
        headers: { 'x-markorbit-internal-authorization': secret },
        body: { ...body, binding: { ...body.binding, token: 'forbidden' } }
      } as never)
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  });
});
