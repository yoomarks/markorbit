import { describe, expect, it } from 'vitest';
import { HttpCapabilityProvenanceAuthorityV1 } from '../src/capability-provenance-http-reader.js';

const secret = 'core-capability-provenance-secret-32-bytes';
const request = {
  capabilityId: 'capability.messages.send',
  capabilityVersion: '1.0.0',
  implementationProfileId: 'implementation-profile_test-v1',
  implementationProfileVersion: 1
};

describe('Capability provenance HTTP authority', () => {
  it('calls the fixed trusted currentness route and accepts only no-authority evidence', async () => {
    const fetcher: typeof fetch = (input, init) => {
      expect(input).toBe(
        'http://capability.test/internal/v1/channel-identity/provenance/currentness'
      );
      expect(init?.headers).toMatchObject({
        'x-markorbit-internal-authorization': secret
      });
      expect(typeof init?.body).toBe('string');
      expect(JSON.parse(init?.body as string)).toEqual(request);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            state: 'CURRENT',
            checkedAt: '2026-09-20T10:00:00.000Z',
            createsImplementationSelectionAuthority: false,
            createsExecutionAuthority: false
          }),
          { status: 200 }
        )
      );
    };
    await expect(
      new HttpCapabilityProvenanceAuthorityV1('http://capability.test/', secret, fetcher).assess(
        request
      )
    ).resolves.toEqual({ state: 'CURRENT' });
  });

  it('fails closed for owner outage, malformed evidence, or extra fields', async () => {
    for (const fetcher of [
      (() => Promise.reject(new Error('down'))) as typeof fetch,
      (() => Promise.resolve(new Response('{}', { status: 200 }))) as typeof fetch,
      (() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              schemaVersion: 1,
              state: 'CURRENT',
              checkedAt: '2026-09-20T10:00:00.000Z',
              createsImplementationSelectionAuthority: false,
              createsExecutionAuthority: false,
              secret: 'forbidden'
            }),
            { status: 200 }
          )
        )) as typeof fetch
    ])
      await expect(
        new HttpCapabilityProvenanceAuthorityV1('http://capability.test', secret, fetcher).assess(
          request
        )
      ).resolves.toEqual({ state: 'UNAVAILABLE' });
  });
});
