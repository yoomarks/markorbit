import { describe, expect, it, vi } from 'vitest';

import {
  HttpCoreOfficialFeeReferenceReaderV1,
  OfficialFeeReferenceReaderError
} from '../src/official-fee-reference-http-reader.js';
import { USPTO_OFFICIAL_FEE_RESOLVER_OPERATION } from '../src/uspto-official-fee-resolver-pilot.js';

const secret = 'capability-core-reference-secret-32-bytes';
const query = {
  operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
  jurisdiction: 'US' as const,
  authority: 'USPTO' as const,
  asOf: '2026-09-03T03:45:00.000Z'
};
const payload = {
  schemaVersion: 1,
  referenceId: `official-fee-ref_${'a'.repeat(64)}`,
  operation: USPTO_OFFICIAL_FEE_RESOLVER_OPERATION,
  jurisdiction: 'US',
  authority: 'USPTO',
  status: 'CURRENT'
};

function requestUrl(input: RequestInfo | URL): string {
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.href;
  return input;
}

describe('Core Official Fee Reference HTTP reader', () => {
  it('sends only the bounded query to the authenticated Core owner route', async () => {
    const observed = vi.fn();
    const fetcher: typeof fetch = (input, init) => {
      observed(input, init);
      expect(requestUrl(input)).toBe(
        'http://core.test/internal/v1/official-fee-references/current'
      );
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        'content-type': 'application/json',
        'x-markorbit-internal-authorization': secret
      });
      expect(JSON.parse(String(init?.body))).toEqual(query);
      return Promise.resolve(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    };
    const reader = new HttpCoreOfficialFeeReferenceReaderV1(
      'http://core.test/',
      secret,
      fetcher
    );

    await expect(reader.resolveCurrent(query)).resolves.toEqual(payload);
    expect(observed).toHaveBeenCalledOnce();
  });

  it.each([
    [404, 'NO_CURRENT_REFERENCE', 'NO_CURRENT_REFERENCE', false],
    [409, 'AMBIGUOUS_CURRENT_REFERENCE', 'AMBIGUOUS_CURRENT_REFERENCE', false],
    [503, 'PERSISTENCE_UNAVAILABLE', 'DEPENDENCY_UNAVAILABLE', true]
  ] as const)(
    'maps Core HTTP %s/%s to %s without fallback',
    async (status, ownerCode, expectedCode, retryable) => {
      const fetcher: typeof fetch = () =>
        Promise.resolve(
          new Response(JSON.stringify({ code: ownerCode, message: 'forced' }), {
            status,
            headers: { 'content-type': 'application/json' }
          })
        );
      const reader = new HttpCoreOfficialFeeReferenceReaderV1(
        'http://core.test',
        secret,
        fetcher
      );

      await expect(reader.resolveCurrent(query)).rejects.toMatchObject({
        code: expectedCode,
        retryable
      });
    }
  );

  it('fails closed on network outage and malformed successful owner response', async () => {
    const outage: typeof fetch = () => Promise.reject(new Error('connection refused'));
    await expect(
      new HttpCoreOfficialFeeReferenceReaderV1('http://core.test', secret, outage).resolveCurrent(
        query
      )
    ).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE', retryable: true });

    const malformed: typeof fetch = () => Promise.resolve(new Response('null', { status: 200 }));
    await expect(
      new HttpCoreOfficialFeeReferenceReaderV1(
        'http://core.test',
        secret,
        malformed
      ).resolveCurrent(query)
    ).rejects.toBeInstanceOf(OfficialFeeReferenceReaderError);
  });

  it('rejects out-of-scope query data before contacting Core', async () => {
    const observed = vi.fn();
    const fetcher: typeof fetch = (input, init) => {
      observed(input, init);
      return Promise.reject(new Error('unexpected Core request'));
    };
    const reader = new HttpCoreOfficialFeeReferenceReaderV1(
      'http://core.test',
      secret,
      fetcher
    );

    await expect(
      reader.resolveCurrent({ ...query, asOf: 'not-an-instant' })
    ).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    expect(observed).not.toHaveBeenCalled();
  });
});
