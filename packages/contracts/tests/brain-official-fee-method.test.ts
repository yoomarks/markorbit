import { describe, expect, it } from 'vitest';
import {
  selectExecutableMethodPackageV1,
  type KnowledgeRetrievalLineageRefV1
} from '../src/brain-method.js';
import {
  activateExecutableMethodPackageV1,
  executableMethodActivationEvidenceRefV1,
  prepareExecutableMethodPackageActivationDecisionV1
} from '../src/brain-method-activation.js';
import {
  USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE,
  USPTO_OFFICIAL_FEE_LEGACY_PILOT_GOVERNANCE,
  USPTO_OFFICIAL_FEE_PILOT_OPERATION,
  compileUsptoOfficialFeeMethodPackageV1,
  prepareUsptoOfficialFeeGovernedSuccessorV1,
  type CompileUsptoOfficialFeeMethodInputV1
} from '../src/brain-official-fee-method.js';

function resolvedInput(): CompileUsptoOfficialFeeMethodInputV1 {
  return {
    knowledgeSources: structuredClone(USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE),
    temporalResolution: {
      status: 'RESOLVED',
      effectiveFrom: '2025-01-18T00:00:00.000Z',
      evidenceRef: 'USPTO_FY2025_TRADEMARK_FEE_APPLICABILITY'
    },
    conflictResolution: {
      status: 'NONE',
      evidenceRef: 'USPTO_DUAL_SOURCE_AUTHORITY_RECONCILIATION'
    }
  };
}

describe('USPTO Official Fee Brain Method compiler', () => {
  it('compiles one ACTIVE package bound to the exact accepted Knowledge lineage without a fee amount', () => {
    const result = compileUsptoOfficialFeeMethodPackageV1(resolvedInput());
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;

    expect(result.package.lifecycle).toBe('ACTIVE');
    expect(result.package.lineage.knowledgeSources).toHaveLength(2);
    expect(result.package.lineage.knowledgeSources.map((source) => source.chunkId).sort()).toEqual(
      USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE.map((source) => source.chunkId).sort()
    );
    expect(JSON.stringify(result)).not.toContain('350');
    expect(JSON.stringify(result)).not.toContain('amountMinor');
  });

  it('fails closed when temporal applicability or source conflict is unresolved', () => {
    expect(
      compileUsptoOfficialFeeMethodPackageV1({
        ...resolvedInput(),
        temporalResolution: { status: 'UNRESOLVED' }
      })
    ).toEqual({ status: 'REJECTED', reason: 'TEMPORAL_UNRESOLVED' });

    expect(
      compileUsptoOfficialFeeMethodPackageV1({
        ...resolvedInput(),
        conflictResolution: { status: 'UNRESOLVED' }
      })
    ).toEqual({ status: 'REJECTED', reason: 'CONFLICT_UNRESOLVED' });
  });

  it('rejects missing or tampered accepted lineage', () => {
    const missing = resolvedInput();
    missing.knowledgeSources = missing.knowledgeSources.slice(0, 1);
    expect(compileUsptoOfficialFeeMethodPackageV1(missing)).toEqual({
      status: 'REJECTED',
      reason: 'LINEAGE_MISMATCH'
    });

    const [acceptedSource] = USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE;
    if (!acceptedSource) throw new Error('Expected accepted Knowledge lineage fixture.');
    const source: KnowledgeRetrievalLineageRefV1 = structuredClone(acceptedSource);
    const tampered = resolvedInput();
    tampered.knowledgeSources = [
      {
        ...source,
        contentSha256: 'a'.repeat(64)
      },
      ...tampered.knowledgeSources.slice(1)
    ];
    expect(compileUsptoOfficialFeeMethodPackageV1(tampered)).toEqual({
      status: 'REJECTED',
      reason: 'LINEAGE_MISMATCH'
    });
  });

  it('is deterministic for the same evidence resolution and rejects out-of-scope selection', () => {
    const first = compileUsptoOfficialFeeMethodPackageV1(resolvedInput());
    const replay = compileUsptoOfficialFeeMethodPackageV1(resolvedInput());
    expect(replay).toEqual(first);
    if (first.status !== 'READY') throw new Error('Expected READY package.');

    const baseContext = {
      methodFamily: 'SOURCE_RESOLUTION' as const,
      jurisdiction: 'US',
      authority: 'USPTO',
      objectType: 'TRADEMARK_APPLICATION',
      operation: USPTO_OFFICIAL_FEE_PILOT_OPERATION,
      procedure: 'ELECTRONIC_FILING',
      stage: 'NEW_APPLICATION',
      filingBasis: 'SECTION_1',
      segment: 'BASE_FEE',
      availableData: ['FILING_BASIS', 'CLASS_COUNT', 'RESOLVED_OFFICIAL_FEE_VALUE'],
      asOf: '2026-08-28T00:00:00.000Z'
    };
    expect(selectExecutableMethodPackageV1([first.package], baseContext).status).toBe('SELECTED');
    expect(
      selectExecutableMethodPackageV1([first.package], {
        ...baseContext,
        jurisdiction: 'CA'
      })
    ).toEqual({
      status: 'NOT_APPLICABLE',
      reason: 'No ACTIVE executable method package matches the request scope and available data.'
    });
  });

  it('preserves the direct-ACTIVE v1 artifact as an explicitly ungoverned legacy pilot', () => {
    const legacy = compileUsptoOfficialFeeMethodPackageV1(resolvedInput());
    const prepared = prepareUsptoOfficialFeeGovernedSuccessorV1(resolvedInput());
    if (legacy.status !== 'READY' || prepared.status !== 'PREPARED') {
      throw new Error('Expected legacy and governed-successor preparation.');
    }

    expect(prepared.legacyPilot.governanceStatus).toBe(
      USPTO_OFFICIAL_FEE_LEGACY_PILOT_GOVERNANCE
    );
    expect(prepared.legacyPilot.packageId).toBe(legacy.package.packageId);
    expect(prepared.legacyPilot.packageVersion).toBe(1);
    expect(prepared.legacyPilot.historicalActivatedAt).toBe(
      '2026-08-28T00:00:00.000Z'
    );
    expect(prepared.legacyPilot.activationDecisionId).toBeNull();
    expect(prepared.legacyPilot.activationEvidenceRef).toBeNull();
    expect(prepared.legacyPilot.phase4ResolverAcceptanceIsBrainGovernanceActivation).toBe(false);
    expect(prepared.legacyPilot.currentBrainGovernanceActivationEstablished).toBe(false);
  });

  it('prepares a distinct VALIDATED successor with exact source/evaluation lineage and no activation authority', () => {
    const legacy = compileUsptoOfficialFeeMethodPackageV1(resolvedInput());
    const prepared = prepareUsptoOfficialFeeGovernedSuccessorV1(resolvedInput());
    if (legacy.status !== 'READY' || prepared.status !== 'PREPARED') {
      throw new Error('Expected legacy and governed-successor preparation.');
    }

    expect(prepared.validatedSuccessor.lifecycle).toBe('VALIDATED');
    expect(prepared.validatedSuccessor.activatedAt).toBeUndefined();
    expect(prepared.validatedSuccessor.packageId).not.toBe(legacy.package.packageId);
    expect(prepared.validatedSuccessor.packageId).toBe(
      `${legacy.package.packageId}-governed-successor`
    );
    expect(prepared.validatedSuccessor.packageVersion).toBe(1);
    expect(prepared.validatedSuccessor.methodId).toBe(legacy.package.methodId);
    expect(prepared.validatedSuccessor.methodVersionId).toBe(legacy.package.methodVersionId);
    expect(prepared.validatedSuccessor.evaluation).toEqual(legacy.package.evaluation);
    expect(prepared.validatedSuccessor.lineage).toEqual(legacy.package.lineage);
    expect(prepared.validatedSuccessor.executable).toEqual(legacy.package.executable);
    expect(prepared.requiresExplicitBrainGovernanceApproval).toBe(true);
    expect(prepared.activationDecisionId).toBeNull();
    expect(prepared.activationEvidenceRef).toBeNull();
    expect(prepared.validatedSuccessorFingerprintSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('can become ACTIVE only through an explicit canonical BRAIN_GOVERNANCE approval decision', () => {
    const prepared = prepareUsptoOfficialFeeGovernedSuccessorV1(resolvedInput());
    if (prepared.status !== 'PREPARED') {
      throw new Error('Expected governed-successor preparation.');
    }

    const rejected = prepareExecutableMethodPackageActivationDecisionV1(
      prepared.validatedSuccessor,
      {
        decision: 'REJECTED',
        selectionPriority: 100,
        limitations: prepared.validatedSuccessor.limitations,
        policyVersion: 'brain-governance-test-v1',
        approvedBy: 'test-governance-principal',
        approvalTicketRef: 'TEST-ONLY-REJECTION-460',
        approvedAt: '2026-09-01T00:00:00.000Z',
        rationale: 'Test-only rejection proving fail-closed activation.'
      }
    );
    expect(() =>
      activateExecutableMethodPackageV1(prepared.validatedSuccessor, rejected)
    ).toThrow('A REJECTED activation decision cannot produce ACTIVE state.');

    const approved = prepareExecutableMethodPackageActivationDecisionV1(
      prepared.validatedSuccessor,
      {
        decision: 'APPROVED',
        selectionPriority: 100,
        limitations: prepared.validatedSuccessor.limitations,
        policyVersion: 'brain-governance-test-v1',
        approvedBy: 'test-governance-principal',
        approvalTicketRef: 'TEST-ONLY-APPROVAL-460',
        approvedAt: '2026-09-01T00:00:00.000Z',
        rationale: 'Synthetic test fixture only; not a production governance approval.'
      }
    );
    const active = activateExecutableMethodPackageV1(prepared.validatedSuccessor, approved);

    expect(approved.approval.authority).toBe('BRAIN_GOVERNANCE');
    expect(approved.decisionId).toMatch(/^brain-method-activation_/);
    expect(active.lifecycle).toBe('ACTIVE');
    expect(active.packageVersion).toBe(2);
    expect(active.activatedAt).toBe(approved.approval.approvedAt);
    expect(executableMethodActivationEvidenceRefV1(approved)).toBe(
      `brain-method-activation:${approved.decisionId}:${prepared.validatedSuccessorFingerprintSha256}`
    );
  });
});
