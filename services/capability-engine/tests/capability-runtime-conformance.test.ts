import { vi } from 'vitest';
import type { RuntimeCapabilityDefinition } from '@markorbit/contracts/capability-learning';
import type { ImplementationProfile } from '@markorbit/contracts/capability-runtime';
import {
  GovernedCapabilityRuntime,
  type CapabilityRuntimeIdFactory
} from '../src/capability-runtime.js';
import {
  registerCapabilityRuntimeConformanceSuite,
  type CapabilityRuntimeConformanceAdapter,
  type CapabilityRuntimeConformanceMode
} from './capability-runtime-conformance-harness.js';

const definition: RuntimeCapabilityDefinition = {
  schemaVersion: 1,
  runtimeCapabilityDefinitionId: 'runtime-capability_conformance',
  version: 7,
  capabilityId: 'conformance-capability',
  capabilityVersion: '1.0.0',
  title: 'Conformance Capability',
  description: 'Deterministic test-only Capability used by the reusable conformance harness.',
  lineage: { capabilityId: 'conformance-capability' },
  canonReference: {
    canonId: 'capability-conformance',
    canonVersion: '1',
    sourceFingerprintSha256: 'c'.repeat(64)
  },
  acceptedCanonProjection: true,
  createdFromWorkEvidence: false,
  createdFromAiOutput: false,
  createdAt: '2026-08-25T17:00:00.000Z'
};

const baseProfile: ImplementationProfile = {
  schemaVersion: 1,
  implementationProfileId: 'implementation-profile_conformance',
  version: 3,
  capabilityId: 'conformance-capability',
  capabilityVersion: '1.0.0',
  kind: 'DETERMINISTIC_SERVICE',
  status: 'APPROVED',
  implementationKey: 'capability-engine:test:conformance',
  inputSchemaId: 'conformance-input.v1',
  outputSchemaId: 'conformance-output.v1',
  allowedCallerProducts: ['KNOWLEDGE'],
  maximumRiskClass: 'MODERATE',
  timeoutMs: 1000,
  maxAttempts: 1,
  approvalPolicyVersion: 'capability-conformance-policy.v1',
  createdAt: '2026-08-25T17:00:00.000Z'
};

function ids(): CapabilityRuntimeIdFactory {
  return {
    capabilityRequest: () => 'capreq_conformance',
    implementationBinding: () => 'implementation-binding_conformance',
    capabilityInvocation: () => 'capability-invocation_conformance',
    capabilityOutcome: () => 'capability-outcome_conformance',
    capabilityReturn: () => 'capability-return_conformance',
    sessionReceipt: () => 'session-receipt_conformance'
  };
}

function profileFor(mode: CapabilityRuntimeConformanceMode): ImplementationProfile {
  switch (mode) {
    case 'CALLER_FORBIDDEN':
      return { ...baseProfile, allowedCallerProducts: ['BRAIN'] };
    case 'RISK_FORBIDDEN':
      return { ...baseProfile, maximumRiskClass: 'LOW' };
    case 'SCHEMA_MISMATCH':
      return { ...baseProfile, outputSchemaId: 'different-output.v1' };
    default:
      return { ...baseProfile };
  }
}

const adapter: CapabilityRuntimeConformanceAdapter = {
  command: (overrides = {}) => ({
    schemaVersion: 2,
    capabilityId: 'conformance-capability',
    capabilityVersion: overrides.capabilityVersion ?? '1.0.0',
    caller: {
      workspaceId: 'workspace_conformance',
      principalId: 'principal_conformance',
      callerProduct: 'KNOWLEDGE',
      permissionContextRef: 'permission_context_conformance'
    },
    purpose: 'Prove reusable Capability runtime conformance.',
    input: overrides.input ?? { question: 'What changed?' },
    inputSchemaId: 'conformance-input.v1',
    outputSchemaId: 'conformance-output.v1',
    riskClass: 'MODERATE',
    idempotencyKey: 'conformance-idempotency-key',
    correlationId: 'correlation_conformance'
  }),
  create: (mode = 'DEFAULT') => {
    const execute = vi.fn(() => {
      if (mode === 'EXECUTOR_FAILURE') {
        return Promise.reject(new Error('Deterministic conformance implementation failure.'));
      }
      return Promise.resolve({
        output: { answer: 'conformant deterministic output' },
        evidenceRefs: ['evidence_conformance_1'],
        usage: { latencyMs: 8 }
      });
    });
    const runtime = new GovernedCapabilityRuntime({
      definitions: { findCurrent: () => Promise.resolve(definition) },
      implementations: {
        select: () =>
          Promise.resolve({
            profile: profileFor(mode),
            policyVersion: 'capability-conformance-policy.v1'
          })
      },
      inputContracts: { validate: () => true },
      outputContracts: { validate: () => mode !== 'INVALID_OUTPUT' },
      executor: { execute },
      now: () => '2026-08-25T17:01:00.000Z',
      ids: ids()
    });
    return {
      invoke: (command: unknown) => runtime.invoke(command),
      executionCount: () => execute.mock.calls.length
    };
  }
};

registerCapabilityRuntimeConformanceSuite(
  'Capability runtime reusable conformance and reliability suite',
  adapter
);
