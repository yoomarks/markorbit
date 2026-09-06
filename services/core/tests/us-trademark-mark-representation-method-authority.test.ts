import { describe, expect, it } from 'vitest';
import type { JsonRequest } from '@markorbit/service-kit';

import { InMemoryBrainAssetRegistry } from '../src/brain-asset-registry.js';
import {
  US_TRADEMARK_MARK_REPRESENTATION_BRAIN_ASSET_ID,
  US_TRADEMARK_MARK_REPRESENTATION_KNOWLEDGE_GOVERNANCE_REF,
  UsTrademarkMarkRepresentationMethodAuthorityV1,
  buildUsTrademarkMarkRepresentationBrainAssetLifecycleV1,
  materializeUsTrademarkMarkRepresentationBrainAssetLifecycleV1,
  type UsTrademarkMarkRepresentationResolutionQueryV1
} from '../src/us-trademark-mark-representation-method-authority.js';
import { createUsTrademarkMarkRepresentationMethodRoutesV1 } from '../src/us-trademark-mark-representation-method-http.js';

const SECRET = 'core-us-mark-representation-secret-32-bytes';
const ACTIVE_AT = '2026-09-06T15:27:00.000Z';
const AFTER_ACTIVE = '2026-09-06T15:30:00.000Z';

function exactQuery(asOf = AFTER_ACTIVE): UsTrademarkMarkRepresentationResolutionQueryV1 {
  return {
    operation: 'MARK_REPRESENTATION_STRATEGY',
    jurisdiction: 'US',
    authority: 'USPTO',
    asOf
  };
}
function request(body: unknown, authorization: string | undefined = SECRET): JsonRequest {
  return {
    method: 'POST',
    path: '/internal/v1/brain-method-references/us-trademark-mark-representation/current',
    params: {},
    query: {},
    headers: { 'x-markorbit-internal-authorization': authorization },
    body
  };
}

async function currentAuthority() {
  const registry = new InMemoryBrainAssetRegistry();
  await materializeUsTrademarkMarkRepresentationBrainAssetLifecycleV1(registry);
  return {
    registry,
    authority: new UsTrademarkMarkRepresentationMethodAuthorityV1(registry)
  };
}

describe('governed US trademark mark-representation Method authority', () => {
  it('materializes the immutable lifecycle idempotently and resolves only after activation', async () => {
    const registry = new InMemoryBrainAssetRegistry();
    const first = await materializeUsTrademarkMarkRepresentationBrainAssetLifecycleV1(registry);
    const replay = await materializeUsTrademarkMarkRepresentationBrainAssetLifecycleV1(registry);
    expect(first.map((asset) => asset.status)).toEqual([
      'DRAFT',
      'CANDIDATE',
      'VALIDATED',
      'ACTIVE'
    ]);
    expect(replay).toEqual(first);
    expect(registry.listVersions(US_TRADEMARK_MARK_REPRESENTATION_BRAIN_ASSET_ID)).toHaveLength(4);
    expect(first.at(-1)!.scope.effectiveFrom).toBe(ACTIVE_AT);

    const authority = new UsTrademarkMarkRepresentationMethodAuthorityV1(registry);
    await expect(
      authority.resolveCurrent(exactQuery('2026-09-06T15:26:59.999Z'))
    ).rejects.toMatchObject({
      code: 'NO_CURRENT_METHOD'
    });

    const current = await authority.resolveCurrent(exactQuery());
    expect(current.currentness).toBe('CURRENT');
    expect(current.activatedAt).toBe(ACTIVE_AT);
    expect(current.packageVersion).toBe(2);
    expect(current.knowledgeGovernanceRef).toBe(
      US_TRADEMARK_MARK_REPRESENTATION_KNOWLEDGE_GOVERNANCE_REF
    );
    expect(Object.values(current.authorityConsequences).every((value) => value === false)).toBe(
      true
    );
  });

  it('fails closed when the exact governed version identity already exists with drift', async () => {
    const registry = new InMemoryBrainAssetRegistry();
    const draft = buildUsTrademarkMarkRepresentationBrainAssetLifecycleV1()[0]!;
    registry.register({ ...draft, payload: { drifted: true } });
    await expect(
      materializeUsTrademarkMarkRepresentationBrainAssetLifecycleV1(registry)
    ).rejects.toMatchObject({ code: 'IDENTITY_MISMATCH' });
  });

  it('treats a later DEGRADED lifecycle version as not current even while historical ACTIVE remains effective', async () => {
    const { registry, authority } = await currentAuthority();
    const active = buildUsTrademarkMarkRepresentationBrainAssetLifecycleV1().at(-1)!;
    registry.register({
      ...active,
      brainAssetVersionId:
        'brain-asset-version_us-trademark-mark-representation-strategy-degraded-v1',
      version: 5,
      status: 'DEGRADED',
      derivedFromBrainAssetVersionIds: [active.brainAssetVersionId],
      createdAt: '2026-09-06T15:35:00.000Z'
    });

    await expect(
      authority.resolveCurrent(exactQuery('2026-09-06T15:40:00.000Z'))
    ).rejects.toMatchObject({
      code: 'NO_CURRENT_METHOD'
    });
  });

  it('serves the exact current identity only to an authenticated internal caller', async () => {
    const { authority } = await currentAuthority();
    const route = createUsTrademarkMarkRepresentationMethodRoutesV1({
      internalServiceSecret: SECRET,
      methods: authority
    })[0]!;
    const result = await route.handle(request(exactQuery()));
    expect(result.status).toBe(200);
    expect((result.body as { currentness: string }).currentness).toBe('CURRENT');

    await expect(
      route.handle(request(exactQuery(), 'wrong-internal-secret'))
    ).rejects.toMatchObject({ status: 401, code: 'INTERNAL_SERVICE_UNAUTHORIZED' });

    await expect(
      route.handle(request({ ...exactQuery(), jurisdiction: 'CA' }))
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  });

  it('maps missing-current semantics to HTTP 404 without weakening the authority error', async () => {
    const { authority } = await currentAuthority();
    const route = createUsTrademarkMarkRepresentationMethodRoutesV1({
      internalServiceSecret: SECRET,
      methods: authority
    })[0]!;

    await expect(
      route.handle(request(exactQuery('2026-09-06T15:26:00.000Z')))
    ).rejects.toMatchObject({ status: 404, code: 'NO_CURRENT_METHOD', retryable: false });
  });
});
