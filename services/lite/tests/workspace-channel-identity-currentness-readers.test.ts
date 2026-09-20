import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpCoreExternalCredentialCurrentnessReaderV1 } from '../src/workspace-channel-identity-currentness-readers.js';

const input = {
  credential: {
    owner: 'CORE_IDENTITY' as const,
    credentialBindingId: 'external-credential-binding_reader' as const,
    version: 3
  },
  expectedWorkspaceId: '14141414-1414-4414-8414-141414141414',
  expectedProvider: 'WHATSAPP',
  expectedExternalAccountRef: 'account_primary',
  expectedSecretKind: 'API_KEY' as const,
  requiredCapabilityId: 'capability_whatsapp'
};

afterEach(() => vi.unstubAllGlobals());

describe('Core external credential currentness reader', () => {
  it('posts only exact safe context and accepts the matching safe ref', async () => {
    const fetcher = vi.fn((_url: string, init: RequestInit) => {
      expect(typeof init.body).toBe('string');
      expect(JSON.parse(init.body as string)).toEqual(input);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            credential: input.credential,
            state: 'CURRENT',
            checkedAt: '2026-09-20T10:00:00.000Z',
            exposesSecretMaterial: false,
            createsExecutionAuthority: false
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    });
    vi.stubGlobal('fetch', fetcher);
    await expect(
      new HttpCoreExternalCredentialCurrentnessReaderV1(
        'http://core.test',
        'internal-secret-at-least-thirty-two-bytes-long'
      ).assess(input)
    ).resolves.toEqual({ state: 'CURRENT' });
    expect(fetcher).toHaveBeenCalledWith(
      'http://core.test/internal/v1/external-credentials/currentness',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it.each([
    [{ ...input.credential, version: 4 }],
    [
      {
        ...input.credential,
        secret: 'must-not-cross-safe-currentness'
      }
    ]
  ])('fails closed for a mismatched or secret-bearing response ref', async (credential) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              schemaVersion: 1,
              credential,
              state: 'CURRENT',
              checkedAt: '2026-09-20T10:00:00.000Z',
              exposesSecretMaterial: false,
              createsExecutionAuthority: false
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
        )
      )
    );
    await expect(
      new HttpCoreExternalCredentialCurrentnessReaderV1(
        'http://core.test',
        'internal-secret-at-least-thirty-two-bytes-long'
      ).assess(input)
    ).resolves.toEqual({ state: 'UNAVAILABLE' });
  });
});
