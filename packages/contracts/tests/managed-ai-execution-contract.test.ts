import { describe, expect, it } from 'vitest';
import {
  MANAGED_AI_EXECUTION_CAPABILITY_ID,
  MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  ManagedAiContractError,
  managedAiNoAuthorityConsequences,
  parseManagedAiExecutionInputV1,
  parseManagedAiExecutionOutcomeV1
} from '../src/managed-ai-execution.js';

const validInput = () => ({
  schemaVersion: 1 as const,
  processingClass: 'SOURCE_ACQUISITION' as const,
  dataClassification: 'INTERNAL' as const,
  taskInput: { assignmentId: 'kas_test', prompt: 'Return governed source evidence.' },
  requestedOutput: { schemaId: 'knowledge-ai-source.v1', format: 'MARKDOWN' as const },
  requirements: {
    capabilities: ['TEXT_GENERATION', 'STRUCTURED_OUTPUT'],
    maxLatencyMs: 120_000,
    exactProviderOutputRequired: true,
    provenanceRequired: true
  },
  budget: { maxInputUnits: 20_000, maxOutputUnits: 8_000, maxCostMinor: 500, currency: 'USD' },
  promptPolicy: {
    policyId: 'knowledge-source-acquisition',
    policyVersion: '1',
    templateId: 'knowledge-source-prompt',
    templateVersion: '3'
  },
  evidence: {
    exactOutput: 'REQUIRED' as const,
    providerRequestId: 'REQUIRED_WHEN_AVAILABLE' as const
  }
});

const provenance = () => ({
  implementationProfileId: 'implementation-profile_managed-ai-test',
  implementationProfileVersion: 1,
  implementationKey: 'ai-gateway:test-provider',
  provider: 'TEST_PROVIDER',
  model: 'test-model-v1',
  promptPolicyId: 'knowledge-source-acquisition',
  promptPolicyVersion: '1',
  outputSchemaId: 'knowledge-ai-source.v1',
  inputSha256: 'a'.repeat(64),
  providerRequestId: 'provider_request_test',
  startedAt: '2026-08-25T01:00:00.000Z',
  completedAt: '2026-08-25T01:00:01.000Z'
});

const completedOutcome = () => ({
  schemaVersion: 1 as const,
  capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
  capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
  status: 'COMPLETED' as const,
  deliveryState: 'PROVIDER_COMPLETED' as const,
  retryDisposition: 'RETRY_FORBIDDEN' as const,
  provenance: provenance(),
  exactOutput: {
    kind: 'INLINE_BASE64' as const,
    mediaType: 'application/json',
    sha256: 'b'.repeat(64),
    sizeBytes: 2,
    dataBase64: 'e30='
  },
  structuredOutput: { answer: 'test' },
  usage: { inputUnits: 10, outputUnits: 5, latencyMs: 1000 },
  authority: managedAiNoAuthorityConsequences
});

describe('Managed AI Execution V1 input contract', () => {
  it('accepts a provider-neutral source-acquisition request', () => {
    const parsed = parseManagedAiExecutionInputV1(validInput());

    expect(parsed.processingClass).toBe('SOURCE_ACQUISITION');
    expect(parsed.requirements.exactProviderOutputRequired).toBe(true);
    expect(parsed.promptPolicy.policyVersion).toBe('1');
  });

  it.each(['provider', 'model', 'endpoint', 'credential', 'apiKey', 'retryMode'])(
    'rejects caller implementation-control field %s',
    (field) => {
      expect(() =>
        parseManagedAiExecutionInputV1({ ...validInput(), [field]: 'caller-controlled' })
      ).toThrow(ManagedAiContractError);
    }
  );

  it('requires a currency whenever a cost budget is supplied', () => {
    expect(() =>
      parseManagedAiExecutionInputV1({
        ...validInput(),
        budget: { maxCostMinor: 500 }
      })
    ).toThrow(/currency is required/u);
  });

  it('does not confuse provider-like task data with implementation control', () => {
    const parsed = parseManagedAiExecutionInputV1({
      ...validInput(),
      taskInput: { quotedText: 'The document mentions model and provider as ordinary source data.' }
    });

    expect(parsed.taskInput).toEqual({
      quotedText: 'The document mentions model and provider as ordinary source data.'
    });
  });
});

describe('Managed AI Execution V1 outcome contract', () => {
  it('preserves completed implementation provenance and exact provider bytes', () => {
    const parsed = parseManagedAiExecutionOutcomeV1(completedOutcome());

    expect(parsed.status).toBe('COMPLETED');
    expect(parsed.deliveryState).toBe('PROVIDER_COMPLETED');
    expect(parsed.provenance?.providerRequestId).toBe('provider_request_test');
    expect(parsed.exactOutput).toMatchObject({
      kind: 'INLINE_BASE64',
      sha256: 'b'.repeat(64),
      dataBase64: 'e30='
    });
    expect(Object.values(parsed.authority).every((value) => value === false)).toBe(true);
  });

  it('forces delivery uncertainty to require reconciliation rather than retry', () => {
    const parsed = parseManagedAiExecutionOutcomeV1({
      schemaVersion: 1,
      capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
      capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
      status: 'REQUIRES_RECONCILIATION',
      deliveryState: 'DELIVERY_UNCERTAIN',
      retryDisposition: 'RECONCILIATION_REQUIRED',
      error: { code: 'DELIVERY_UNCERTAIN', message: 'Provider delivery cannot be proven.' },
      authority: managedAiNoAuthorityConsequences
    });

    expect(parsed.retryDisposition).toBe('RECONCILIATION_REQUIRED');
  });

  it('rejects automatic retry for a delivery-uncertain paid side effect', () => {
    expect(() =>
      parseManagedAiExecutionOutcomeV1({
        schemaVersion: 1,
        capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
        capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
        status: 'REQUIRES_RECONCILIATION',
        deliveryState: 'DELIVERY_UNCERTAIN',
        retryDisposition: 'RETRY_ALLOWED',
        error: { code: 'TIMEOUT', message: 'Response timed out after send.' },
        authority: managedAiNoAuthorityConsequences
      })
    ).toThrow(/require reconciliation/u);
  });

  it('requires typed errors for all non-completed outcomes', () => {
    expect(() =>
      parseManagedAiExecutionOutcomeV1({
        schemaVersion: 1,
        capabilityId: MANAGED_AI_EXECUTION_CAPABILITY_ID,
        capabilityVersion: MANAGED_AI_EXECUTION_CONTRACT_VERSION,
        status: 'FAILED',
        deliveryState: 'NOT_DELIVERED',
        retryDisposition: 'RETRY_ALLOWED',
        authority: managedAiNoAuthorityConsequences
      })
    ).toThrow(/typed generic error/u);
  });

  it('rejects any authority promotion in a provider outcome', () => {
    expect(() =>
      parseManagedAiExecutionOutcomeV1({
        ...completedOutcome(),
        authority: { ...managedAiNoAuthorityConsequences, knowledgeApproved: true }
      })
    ).toThrow(/knowledgeApproved must remain false/u);
  });

  it('allows durable exact-output references instead of lossy reserialization', () => {
    const parsed = parseManagedAiExecutionOutcomeV1({
      ...completedOutcome(),
      exactOutput: {
        kind: 'DURABLE_REF',
        mediaType: 'application/json',
        sha256: 'c'.repeat(64),
        sizeBytes: 4096,
        ref: 'artifact://managed-ai/exact/provider-response/receipt_test'
      }
    });

    expect(parsed.exactOutput).toMatchObject({
      kind: 'DURABLE_REF',
      ref: 'artifact://managed-ai/exact/provider-response/receipt_test'
    });
  });

  it('keeps usage fields optional when a provider does not report them', () => {
    const parsed = parseManagedAiExecutionOutcomeV1({
      ...completedOutcome(),
      usage: {}
    });

    expect(parsed.usage).toEqual({});
  });
});
