import { describe, expect, it } from 'vitest';
import { parseExternalCapabilityExposurePolicyV1 } from '../src/external-capability-exposure.js';

const ref = (owner: string, id: string) => ({ owner, id, version: '1.0.0' });
const policy = {
  schemaVersion: 1,
  policyId: 'external-capability-exposure-policy_trademark-prepare',
  version: '1.0.0',
  status: 'AVAILABLE',
  capabilityRef: { capabilityId: 'trademark.application.prepare', capabilityVersion: '1.0.0' },
  subjectBinding: {
    workspaceRequired: true,
    principalRequired: true,
    currentPermissionContextRequired: true,
    currentEntitlementContextRequired: true
  },
  discoveryPolicyRef: ref('CAPABILITY', 'external-discovery-policy'),
  authenticationPolicyRef: ref('CORE', 'workspace-principal-authentication'),
  auditPolicyRef: ref('EVIDENCE', 'external-capability-audit'),
  ratePolicyRef: ref('CAPABILITY', 'external-usage-limit'),
  operations: [
    {
      operation: 'READ',
      riskClass: 'LOW',
      permissionRequirementRef: ref('CORE', 'trademark-read'),
      evidenceRequirementRefs: [ref('EVIDENCE', 'read-audit')]
    },
    {
      operation: 'PREPARE',
      riskClass: 'HIGH',
      permissionRequirementRef: ref('CORE', 'trademark-prepare'),
      evidenceRequirementRefs: [ref('EVIDENCE', 'preparation-lineage')]
    },
    {
      operation: 'EXECUTE',
      riskClass: 'PROTECTED',
      permissionRequirementRef: ref('CORE', 'trademark-execute'),
      evidenceRequirementRefs: [ref('EVIDENCE', 'protected-action-audit')],
      protectedActionPolicyRef: ref('GOVERNANCE', 'trademark-protected-action'),
      executionContractRef: ref('EXECUTION', 'trademark-execution')
    }
  ],
  authority: {
    permissionGranted: false,
    preparationAcceptedAsTruth: false,
    protectedActionAuthorized: false,
    executionStarted: false,
    externalBillingCreated: false
  }
} as const;

describe('external capability exposure policy', () => {
  it('maps presentation operations to existing permission and execution owners', () => {
    const parsed = parseExternalCapabilityExposurePolicyV1(policy);
    expect(parsed.operations[2]?.protectedActionPolicyRef?.owner).toBe('GOVERNANCE');
    expect(parsed.operations[2]?.executionContractRef?.owner).toBe('EXECUTION');
  });
  it('keeps NOT_EXPOSED explicit and fail closed', () => {
    expect(
      parseExternalCapabilityExposurePolicyV1({ ...policy, status: 'NOT_EXPOSED', operations: [] })
        .status
    ).toBe('NOT_EXPOSED');
    expect(() =>
      parseExternalCapabilityExposurePolicyV1({ ...policy, status: 'NOT_EXPOSED' })
    ).toThrow('cannot expose operations');
  });
  it('requires EXECUTE to use existing protected-action and execution mappings', () => {
    const execute = { ...policy.operations[2], executionContractRef: undefined };
    expect(() =>
      parseExternalCapabilityExposurePolicyV1({ ...policy, operations: [execute] })
    ).toThrow('EXECUTE must map to PROTECTED');
  });
  it('never treats exposure metadata as permission, truth, execution, or billing authority', () => {
    expect(() =>
      parseExternalCapabilityExposurePolicyV1({
        ...policy,
        authority: { ...policy.authority, protectedActionAuthorized: true }
      })
    ).toThrow('authority claims must all be false');
  });
  it('rejects endpoints, provider routing, tokens, and billing fields', () => {
    expect(() =>
      parseExternalCapabilityExposurePolicyV1({ ...policy, endpoint: '/public/execute' })
    ).toThrow('unsupported fields');
  });
});
