import { describe, expect, it, vi } from 'vitest';
import type { CapabilityLedgerEntry, CapabilityObservation } from '@markorbit/contracts';
import type {
  ManagedAiExecutionInputV1,
  ManagedAiExecutionOutcomeV1
} from '@markorbit/contracts/managed-ai-execution';
import {
  InMemoryCapabilityAuditTelemetrySinkV1,
  ObservedManagedAiExecutionAuthorityV1,
  capabilityAuditTelemetryNoAuthority,
  createCapabilityObservationAuditTelemetryV1,
  createManagedAiExecutionAuditTelemetryV1,
  type CapabilityAuditTelemetrySinkV1
} from '../src/capability-audit-telemetry.js';

const input: ManagedAiExecutionInputV1 = {
  schemaVersion: 1,
  processingClass: 'SOURCE_ACQUISITION',
  dataClassification: 'CONFIDENTIAL',
  taskInput: { prompt: 'TOP SECRET CUSTOMER CONTENT' },
  requestedOutput: { schemaId: 'managed-ai-output.v1', format: 'JSON' },
  requirements: {
    capabilities: ['text-generation'],
    exactProviderOutputRequired: true,
    provenanceRequired: true
  },
  promptPolicy: { policyId: 'policy-1', policyVersion: '1' },
  evidence: { exactOutput: 'REQUIRED', providerRequestId: 'REQUIRED_WHEN_AVAILABLE' }
};

const outcome: ManagedAiExecutionOutcomeV1 = {
  schemaVersion: 1,
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  status: 'COMPLETED',
  deliveryState: 'PROVIDER_COMPLETED',
  retryDisposition: 'RETRY_FORBIDDEN',
  provenance: {
    implementationProfileId: 'implementation-profile_test',
    implementationProfileVersion: 3,
    implementationKey: 'ai:test',
    provider: 'DEEPSEEK',
    model: 'deepseek-test',
    promptPolicyId: 'policy-1',
    promptPolicyVersion: '1',
    outputSchemaId: 'managed-ai-output.v1',
    inputSha256: 'a'.repeat(64),
    providerRequestId: 'provider-request-1',
    startedAt: '2026-08-25T17:00:00.000Z',
    completedAt: '2026-08-25T17:00:01.000Z'
  },
  exactOutput: {
    kind: 'INLINE_BASE64',
    mediaType: 'application/json',
    sha256: 'b'.repeat(64),
    sizeBytes: 24,
    dataBase64: 'U0VDUkVUX1BST1ZJREVSX0JZVEVT'
  },
  structuredOutput: { private: 'SECRET STRUCTURED OUTPUT' },
  usage: {
    inputUnits: 20,
    outputUnits: 7,
    latencyMs: 1000,
    costMinor: 3,
    currency: 'USD',
    retryCount: 0,
    fallbackCount: 0
  },
  authority: {
    canonicalTruthCreated: false,
    capabilityCanonMutated: false,
    knowledgeApproved: false,
    brainConclusionCreated: false,
    professionalDecisionCreated: false,
    paymentCreated: false,
    filingSubmitted: false,
    externalMessageSent: false,
    externalProfessionalActionExecuted: false
  }
};

const context = { executionId: 'aiexec_1', correlationId: 'corr_1' };

const observation: CapabilityObservation = {
  schemaVersion: 1,
  capabilityObservationId: 'capability-observation_1',
  workspaceId: 'workspace_1',
  subjectUserId: 'user_1',
  runtimeCapability: { id: 'runtime-capability_1', version: 2 },
  source: {
    owner: 'EXECUTION',
    kind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
    sourceId: 'evidence-review-1',
    sourceVersion: 1,
    sourceFingerprintSha256: 'c'.repeat(64),
    observedAt: '2026-08-25T16:59:00.000Z',
    workspaceId: 'workspace_1',
    subjectUserId: 'user_1',
    correlationId: 'corr_1'
  },
  subjectAttributionAuthority: 'OWNER_SOURCE',
  observationNature: 'PRIVATE_GOVERNED_WORK_OBSERVATION',
  admittedAt: '2026-08-25T17:00:00.000Z',
  authority: {
    canonicalTruth: false,
    capabilityVerified: false,
    publicProfilePublished: false,
    publicScoreCreated: false,
    permissionChanged: false,
    roleChanged: false,
    providerSupplyCapabilityConverted: false,
    rawProviderReturnConverted: false,
    paymentOrInvoiceCreated: false,
    legalAppointmentCreated: false,
    filingSubmitted: false,
    officialTruthCreated: false,
    externalActionExecuted: false
  }
};

const ledgerEntry: CapabilityLedgerEntry = {
  schemaVersion: 1,
  capabilityLedgerEntryId: 'capability-ledger_1',
  workspaceId: 'workspace_1',
  subjectUserId: 'user_1',
  runtimeCapability: { id: 'runtime-capability_1', version: 2 },
  observation: {
    id: 'capability-observation_1',
    sourceOwner: 'EXECUTION',
    sourceKind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
    sourceId: 'evidence-review-1',
    sourceVersion: 1,
    sourceFingerprintSha256: 'c'.repeat(64)
  },
  appendOnly: true,
  private: true,
  recordedAt: '2026-08-25T17:00:00.000Z',
  authority: observation.authority
};

describe('Capability audit telemetry V1', () => {
  it('retains Managed AI provenance, usage and exact evidence metadata without sensitive content', () => {
    const event = createManagedAiExecutionAuditTelemetryV1(
      context,
      outcome,
      '2026-08-25T17:00:02.000Z'
    );

    expect(event).toMatchObject({
      eventType: 'MANAGED_AI_EXECUTION_OUTCOME',
      executionId: 'aiexec_1',
      correlationId: 'corr_1',
      outcome: {
        status: 'COMPLETED',
        deliveryState: 'PROVIDER_COMPLETED',
        retryDisposition: 'RETRY_FORBIDDEN'
      },
      implementation: {
        implementationProfileId: 'implementation-profile_test',
        implementationProfileVersion: 3,
        provider: 'DEEPSEEK',
        model: 'deepseek-test',
        providerRequestId: 'provider-request-1'
      },
      usage: { inputUnits: 20, outputUnits: 7, costMinor: 3, currency: 'USD' },
      exactEvidence: {
        kind: 'INLINE_BASE64',
        sha256: 'b'.repeat(64),
        sizeBytes: 24
      },
      sensitiveContentRetained: false,
      errorMessageRetained: false,
      authority: capabilityAuditTelemetryNoAuthority
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('TOP SECRET CUSTOMER CONTENT');
    expect(serialized).not.toContain('SECRET STRUCTURED OUTPUT');
    expect(serialized).not.toContain('U0VDUkVUX1BST1ZJREVSX0JZVEVT');
    expect(serialized).not.toContain('dataBase64');
    expect(serialized).not.toContain('structuredOutput');
    expect(serialized).not.toContain('taskInput');
  });

  it('correlates existing governed Observation/Ledger identities without promoting raw AI into learning evidence', () => {
    const event = createCapabilityObservationAuditTelemetryV1(observation, ledgerEntry, false);

    expect(event).toEqual({
      schemaVersion: 1,
      eventType: 'CAPABILITY_OBSERVATION_ADMISSION',
      runtimeCapability: { id: 'runtime-capability_1', version: 2 },
      workspaceId: 'workspace_1',
      subjectUserId: 'user_1',
      observationId: 'capability-observation_1',
      ledgerEntryId: 'capability-ledger_1',
      source: {
        owner: 'EXECUTION',
        kind: 'EXECUTION_EVIDENCE_REVIEW_DECISION',
        sourceFingerprintSha256: 'c'.repeat(64)
      },
      replayed: false,
      sensitiveContentRetained: false,
      recordedAt: '2026-08-25T17:00:00.000Z',
      authority: capabilityAuditTelemetryNoAuthority
    });
  });

  it('rejects telemetry correlation when Observation and Ledger identities drift', () => {
    expect(() =>
      createCapabilityObservationAuditTelemetryV1(
        observation,
        { ...ledgerEntry, workspaceId: 'workspace_other' },
        false
      )
    ).toThrow(/exact Observation\/Ledger pairing/u);
  });

  it('records one best-effort event without changing a governed Managed AI result', async () => {
    const sink = new InMemoryCapabilityAuditTelemetrySinkV1();
    const execute = vi.fn(() => Promise.resolve(outcome));
    const observed = new ObservedManagedAiExecutionAuthorityV1(
      { execute },
      sink,
      () => '2026-08-25T17:00:02.000Z'
    );

    const result = await observed.execute(input, context);

    expect(result).toBe(outcome);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(sink.list()).toHaveLength(1);
    expect(sink.list()[0]?.eventType).toBe('MANAGED_AI_EXECUTION_OUTCOME');
  });

  it('never retries or changes the provider result when the telemetry sink fails', async () => {
    const record = vi.fn(() => Promise.reject(new Error('telemetry unavailable')));
    const sink: CapabilityAuditTelemetrySinkV1 = { record };
    const execute = vi.fn(() => Promise.resolve(outcome));
    const observed = new ObservedManagedAiExecutionAuthorityV1({ execute }, sink);

    await expect(observed.execute(input, context)).resolves.toBe(outcome);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('rethrows the exact executor failure after redacted best-effort telemetry without retry', async () => {
    const sink = new InMemoryCapabilityAuditTelemetrySinkV1();
    const failure = new Error('SENSITIVE PROVIDER ERROR MESSAGE');
    const execute = vi.fn(() => Promise.reject(failure));
    const observed = new ObservedManagedAiExecutionAuthorityV1(
      { execute },
      sink,
      () => '2026-08-25T17:00:02.000Z'
    );

    await expect(observed.execute(input, context)).rejects.toBe(failure);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(sink.list()).toHaveLength(1);
    expect(JSON.stringify(sink.list()[0])).not.toContain('SENSITIVE PROVIDER ERROR MESSAGE');
    expect(sink.list()[0]?.eventType).toBe('MANAGED_AI_EXECUTOR_THROWN');
  });

  it('records invalid executor output as audit metadata but preserves the invalid result for the governed route to reject', async () => {
    const sink = new InMemoryCapabilityAuditTelemetrySinkV1();
    const invalid = { raw: 'SECRET INVALID RESULT' };
    const execute = vi.fn(() => Promise.resolve(invalid));
    const observed = new ObservedManagedAiExecutionAuthorityV1({ execute }, sink);

    await expect(observed.execute(input, context)).resolves.toBe(invalid);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(sink.list()[0]?.eventType).toBe('MANAGED_AI_EXECUTOR_INVALID_RESULT');
    expect(JSON.stringify(sink.list()[0])).not.toContain('SECRET INVALID RESULT');
  });
});
