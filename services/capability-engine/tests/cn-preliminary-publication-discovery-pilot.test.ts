import { describe, expect, it, vi } from 'vitest';

import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';
import {
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_ORDERING,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_PROJECTION_FIELDS,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
  DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
  type CnPreliminaryPublicationDiscoveryEnvelopeV2
} from '@markorbit/contracts/data-engine-discovery';
import {
  DATA_ENGINE_FACT_AUTHORITY,
  DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
  DATA_ENGINE_SOURCE_OWNER
} from '@markorbit/contracts/data-engine';

import {
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_DEFINITION,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_ID,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_VERSION,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_IMPLEMENTATION_PROFILE,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_INPUT_SCHEMA,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_OUTPUT_SCHEMA,
  CnPreliminaryPublicationDiscoveryCapabilityExecutorV2,
  validateCnPreliminaryPublicationDiscoveryCapabilityInputV2,
  validateCnPreliminaryPublicationDiscoveryCapabilityOutputV2
} from '../src/cn-preliminary-publication-discovery-pilot.js';
import { GovernedCapabilityRuntime } from '../src/capability-runtime.js';

const QUERY_HASH = `sha256:${'a'.repeat(64)}`;

function envelope(
  options: {
    start?: string;
    end?: string;
    pageSize?: number;
    pageNumber?: number;
    emittedCount?: number;
    applicationNumber?: string;
    nextCursor?: string | null;
  } = {}
): CnPreliminaryPublicationDiscoveryEnvelopeV2 {
  const start = options.start ?? '10000000';
  const end = options.end ?? '10001000';
  const pageSize = options.pageSize ?? 25;
  const pageNumber = options.pageNumber ?? 1;
  const emittedCount = options.emittedCount ?? 1;
  const nextCursor = options.nextCursor ?? null;
  const scope = {
    jurisdiction: 'CN' as const,
    application_number: { start_inclusive: start, end_exclusive: end },
    is_deleted: 0 as const,
    prelim_pub_date_not_null: true as const,
    ordering: [...CN_PRELIMINARY_PUBLICATION_DISCOVERY_ORDERING],
    ranking: 'NONE' as const,
    joins: 'NONE' as const,
    read_budget: {
      max_rows_to_read: 250000 as const,
      max_bytes_to_read: 268435456 as const,
      overflow_mode: 'throw' as const
    }
  };
  const limits = { page_size: pageSize, max_pages: 10 as const, max_results: 1000 as const };
  const query = {
    contract_version: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
    stream_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
    source_schema_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID,
    candidate_type: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
    projection_fields: [...CN_PRELIMINARY_PUBLICATION_DISCOVERY_PROJECTION_FIELDS],
    scope,
    limits,
    query_hash: QUERY_HASH
  };
  const snapshot = {
    snapshot_id: 'epoch-v1',
    snapshot_kind: 'CN_QUIESCENT_SERVING_EPOCH' as const,
    watermark: 'epoch-v1',
    source_version: 'M1.7-test'
  };
  const results = [
    {
      candidate_type: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
      case_id: `case-${pageNumber}`,
      application_number: options.applicationNumber ?? '10000001',
      mark_name_raw: 'MARK',
      classes: [9],
      filing_date: '2025-01-01',
      prelim_pub_date: '2026-01-01',
      prelim_pub_issue: '1910',
      source_effective_date: null,
      source_package_id: 'package-1',
      source_row_hash: `row-hash-${pageNumber}`,
      record_hash: `record-hash-${pageNumber}`,
      source_rank: pageNumber
    }
  ];
  const payload = {
    stream_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
    candidate_type: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
    query,
    snapshot,
    results,
    next_cursor: nextCursor,
    provenance: {
      contract_version: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
      query_hash: QUERY_HASH,
      stream_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
      candidate_type: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
      source_schema_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID,
      projection_fields: [...CN_PRELIMINARY_PUBLICATION_DISCOVERY_PROJECTION_FIELDS],
      scope,
      limits,
      snapshot,
      engine_version: 'M1.7-test',
      page_number: pageNumber,
      result_count: 1,
      emitted_count: emittedCount,
      has_more: nextCursor !== null
    },
    bounded_truncation: false,
    read_budget: {
      max_rows_to_read: 250000 as const,
      max_bytes_to_read: 268435456 as const,
      read_overflow_mode: 'throw' as const
    }
  };
  return {
    contract_version: DATA_ENGINE_INTEGRATION_CONTRACT_VERSION,
    engine_version: 'M1.7-test',
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    jurisdiction: 'CN',
    resource_kind: CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    legal_conclusion: false,
    fact_state: 'observed',
    payload
  };
}

function capabilityInput(overrides: Record<string, unknown> = {}) {
  return {
    jurisdiction: 'CN',
    authority: 'CNIPA',
    objectType: 'TRADEMARK_APPLICATION',
    operation: 'DISCOVER_PRELIMINARY_PUBLICATION_FACTS',
    candidateType: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
    applicationNumberStart: '10000000',
    applicationNumberEnd: '10001000',
    pageSize: 25,
    ...overrides
  };
}

function command(overrides: Partial<CapabilityRequestV2Command> = {}): CapabilityRequestV2Command {
  return {
    schemaVersion: 2,
    capabilityId: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_ID,
    capabilityVersion: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_VERSION,
    caller: {
      workspaceId: 'workspace_phase4_discovery',
      principalId: 'principal_phase4_discovery',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_phase4_discovery'
    },
    purpose: 'Read a bounded objective CN preliminary-publication fact page.',
    input: capabilityInput(),
    inputSchemaId: CN_PRELIMINARY_PUBLICATION_DISCOVERY_INPUT_SCHEMA,
    outputSchemaId: CN_PRELIMINARY_PUBLICATION_DISCOVERY_OUTPUT_SCHEMA,
    riskClass: 'LOW',
    idempotencyKey: 'phase4-cn-prelim-discovery-1',
    correlationId: 'correlation_phase4_cn_prelim_discovery',
    ...overrides
  };
}

function runtime(discover: ReturnType<typeof vi.fn>) {
  const executor = new CnPreliminaryPublicationDiscoveryCapabilityExecutorV2({ discover });
  return new GovernedCapabilityRuntime({
    definitions: {
      findCurrent: (capabilityId) =>
        Promise.resolve(
          capabilityId === CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_ID
            ? CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_DEFINITION
            : undefined
        )
    },
    implementations: {
      select: (request) =>
        Promise.resolve(
          request.capabilityId === CN_PRELIMINARY_PUBLICATION_DISCOVERY_CAPABILITY_ID
            ? {
                profile: CN_PRELIMINARY_PUBLICATION_DISCOVERY_IMPLEMENTATION_PROFILE,
                policyVersion: 'phase4-cn-preliminary-publication-discovery-selection.v2'
              }
            : undefined
        )
    },
    inputContracts: {
      validate: (schemaId, value) =>
        schemaId === CN_PRELIMINARY_PUBLICATION_DISCOVERY_INPUT_SCHEMA &&
        validateCnPreliminaryPublicationDiscoveryCapabilityInputV2(value)
    },
    outputContracts: {
      validate: (schemaId, value) =>
        schemaId === CN_PRELIMINARY_PUBLICATION_DISCOVERY_OUTPUT_SCHEMA &&
        validateCnPreliminaryPublicationDiscoveryCapabilityOutputV2(value)
    },
    executor,
    now: () => '2026-08-29T11:30:00.000Z'
  });
}

describe('Phase 4 CN preliminary-publication Discovery Capability', () => {
  it('executes one exact bounded objective fact page through governed Capability', async () => {
    const discover = vi.fn(() => Promise.resolve(envelope()));
    const execution = await runtime(discover).invoke(command());

    expect(execution.returnValue.status).toBe('COMPLETED');
    expect(execution.outcome.status).toBe('SUCCEEDED');
    expect(execution.replayed).toBe(false);
    expect(discover).toHaveBeenCalledWith(
      {
        applicationNumberStart: '10000000',
        applicationNumberEnd: '10001000',
        pageSize: 25
      },
      { correlationId: 'correlation_phase4_cn_prelim_discovery' }
    );
    expect(execution.returnValue.output).toMatchObject({
      kind: CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
      objectiveFactOnly: true,
      rankingApplied: false,
      scoringApplied: false,
      recommendation: false,
      legalConclusion: false,
      brainResearchHotPathUsed: false,
      candidateLifecycleStateCreated: false,
      productBusinessStateMutated: false,
      page: {
        query: { query_hash: QUERY_HASH },
        snapshot: { snapshot_id: 'epoch-v1' }
      }
    });
    expect(execution.receipt.evidenceRefs).toContain(`data-engine-query-sha256:${QUERY_HASH}`);
    expect(execution.receipt.evidenceRefs).toContain('data-engine-snapshot:epoch-v1');
    expect(execution.receipt.evidenceRefs).toContain(
      'capability-runtime:brain-research-hot-path=absent'
    );
    expect(execution.receipt.evidenceRefs).toContain(
      'capability-runtime:product-business-state-write=absent'
    );
  });

  it('replays the exact result without reading Data Engine twice', async () => {
    const discover = vi.fn(() => Promise.resolve(envelope()));
    const governed = runtime(discover);
    const request = command({ idempotencyKey: 'phase4-cn-prelim-replay' });

    const first = await governed.invoke(request);
    const replay = await governed.invoke(request);

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(discover).toHaveBeenCalledTimes(1);
    expect(replay.returnValue).toEqual(first.returnValue);
  });

  it('passes the opaque continuation cursor unchanged and accepts deterministic page 2', async () => {
    const discover = vi.fn((request: { cursor?: string }) => {
      expect(request.cursor).toBe('opaque-page-2');
      return Promise.resolve(
        envelope({ pageNumber: 2, emittedCount: 2, applicationNumber: '10000002' })
      );
    });
    const execution = await runtime(discover).invoke(
      command({
        idempotencyKey: 'phase4-cn-prelim-page-2',
        input: capabilityInput({ cursor: 'opaque-page-2' })
      })
    );

    expect(execution.returnValue.status).toBe('COMPLETED');
    expect(discover).toHaveBeenCalledTimes(1);
    expect(
      (execution.returnValue.output as { page: { provenance: { page_number: number } } }).page
        .provenance.page_number
    ).toBe(2);
  });

  it('fails closed on response scope drift', async () => {
    const discover = vi.fn(() =>
      Promise.resolve(envelope({ end: '10002000', applicationNumber: '10000001' }))
    );
    const execution = await runtime(discover).invoke(
      command({ idempotencyKey: 'phase4-cn-prelim-scope-drift' })
    );

    expect(execution.returnValue.status).toBe('FAILED');
    expect(execution.outcome.error?.message).toContain('response scope does not match');
  });

  it('rejects invalid ranges before invoking Data Engine', async () => {
    const discover = vi.fn(() => Promise.resolve(envelope()));
    const governed = runtime(discover);

    await expect(
      governed.invoke(
        command({
          idempotencyKey: 'phase4-cn-prelim-invalid-range',
          input: capabilityInput({
            applicationNumberStart: '10002000',
            applicationNumberEnd: '10001000'
          })
        })
      )
    ).rejects.toMatchObject({ code: 'INPUT_CONTRACT_INVALID' });
    expect(discover).not.toHaveBeenCalled();
  });
});
