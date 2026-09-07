import { describe, expect, it } from 'vitest';

import {
  US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID,
  US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID,
  US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID,
  US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID,
  US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID,
  US_TRADEMARK_MARK_REPRESENTATION_REFERENCE_DEPENDENCY,
  USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE
} from '@markorbit/contracts/brain-us-trademark-mark-representation-method';
import { noRecommendationSourceAuthorityConsequences } from '@markorbit/contracts/markreg-early-funnel';

import {
  HttpCoreUsTrademarkMarkRepresentationMethodReaderV1,
  UsTrademarkMarkRepresentationMethodReaderError
} from '../src/us-trademark-mark-representation-method-http-reader.js';

const SECRET = 'capability-848-core-method-reader-secret-32-bytes';
const AS_OF = '2026-09-07T00:12:00.000Z';

function payload() {
  return {
    schemaVersion: 1,
    currentness: 'CURRENT',
    currentnessMechanism:
      'CORE_BRAIN_ASSET_LATEST_ACTIVE_PLUS_EXACT_KNOWLEDGE_REFERENCE_IDENTITY_AND_CAPTURE_WINDOW',
    brainAssetId: 'brain-asset_us-trademark-mark-representation-strategy',
    brainAssetVersionId: 'brain-asset-version_us-trademark-mark-representation-strategy-active-v1',
    methodId: US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID,
    methodVersionId: US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID,
    methodFingerprintSha256: 'eb9fe8e8814c37b713409c45f9dec633712e2684df4886760b0776c21e2ac26a',
    packageId: US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID,
    packageVersion: 2,
    packageFingerprintSha256: '6877e2ae2bfa659595f3997e312aad933f65976cbb825678e41d47126443ed41',
    activatedAt: '2026-09-06T19:05:00.000Z',
    activationDecisionId:
      'brain-method-activation_c0cfc431db2ec1f8047b554aeeb67cedee64d971d37e0488efefdad39921c2b9',
    activationEvidenceRef:
      'brain-method-activation:brain-method-activation_c0cfc431db2ec1f8047b554aeeb67cedee64d971d37e0488efefdad39921c2b9:fb97d07eca29ac78cc2098893a03a752f98a4bd35e9291e2d8b6407bbfbb135c',
    inputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID,
    outputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID,
    referenceDependency: US_TRADEMARK_MARK_REPRESENTATION_REFERENCE_DEPENDENCY,
    sourceReference: {
      ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
      currentness: 'CURRENT'
    },
    knowledgeGovernanceRef:
      'github:yoomarks/markorbit-knowledge@7ba94f5e7d45bd451d6ac25d5b509a600da43b7f',
    currentnessCheckedAt: AS_OF,
    authorityConsequences: noRecommendationSourceAuthorityConsequences
  };
}

function fetcher(
  responsePayload: unknown,
  status = 200,
  observed?: { url?: string; init?: RequestInit }
) {
  return ((input: string | URL | Request, init?: RequestInit) => {
    if (observed) {
      observed.url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (init) observed.init = init;
    }
    return Promise.resolve(
      new Response(JSON.stringify(responsePayload), {
        status,
        headers: { 'content-type': 'application/json' }
      })
    );
  }) as typeof fetch;
}

function reader(
  responsePayload: unknown,
  status = 200,
  observed?: { url?: string; init?: RequestInit }
) {
  return new HttpCoreUsTrademarkMarkRepresentationMethodReaderV1(
    'http://core.internal/',
    SECRET,
    fetcher(responsePayload, status, observed)
  );
}

const query = {
  operation: 'MARK_REPRESENTATION_STRATEGY',
  jurisdiction: 'US',
  authority: 'USPTO',
  asOf: AS_OF
} as const;

describe('#848 Core US mark-representation Method reader', () => {
  it('accepts only the exact #903 current bundle and sends the internal owner request', async () => {
    const observed: { url?: string; init?: RequestInit } = {};
    await expect(reader(payload(), 200, observed).resolveCurrent(query)).resolves.toEqual(
      payload()
    );
    expect(observed.url).toBe(
      'http://core.internal/internal/v1/brain-method-references/us-trademark-mark-representation/current'
    );
    expect(observed.init?.method).toBe('POST');
    expect(
      (observed.init?.headers as Record<string, string>)['x-markorbit-internal-authorization']
    ).toBe(SECRET);
    const requestBody = observed.init?.body;
    if (typeof requestBody !== 'string') throw new Error('expected serialized JSON request body');
    expect(JSON.parse(requestBody)).toEqual(query);
  });

  it.each([
    ['Method fingerprint', { ...payload(), methodFingerprintSha256: '0'.repeat(64) }],
    ['package fingerprint', { ...payload(), packageFingerprintSha256: '0'.repeat(64) }],
    [
      'activation identity',
      { ...payload(), activationDecisionId: 'brain-method-activation_wrong' }
    ],
    ['BrainAsset identity', { ...payload(), brainAssetVersionId: 'brain-asset-version_wrong' }],
    ['currentness mechanism', { ...payload(), currentnessMechanism: 'WRONG' }],
    [
      'Knowledge governance',
      { ...payload(), knowledgeGovernanceRef: 'github:yoomarks/markorbit-knowledge@wrong' }
    ],
    ['reference dependency', { ...payload(), referenceDependency: 'WRONG' }],
    [
      'Knowledge document hash',
      {
        ...payload(),
        sourceReference: { ...payload().sourceReference, documentContentSha256: '0'.repeat(64) }
      }
    ],
    [
      'Knowledge source id',
      { ...payload(), sourceReference: { ...payload().sourceReference, sourceId: 'src_wrong' } }
    ]
  ])('fails closed on %s drift', async (_label, drifted) => {
    await expect(reader(drifted).resolveCurrent(query)).rejects.toMatchObject({
      code: 'IDENTITY_MISMATCH'
    });
  });

  it('maps explicit no-current and dependency failure without fallback', async () => {
    await expect(
      reader({ code: 'NO_CURRENT_METHOD' }, 404).resolveCurrent(query)
    ).rejects.toMatchObject({ code: 'NO_CURRENT_METHOD', retryable: false });
    await expect(
      reader({ code: 'UPSTREAM_FAILURE' }, 503).resolveCurrent(query)
    ).rejects.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      retryable: true
    });
  });

  it('rejects unsupported queries before contacting Core', async () => {
    let called = false;
    const never = (() => {
      called = true;
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as typeof fetch;
    const instance = new HttpCoreUsTrademarkMarkRepresentationMethodReaderV1(
      'http://core.internal',
      SECRET,
      never
    );
    await expect(
      instance.resolveCurrent({ ...query, jurisdiction: 'CA' as 'US' })
    ).rejects.toBeInstanceOf(UsTrademarkMarkRepresentationMethodReaderError);
    expect(called).toBe(false);
  });
});
