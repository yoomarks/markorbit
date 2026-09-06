import { describe, expect, it } from 'vitest';
import {
  InMemoryMgsnSemanticTelemetrySinkV1,
  JsonLineMgsnSemanticTelemetrySinkV1,
  classifyMgsnSemanticFailure,
  createMgsnSemanticTelemetryEventV1,
  observeMgsnSemanticOperationV1,
  recordMgsnSemanticTelemetryBestEffort,
  type MgsnSemanticTelemetrySinkV1
} from '../src/semantic-observability.js';

const baseEvent = {
  operation: 'GOVERNED_ALLOCATION_COMMIT' as const,
  outcomeClass: 'SUCCESS' as const,
  resultCode: 'ALLOCATED' as const,
  latencyMs: 12,
  recordedAt: '2026-09-07T00:00:00.000Z'
};

describe('MGSN semantic observability', () => {
  it('freezes a privacy-minimized non-authoritative telemetry envelope', () => {
    const event = createMgsnSemanticTelemetryEventV1(baseEvent);
    expect(event).toMatchObject({
      schemaVersion: 1,
      eventType: 'MGSN_GOVERNED_NETWORK_OPERATION',
      operation: 'GOVERNED_ALLOCATION_COMMIT',
      outcomeClass: 'SUCCESS',
      resultCode: 'ALLOCATED',
      sensitiveContentRetained: false,
      errorMessageRetained: false,
      rawPayloadRetained: false
    });
    expect(Object.values(event.authority)).toEqual(expect.arrayContaining([false]));
    expect(Object.values(event.authority).every((value) => value === false)).toBe(true);
    const serialized = JSON.stringify(event);
    for (const forbidden of [
      'workspaceId',
      'providerId',
      'endClient',
      'applicant',
      'trademark',
      'matter',
      'evidenceArtifact',
      'bearer',
      'margin',
      'paymentAmount'
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('classifies bounded conflict, unavailability, denial and internal failure classes', () => {
    expect(classifyMgsnSemanticFailure({ code: 'IDEMPOTENCY_CONFLICT', status: 409 })).toEqual({
      outcomeClass: 'CONFLICT',
      resultCode: 'IDEMPOTENCY_CONFLICT'
    });
    expect(classifyMgsnSemanticFailure({ code: 'RETURN_SUPERSEDED', status: 409 })).toEqual({
      outcomeClass: 'CONFLICT',
      resultCode: 'STALE_OR_VERSION_CONFLICT'
    });
    expect(classifyMgsnSemanticFailure({ code: 'VERSION_CONFLICT', status: 409 })).toEqual({
      outcomeClass: 'CONFLICT',
      resultCode: 'STALE_OR_VERSION_CONFLICT'
    });
    expect(classifyMgsnSemanticFailure({ code: 'AUTHORITY_UNAVAILABLE', status: 503 })).toEqual({
      outcomeClass: 'UNAVAILABLE',
      resultCode: 'AUTHORITY_UNAVAILABLE'
    });
    expect(classifyMgsnSemanticFailure({ code: 'DEPENDENCY_DOWN', status: 503 })).toEqual({
      outcomeClass: 'UNAVAILABLE',
      resultCode: 'DEPENDENCY_UNAVAILABLE'
    });
    expect(classifyMgsnSemanticFailure({ code: 'PROVIDER_SUSPENDED', status: 409 })).toEqual({
      outcomeClass: 'DENIED',
      resultCode: 'CURRENT_AUTHORITY_DENIED'
    });
    expect(classifyMgsnSemanticFailure({ code: 'OTHER_CONFLICT', status: 409 })).toEqual({
      outcomeClass: 'CONFLICT',
      resultCode: 'OPERATION_CONFLICT'
    });
    expect(classifyMgsnSemanticFailure(new Error('private detail'))).toEqual({
      outcomeClass: 'ERROR',
      resultCode: 'INTERNAL_ERROR'
    });
  });

  it('never lets a telemetry sink failure alter a successful governed result', async () => {
    const failingSink: MgsnSemanticTelemetrySinkV1 = {
      record: () => Promise.reject(new Error('telemetry unavailable'))
    };
    const result = await observeMgsnSemanticOperationV1(
      failingSink,
      'GOVERNED_ALLOCATION_COMMIT',
      () => Promise.resolve({ allocationId: 'not-recorded' }),
      () => ({ outcomeClass: 'SUCCESS', resultCode: 'ALLOCATED' })
    );
    expect(result).toEqual({ allocationId: 'not-recorded' });
  });

  it('records bounded failure metadata and rethrows the original governed error unchanged', async () => {
    const sink = new InMemoryMgsnSemanticTelemetrySinkV1();
    const governedError = Object.assign(new Error('must never be retained'), {
      code: 'IDEMPOTENCY_CONFLICT',
      status: 409
    });
    await expect(
      observeMgsnSemanticOperationV1(
        sink,
        'PROVIDER_SELECTION_CREATE_OR_REPLACE',
        () => Promise.reject(governedError),
        () => ({ outcomeClass: 'SUCCESS', resultCode: 'CREATED' })
      )
    ).rejects.toBe(governedError);
    expect(sink.list()).toHaveLength(1);
    expect(sink.list()[0]).toMatchObject({
      outcomeClass: 'CONFLICT',
      resultCode: 'IDEMPOTENCY_CONFLICT',
      errorMessageRetained: false
    });
    expect(JSON.stringify(sink.list()[0])).not.toContain('must never be retained');
  });

  it('emits only the minimized event through the JSON-line production sink', async () => {
    const lines: string[] = [];
    const sink = new JsonLineMgsnSemanticTelemetrySinkV1((line) => lines.push(line));
    await recordMgsnSemanticTelemetryBestEffort(sink, baseEvent);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      kind: 'mgsn.semantic.v1',
      event: { resultCode: 'ALLOCATED', rawPayloadRetained: false }
    });
  });
});
