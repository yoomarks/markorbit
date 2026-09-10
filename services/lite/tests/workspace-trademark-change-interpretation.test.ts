import {
  capabilityRuntimeNoAuthorityConsequences,
  type ImplementationBinding,
  type SessionReceipt
} from '@markorbit/contracts/capability-runtime';
import {
  managedAiNoAuthorityConsequences,
  type ManagedAiExecutionOutcomeV1
} from '@markorbit/contracts/managed-ai-execution';
import type { TrademarkAssetManagementSignal } from '@markorbit/contracts/trademark-asset-management';
import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_TRADEMARK_CHANGE_INTERPRETATION_OUTCOME_V1,
  prepareWorkspaceTrademarkChangeInterpretationV1,
  workspaceTrademarkChangeInterpretationAuthority,
  type WorkspaceTrademarkChangeManagedAiEvidenceV1
} from '../src/workspace-trademark-change-interpretation.js';

const WORKSPACE_A = '11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = '22222222-2222-4222-8222-222222222222';
const INTERPRETED_AT = '2026-09-09T15:45:00.000Z';
const EXACT_SOURCE = {
  owner: 'MARKREG',
  kind: 'MARKREG_LIFECYCLE_PROJECTION',
  sourceId: 'lifecycle_exact_change_1092',
  sourceVersion: '17',
  observedAt: '2026-09-09T15:40:00.000Z',
  freshness: 'CURRENT'
} as const;

function signal(
  workspaceId: string,
  id: string,
  options: {
    dimension?: TrademarkAssetManagementSignal['dimension'];
    freshness?: TrademarkAssetManagementSignal['freshness'];
  } = {}
): TrademarkAssetManagementSignal {
  const freshness = options.freshness ?? 'CURRENT';
  return {
    schemaVersion: 1,
    managementSignalId: `trademark-asset-management-signal_${id}`,
    workspaceId,
    version: 7,
    asset: { id: `trademark-asset_${id}`, version: 7 },
    dimension: options.dimension ?? 'LIFECYCLE_RELEVANCE',
    severity: 'IMPORTANT',
    reason: 'Exact owner-domain lifecycle change requires management review.',
    changes: [
      {
        kind: 'OWNER_LIFECYCLE_CHANGED',
        sourceReferences: [{ ...EXACT_SOURCE, freshness }],
        previousSourceVersion: '16',
        currentSourceVersion: '17',
        observedAt: EXACT_SOURCE.observedAt,
        freshness
      }
    ],
    evidence: [{ ...EXACT_SOURCE, freshness }],
    freshness,
    generatedAt: '2026-09-09T15:41:00.000Z',
    legalDeadlineCertified: false,
    officialStatusVerifiedByLite: false,
    legalConclusionVerified: false,
    conflictResolvedByLite: false,
    executionAuthorized: false
  };
}

function binding(
  label: string,
  implementationKey: string,
  selectionPolicyVersion: string
): ImplementationBinding {
  return {
    schemaVersion: 1,
    implementationBindingId: `implementation-binding_${label}`,
    capabilityRequestId: `capreq_${label}`,
    runtimeCapability: {
      id: 'runtime-capability_managed-ai-execution',
      version: 4,
      capabilityId: 'managed-ai-execution',
      capabilityVersion: '1.0.0'
    },
    implementation: {
      id: `implementation-profile_${label}`,
      version: 3,
      implementationKey,
      kind: 'AI_ASSISTED_SERVICE'
    },
    selectionPolicyVersion,
    boundAt: '2026-09-09T15:42:00.000Z'
  };
}

function receipt(workspaceId: string, runtimeBinding: ImplementationBinding): SessionReceipt {
  return {
    schemaVersion: 1,
    sessionReceiptId: `session-receipt_${workspaceId}`,
    capabilityRequestId: runtimeBinding.capabilityRequestId,
    correlationId: `correlation_${workspaceId}`,
    workspaceId,
    principalId: `principal_${workspaceId}`,
    callerProduct: 'LITE',
    runtimeCapability: { ...runtimeBinding.runtimeCapability },
    implementation: {
      id: runtimeBinding.implementation.id,
      version: runtimeBinding.implementation.version,
      implementationKey: runtimeBinding.implementation.implementationKey
    },
    capabilityInvocationId: `capability-invocation_${workspaceId}`,
    capabilityOutcomeId: `capability-outcome_${workspaceId}`,
    capabilityReturnId: `capability-return_${workspaceId}`,
    evidenceRefs: ['trademark-change-evidence:1092'],
    createdAt: '2026-09-09T15:43:00.000Z',
    authority: capabilityRuntimeNoAuthorityConsequences
  };
}

function outcome(
  runtimeBinding: ImplementationBinding,
  summary: string,
  reviewFocus: string,
  structuredOutput: unknown = { summary, reviewFocus }
): ManagedAiExecutionOutcomeV1 {
  const workspaceLocal = runtimeBinding.selectionPolicyVersion.startsWith(
    'workspace-implementation-preference.'
  );
  return {
    schemaVersion: 1,
    capabilityId: 'managed-ai-execution',
    capabilityVersion: '1.0.0',
    status: 'COMPLETED',
    deliveryState: 'PROVIDER_COMPLETED',
    retryDisposition: 'RETRY_FORBIDDEN',
    provenance: {
      implementationProfileId: runtimeBinding.implementation.id,
      implementationProfileVersion: runtimeBinding.implementation.version,
      implementationKey: runtimeBinding.implementation.implementationKey,
      provider: workspaceLocal ? 'WORKSPACE_APPROVED_AI' : 'MO_MANAGED_AI',
      model: workspaceLocal ? 'workspace-approved-model' : 'mo-base-model',
      promptPolicyId: 'trademark-change-interpretation',
      promptPolicyVersion: '1.0.0',
      outputSchemaId: WORKSPACE_TRADEMARK_CHANGE_INTERPRETATION_OUTCOME_V1,
      inputSha256: 'a'.repeat(64),
      startedAt: '2026-09-09T15:42:30.000Z',
      completedAt: '2026-09-09T15:42:31.000Z'
    },
    structuredOutput,
    authority: managedAiNoAuthorityConsequences
  };
}

function managedAi(
  workspaceId: string,
  label: string,
  implementationKey: string,
  selectionPolicyVersion: string,
  summary: string,
  reviewFocus: string
): WorkspaceTrademarkChangeManagedAiEvidenceV1 {
  const runtimeBinding = binding(label, implementationKey, selectionPolicyVersion);
  return {
    binding: runtimeBinding,
    receipt: receipt(workspaceId, runtimeBinding),
    outcome: outcome(runtimeBinding, summary, reviewFocus)
  };
}

describe('Workspace Trademark Change Interpretation V1', () => {
  it('keeps one stable outcome while Workspace A and B use governed different interpretation', () => {
    const workspaceA = prepareWorkspaceTrademarkChangeInterpretationV1({
      signal: signal(WORKSPACE_A, 'workspace_a'),
      managedAi: managedAi(
        WORKSPACE_A,
        'workspace-a',
        'ai:mo-base:chat-completions:v1',
        'capability-managed-ai-selection.v1',
        'MO Base sees a current lifecycle change.',
        'Review owner-domain lifecycle evidence before preparing work.'
      ),
      interpretedAt: INTERPRETED_AT
    });
    const workspaceB = prepareWorkspaceTrademarkChangeInterpretationV1({
      signal: signal(WORKSPACE_B, 'workspace_b'),
      managedAi: managedAi(
        WORKSPACE_B,
        'workspace-b',
        'ai:workspace-approved:chat-completions:v1',
        'workspace-implementation-preference.v1:workspace-b',
        'Workspace B interprets the same change through approved local context.',
        'Prioritize the Workspace case playbook before preparing work.'
      ),
      workspaceContextReferences: [
        { kind: 'CASE_KNOWLEDGE_REF', referenceId: 'workspace-b-case:change-review-v3' },
        { kind: 'WORKSPACE_POLICY_REF', referenceId: 'workspace-b-policy:portfolio-review-v2' }
      ],
      interpretedAt: INTERPRETED_AT
    });

    expect(workspaceA.outcomeBoundary).toBe(WORKSPACE_TRADEMARK_CHANGE_INTERPRETATION_OUTCOME_V1);
    expect(workspaceB.outcomeBoundary).toBe(workspaceA.outcomeBoundary);
    expect(workspaceB.sourceEvidenceFingerprintSha256).toBe(
      workspaceA.sourceEvidenceFingerprintSha256
    );
    expect(workspaceA.sourceEvidence).toEqual(workspaceB.sourceEvidence);
    expect(workspaceA.recommendation.kind).toBe('REVIEW_LIFECYCLE_RECOMMENDATION');
    expect(workspaceB.recommendation.kind).toBe(workspaceA.recommendation.kind);
    expect(workspaceA.interpretation.source).toBe('MO_BASE');
    expect(workspaceB.interpretation.source).toBe('WORKSPACE_LOCAL');
    expect(workspaceA.interpretation.reviewFocus).not.toBe(workspaceB.interpretation.reviewFocus);
    expect(workspaceB.implementationSelection).toMatchObject({
      implementationKey: 'ai:workspace-approved:chat-completions:v1',
      selectionPolicyVersion: 'workspace-implementation-preference.v1:workspace-b',
      provider: 'WORKSPACE_APPROVED_AI',
      model: 'workspace-approved-model'
    });
    expect(workspaceB.workspaceContextReferences.map((reference) => reference.kind)).toEqual([
      'CASE_KNOWLEDGE_REF',
      'WORKSPACE_POLICY_REF'
    ]);
  });

  it('fails closed for stale and conflicting source evidence', () => {
    const stale = prepareWorkspaceTrademarkChangeInterpretationV1({
      signal: signal(WORKSPACE_A, 'stale', {
        dimension: 'SOURCE_FRESHNESS',
        freshness: 'STALE'
      }),
      interpretedAt: INTERPRETED_AT
    });
    const conflicting = prepareWorkspaceTrademarkChangeInterpretationV1({
      signal: signal(WORKSPACE_A, 'conflict', {
        dimension: 'SOURCE_CONFLICT',
        freshness: 'CONFLICTING'
      }),
      interpretedAt: INTERPRETED_AT
    });

    for (const result of [stale, conflicting]) {
      expect(result.status).toBe('VERIFICATION_REQUIRED');
      expect(result.interpretation.source).toBe('SOURCE_GUARDRAIL');
      expect(result.recommendation.kind).toBe('VERIFY_SOURCE_OR_DEADLINE');
      expect(result.implementationSelection).toBeUndefined();
      expect(result.authority.officialTruthCreated).toBe(false);
      expect(result.authority.legalDeadlineCertified).toBe(false);
    }
  });

  it('keeps the deterministic recommendation when Managed AI is unavailable', () => {
    const result = prepareWorkspaceTrademarkChangeInterpretationV1({
      signal: signal(WORKSPACE_A, 'unavailable'),
      interpretedAt: INTERPRETED_AT
    });

    expect(result.status).toBe('INTERPRETATION_UNAVAILABLE');
    expect(result.interpretation.source).toBe('BASE_RECOMMENDATION_ONLY');
    expect(result.recommendation.kind).toBe('REVIEW_LIFECYCLE_RECOMMENDATION');
    expect(result.implementationSelection).toBeUndefined();
  });

  it('rejects cross-Workspace Managed AI evidence', () => {
    const local = managedAi(
      WORKSPACE_A,
      'workspace-a',
      'ai:workspace-approved:chat-completions:v1',
      'workspace-implementation-preference.v1:workspace-a',
      'summary',
      'focus'
    );

    expect(() =>
      prepareWorkspaceTrademarkChangeInterpretationV1({
        signal: signal(WORKSPACE_B, 'cross_workspace'),
        managedAi: local,
        interpretedAt: INTERPRETED_AT
      })
    ).toThrow(/same Workspace/);
  });

  it('rejects implementation provenance drift', () => {
    const local = managedAi(
      WORKSPACE_A,
      'workspace-a',
      'ai:workspace-approved:chat-completions:v1',
      'workspace-implementation-preference.v1:workspace-a',
      'summary',
      'focus'
    );
    const provenance = local.outcome.provenance;
    if (provenance === undefined) throw new Error('test fixture requires provenance');
    const drifted = {
      ...local,
      outcome: {
        ...local.outcome,
        provenance: { ...provenance, implementationKey: 'ai:drifted:v1' }
      }
    } satisfies WorkspaceTrademarkChangeManagedAiEvidenceV1;

    expect(() =>
      prepareWorkspaceTrademarkChangeInterpretationV1({
        signal: signal(WORKSPACE_A, 'provenance_drift'),
        managedAi: drifted,
        interpretedAt: INTERPRETED_AT
      })
    ).toThrow(/provenance does not match/);
  });

  it('rejects provider, action, or authority escape-hatch fields from AI output', () => {
    const runtimeBinding = binding(
      'workspace-a',
      'ai:workspace-approved:chat-completions:v1',
      'workspace-implementation-preference.v1:workspace-a'
    );
    const controlled: WorkspaceTrademarkChangeManagedAiEvidenceV1 = {
      binding: runtimeBinding,
      receipt: receipt(WORKSPACE_A, runtimeBinding),
      outcome: outcome(runtimeBinding, 'summary', 'focus', {
        summary: 'summary',
        reviewFocus: 'focus',
        provider: 'caller-provider',
        action: 'FILE_NOW',
        authority: true
      })
    };

    expect(() =>
      prepareWorkspaceTrademarkChangeInterpretationV1({
        signal: signal(WORKSPACE_A, 'escape_hatch'),
        managedAi: controlled,
        interpretedAt: INTERPRETED_AT
      })
    ).toThrow(/unsupported fields/);
  });

  it('replays deterministically and preserves permanent authority locks', () => {
    const exactInput = {
      signal: signal(WORKSPACE_A, 'replay'),
      managedAi: managedAi(
        WORKSPACE_A,
        'workspace-a',
        'ai:mo-base:chat-completions:v1',
        'capability-managed-ai-selection.v1',
        'summary',
        'focus'
      ),
      workspaceContextReferences: [
        { kind: 'WORKSPACE_POLICY_REF', referenceId: 'workspace-a-policy:review-v1' }
      ],
      interpretedAt: INTERPRETED_AT
    } as const;

    const first = prepareWorkspaceTrademarkChangeInterpretationV1(exactInput);
    const second = prepareWorkspaceTrademarkChangeInterpretationV1(exactInput);
    expect(first).toEqual(second);
    expect(Object.values(first.authority).every((value) => value === false)).toBe(true);
    expect(first.recommendation.userConfirmationRequired).toBe(true);
    expect(workspaceTrademarkChangeInterpretationAuthority.serviceLocalProjectionOnly).toBe(true);
    expect(workspaceTrademarkChangeInterpretationAuthority.mayCreateCapabilityId).toBe(false);
    expect(workspaceTrademarkChangeInterpretationAuthority.mayAuthorizeProtectedAction).toBe(false);
    expect(workspaceTrademarkChangeInterpretationAuthority.mayExecuteExternalAction).toBe(false);
  });
});
