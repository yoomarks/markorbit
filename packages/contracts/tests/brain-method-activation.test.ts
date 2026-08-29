import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runCnDurationResearchEvidenceFileIntakeV1 } from '../src/brain-cn-duration-evidence-intake.js';
import {
  activateExecutableMethodPackageV1,
  executableMethodActivationEvidenceRefV1,
  executableMethodPackageFingerprintV1,
  prepareExecutableMethodPackageActivationDecisionV1
} from '../src/brain-method-activation.js';
import { selectExecutableMethodPackageV1 } from '../src/brain-method.js';

const evidencePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'evidence',
  'cn_filing_to_prelim_research_evidence_4ee0030dd77fac50f973573818225324888dc064.json'
);
const APPROVED_AT = '2026-08-29T00:30:00.000Z';
const ACTIVE_LIMITATIONS = [
  'Applies only to the accepted bounded CN filing-to-preliminary-publication dataset identity in lineage.',
  'Descriptive elapsed-day statistics are not a legal deadline, SLA, outcome prediction, case-status inference, risk score, or recommendation.',
  'Dataset freshness, source coverage and population bounds remain Data Engine evidence properties; a different dataset identity requires a new evaluation.',
  'Runtime activation is limited to the explicit Phase 4 governed decision bound to this immutable package version; automatic promotion remains prohibited.'
] as const;

function realValidatedPackage() {
  const intake = runCnDurationResearchEvidenceFileIntakeV1(evidencePath);
  expect(intake.status).toBe('READY');
  if (intake.status !== 'READY') throw new Error(`expected READY, got ${intake.status}`);
  return intake.package;
}

function decision(
  pkg: ReturnType<typeof realValidatedPackage>,
  result: 'APPROVED' | 'REJECTED' = 'APPROVED'
) {
  return prepareExecutableMethodPackageActivationDecisionV1(pkg, {
    decision: result,
    selectionPriority: 100,
    limitations: ACTIVE_LIMITATIONS,
    policyVersion: 'phase4-governed-method-activation.v1',
    approvedBy: 'markorbit-core-governance',
    approvalTicketRef: 'github:yoomarks/markorbit#309',
    approvedAt: APPROVED_AT,
    rationale:
      'Activate only the accepted Phase 3 CN descriptive distribution for the narrow Phase 4 analytical Capability pilot; no predictive, legal, scoring, discovery, product or autonomous authority is granted.'
  });
}

const selectionContext = {
  methodFamily: 'STATISTICAL_ANALYSIS' as const,
  jurisdiction: 'CN',
  authority: 'CNIPA',
  objectType: 'TRADEMARK_APPLICATION',
  operation: 'DESCRIPTIVE_DURATION_RESEARCH',
  procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
  stage: 'HISTORICAL_FACT_RESEARCH',
  filingBasis: 'ANY',
  segment: 'FILING_TO_PRELIM_PUBLICATION',
  availableData: ['CN_CASE_CURRENT', 'FILING_DATE', 'PRELIM_PUB_DATE', 'SOURCE_LINEAGE'],
  asOf: '2026-08-29T01:00:00.000Z'
};

describe('Phase 4 governed executable method activation', () => {
  it('creates a separately auditable next-version ACTIVE package without mutating the accepted predecessor', () => {
    const predecessor = realValidatedPackage();
    const predecessorFingerprint = executableMethodPackageFingerprintV1(predecessor);
    const activation = decision(predecessor);
    const active = activateExecutableMethodPackageV1(predecessor, activation);

    expect(predecessor.lifecycle).toBe('VALIDATED');
    expect(predecessor.packageVersion).toBe(1);
    expect(predecessor.activatedAt).toBeUndefined();

    expect(activation.decision).toBe('APPROVED');
    expect(activation.decisionId).toMatch(/^brain-method-activation_[0-9a-f]{64}$/);
    expect(activation.predecessor.packageFingerprintSha256).toBe(predecessorFingerprint);
    expect(activation.approval.authority).toBe('BRAIN_GOVERNANCE');
    expect(activation.approval.approvalTicketRef).toBe('github:yoomarks/markorbit#309');

    expect(active.packageId).toBe(predecessor.packageId);
    expect(active.packageVersion).toBe(2);
    expect(active.lifecycle).toBe('ACTIVE');
    expect(active.activatedAt).toBe(APPROVED_AT);
    expect(active.selectionPriority).toBe(100);
    expect(active.executable).toEqual(predecessor.executable);
    expect(active.lineage).toEqual(predecessor.lineage);
    expect(active.evaluation).toEqual(predecessor.evaluation);
    expect(active.limitations).toHaveLength(ACTIVE_LIMITATIONS.length);
    expect(active.limitations).toEqual([...ACTIVE_LIMITATIONS].sort());
    expect(executableMethodActivationEvidenceRefV1(activation)).toContain(activation.decisionId);

    const selected = selectExecutableMethodPackageV1([predecessor, active], selectionContext);
    expect(selected.status).toBe('SELECTED');
    if (selected.status !== 'SELECTED')
      throw new Error(`expected SELECTED, got ${selected.status}`);
    expect(selected.package.packageVersion).toBe(2);
    expect(selected.package.lifecycle).toBe('ACTIVE');
  });

  it('does not allow a REJECTED governance decision to create ACTIVE state', () => {
    const predecessor = realValidatedPackage();
    expect(() =>
      activateExecutableMethodPackageV1(predecessor, decision(predecessor, 'REJECTED'))
    ).toThrow('REJECTED activation decision cannot produce ACTIVE state');
  });

  it('rejects predecessor drift after the activation decision was recorded', () => {
    const predecessor = realValidatedPackage();
    const activation = decision(predecessor);
    const executable = predecessor.executable as Record<string, unknown>;
    const stats = executable.statistics as Record<string, unknown>;
    const drifted = {
      ...predecessor,
      executable: {
        ...executable,
        statistics: { ...stats, median_days: 337 }
      }
    };

    expect(() => activateExecutableMethodPackageV1(drifted, activation)).toThrow(
      'does not bind the exact VALIDATED predecessor package'
    );
  });

  it('rejects attempts to activate an already ACTIVE package again with the old decision', () => {
    const predecessor = realValidatedPackage();
    const activation = decision(predecessor);
    const active = activateExecutableMethodPackageV1(predecessor, activation);

    expect(() => activateExecutableMethodPackageV1(active, activation)).toThrow(
      'Activation predecessor must be the exact unactivated VALIDATED package'
    );
  });
});
