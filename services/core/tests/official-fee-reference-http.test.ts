import { describe, expect, it, vi } from 'vitest';
import type { JsonRequest } from '@markorbit/service-kit';

import { createOfficialFeeReferenceRoutesV1 } from '../src/official-fee-reference-http.js';
import {
  OFFICIAL_FEE_PILOT_OPERATION,
  OfficialFeeReferenceStoreError,
  type OfficialFeeReferenceV1,
  type OfficialFeeResolutionQueryV1
} from '../src/official-fee-reference-store.js';

const secret = 'core-official-fee-reference-secret-32-bytes';
const asOf = '2026-09-03T03:45:00.000Z';

const reference: Readonly<OfficialFeeReferenceV1> = {
  schemaVersion: 1,
  referenceId:
    'official-fee-ref_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  operation: OFFICIAL_FEE_PILOT_OPERATION,
  jurisdiction: 'US',
  authority: 'USPTO',
  currency: 'USD',
  amountMinor: 35000,
  unit: 'PER_CLASS',
  effectiveFrom: '2025-01-18T00:00:00.000-05:00',
  status: 'CURRENT',
  packageId: 'executable-method-package_uspto-official-fee-resolution-20250118',
  methodId: 'brain-method_uspto-official-fee-resolution',
  methodVersionId: 'brain-method-version_uspto-official-fee-resolution-20250118',
  knowledgeSources: [],
  sourceIdentityFingerprintSha256: 'b'.repeat(64),
  materializationFingerprintSha256: 'a'.repeat(64),
  materializedAt: '2026-08-28T00:00:00.000Z'
};

function request(
  body: unknown,
  authorization: string | undefined = secret
): JsonRequest {
  return {
    method: 'POST',
    path: '/internal/v1/official-fee-references/current',
    params: {},
    query: {},
    headers: { 'x-markorbit-internal-authorization': authorization },
    body
  };
}

function exactQuery(): OfficialFeeResolutionQueryV1 {
  return {
    operation: OFFICIAL_FEE_PILOT_OPERATION,
    jurisdiction: 'US',
    authority: 'USPTO',
    asOf
  };
}

function route(resolveCurrent: (query: Readonly<OfficialFeeResolutionQueryV1>) => unknown) {
  return createOfficialFeeReferenceRoutesV1({
    internalServiceSecret: secret,
    references: { resolveCurrent }
  })[0]!;
}

describe('controlled Official Fee Reference HTTP read', () => {
  it('returns the exact Core-owned current reference to an authenticated internal caller', async () => {
    const resolveCurrent = vi.fn(() => Promise.resolve(reference));
    const result = await route(resolveCurrent).handle(request(exactQuery()));

    expect(result).toEqual({ status: 200, body: reference });
    expect(resolveCurrent).toHaveBeenCalledWith(exactQuery());
    expect(resolveCurrent).toHaveBeenCalledOnce();
  });

  it('rejects callers before touching the Core store when internal identity is invalid', async () => {
    const resolveCurrent = vi.fn(() => reference);

    await expect(
      route(resolveCurrent).handle(request(exactQuery(), 'not-the-configured-secret'))
    ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });
    expect(resolveCurrent).not.toHaveBeenCalled();
  });

  it('rejects generic or caller-expanded queries before touching the Core store', async () => {
    const resolveCurrent = vi.fn(() => reference);

    await expect(
      route(resolveCurrent).handle(request({ ...exactQuery(), jurisdiction: 'CA' }))
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    await expect(
      route(resolveCurrent).handle(request({ ...exactQuery(), includeStale: true }))
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
    expect(resolveCurrent).not.toHaveBeenCalled();
  });

  it.each([
    ['NO_CURRENT_REFERENCE', 404, false],
    ['AMBIGUOUS_CURRENT_REFERENCE', 409, false],
    ['PERSISTENCE_UNAVAILABLE', 503, true]
  ] as const)('maps Core %s fail-closed semantics to HTTP %s', async (code, status, retryable) => {
    const resolveCurrent = vi.fn(() => {
      throw new OfficialFeeReferenceStoreError(code, `forced ${code}`);
    });

    await expect(route(resolveCurrent).handle(request(exactQuery()))).rejects.toMatchObject({
      status,
      code,
      retryable
    });
    expect(resolveCurrent).toHaveBeenCalledOnce();
  });
});
