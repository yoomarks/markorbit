import { describe, expect, it } from 'vitest';
import {
  CapabilityRuntimeContractError,
  capabilityRuntimeNoAuthorityConsequences,
  parseCapabilityRequestV2Command
} from '../src/capability-runtime.js';

const validRequest = () => ({
  schemaVersion: 2 as const,
  capabilityId: 'managed-ai-execution',
  capabilityVersion: '1.0.0',
  caller: {
    workspaceId: 'workspace_test',
    principalId: 'principal_test',
    callerProduct: 'KNOWLEDGE',
    permissionContextRef: 'permission_context_test'
  },
  purpose: 'Acquire one governed AI source result.',
  input: { question: 'What changed?' },
  inputSchemaId: 'managed-ai-input.v1',
  outputSchemaId: 'managed-ai-output.v1',
  riskClass: 'MODERATE' as const,
  idempotencyKey: 'knowledge-ai-source-1',
  correlationId: 'correlation_test'
});

describe('MO-CAP-001 runtime contract family', () => {
  it('parses a provider-neutral trusted Capability request', () => {
    const parsed = parseCapabilityRequestV2Command(validRequest());

    expect(parsed.capabilityId).toBe('managed-ai-execution');
    expect(parsed.caller.callerProduct).toBe('KNOWLEDGE');
    expect(parsed.riskClass).toBe('MODERATE');
  });

  it.each(['provider', 'model', 'endpoint', 'credential', 'apiKey', 'retryMode'])(
    'rejects caller-selected implementation field %s',
    (field) => {
      expect(() =>
        parseCapabilityRequestV2Command({
          ...validRequest(),
          [field]: 'caller-controlled-value'
        })
      ).toThrow(CapabilityRuntimeContractError);
    }
  );

  it('rejects provider-specific fields inside the trusted caller context', () => {
    expect(() =>
      parseCapabilityRequestV2Command({
        ...validRequest(),
        caller: { ...validRequest().caller, provider: 'openai' }
      })
    ).toThrow(CapabilityRuntimeContractError);
  });

  it('freezes runtime returns as non-authoritative by default', () => {
    expect(Object.values(capabilityRuntimeNoAuthorityConsequences)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false
    ]);
  });
});
