import { describe, expect, it, vi } from 'vitest';
import {
  CapabilityObservationSourceError,
  HttpExecutionCapabilityObservationSourceAuthority
} from '../src/capability-observation-source.js';

const secret = 'm6-wp-03-internal-secret-32-bytes-minimum';
const locator = {
  owner: 'EXECUTION' as const,
  kind: 'EXECUTION_EVIDENCE_REVIEW_DECISION' as const,
  sourceId: 'evidence-review-decision_governed-001',
  sourceVersion: 1,
  sourceFingerprintSha256: 'c'.repeat(64)
};

function okPayload() {
  return {
    source: {
      ...locator,
      observedAt: '2026-08-12T00:00:00.000Z',
      workspaceId: '11111111-1111-4111-8111-111111111111',
      subjectUserId: 'user_capability_subject',
      correlationId: 'correlation_governed-review-001'
    },
    subjectAttributionAuthority: 'OWNER_SOURCE'
  };
}

function requestUrl(input: RequestInfo | URL): string {
  if (input instanceof Request) return input.url;
  if (input instanceof URL) return input.href;
  return input;
}

describe('M6-WP-03 Execution governed source authority client', () => {
  it('requests the exact owner ID/version/fingerprint and accepts owner-derived subject attribution', async () => {
    const observed = vi.fn();
    const fetcher: typeof fetch = (input, init) => {
      observed(input, init);
      expect(requestUrl(input)).toBe(
        'http://execution.test/internal/v1/capability-observation-sources/evidence-review-decisions/evidence-review-decision_governed-001/versions/1'
      );
      expect(init?.method).toBe('GET');
      expect(init?.headers).toMatchObject({
        'x-markorbit-internal-authorization': secret,
        'x-source-fingerprint-sha256': 'c'.repeat(64)
      });
      return Promise.resolve(
        new Response(JSON.stringify(okPayload()), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      );
    };
    const authority = new HttpExecutionCapabilityObservationSourceAuthority(
      'http://execution.test',
      secret,
      fetcher
    );
    await expect(authority.verify(locator)).resolves.toEqual(okPayload());
    expect(observed).toHaveBeenCalledTimes(1);
  });

  it('rejects any non-reviewed source family without contacting Execution', async () => {
    const observed = vi.fn();
    const fetcher: typeof fetch = (input, init) => {
      observed(input, init);
      return Promise.reject(new Error('unexpected Execution request'));
    };
    const authority = new HttpExecutionCapabilityObservationSourceAuthority(
      'http://execution.test',
      secret,
      fetcher
    );
    await expect(
      authority.verify({
        ...locator,
        owner: 'MARKREG',
        kind: 'MARKREG_REVIEWED_LIFECYCLE_SOURCE'
      })
    ).rejects.toMatchObject({ code: 'SOURCE_NOT_ALLOWED' });
    expect(observed).not.toHaveBeenCalled();
  });

  it('fails closed when owner response changes identity, version, fingerprint or attribution authority', async () => {
    for (const payload of [
      { ...okPayload(), source: { ...okPayload().source, sourceVersion: 2 } },
      {
        ...okPayload(),
        source: { ...okPayload().source, sourceFingerprintSha256: 'd'.repeat(64) }
      },
      { ...okPayload(), subjectAttributionAuthority: 'CORE_PRINCIPAL_RELATIONSHIP' }
    ]) {
      const fetcher: typeof fetch = () =>
        Promise.resolve(
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        );
      const authority = new HttpExecutionCapabilityObservationSourceAuthority(
        'http://execution.test',
        secret,
        fetcher
      );
      await expect(authority.verify(locator)).rejects.toBeInstanceOf(
        CapabilityObservationSourceError
      );
    }
  });

  it('maps owner stale fingerprint and transport outage into typed fail-closed errors', async () => {
    const staleFetcher: typeof fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: 'SOURCE_FINGERPRINT_MISMATCH',
            message: 'fingerprint changed'
          }),
          { status: 409, headers: { 'content-type': 'application/json' } }
        )
      );
    const stale = new HttpExecutionCapabilityObservationSourceAuthority(
      'http://execution.test',
      secret,
      staleFetcher
    );
    await expect(stale.verify(locator)).rejects.toMatchObject({
      code: 'SOURCE_FINGERPRINT_MISMATCH',
      status: 409
    });

    const outageFetcher: typeof fetch = () => Promise.reject(new Error('connection refused'));
    const outage = new HttpExecutionCapabilityObservationSourceAuthority(
      'http://execution.test',
      secret,
      outageFetcher
    );
    await expect(outage.verify(locator)).rejects.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      status: 503,
      retryable: true
    });
  });
});
