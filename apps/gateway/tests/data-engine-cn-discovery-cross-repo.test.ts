import { describe, expect, it } from 'vitest';

import {
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID
} from '@markorbit/contracts/data-engine-discovery';
import { DATA_ENGINE_INTEGRATION_CONTRACT_VERSION } from '@markorbit/contracts/data-engine';

import { createCnPreliminaryPublicationDiscoveryClientV2 } from '../src/data-engine-discovery-http.js';
import { createDataEngineClient } from '../src/data-engine-http.js';

const crossRepoDescribe = process.env.MO_DE_DISCOVERY_CROSS_REPO === '1' ? describe : describe.skip;

crossRepoDescribe('Phase 4 CN preliminary-publication Discovery cross-repo acceptance', () => {
  const providerUrl = process.env.MO_DE_DISCOVERY_PROVIDER_URL!;
  const apiKey = process.env.MO_DE_DISCOVERY_API_KEY!;
  const providerSha = process.env.DATA_ENGINE_DISCOVERY_ACCEPTANCE_SHA!;
  const applicationNumberStart = '2026000000';
  const applicationNumberEnd = '2026000010';

  it('proves authenticated page1 -> deterministic replay -> page2 against the exact Data Engine provider', async () => {
    expect(providerUrl).toMatch(/^http:\/\/127\.0\.0\.1:/);
    expect(apiKey.length).toBeGreaterThanOrEqual(32);
    expect(providerSha).toMatch(/^[0-9a-f]{40}$/);

    const transport = createDataEngineClient({
      dataEngineUrl: providerUrl,
      apiKey,
      timeoutMs: 5_000,
      requestIdFactory: () => 'phase4-discovery-generated-request'
    });
    const discovery = createCnPreliminaryPublicationDiscoveryClientV2(transport);

    const page1Request = {
      applicationNumberStart,
      applicationNumberEnd,
      pageSize: 2
    } as const;
    const page1 = await discovery.discover(page1Request, {
      requestId: 'phase4-discovery-page1',
      correlationId: 'phase4-discovery-crossrepo'
    });
    const replay = await discovery.discover(page1Request, {
      requestId: 'phase4-discovery-replay',
      correlationId: 'phase4-discovery-crossrepo'
    });

    expect(page1.contract_version).toBe(DATA_ENGINE_INTEGRATION_CONTRACT_VERSION);
    expect(page1.resource_kind).toBe(CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND);
    expect(page1.payload.stream_id).toBe(CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID);
    expect(page1.payload.results.map((candidate) => candidate.application_number)).toEqual([
      '2026000001',
      '2026000002'
    ]);
    expect(page1.payload.next_cursor).toEqual(expect.any(String));
    expect(page1.payload.query.scope.application_number).toEqual({
      start_inclusive: applicationNumberStart,
      end_exclusive: applicationNumberEnd
    });
    expect(page1.payload.query.scope.ordering).toEqual([
      'application_number ASC',
      'toString(case_id) ASC'
    ]);
    expect(page1.payload.query.scope.ranking).toBe('NONE');
    expect(page1.payload.query.scope.joins).toBe('NONE');
    expect(page1.payload.read_budget).toEqual({
      max_rows_to_read: 250000,
      max_bytes_to_read: 268435456,
      read_overflow_mode: 'throw'
    });
    expect(page1.payload.query.query_hash).toMatch(/^sha256:[0-9a-f]{64}$/);

    expect(replay.payload).toEqual(page1.payload);

    const page2 = await discovery.discover(
      {
        ...page1Request,
        cursor: page1.payload.next_cursor ?? undefined
      },
      {
        requestId: 'phase4-discovery-page2',
        correlationId: 'phase4-discovery-crossrepo'
      }
    );

    expect(page2.payload.results.map((candidate) => candidate.application_number)).toEqual([
      '2026000003'
    ]);
    expect(page2.payload.next_cursor).toBeNull();
    expect(page2.payload.query.query_hash).toBe(page1.payload.query.query_hash);
    expect(page2.payload.snapshot).toEqual(page1.payload.snapshot);
    expect(page2.payload.provenance.query_hash).toBe(page1.payload.provenance.query_hash);
    expect(page2.payload.provenance.snapshot).toEqual(page1.payload.provenance.snapshot);
    expect(page2.payload.provenance.page_number).toBe(2);

    const combined = [...page1.payload.results, ...page2.payload.results];
    expect(combined).toHaveLength(3);
    expect(new Set(combined.map((candidate) => candidate.case_id)).size).toBe(3);
    expect(
      combined.every(
        (candidate) =>
          candidate.application_number >= applicationNumberStart &&
          candidate.application_number < applicationNumberEnd
      )
    ).toBe(true);

    console.log(
      'PHASE4_CN_DISCOVERY_CROSS_REPO_PASS',
      JSON.stringify({
        providerSha,
        integrationContract: page1.contract_version,
        resourceKind: page1.resource_kind,
        streamId: page1.payload.stream_id,
        bounds: { applicationNumberStart, applicationNumberEnd },
        pageSize: page1Request.pageSize,
        page1Count: page1.payload.results.length,
        page2Count: page2.payload.results.length,
        queryHash: page1.payload.query.query_hash,
        snapshotId: page1.payload.snapshot.snapshot_id,
        replayExact: true,
        continuationExact: true
      })
    );
  });
});
