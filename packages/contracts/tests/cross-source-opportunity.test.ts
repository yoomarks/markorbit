import { describe, expect, it } from 'vitest';
import {
  evaluateMaintenanceOpportunityV1,
  type MaintenanceOpportunityInputV1
} from '../src/cross-source-opportunity.js';

const evidence = (id: string) => ({
  sourceOwner: 'DATA_ENGINE' as const,
  sourceObjectId: id,
  sourceVersion: 'epoch-1',
  sourceFingerprintSha256: 'a'.repeat(64),
  observedAt: '2026-09-21T00:00:00.000Z'
});

function input(
  patch: Partial<{
    lifecycle: MaintenanceOpportunityInputV1['lifecycle']['value'];
    subject: MaintenanceOpportunityInputV1['subjectOperatingState']['value'];
    holder: MaintenanceOpportunityInputV1['holderContinuity']['value'];
    relationship: MaintenanceOpportunityInputV1['workspaceRelationship']['value'];
  }> = {}
): MaintenanceOpportunityInputV1 {
  return {
    schemaVersion: 1,
    methodVersionId: 'brain-method-version_maintenance-opportunity-v1',
    trademarkRef: {
      owner: 'DATA_ENGINE',
      kind: 'TRADEMARK',
      id: 'tm-001',
      version: 'epoch-1',
      fingerprintSha256: 'b'.repeat(64),
      observedAt: '2026-09-21T00:00:00.000Z'
    },
    lifecycle: {
      value: patch.lifecycle ?? 'WINDOW_OPEN',
      evidenceRefs: [evidence('lifecycle-001')]
    },
    subjectOperatingState: {
      value: patch.subject ?? 'ACTIVE',
      evidenceRefs: [evidence('company-001')]
    },
    holderContinuity: {
      value: patch.holder ?? 'CONFIRMED',
      evidenceRefs: [evidence('holder-001')]
    },
    workspaceRelationship: {
      value: patch.relationship ?? 'CURRENT',
      evidenceRefs: [evidence('workspace-relation-001')]
    },
    evaluatedAt: '2026-09-21T01:00:00.000Z'
  };
}

describe('Cross-source maintenance opportunity V1', () => {
  it('supports only a candidate when the maintenance, subject, holder and Workspace evidence align', () => {
    const result = evaluateMaintenanceOpportunityV1(
      input(),
      'cross-source-opportunity_maintenance-001'
    );
    expect(result.state).toBe('SUPPORTED_CANDIDATE');
    expect(result.authorityConsequences.customerDemandEstablished).toBe(false);
    expect(result.authorityConsequences.opportunityQualified).toBe(false);
  });

  it('turns a dissolved subject into ownership/succession review instead of a fake renewal need', () => {
    const result = evaluateMaintenanceOpportunityV1(
      input({ subject: 'INACTIVE_OR_DISSOLVED' }),
      'cross-source-opportunity_maintenance-002'
    );
    expect(result.state).toBe('REVIEW_REQUIRED');
    expect(result.reasonCodes).toContain('SUBJECT_INACTIVE_OR_DISSOLVED');
    expect(result.suggestedReviewKinds).toContain('OWNERSHIP_OR_SUCCESSION_REVIEW');
    expect(result.explanation).toMatch(/may still have value/u);
  });

  it('keeps rename or successor evidence in ownership review without establishing legal succession', () => {
    const result = evaluateMaintenanceOpportunityV1(
      input({ holder: 'RENAMED_OR_SUCCESSOR_EVIDENCE' }),
      'cross-source-opportunity_maintenance-005'
    );
    expect(result.state).toBe('REVIEW_REQUIRED');
    expect(result.reasonCodes).toContain('RENAME_OR_SUCCESSOR_EVIDENCE');
    expect(result.suggestedReviewKinds).toContain('OWNERSHIP_OR_SUCCESSION_REVIEW');
    expect(result.authorityConsequences.legalSuccessionEstablished).toBe(false);
  });

  it('requires holder review when ownership evidence conflicts', () => {
    const result = evaluateMaintenanceOpportunityV1(
      input({ holder: 'CHANGED_OR_CONFLICTING' }),
      'cross-source-opportunity_maintenance-003'
    );
    expect(result.state).toBe('REVIEW_REQUIRED');
    expect(result.reasonCodes).toContain('HOLDER_CONTINUITY_CONFLICT');
  });

  it('does not support a maintenance opportunity outside the lifecycle window', () => {
    const result = evaluateMaintenanceOpportunityV1(
      input({ lifecycle: 'NOT_IN_WINDOW' }),
      'cross-source-opportunity_maintenance-004'
    );
    expect(result.state).toBe('NOT_SUPPORTED');
    expect(result.suggestedReviewKinds).toEqual([]);
  });

  it('requires relationship review for historical representation instead of treating it as current', () => {
    const result = evaluateMaintenanceOpportunityV1(
      input({ relationship: 'HISTORICAL' }),
      'cross-source-opportunity_maintenance-006'
    );
    expect(result.state).toBe('REVIEW_REQUIRED');
    expect(result.reasonCodes).toContain('WORKSPACE_RELATIONSHIP_HISTORICAL');
    expect(result.suggestedReviewKinds).toContain('CUSTOMER_RELATIONSHIP_REVIEW');
  });

  it('requires a Workspace relationship review when no relationship is confirmed', () => {
    const result = evaluateMaintenanceOpportunityV1(
      input({ relationship: 'NONE' }),
      'cross-source-opportunity_maintenance-007'
    );
    expect(result.state).toBe('REVIEW_REQUIRED');
    expect(result.reasonCodes).toContain('WORKSPACE_RELATIONSHIP_NOT_CONFIRMED');
    expect(result.suggestedReviewKinds).toContain('CUSTOMER_RELATIONSHIP_REVIEW');
  });

  it('fails closed when an evidence signal has no provenance', () => {
    const value = input();
    expect(() =>
      evaluateMaintenanceOpportunityV1(
        { ...value, subjectOperatingState: { value: 'ACTIVE', evidenceRefs: [] } },
        'cross-source-opportunity_maintenance-008'
      )
    ).toThrow(/evidenceRefs must be non-empty/u);
  });
});
