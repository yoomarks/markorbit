import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';
import {
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_ORDERING,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_PROJECTION_FIELDS,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID,
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
  CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_CONTRACT_VERSION,
  CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_KIND,
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
  adaptCnPreliminaryPublicationSourceReadReceiptV3,
  validateCnPreliminaryPublicationDiscoveryCapabilityInputV2,
  validateCnPreliminaryPublicationDiscoveryCapabilityOutputV2
} from '../src/cn-preliminary-publication-discovery-pilot.js';
import { GovernedCapabilityRuntime } from '../src/capability-runtime.js';

const QUERY_HASH = `sha256:${'a'.repeat(64)}`;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(canonicalize(value)), 'utf8')
    .digest('hex')}`;
}

function unavailableSourceReadReceipt() {
  const query = {
    contract_version: DATA_ENGINE_DISCOVERY_CONTRACT_VERSION,
    stream_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_STREAM_ID,
    source_schema_id: CN_PRELIMINARY_PUBLICATION_DISCOVERY_SOURCE_SCHEMA_ID,
    candidate_type: CN_PRELIMINARY_PUBLICATION_DISCOVERY_CANDIDATE_TYPE,
    projection_fields: [...CN_PRELIMINARY_PUBLICATION_DISCOVERY_PROJECTION_FIELDS],
    scope: {
      jurisdiction: 'CN',
      application_number: { start_inclusive: '10000000', end_exclusive: '10001000' },
      is_deleted: 0,
      prelim_pub_date_not_null: true,
      ordering: [...CN_PRELIMINARY_PUBLICATION_DISCOVERY_ORDERING],
      ranking: 'NONE',
      joins: 'NONE',
      read_budget: {
        max_rows_to_read: 250000,
        max_bytes_to_read: 268435456,
        overflow_mode: 'throw'
      }
    },
    limits: { page_size: 25, max_pages: 10, max_results: 1000 }
  };
  const queryFingerprint = fingerprint(query);
  const material = {
    contract_version: CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_CONTRACT_VERSION,
    receipt_kind: CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_KIND,
    receipt_id: 'source-read:unavailable:test',
    source_owner: DATA_ENGINE_SOURCE_OWNER,
    authority: DATA_ENGINE_FACT_AUTHORITY,
    jurisdiction: 'CN',
    resource_kind: CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND,
    state: 'UNAVAILABLE',
    scope_id: `${CN_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_KIND}:${queryFingerprint}`,
    issued_at: '2026-10-10T08:03:00.000Z',
    read_started_at: '2026-10-10T08:00:00.000Z',
    read_ended_at: '2026-10-10T08:02:00.000Z',
    read_completed_at: null,
    query,
    query_fingerprint_sha256: queryFingerprint,
    snapshot: null,
    producer_implementation: {
      package_id: 'markorbit-data-engine',
      package_version: '3.0.0-test',
      package_fingerprint_sha256: fingerprint({ implementation: 3 }),
      build_id: 'git:0123456789abcdef'
    },
    source_corpus: null,
    coverage_evidence: null,
    data_trust: null,
    scan: null,
    result_set: {
      result_count: 0,
      result_references: [],
      result_fingerprint_sha256: fingerprint([])
    },
    reason_codes: ['SOURCE_READ_TIMEOUT'],
    retryable: true,
    silence_semantics: null,
    legal_conclusion: false,
    authority_consequences: {
      rulePackAdmitted: false,
      sourceUsePromoted: false,
      methodActivated: false,
      capabilityVerified: false,
      projectionPersistenceAuthorized: false,
      productBusinessStateCreated: false,
      officialTruthCreated: false,
      legalDeadlineCertified: false,
      executionAuthorized: false,
      lifecyclePositionInferred: false,
      recommendationAuthorized: false
    }
  };
  return { ...material, receipt_fingerprint_sha256: fingerprint(material) };
}

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

describe('CN preliminary-publication source-read receipt V3 Capability adapter', () => {
  it('binds one typed owner receipt to the exact request without granting authority', () => {
    const receipt = unavailableSourceReadReceipt();
    const adapted = adaptCnPreliminaryPublicationSourceReadReceiptV3(receipt, capabilityInput());

    expect(adapted.state).toBe('UNAVAILABLE');
    expect(adapted.receiptReference).toMatchObject({
      receipt_id: 'source-read:unavailable:test',
      state: 'UNAVAILABLE',
      snapshot_id: null,
      source_version: null,
      receipt_fingerprint_sha256: receipt.receipt_fingerprint_sha256
    });
    expect(Object.values(adapted.authorityConsequences)).toEqual(Array(11).fill(false));
  });

  it('fails closed on exact range, page-size or caller-cursor drift', () => {
    const receipt = unavailableSourceReadReceipt();

    expect(() =>
      adaptCnPreliminaryPublicationSourceReadReceiptV3(
        receipt,
        capabilityInput({ applicationNumberEnd: '10002000' })
      )
    ).toThrow('does not match the requested exact range and page size');
    expect(() =>
      adaptCnPreliminaryPublicationSourceReadReceiptV3(receipt, capabilityInput({ pageSize: 50 }))
    ).toThrow('does not match the requested exact range and page size');
    expect(() =>
      adaptCnPreliminaryPublicationSourceReadReceiptV3(
        receipt,
        capabilityInput({ cursor: 'opaque-page-2' })
      )
    ).toThrow('requires a whole exact-scope request without a caller cursor');
  });

  it('cannot synthesize a V3 receipt from a V2 page or transport diagnostic', () => {
    const emptyV2 = envelope();
    emptyV2.payload.results = [];
    emptyV2.payload.provenance.result_count = 0;
    emptyV2.payload.provenance.emitted_count = 0;

    expect(() =>
      adaptCnPreliminaryPublicationSourceReadReceiptV3(emptyV2, capabilityInput())
    ).toThrow('not a valid owner-issued receipt shape');
    expect(() =>
      adaptCnPreliminaryPublicationSourceReadReceiptV3(
        { code: 'NETWORK_TIMEOUT', retryable: true },
        capabilityInput()
      )
    ).toThrow('not a valid owner-issued receipt shape');
  });
});
