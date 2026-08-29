import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { runCnDurationResearchEvidenceFileIntakeV1 } from '@markorbit/contracts/brain-cn-duration-evidence-intake';
import {
  activateExecutableMethodPackageV1,
  executableMethodActivationEvidenceRefV1,
  prepareExecutableMethodPackageActivationDecisionV1
} from '@markorbit/contracts/brain-method-activation';
import type { ExecutableMethodPackageV1 } from '@markorbit/contracts/brain-method';
import type { CapabilityRequestV2Command } from '@markorbit/contracts/capability-runtime';

import {
  CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION,
  CN_DURATION_ANALYTICAL_CAPABILITY_ID,
  CN_DURATION_ANALYTICAL_CAPABILITY_VERSION,
  CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE,
  CN_DURATION_ANALYTICAL_INPUT_SCHEMA,
  CN_DURATION_ANALYTICAL_OUTPUT_SCHEMA,
  CnDurationDescriptiveDistributionRunnerV1,
  CnDurationMethodSelectionContextResolverV1,
  validateCnDurationAnalyticalInputV1,
  validateCnDurationAnalyticalOutputV1
} from '../src/cn-duration-analytical-pilot.js';
import { GovernedCapabilityRuntime } from '../src/capability-runtime.js';
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
const DATASET_REF =
  'research-dataset_7bdd73d7e4eab9cec0bc04337747f2ea6c1b692f9a79570c4b7ba4fde1faa82d';
const ACTIVE_AT = '2026-08-29T00:30:00.000Z';
const ACTIVE_LIMITATIONS = [
  'Applies only to the accepted bounded CN filing-to-preliminary-publication dataset identity in lineage.',
  'Descriptive elapsed-day statistics are not a legal deadline, SLA, outcome prediction, case-status inference, risk score, or recommendation.',
  'Dataset freshness, source coverage and population bounds remain Data Engine evidence properties; a different dataset identity requires a new evaluation.',
  'Runtime activation is limited to the explicit Phase 4 governed decision bound to this immutable package version; automatic promotion remains prohibited.'
] as const;

function acceptedValidatedPackage(): ExecutableMethodPackageV1 {
  const intake = runCnDurationResearchEvidenceFileIntakeV1(evidencePath);
  if (intake.status !== 'READY') throw new Error(`expected READY, got ${intake.status}`);
  return intake.package;
}

function activatedPackage() {
  const predecessor = acceptedValidatedPackage();
  const activation = prepareExecutableMethodPackageActivationDecisionV1(predecessor, {
    decision: 'APPROVED',
    selectionPriority: 100,
    limitations: ACTIVE_LIMITATIONS,
    policyVersion: 'phase4-governed-method-activation.v1',
    approvedBy: 'markorbit-core-governance',
    approvalTicketRef: 'github:yoomarks/markorbit#309',
    approvedAt: ACTIVE_AT,
    rationale:
      'Activate only the accepted Phase 3 CN descriptive distribution for the narrow Phase 4 analytical Capability pilot; no predictive, legal, scoring, discovery, product or autonomous authority is granted.'
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
    operation: 'DESCRIPTIVE_DURATION_RESEARCH',
    procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
    stage: 'HISTORICAL_FACT_RESEARCH',
    filingBasis: 'ANY',
    segment: 'FILING_TO_PRELIM_PUBLICATION',
    availableData: ['CN_CASE_CURRENT', 'FILING_DATE', 'PRELIM_PUB_DATE', 'SOURCE_LINEAGE'],
    acceptedResearchDatasetRef: DATASET_REF,
    ...overrides
  };
}

function command(overrides: Partial<CapabilityRequestV2Command> = {}): CapabilityRequestV2Command {
  return {
    schemaVersion: 2,
    capabilityId: CN_DURATION_ANALYTICAL_CAPABILITY_ID,
    capabilityVersion: CN_DURATION_ANALYTICAL_CAPABILITY_VERSION,
    caller: {
      workspaceId: 'workspace_phase4_cn_duration',
      principalId: 'principal_phase4_cn_duration',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_phase4_cn_duration'
    },
    purpose: 'Read the accepted bounded CN descriptive duration distribution.',
    input: input(),
    inputSchemaId: CN_DURATION_ANALYTICAL_INPUT_SCHEMA,
    outputSchemaId: CN_DURATION_ANALYTICAL_OUTPUT_SCHEMA,
    riskClass: 'LOW',
    idempotencyKey: 'phase4-cn-duration-pilot-1',
    correlationId: 'correlation_phase4_cn_duration',
    ...overrides
  };
}

function runtimeWithPackages(packages: readonly unknown[], activation: unknown) {
  const runner = new CnDurationDescriptiveDistributionRunnerV1(activation);
  const run = vi.spyOn(runner, 'run');
  const executor = new ExecutableMethodCapabilityExecutorV1({
    packages: { list: () => Promise.resolve(packages) },
    selectionContext: new CnDurationMethodSelectionContextResolverV1(),
    runners: {
      resolve: (kind) => (kind === 'DESCRIPTIVE_EMPIRICAL_DISTRIBUTION' ? runner : undefined)
    }
  });
  const runtime = new GovernedCapabilityRuntime({
    definitions: {
      findCurrent: (capabilityId) =>
        Promise.resolve(
          capabilityId === CN_DURATION_ANALYTICAL_CAPABILITY_ID
            ? CN_DURATION_ANALYTICAL_CAPABILITY_DEFINITION
            : undefined
        )
    },
    implementations: {
      select: (request) =>
        Promise.resolve(
          request.capabilityId === CN_DURATION_ANALYTICAL_CAPABILITY_ID
            ? {
                profile: CN_DURATION_ANALYTICAL_IMPLEMENTATION_PROFILE,
                policyVersion: 'phase4-cn-duration-method-selection.v1'
              }
            : undefined
        )
    },
    inputContracts: {
      validate: (schemaId, value) =>
        schemaId === CN_DURATION_ANALYTICAL_INPUT_SCHEMA &&
        validateCnDurationAnalyticalInputV1(value)
    },
    outputContracts: {
      validate: (schemaId, value) =>
        schemaId === CN_DURATION_ANALYTICAL_OUTPUT_SCHEMA &&
        validateCnDurationAnalyticalOutputV1(value)
    },
    executor,
    now: () => '2026-08-29T01:00:00.000Z'
  });
  return { runtime, run };
}

describe('Phase 4 CN duration analytical Capability pilot', () => {
  it('executes the real accepted descriptive package through governed Capability with exact activation and dataset provenance', async () => {
    const { active, activation } = activatedPackage();
    const { runtime, run } = runtimeWithPackages([active], activation);

    const execution = await runtime.invoke(command());

    expect(execution.returnValue.status).toBe('COMPLETED');
    expect(execution.outcome.status).toBe('SUCCEEDED');
    expect(execution.replayed).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    expect(execution.returnValue.output).toMatchObject({
      schemaVersion: 1,
      kind: 'DESCRIPTIVE_EMPIRICAL_DISTRIBUTION',
      jurisdiction: 'CN',
      procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
      datasetRefId: DATASET_REF,
      quantileMethod: 'NEAREST_RANK',
      statistics: {
        count: 10000,
        min_days: 58,
        p25_days: 335,
        median_days: 336,
        p75_days: 383,
        max_days: 3654
      },
      objectiveOnly: true,
      legalConclusion: false,
      predictiveClaim: false,
      rawPopulationRowsReadByCapability: false
    });
    expect(execution.receipt.evidenceRefs).toContain(
      `brain-method-package:${active.packageId}@${active.packageVersion}`
    );
    expect(execution.receipt.evidenceRefs).toContain(executableMethodActivationEvidenceRefV1(activation));
    expect(
      execution.receipt.evidenceRefs.some((ref) =>
        ref.startsWith(`research-dataset:${DATASET_REF}:`)
      )
    ).toBe(true);
    expect(execution.receipt.evidenceRefs).toContain(
      'capability-runtime:brain-research-hot-path=absent'
    );
    expect(execution.receipt.evidenceRefs).toContain(
      'capability-runtime:data-engine-population-read=absent'
    );
  });

  it('replays the governed result without executing the method runner twice', async () => {
    const { active, activation } = activatedPackage();
    const { runtime, run } = runtimeWithPackages([active], activation);
    const request = command({ idempotencyKey: 'phase4-cn-duration-replay' });

    const first = await runtime.invoke(request);
    const replay = await runtime.invoke(request);

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(replay.returnValue).toEqual(first.returnValue);
    expect(replay.receipt).toEqual(first.receipt);
  });

  it('fails closed before execution when only the Phase 3 VALIDATED predecessor is available', async () => {
    const { predecessor, activation } = activatedPackage();
    const { runtime, run } = runtimeWithPackages([predecessor], activation);

    const execution = await runtime.invoke(command({ idempotencyKey: 'phase4-cn-duration-inactive' }));

    expect(execution.returnValue.status).toBe('FAILED');
    expect(execution.outcome.error?.message).toContain('No ACTIVE executable method package');
    expect(run).not.toHaveBeenCalled();
  });

  it('fails closed on applicability drift and ambiguous ACTIVE packages without runner execution', async () => {
    const { active, activation } = activatedPackage();
    const wrongScope = {
      ...active,
      applicability: { ...active.applicability, jurisdictions: ['US'] }
    };
    const wrongScopeRuntime = runtimeWithPackages([wrongScope], activation);
    const wrongScopeResult = await wrongScopeRuntime.runtime.invoke(
      command({ idempotencyKey: 'phase4-cn-duration-wrong-scope' })
    );
    expect(wrongScopeResult.returnValue.status).toBe('FAILED');
    expect(wrongScopeResult.outcome.error?.message).toContain('No ACTIVE executable method package');
    expect(wrongScopeRuntime.run).not.toHaveBeenCalled();

    const ambiguousRuntime = runtimeWithPackages([active, structuredClone(active)], activation);
    const ambiguousResult = await ambiguousRuntime.runtime.invoke(
      command({ idempotencyKey: 'phase4-cn-duration-ambiguous' })
    );
    expect(ambiguousResult.returnValue.status).toBe('FAILED');
    expect(ambiguousResult.outcome.error?.message).toContain('Multiple applicable ACTIVE packages');
    expect(ambiguousRuntime.run).not.toHaveBeenCalled();
  });

  it('fails closed on missing required data before Capability execution', async () => {
    const { active, activation } = activatedPackage();
    const { runtime, run } = runtimeWithPackages([active], activation);

    await expect(
      runtime.invoke(
        command({
          idempotencyKey: 'phase4-cn-duration-missing-data',
          input: input({ availableData: ['FILING_DATE'] })
        })
      )
    ).rejects.toMatchObject({ code: 'INPUT_CONTRACT_INVALID' });
    expect(run).not.toHaveBeenCalled();
  });

  it('fails closed if the request attempts to substitute another dataset identity', async () => {
    const { active, activation } = activatedPackage();
    const { runtime, run } = runtimeWithPackages([active], activation);
    const result = await runtime.invoke(
      command({
        idempotencyKey: 'phase4-cn-duration-dataset-mismatch',
        input: input({ acceptedResearchDatasetRef: `research-dataset_${'f'.repeat(64)}` })
      })
    );

    expect(result.returnValue.status).toBe('FAILED');
    expect(result.outcome.error?.message).toContain('dataset lineage does not match exactly');
    expect(run).toHaveBeenCalledTimes(1);
  });
});
