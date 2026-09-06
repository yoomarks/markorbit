import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AllocationProviderAcceptanceService,
  type ProviderAcceptanceRecord
} from '../src/allocation-provider-acceptance.js';
import { ProviderReturnError, ProviderReturnService, type ProviderReturnRecord } from '../src/provider-return.js';
import {
  ObservedAllocationProviderAcceptanceService,
  ObservedProviderReturnService
} from '../src/provider-workflow-observability.js';
import { InMemoryMgsnSemanticTelemetrySinkV1 } from '../src/semantic-observability.js';

afterEach(() => vi.restoreAllMocks());

function observedAcceptance(sink: InMemoryMgsnSemanticTelemetrySinkV1) {
  return new ObservedAllocationProviderAcceptanceService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    sink
  );
}

function observedReturn(sink: InMemoryMgsnSemanticTelemetrySinkV1) {
  return new ObservedProviderReturnService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    sink
  );
}

describe('MGSN Provider workflow semantic observability', () => {
  it('records ACCEPTED and DECLINED without turning either result into Provider quality', async () => {
    const sink = new InMemoryMgsnSemanticTelemetrySinkV1();
    vi.spyOn(AllocationProviderAcceptanceService.prototype, 'respondToAllocation')
      .mockResolvedValueOnce({ decision: 'ACCEPTED' } as ProviderAcceptanceRecord)
      .mockResolvedValueOnce({ decision: 'DECLINED' } as ProviderAcceptanceRecord);
    const service = observedAcceptance(sink);

    await service.respondToAllocation({} as never);
    await service.respondToAllocation({} as never);

    expect(sink.list().map((event) => [event.operation, event.resultCode])).toEqual([
      ['PROVIDER_ALLOCATION_RESPOND', 'ACCEPTED'],
      ['PROVIDER_ALLOCATION_RESPOND', 'DECLINED']
    ]);
    for (const event of sink.list()) {
      expect(event.eventType).toBe('MGSN_PROVIDER_WORKFLOW_OPERATION');
      expect(event.authority.providerTrustEvidenceCreated).toBe(false);
      expect(event.authority.providerRankingAuthorityGranted).toBe(false);
      expect(event.authority.providerQualityInferenceCreated).toBe(false);
    }
  });

  it('distinguishes initial Provider Return submission from a correction using version only', async () => {
    const sink = new InMemoryMgsnSemanticTelemetrySinkV1();
    vi.spyOn(ProviderReturnService.prototype, 'createProviderReturn')
      .mockResolvedValueOnce({ version: 1 } as ProviderReturnRecord)
      .mockResolvedValueOnce({ version: 2 } as ProviderReturnRecord);
    const service = observedReturn(sink);

    await service.createProviderReturn({} as never);
    await service.createProviderReturn({} as never);

    expect(sink.list().map((event) => event.resultCode)).toEqual([
      'RETURN_SUBMITTED',
      'RETURN_CORRECTED'
    ]);
  });

  it('records evidence handoff completion without retaining evidence or creating Filing truth', async () => {
    const sink = new InMemoryMgsnSemanticTelemetrySinkV1();
    vi.spyOn(ProviderReturnService.prototype, 'handoffProviderReturnEvidence').mockResolvedValue({
      evidenceHandoffId: 'evidence-handoff_observed',
      workspaceId: 'private-workspace',
      providerReturn: { id: 'provider-return_observed', version: 1 },
      providerReturnFingerprintSha256: 'a'.repeat(64),
      executionRelease: { id: 'execution-release_observed', version: 1 },
      filingExecutionTaskDraft: { id: 'filing-execution-task-draft_observed', version: 1 }
    } as never);
    const service = observedReturn(sink);

    await service.handoffProviderReturnEvidence({} as never);

    const [event] = sink.list();
    expect(event).toMatchObject({
      eventType: 'MGSN_PROVIDER_WORKFLOW_OPERATION',
      operation: 'PROVIDER_RETURN_HANDOFF',
      outcomeClass: 'SUCCESS',
      resultCode: 'EVIDENCE_HANDOFF_COMPLETED',
      sensitiveContentRetained: false,
      errorMessageRetained: false,
      rawPayloadRetained: false
    });
    expect(event?.authority.filingSubmitted).toBe(false);
    expect(JSON.stringify(event)).not.toContain('private-workspace');
    expect(JSON.stringify(event)).not.toContain('provider-return_observed');
  });

  it('classifies superseded Return failures as bounded conflicts and preserves the original error', async () => {
    const sink = new InMemoryMgsnSemanticTelemetrySinkV1();
    const error = new ProviderReturnError('RETURN_SUPERSEDED', 'private error message', 409);
    vi.spyOn(ProviderReturnService.prototype, 'createProviderReturn').mockRejectedValue(error);
    const service = observedReturn(sink);

    await expect(service.createProviderReturn({} as never)).rejects.toBe(error);

    expect(sink.list()).toHaveLength(1);
    expect(sink.list()[0]).toMatchObject({
      operation: 'PROVIDER_RETURN_CREATE',
      outcomeClass: 'CONFLICT',
      resultCode: 'STALE_OR_VERSION_CONFLICT',
      errorMessageRetained: false
    });
    expect(JSON.stringify(sink.list()[0])).not.toContain('private error message');
  });
});
