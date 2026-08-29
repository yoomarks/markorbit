import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import {
  CN_DURATION_BAND_ACCEPTED_DATASET_REF,
  CN_DURATION_BAND_EXECUTABLE_KIND,
  compileCnDurationBandClassificationMethodPackageV1
} from '@markorbit/contracts/brain-cn-duration-band-classification';
import {
  activateExecutableMethodPackageV1,
  executableMethodActivationEvidenceRefV1,
  prepareExecutableMethodPackageActivationDecisionV1
} from '@markorbit/contracts/brain-method-activation';
import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';

import { GovernedCapabilityRuntime } from '../src/capability-runtime.js';
import {
  CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_DEFINITION,
  CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_ID,
  CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_VERSION,
  CN_DURATION_BAND_CLASSIFICATION_IMPLEMENTATION_PROFILE,
  CN_DURATION_BAND_CLASSIFICATION_INPUT_SCHEMA,
  CN_DURATION_BAND_CLASSIFICATION_OUTPUT_SCHEMA,
  CnDurationBandClassificationRunnerV1,
  CnDurationBandClassificationSelectionContextResolverV1,
  validateCnDurationBandClassificationInputV1,
  validateCnDurationBandClassificationOutputV1
} from '../src/cn-duration-band-classification-pilot.js';
import { ExecutableMethodCapabilityExecutorV1 } from '../src/executable-method-runtime.js';

const evidencePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'packages',
  'contracts',
  'tests',
  'evidence',
  'cn_filing_to_prelim_research_evidence_4ee0030dd77fac50f973573818225324888dc064.json'
);
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as Record<string, unknown>;
const ACTIVE_AT = '2026-08-29T08:25:00.000Z';
const ACTIVE_LIMITATIONS = [
  'Applies only to an already completed CN filing-to-preliminary-publication elapsed-day observation and the exact accepted Phase 3 dataset identity in lineage.',
  'Historical quartile-band position is descriptive interpretation only; it is not a legal deadline, SLA, future-duration prediction, case-status inference, probability, risk score, recommendation, or business action.',
  'A different Data Engine dataset identity or changed p25/median/p75 thresholds requires a new research evaluation and method version.',
  'The caller owns the completed-duration input and any product lifecycle state; Capability and Brain do not infer or persist product worklist state.',
  'Runtime activation is limited to the explicit Phase 4 #311 governance decision; automatic promotion remains prohibited.'
] as const;

function acceptedResearchInput() {
  return {
    dataset: structuredClone(evidence.dataset),
    acceptanceReceipt: structuredClone(evidence.acceptance_receipt),
    firstSummary: structuredClone(evidence.first_summary),
    replaySummary: structuredClone(evidence.replay_summary)
  };
}

function acceptedValidatedPackage() {
  const compiled = compileCnDurationBandClassificationMethodPackageV1(acceptedResearchInput());
  if (compiled.status !== 'READY') throw new Error(`expected READY, got ${compiled.status}`);
  return compiled.package;
}

function activatedPackage() {
  const predecessor = acceptedValidatedPackage();
  const activation = prepareExecutableMethodPackageActivationDecisionV1(predecessor, {
    decision: 'APPROVED',
    selectionPriority: 90,
    limitations: ACTIVE_LIMITATIONS,
    policyVersion: 'phase4-cn-duration-band-classification-activation.v1',
    approvedBy: 'markorbit-core-governance',
    approvalTicketRef: 'github:yoomarks/markorbit#311',
    approvedAt: ACTIVE_AT,
    rationale:
      'Activate only the separately validated completed-duration historical-band classifier for the narrow Phase 4 interpretation Capability. No prediction, legal conclusion, risk, probability, recommendation, current case status, product worklist or autonomous authority is granted.'
  });
  return {
    predecessor,
    activation,
    active: activateExecutableMethodPackageV1(predecessor, activation)
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    jurisdiction: 'CN',
    authority: 'CNIPA',
    objectType: 'TRADEMARK_APPLICATION',
    operation: 'CLASSIFY_COMPLETED_DURATION_HISTORICAL_BAND',
    procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
    stage: 'COMPLETED_INTERVAL_INTERPRETATION',
    filingBasis: 'ANY',
    segment: 'FILING_TO_PRELIM_PUBLICATION',
    availableData: [
      'OBSERVED_COMPLETED_DURATION_DAYS',
      'ACCEPTED_CN_DURATION_DISTRIBUTION'
    ],
    acceptedResearchDatasetRef: CN_DURATION_BAND_ACCEPTED_DATASET_REF,
    observedCompletedDurationDays: 336,
    ...overrides
  };
}

function command(overrides: Partial<CapabilityRequestV2Command> = {}): CapabilityRequestV2Command {
  return {
    schemaVersion: 2,
    capabilityId: CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_ID,
    capabilityVersion: CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_VERSION,
    caller: {
      workspaceId: 'workspace_phase4_cn_duration_band',
      principalId: 'principal_phase4_cn_duration_band',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_phase4_cn_duration_band'
    },
    purpose: 'Classify one already completed duration relative to the accepted historical distribution.',
    input: input(),
    inputSchemaId: CN_DURATION_BAND_CLASSIFICATION_INPUT_SCHEMA,
    outputSchemaId: CN_DURATION_BAND_CLASSIFICATION_OUTPUT_SCHEMA,
    riskClass: 'LOW',
    idempotencyKey: 'phase4-cn-duration-band-1',
    correlationId: 'correlation_phase4_cn_duration_band',
    ...overrides
  };
}

function runtimeWithPackages(packages: readonly unknown[], activation: unknown) {
  const runner = new CnDurationBandClassificationRunnerV1(activation);
  const run = vi.spyOn(runner, 'run');
  const executor = new ExecutableMethodCapabilityExecutorV1({
    packages: { list: () => Promise.resolve(packages) },
    selectionContext: new CnDurationBandClassificationSelectionContextResolverV1(),
    runners: {
      resolve: (kind) => (kind === CN_DURATION_BAND_EXECUTABLE_KIND ? runner : undefined)
    }
  });
  const runtime = new GovernedCapabilityRuntime({
    definitions: {
      findCurrent: (capabilityId) =>
        Promise.resolve(
          capabilityId === CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_ID
            ? CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_DEFINITION
            : undefined
        )
    },
    implementations: {
      select: (request) =>
        Promise.resolve(
          request.capabilityId === CN_DURATION_BAND_CLASSIFICATION_CAPABILITY_ID
            ? {
                profile: CN_DURATION_BAND_CLASSIFICATION_IMPLEMENTATION_PROFILE,
                policyVersion: 'phase4-cn-duration-band-classification-selection.v1'
              }
            : undefined
        )
    },
    inputContracts: {
      validate: (schemaId, value) =>
        schemaId === CN_DURATION_BAND_CLASSIFICATION_INPUT_SCHEMA &&
        validateCnDurationBandClassificationInputV1(value)
    },
    outputContracts: {
      validate: (schemaId, value) =>
        schemaId === CN_DURATION_BAND_CLASSIFICATION_OUTPUT_SCHEMA &&
        validateCnDurationBandClassificationOutputV1(value)
    },
    executor,
    now: () => '2026-08-29T08:30:00.000Z'
  });
  return { runtime, run };
}

describe('Phase 4 CN completed-duration historical band classification Capability', () => {
  it('executes the explicitly activated validated classifier with exact lineage and no hidden prediction or product mutation', async () => {
    const { active, activation } = activatedPackage();
    const { runtime, run } = runtimeWithPackages([active], activation);

    const execution = await runtime.invoke(command());

    expect(execution.returnValue.status).toBe('COMPLETED');
    expect(execution.outcome.status).toBe('SUCCEEDED');
    expect(execution.replayed).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    expect(execution.returnValue.output).toEqual({
      schemaVersion: 1,
      kind: CN_DURATION_BAND_EXECUTABLE_KIND,
      jurisdiction: 'CN',
      procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
      observedCompletedDurationDays: 336,
      historicalBand: 'LOWER_INTERQUARTILE',
      datasetRefId: CN_DURATION_BAND_ACCEPTED_DATASET_REF,
      thresholds: { p25Days: 335, medianDays: 336, p75Days: 383 },
      semantics: 'COMPLETED_INTERVAL_RELATIVE_TO_ACCEPTED_HISTORICAL_DISTRIBUTION',
      descriptiveInterpretationOnly: true,
      legalConclusion: false,
      predictiveClaim: false,
      riskClaim: false,
      probabilityClaim: false,
      recommendation: false,
      currentCaseStatusInferred: false,
      productBusinessStateMutated: false
    });
    expect(execution.receipt.evidenceRefs).toContain(
      executableMethodActivationEvidenceRefV1(activation)
    );
    expect(
      execution.receipt.evidenceRefs.some((ref) =>
        ref.startsWith(`research-dataset:${CN_DURATION_BAND_ACCEPTED_DATASET_REF}:`)
      )
    ).toBe(true);
    expect(execution.receipt.evidenceRefs).toContain(
      'capability-runtime:brain-research-hot-path=absent'
    );
    expect(execution.receipt.evidenceRefs).toContain(
      'capability-runtime:data-engine-population-read=absent'
    );
    expect(execution.receipt.evidenceRefs).toContain(
      'capability-runtime:current-case-status-inference=absent'
    );
    expect(execution.receipt.evidenceRefs).toContain(
      'capability-runtime:product-business-state-write=absent'
    );
  });

  it('preserves all four frozen historical bands at runtime', async () => {
    const { active, activation } = activatedPackage();
    const cases = [
      [335, 'LOWER_QUARTILE_OR_BELOW'],
      [336, 'LOWER_INTERQUARTILE'],
      [337, 'UPPER_INTERQUARTILE'],
      [384, 'UPPER_QUARTILE']
    ] as const;
    for (const [days, expected] of cases) {
      const { runtime } = runtimeWithPackages([active], activation);
      const execution = await runtime.invoke(
        command({
          idempotencyKey: `phase4-cn-duration-band-${days}`,
          input: input({ observedCompletedDurationDays: days })
        })
      );
      expect(execution.returnValue.status).toBe('COMPLETED');
      expect(execution.returnValue.output).toMatchObject({
        observedCompletedDurationDays: days,
        historicalBand: expected
      });
    }
  });

  it('replays without executing the classifier twice', async () => {
    const { active, activation } = activatedPackage();
    const { runtime, run } = runtimeWithPackages([active], activation);
    const request = command({ idempotencyKey: 'phase4-cn-duration-band-replay' });

    const first = await runtime.invoke(request);
    const replay = await runtime.invoke(request);

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(replay.returnValue).toEqual(first.returnValue);
    expect(replay.receipt).toEqual(first.receipt);
  });

  it('does not execute a merely VALIDATED predecessor or a rejected activation', async () => {
    const predecessor = acceptedValidatedPackage();
    const rejected = prepareExecutableMethodPackageActivationDecisionV1(predecessor, {
      decision: 'REJECTED',
      selectionPriority: 90,
      limitations: ACTIVE_LIMITATIONS,
      policyVersion: 'phase4-cn-duration-band-classification-activation.v1',
      approvedBy: 'markorbit-core-governance',
      approvalTicketRef: 'github:yoomarks/markorbit#311',
      approvedAt: ACTIVE_AT,
      rationale: 'Reject activation for regression coverage.'
    });
    expect(() => activateExecutableMethodPackageV1(predecessor, rejected)).toThrow(
      'REJECTED activation decision cannot produce ACTIVE state'
    );
    expect(() => new CnDurationBandClassificationRunnerV1(rejected)).toThrow(
      'requires an APPROVED activation decision'
    );

    const approved = activatedPackage().activation;
    const { runtime, run } = runtimeWithPackages([predecessor], approved);
    const execution = await runtime.invoke(
      command({ idempotencyKey: 'phase4-cn-duration-band-inactive' })
    );
    expect(execution.returnValue.status).toBe('FAILED');
    expect(execution.outcome.error?.message).toContain('No ACTIVE executable method package');
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects invalid completed-duration input and dataset substitution before runner execution', async () => {
    const { active, activation } = activatedPackage();
    const { runtime, run } = runtimeWithPackages([active], activation);

    await expect(
      runtime.invoke(
        command({
          idempotencyKey: 'phase4-cn-duration-band-negative',
          input: input({ observedCompletedDurationDays: -1 })
        })
      )
    ).rejects.toMatchObject({ code: 'INPUT_CONTRACT_INVALID' });
    await expect(
      runtime.invoke(
        command({
          idempotencyKey: 'phase4-cn-duration-band-fractional',
          input: input({ observedCompletedDurationDays: 1.5 })
        })
      )
    ).rejects.toMatchObject({ code: 'INPUT_CONTRACT_INVALID' });
    await expect(
      runtime.invoke(
        command({
          idempotencyKey: 'phase4-cn-duration-band-dataset-substitution',
          input: input({ acceptedResearchDatasetRef: `research-dataset_${'f'.repeat(64)}` })
        })
      )
    ).rejects.toMatchObject({ code: 'INPUT_CONTRACT_INVALID' });
    expect(run).not.toHaveBeenCalled();
  });

  it('fails closed on ACTIVE package ambiguity and executable threshold drift', async () => {
    const { active, activation } = activatedPackage();
    const ambiguous = runtimeWithPackages([active, structuredClone(active)], activation);
    const ambiguousResult = await ambiguous.runtime.invoke(
      command({ idempotencyKey: 'phase4-cn-duration-band-ambiguous' })
    );
    expect(ambiguousResult.returnValue.status).toBe('FAILED');
    expect(ambiguousResult.outcome.error?.message).toContain('Multiple applicable ACTIVE packages');
    expect(ambiguous.run).not.toHaveBeenCalled();

    const drifted = {
      ...active,
      executable: {
        ...active.executable,
        thresholds: { p25Days: 334, medianDays: 336, p75Days: 383 }
      }
    };
    const driftedRuntime = runtimeWithPackages([drifted], activation);
    const driftedResult = await driftedRuntime.runtime.invoke(
      command({ idempotencyKey: 'phase4-cn-duration-band-threshold-drift' })
    );
    expect(driftedResult.returnValue.status).toBe('FAILED');
    expect(driftedResult.outcome.error?.message).toContain('thresholds have drifted');
    expect(driftedRuntime.run).toHaveBeenCalledTimes(1);
  });
});
