import { describe, expect, it } from 'vitest';

import {
  CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1,
  CN_TRADEMARK_LIFECYCLE_HISTORY_INPUT_SCHEMA_ID,
  CN_TRADEMARK_LIFECYCLE_HISTORY_LIMITATIONS,
  CN_TRADEMARK_LIFECYCLE_HISTORY_OUTPUT_SCHEMA_ID
} from '@markorbit/contracts/brain-cn-trademark-lifecycle-history';
import {
  activateExecutableMethodPackageV1,
  executableMethodPackageFingerprintV1,
  prepareExecutableMethodPackageActivationDecisionV1,
  type ExecutableMethodPackageActivationDecisionV1
} from '@markorbit/contracts/brain-method-activation';
import type { ExecutableMethodPackageV1 } from '@markorbit/contracts/brain-method';
import type {
  CapabilityRequestV2,
  ImplementationBinding
} from '@markorbit/contracts/capability-runtime';
import type { TrademarkAssetSourceReference } from '@markorbit/contracts/trademark-asset-workspace';
import {
  noTrademarkLifecycleAuthorityConsequencesV1,
  trademarkLifecycleComputationAdverseLimitationCodeV1,
  trademarkLifecycleComputationAdverseSemanticsBySourceReadStateV1,
  trademarkLifecycleComputationInputFingerprintSha256V1,
  type ExactOwnerReferenceV1,
  type TrademarkLifecycleComputationAdverseStateV1,
  type TrademarkLifecycleComputationInputFingerprintMaterialV1,
  type TrademarkLifecycleComputationOutputV1,
  type TrademarkLifecycleComputationResultV1,
  type TrademarkLifecycleSourceDateObservationV1
} from '@markorbit/contracts/trademark-lifecycle';

import {
  CN_TRADEMARK_LIFECYCLE_HISTORY_STABLE_OUTCOME_CANDIDATE_V1,
  CnTrademarkLifecycleHistoryCandidateRunnerV1,
  CnTrademarkLifecycleHistorySelectionContextResolverV1
} from '../src/cn-trademark-lifecycle-history-candidate.js';

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

const AS_OF = '2026-10-10T01:00:00.000Z';
const RECEIVED_AT = '2026-10-10T02:00:00.000Z';
const WORKSPACE_ID = '018f0000-0000-7000-8000-000000000021';
const TRACK_FINGERPRINT = '1'.repeat(64);

const currentSourceReference: TrademarkAssetSourceReference = {
  owner: 'DATA_ENGINE',
  kind: 'DATA_ENGINE_TRADEMARK_RECORD',
  sourceId: 'cn-case-current_12345678',
  sourceVersion: 'cn-serving-epoch-2026-10-10',
  sourceFingerprintSha256: '2'.repeat(64),
  observedAt: AS_OF,
  freshness: 'CURRENT'
};

const competingSourceReference: TrademarkAssetSourceReference = {
  ...currentSourceReference,
  sourceId: 'cn-case-history_12345678',
  sourceVersion: 'cn-serving-epoch-2026-10-09',
  sourceFingerprintSha256: '3'.repeat(64),
  observedAt: '2026-10-09T01:00:00.000Z'
};

const professionalReviewReceiptReference: ExactOwnerReferenceV1 = {
  owner: 'MARKREG',
  kind: 'LIFECYCLE_RULE_REVIEW_RECEIPT',
  id: 'lifecycle-rule-review_fixture-only',
  version: 1,
  fingerprintSha256: '4'.repeat(64)
};

const sourceContractReference: ExactOwnerReferenceV1 = {
  owner: 'DATA_ENGINE',
  kind: 'SOURCE_CONTRACT',
  id: 'CN_CASE_CURRENT_PRELIMINARY_PUBLICATION_SOURCE_READ_RECEIPT_V3',
  version: 3,
  fingerprintSha256: '5'.repeat(64)
};

function syntheticFixtureActivation(
  decision: 'APPROVED' | 'REJECTED' = 'APPROVED',
  approvedAt = '2026-10-10T00:30:00.000Z'
) {
  const activation = prepareExecutableMethodPackageActivationDecisionV1(
    CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1.package,
    {
      decision,
      selectionPriority: 10,
      limitations: CN_TRADEMARK_LIFECYCLE_HISTORY_LIMITATIONS,
      policyVersion: 'fixture-only.lcr-a2b2c.synthetic-activation.v1',
      approvedBy: 'test-fixture-not-brain-governance-evidence',
      approvalTicketRef: 'fixture-only:lcr-a2b2c',
      approvedAt,
      rationale:
        'Synthetic fixture only: exercises the activation-gated runner and is not production activation, owner evidence, Capability admission or Rule Pack admission.'
    }
  );
  return {
    activation,
    active:
      decision === 'APPROVED'
        ? activateExecutableMethodPackageV1(
            CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1.package,
            activation
          )
        : undefined
  };
}

function ownerReference(reference: TrademarkAssetSourceReference): ExactOwnerReferenceV1 {
  return {
    owner: reference.owner,
    kind: reference.kind,
    id: reference.sourceId,
    version: reference.sourceVersion,
    ...(reference.sourceFingerprintSha256 === undefined
      ? {}
      : { fingerprintSha256: reference.sourceFingerprintSha256 })
  };
}

function observations(
  overrides: Partial<
    Record<
      'FILING_DATE' | 'PRELIMINARY_PUBLICATION_DATE',
      TrademarkLifecycleSourceDateObservationV1
    >
  > = {},
  sourceReference: TrademarkAssetSourceReference = currentSourceReference
): readonly TrademarkLifecycleSourceDateObservationV1[] {
  return [
    overrides.FILING_DATE ?? {
      factCode: 'FILING_DATE',
      valueState: 'AVAILABLE',
      candidate: {
        value: '2025-01-02',
        precision: 'DAY',
        jurisdictionTimeZone: 'Asia/Shanghai',
        sourceReferences: [sourceReference]
      },
      reasonCodes: ['SOURCE_DATE_RECORDED']
    },
    overrides.PRELIMINARY_PUBLICATION_DATE ?? {
      factCode: 'PRELIMINARY_PUBLICATION_DATE',
      valueState: 'UNKNOWN',
      candidate: null,
      sourceReferences: [],
      reasonCodes: ['SOURCE_FIELD_NOT_RECORDED']
    }
  ];
}

function adverseObservations(
  state: TrademarkLifecycleComputationAdverseStateV1
): readonly TrademarkLifecycleSourceDateObservationV1[] {
  return [
    {
      factCode: 'FILING_DATE',
      valueState: 'UNKNOWN',
      candidate: null,
      sourceReferences: [],
      reasonCodes: [`SOURCE_READ_${state}`]
    },
    {
      factCode: 'PRELIMINARY_PUBLICATION_DATE',
      valueState: 'UNKNOWN',
      candidate: null,
      sourceReferences: [],
      reasonCodes: [`SOURCE_READ_${state}`]
    }
  ];
}

function computedOutput(
  output: Readonly<TrademarkLifecycleComputationResultV1>
): Readonly<TrademarkLifecycleComputationOutputV1> {
  if (output.status !== 'COMPUTED') throw new Error('fixture expected COMPUTED output');
  return output;
}

function signedInput(
  active: Readonly<ExecutableMethodPackageV1>,
  options: Readonly<{
    observations?: readonly TrademarkLifecycleSourceDateObservationV1[];
    sourceReads?: TrademarkLifecycleComputationInputFingerprintMaterialV1['sourceReads'];
    basis?: string;
    methodReference?: ExactOwnerReferenceV1;
  }> = {}
) {
  const material: TrademarkLifecycleComputationInputFingerprintMaterialV1 = {
    schemaVersion: 1,
    workspaceId: WORKSPACE_ID,
    asset: { id: 'trademark-asset_cn-12345678', version: 7 },
    asOf: AS_OF,
    track: {
      jurisdiction: 'CN',
      authority: 'CNIPA',
      objectType: 'TRADEMARK_APPLICATION',
      procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
      applicationOrRegistrationBasis: options.basis ?? 'ANY',
      trackFingerprintSha256: TRACK_FINGERPRINT,
      relatedOwnerReferences: [ownerReference(currentSourceReference)]
    },
    sourceReads: options.sourceReads ?? [
      {
        scopeId: 'cn-case-current_application-12345678',
        owner: 'DATA_ENGINE',
        state: 'OBSERVED',
        asOf: AS_OF,
        sourceReferences: [currentSourceReference]
      }
    ],
    sourceDateObservations: options.observations ?? observations(),
    methodPackageReference: options.methodReference ?? {
      owner: 'BRAIN',
      kind: 'TEMPORAL_RESOLUTION_METHOD_PACKAGE',
      id: active.packageId,
      version: active.packageVersion,
      fingerprintSha256: executableMethodPackageFingerprintV1(active)
    },
    materializedReferenceDependencies: [
      professionalReviewReceiptReference,
      sourceContractReference
    ],
    professionalReviewReceiptReference
  };
  return {
    ...material,
    normalizedInputFingerprintSha256:
      trademarkLifecycleComputationInputFingerprintSha256V1(material)
  };
}

function request(
  active: Readonly<ExecutableMethodPackageV1>,
  input: unknown = signedInput(active),
  overrides: Partial<CapabilityRequestV2> = {}
): CapabilityRequestV2 {
  return {
    schemaVersion: 2,
    capabilityRequestId: 'capreq_lcr-a2b2c-fixture',
    capabilityId: 'trademark.lifecycle.project',
    capabilityVersion: 'candidate-lcr-a2b2c',
    caller: {
      workspaceId: WORKSPACE_ID,
      principalId: 'principal_lcr-a2b2c',
      callerProduct: 'MARKREG',
      permissionContextRef: 'permission_lcr-a2b2c'
    },
    purpose: 'Produce transient source-recorded CN completed history only.',
    input,
    inputSchemaId: CN_TRADEMARK_LIFECYCLE_HISTORY_INPUT_SCHEMA_ID,
    outputSchemaId: CN_TRADEMARK_LIFECYCLE_HISTORY_OUTPUT_SCHEMA_ID,
    riskClass: 'LOW',
    idempotencyKey: 'lcr-a2b2c-fixture',
    correlationId: 'correlation_lcr-a2b2c',
    receivedAt: RECEIVED_AT,
    ...overrides
  };
}

function binding(
  capabilityRequestId: CapabilityRequestV2['capabilityRequestId'] = 'capreq_lcr-a2b2c-fixture'
): ImplementationBinding {
  return {
    schemaVersion: 1,
    implementationBindingId: 'implementation-binding_lcr-a2b2c-fixture',
    capabilityRequestId,
    runtimeCapability: {
      id: 'runtime-capability_lcr-a2b2c-fixture',
      version: 1,
      capabilityId: 'trademark.lifecycle.project',
      capabilityVersion: 'candidate-lcr-a2b2c'
    },
    implementation: {
      id: 'implementation-profile_lcr-a2b2c-fixture',
      version: 1,
      implementationKey: 'fixture-only.cn-lifecycle-history',
      kind: 'DETERMINISTIC_SERVICE'
    },
    selectionPolicyVersion: 'fixture-only.v1',
    boundAt: RECEIVED_AT
  };
}

async function execute(
  options: Parameters<typeof signedInput>[1] = {},
  requestOverrides: Partial<CapabilityRequestV2> = {}
) {
  const { activation, active } = syntheticFixtureActivation();
  if (!active) throw new Error('fixture drift');
  const runner = new CnTrademarkLifecycleHistoryCandidateRunnerV1(activation);
  const exactRequest = request(active, signedInput(active, options), requestOverrides);
  return runner.run({ request: exactRequest, binding: binding(), package: active });
}

function expectResolverAndRunnerToReject(
  active: Readonly<ExecutableMethodPackageV1>,
  activation: Readonly<ExecutableMethodPackageActivationDecisionV1>,
  input: unknown,
  expected: RegExp
): void {
  const exactRequest = request(active, input);
  const exactBinding = binding();
  expect(() =>
    new CnTrademarkLifecycleHistorySelectionContextResolverV1().resolve(exactRequest, exactBinding)
  ).toThrow(expected);
  expect(() =>
    new CnTrademarkLifecycleHistoryCandidateRunnerV1(activation).run({
      request: exactRequest,
      binding: exactBinding,
      package: active
    })
  ).toThrow(expected);
}

describe('LCR-A2b2c CN lifecycle observed-history candidate runner', () => {
  it('keeps the stable outcome, Method and package candidate-only and unregistered', () => {
    expect(CN_TRADEMARK_LIFECYCLE_HISTORY_STABLE_OUTCOME_CANDIDATE_V1).toMatchObject({
      planningCoordinate: 'trademark.lifecycle.project',
      candidateState: 'CANDIDATE_ONLY',
      runtimeRegistered: false,
      capabilityAdmitted: false,
      projectionPersistenceAuthorized: false,
      officialTruthCreated: false,
      legalDeadlineCertified: false,
      executionAuthorized: false
    });
    expect(CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1.method.lifecycle).toBe('VALIDATED');
    expect(CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1.package.lifecycle).toBe('VALIDATED');
    expect(CN_TRADEMARK_LIFECYCLE_HISTORY_STABLE_OUTCOME_CANDIDATE_V1).not.toHaveProperty(
      'runtimeCapabilityDefinitionId'
    );
    expect(CN_TRADEMARK_LIFECYCLE_HISTORY_STABLE_OUTCOME_CANDIDATE_V1).not.toHaveProperty(
      'implementationProfileId'
    );
  });

  it('maps one owner-observed filing date to OCCURRED history and nothing current or future', async () => {
    const result = await execute();
    const output = computedOutput(result.output);

    expect(output.computedAt).toBe(RECEIVED_AT);
    expect(output.stages).toHaveLength(1);
    expect(output.stages[0]).toMatchObject({
      stageCode: 'FILING',
      processState: 'OCCURRED',
      milestones: [{ milestoneCode: 'APPLICATION_FILED', processState: 'OCCURRED' }]
    });
    expect(output.currentPosition).toEqual({
      supportState: 'UNKNOWN',
      currentGranularity: null,
      currentStageCode: null,
      currentMilestoneCode: null,
      reasonCodes: ['CURRENT_POSITION_NOT_INFERRED']
    });
    expect(output.authority).toEqual(noTrademarkLifecycleAuthorityConsequencesV1);
    expect(output.stages.flatMap((stage) => [stage, ...stage.milestones])).toSatisfy(
      (nodes: Array<{ processState: string }>) =>
        nodes.every((node) => !['CURRENT', 'UPCOMING', 'FUTURE'].includes(node.processState))
    );
    expect(JSON.stringify(output)).not.toMatch(
      /RULE_WINDOW|PREDICTION|TYPICAL_RANGE|destinationReference|attentionOrRecommendationReference/
    );
    expect(result.evidenceRefs).toContain(
      `trademark-lifecycle-output:${output.outputFingerprintSha256}`
    );
  });

  it('maps both owner-observed dates to two ordered OCCURRED historical milestones', async () => {
    const result = await execute({
      observations: observations({
        PRELIMINARY_PUBLICATION_DATE: {
          factCode: 'PRELIMINARY_PUBLICATION_DATE',
          valueState: 'AVAILABLE',
          candidate: {
            value: '2025-04-20',
            precision: 'DAY',
            jurisdictionTimeZone: 'Asia/Shanghai',
            sourceReferences: [currentSourceReference]
          },
          reasonCodes: ['SOURCE_DATE_RECORDED']
        }
      })
    });
    const output = computedOutput(result.output);

    expect(output.stages.map((stage) => [stage.stageCode, stage.processState])).toEqual([
      ['FILING', 'OCCURRED'],
      ['PRELIMINARY_PUBLICATION', 'OCCURRED']
    ]);
    expect(output.coverage.state).toBe('FULL');
    expect(output.primaryTimeEvaluation.state).toBe('PRESENT');
    if (output.primaryTimeEvaluation.state !== 'PRESENT') throw new Error('fixture drift');
    expect(output.primaryTimeEvaluation.target.timeAssertionId).toContain(
      'preliminary_publication_date'
    );
    expect(output.lastUndisputedPosition).toMatchObject({
      stageCode: 'PRELIMINARY_PUBLICATION',
      milestoneCode: 'PRELIMINARY_PUBLICATION_RECORDED'
    });
  });

  it('allows publication-only history while explicitly retaining the missing filing date', async () => {
    const result = await execute({
      observations: observations({
        FILING_DATE: {
          factCode: 'FILING_DATE',
          valueState: 'UNKNOWN',
          candidate: null,
          sourceReferences: [],
          reasonCodes: ['SOURCE_FIELD_NOT_RECORDED']
        },
        PRELIMINARY_PUBLICATION_DATE: {
          factCode: 'PRELIMINARY_PUBLICATION_DATE',
          valueState: 'AVAILABLE',
          candidate: {
            value: '2025-04-20',
            precision: 'DAY',
            jurisdictionTimeZone: 'Asia/Shanghai',
            sourceReferences: [currentSourceReference]
          },
          reasonCodes: ['SOURCE_DATE_RECORDED']
        }
      })
    });
    const output = computedOutput(result.output);

    expect(output.stages.map((stage) => stage.stageCode)).toEqual(['PRELIMINARY_PUBLICATION']);
    expect(output.missingInputCodes).toContain('FILING_DATE_NOT_AVAILABLE');
    expect(output.coverage.state).toBe('PARTIAL');
  });

  it('keeps two UNKNOWN observation records as a restricted UNKNOWN stage, never all-clear', async () => {
    const unknownObservations = observations({
      FILING_DATE: {
        factCode: 'FILING_DATE',
        valueState: 'UNKNOWN',
        candidate: null,
        sourceReferences: [],
        reasonCodes: ['SOURCE_FIELD_NOT_RECORDED']
      },
      PRELIMINARY_PUBLICATION_DATE: {
        factCode: 'PRELIMINARY_PUBLICATION_DATE',
        valueState: 'UNKNOWN',
        candidate: null,
        sourceReferences: [],
        reasonCodes: ['SOURCE_FIELD_NOT_RECORDED']
      }
    });
    const result = await execute({ observations: unknownObservations });
    const output = computedOutput(result.output);

    expect(output.stages).toEqual([
      expect.objectContaining({
        stageCode: 'SOURCE_RECORDED_HISTORY',
        processState: 'UNKNOWN',
        milestones: []
      })
    ]);
    expect(output.lastUndisputedPosition).toBeNull();
    expect(output.coverage.state).toBe('PARTIAL');
    expect(output.primaryTimeEvaluation.state).toBe('PARTIAL');
    expect(output.missingInputCodes).toEqual([
      'FILING_DATE_NOT_AVAILABLE',
      'PRELIMINARY_PUBLICATION_DATE_NOT_AVAILABLE'
    ]);
  });

  it('retains stale observed history as stale partial evidence', async () => {
    const staleReference = { ...currentSourceReference, freshness: 'STALE' as const };
    const result = await execute({
      sourceReads: [
        {
          scopeId: 'cn-case-current_application-12345678',
          owner: 'DATA_ENGINE',
          state: 'OBSERVED',
          asOf: AS_OF,
          sourceReferences: [staleReference]
        }
      ],
      observations: observations({}, staleReference)
    });
    const output = computedOutput(result.output);

    expect(output.stages[0]?.processState).toBe('OCCURRED');
    expect(output.currentness).toMatchObject({
      state: 'STALE',
      reasonCodes: ['SOURCE_OBSERVATION_STALE']
    });
    expect(output.coverage.state).toBe('PARTIAL');
  });

  it('exposes a conflicting date without producing an OCCURRED node for that fact', async () => {
    const result = await execute({
      sourceReads: [
        {
          scopeId: 'cn-case-current_application-12345678',
          owner: 'DATA_ENGINE',
          state: 'OBSERVED',
          asOf: AS_OF,
          sourceReferences: [currentSourceReference, competingSourceReference]
        }
      ],
      observations: observations({
        FILING_DATE: {
          factCode: 'FILING_DATE',
          valueState: 'CONFLICTING',
          candidates: [
            {
              value: '2025-01-02',
              precision: 'DAY',
              jurisdictionTimeZone: 'Asia/Shanghai',
              sourceReferences: [currentSourceReference]
            },
            {
              value: '2025-01-03',
              precision: 'DAY',
              jurisdictionTimeZone: 'Asia/Shanghai',
              sourceReferences: [competingSourceReference]
            }
          ],
          conflictId: 'SOURCE_DATES_CONFLICT',
          reasonCodes: ['SOURCE_DATES_CONFLICT']
        }
      })
    });
    const output = computedOutput(result.output);

    const filing = output.stages.find((stage) => stage.stageCode === 'FILING');
    expect(filing?.processState).toBe('UNKNOWN');
    expect(filing?.milestones[0]?.processState).toBe('UNKNOWN');
    expect(filing?.milestones[0]?.timeAssertions[0]).toMatchObject({
      valueState: 'CONFLICTING',
      value: null
    });
    expect(output.conflictState).toBe('UNRESOLVED');
    expect(output.conflicts).toHaveLength(1);
    expect(output.currentPosition.supportState).toBe('UNKNOWN');
  });

  for (const state of ['NOT_OBSERVED', 'NOT_COVERED', 'UNAVAILABLE'] as const) {
    it(`maps a pure ${state} read to the canonical NOT_COMPUTED branch`, async () => {
      const result = await execute({
        sourceReads: [
          {
            scopeId: 'cn-case-current_application-12345678',
            owner: 'DATA_ENGINE',
            state,
            asOf: AS_OF,
            sourceReferences: []
          }
        ],
        observations: adverseObservations(state)
      });
      const output = result.output;
      const semantics = trademarkLifecycleComputationAdverseSemanticsBySourceReadStateV1[state];

      expect(output.status).toBe('NOT_COMPUTED');
      if (output.status !== 'NOT_COMPUTED') throw new Error('fixture drift');
      expect(output).toMatchObject({
        sourceReadState: state,
        evaluatedAt: RECEIVED_AT,
        coverageState: semantics.coverageState,
        currentnessState: semantics.currentnessState,
        dependencyState: semantics.dependencyState,
        reasonCodes: semantics.reasonCodes,
        dependencyReasonCodes: semantics.dependencyReasonCodes,
        limitationCodes: [trademarkLifecycleComputationAdverseLimitationCodeV1],
        authority: noTrademarkLifecycleAuthorityConsequencesV1
      });
      expect(output.sourceReads).toHaveLength(1);
      expect(output.sourceReads[0]?.sourceReferences).toEqual([]);
      expect(output).not.toHaveProperty('stages');
      expect(output).not.toHaveProperty('currentPosition');
      expect(output).not.toHaveProperty('lastUndisputedPosition');
      expect(output).not.toHaveProperty('nextItemEvaluation');
      expect(output).not.toHaveProperty('recommendationEvaluation');
      expect(output).not.toHaveProperty('primaryTimeEvaluation');
      expect(output).not.toHaveProperty('projectionId');
      expect(output).not.toHaveProperty('destinationReference');
      expect(result.evidenceRefs).toContain(
        `trademark-lifecycle-adverse-result:${output.adverseResultFingerprintSha256}`
      );
    });
  }

  it('rejects mixed OBSERVED plus adverse reads instead of borrowing observed scope', async () => {
    await expect(
      execute({
        sourceReads: [
          {
            scopeId: 'cn-case-last-observed_application-12345678',
            owner: 'DATA_ENGINE',
            state: 'OBSERVED',
            asOf: '2026-10-09T01:00:00.000Z',
            sourceReferences: [competingSourceReference]
          },
          {
            scopeId: 'cn-case-current_application-12345678',
            owner: 'DATA_ENGINE',
            state: 'NOT_OBSERVED',
            asOf: AS_OF,
            sourceReferences: []
          }
        ],
        observations: adverseObservations('NOT_OBSERVED')
      })
    ).rejects.toThrow(
      /sourceReads must contain between 1 and 1 items|one adverse state, no OBSERVED read|exactly one exact-scope source read/i
    );
  });

  it('rejects an adverse source read carrying a positive observed reference', async () => {
    await expect(
      execute({
        sourceReads: [
          {
            scopeId: 'cn-case-current_application-12345678',
            owner: 'DATA_ENGINE',
            state: 'UNAVAILABLE',
            asOf: AS_OF,
            sourceReferences: [currentSourceReference]
          }
        ],
        observations: adverseObservations('UNAVAILABLE')
      })
    ).rejects.toThrow(/cannot carry positive source references/i);
  });

  it('resolves only the exact candidate applicability and exact required observation records', () => {
    const { active } = syntheticFixtureActivation();
    if (!active) throw new Error('fixture drift');
    const resolver = new CnTrademarkLifecycleHistorySelectionContextResolverV1();

    expect(resolver.resolve(request(active), binding())).toMatchObject({
      methodFamily: 'TEMPORAL_RESOLUTION',
      jurisdiction: 'CN',
      authority: 'CNIPA',
      operation: 'PROJECT_TRADEMARK_LIFECYCLE',
      filingBasis: 'ANY',
      stage: 'SOURCE_RECORDED_COMPLETED_HISTORY'
    });
    expect(() =>
      resolver.resolve(request(active, signedInput(active, { basis: 'DOMESTIC' })), binding())
    ).toThrow(/exact candidate applicability/i);
    const missingObservation = signedInput(active, { observations: observations().slice(0, 1) });
    expect(() => resolver.resolve(request(active, missingObservation), binding())).toThrow(
      /exactly one filing-date and one preliminary-publication-date/i
    );
  });

  it('rejects two OBSERVED source scopes in both resolver and runner', () => {
    const { activation, active } = syntheticFixtureActivation();
    if (!active) throw new Error('fixture drift');
    const input = signedInput(active, {
      sourceReads: [
        {
          scopeId: 'cn-case-current_application-12345678',
          owner: 'DATA_ENGINE',
          state: 'OBSERVED',
          asOf: AS_OF,
          sourceReferences: [currentSourceReference]
        },
        {
          scopeId: 'cn-case-history_application-12345678',
          owner: 'DATA_ENGINE',
          state: 'OBSERVED',
          asOf: AS_OF,
          sourceReferences: [competingSourceReference]
        }
      ]
    });
    const expected = /exactly one.*source read|one.*OBSERVED.*scope|multiple.*source scope/i;

    expectResolverAndRunnerToReject(active, activation, input, expected);
  });

  it.each([
    {
      label: 'DAY filing date after input.asOf',
      factCode: 'FILING_DATE' as const,
      value: '2026-10-11',
      precision: 'DAY' as const
    },
    {
      label: 'SECOND preliminary-publication date after input.asOf',
      factCode: 'PRELIMINARY_PUBLICATION_DATE' as const,
      value: '2026-10-10T01:00:00.001Z',
      precision: 'SECOND' as const
    },
    {
      label: 'MONTH filing date after input.asOf',
      factCode: 'FILING_DATE' as const,
      value: '2026-11',
      precision: 'MONTH' as const
    },
    {
      label: 'YEAR preliminary-publication date after input.asOf',
      factCode: 'PRELIMINARY_PUBLICATION_DATE' as const,
      value: '2027',
      precision: 'YEAR' as const
    }
  ])('rejects an available $label', async ({ factCode, value, precision }) => {
    const futureObservation: TrademarkLifecycleSourceDateObservationV1 = {
      factCode,
      valueState: 'AVAILABLE',
      candidate: {
        value,
        precision,
        jurisdictionTimeZone: 'Asia/Shanghai',
        sourceReferences: [currentSourceReference]
      },
      reasonCodes: ['SOURCE_DATE_RECORDED']
    };

    await expect(
      execute({ observations: observations({ [factCode]: futureObservation }) })
    ).rejects.toThrow(
      /cannot occur after input\.asOf|available.*date.*after.*asOf|future.*source.*date/i
    );
  });

  it('accepts an AVAILABLE DAY equal to the local input.asOf day', async () => {
    const result = await execute({
      observations: observations({
        FILING_DATE: {
          factCode: 'FILING_DATE',
          valueState: 'AVAILABLE',
          candidate: {
            value: '2026-10-10',
            precision: 'DAY',
            jurisdictionTimeZone: 'Asia/Shanghai',
            sourceReferences: [currentSourceReference]
          },
          reasonCodes: ['SOURCE_DATE_RECORDED']
        }
      })
    });

    expect(computedOutput(result.output).stages[0]).toMatchObject({
      stageCode: 'FILING',
      processState: 'OCCURRED'
    });
  });

  it.each([
    {
      label: 'DAY precision',
      filingValue: '2025-01-03',
      publicationValue: '2025-01-02',
      precision: 'DAY' as const
    },
    {
      label: 'SECOND precision',
      filingValue: '2025-01-03T00:00:00.000Z',
      publicationValue: '2025-01-02T23:59:59.000Z',
      precision: 'SECOND' as const
    }
  ])(
    'rejects preliminary publication before filing at $label',
    ({ filingValue, publicationValue, precision }) => {
      const { activation, active } = syntheticFixtureActivation();
      if (!active) throw new Error('fixture drift');
      const input = signedInput(active, {
        observations: observations({
          FILING_DATE: {
            factCode: 'FILING_DATE',
            valueState: 'AVAILABLE',
            candidate: {
              value: filingValue,
              precision,
              jurisdictionTimeZone: 'Asia/Shanghai',
              sourceReferences: [currentSourceReference]
            },
            reasonCodes: ['SOURCE_DATE_RECORDED']
          },
          PRELIMINARY_PUBLICATION_DATE: {
            factCode: 'PRELIMINARY_PUBLICATION_DATE',
            valueState: 'AVAILABLE',
            candidate: {
              value: publicationValue,
              precision,
              jurisdictionTimeZone: 'Asia/Shanghai',
              sourceReferences: [currentSourceReference]
            },
            reasonCodes: ['SOURCE_DATE_RECORDED']
          }
        })
      });

      expectResolverAndRunnerToReject(
        active,
        activation,
        input,
        /filing.*after.*preliminary.*publication|preliminary.*publication.*before.*filing|chronolog|inversion/i
      );
    }
  );

  it.each([
    {
      label: 'different precision',
      publicationValue: '2025-01-02T00:00:00.000Z',
      publicationPrecision: 'SECOND' as const,
      publicationTimeZone: 'Asia/Shanghai'
    },
    {
      label: 'different jurisdiction time zone',
      publicationValue: '2025-01-02',
      publicationPrecision: 'DAY' as const,
      publicationTimeZone: 'America/New_York'
    }
  ])(
    'rejects two available dates with $label as not deterministically comparable',
    ({ publicationValue, publicationPrecision, publicationTimeZone }) => {
      const { activation, active } = syntheticFixtureActivation();
      if (!active) throw new Error('fixture drift');
      const input = signedInput(active, {
        observations: observations({
          FILING_DATE: {
            factCode: 'FILING_DATE',
            valueState: 'AVAILABLE',
            candidate: {
              value: '2025-01-01',
              precision: 'DAY',
              jurisdictionTimeZone: 'Asia/Shanghai',
              sourceReferences: [currentSourceReference]
            },
            reasonCodes: ['SOURCE_DATE_RECORDED']
          },
          PRELIMINARY_PUBLICATION_DATE: {
            factCode: 'PRELIMINARY_PUBLICATION_DATE',
            valueState: 'AVAILABLE',
            candidate: {
              value: publicationValue,
              precision: publicationPrecision,
              jurisdictionTimeZone: publicationTimeZone,
              sourceReferences: [currentSourceReference]
            },
            reasonCodes: ['SOURCE_DATE_RECORDED']
          }
        })
      });

      expectResolverAndRunnerToReject(
        active,
        activation,
        input,
        /same precision|same jurisdiction time zone|deterministically comparable|precision.*time zone/i
      );
    }
  );

  it('locks request identity, fixed capability, caller Workspace and binding capability identity in resolver and runner', () => {
    const { activation, active } = syntheticFixtureActivation();
    if (!active) throw new Error('fixture drift');
    const resolver = new CnTrademarkLifecycleHistorySelectionContextResolverV1();
    const runner = new CnTrademarkLifecycleHistoryCandidateRunnerV1(activation);
    const exactRequest = request(active);
    const exactBinding = binding();
    const assertBothReject = (
      changedRequest: CapabilityRequestV2,
      changedBinding: ImplementationBinding,
      expected: RegExp
    ) => {
      expect(() => resolver.resolve(changedRequest, changedBinding)).toThrow(expected);
      expect(() =>
        runner.run({ request: changedRequest, binding: changedBinding, package: active })
      ).toThrow(expected);
    };

    assertBothReject(
      { ...exactRequest, capabilityRequestId: 'capreq_lcr-a2b2c-other' },
      exactBinding,
      /binding does not match the exact Capability request identity/i
    );
    assertBothReject(
      { ...exactRequest, capabilityId: 'trademark.lifecycle.other' },
      exactBinding,
      /request does not match the fixed candidate capability/i
    );
    assertBothReject(
      { ...exactRequest, capabilityVersion: 'candidate-other' },
      exactBinding,
      /request does not match the fixed candidate capability/i
    );
    assertBothReject(
      {
        ...exactRequest,
        caller: {
          ...exactRequest.caller,
          workspaceId: '018f0000-0000-7000-8000-000000000099'
        }
      },
      exactBinding,
      /caller Workspace does not match the normalized input Workspace/i
    );

    const requestBindingDrift = structuredClone(exactBinding);
    requestBindingDrift.capabilityRequestId = 'capreq_lcr-a2b2c-other';
    assertBothReject(
      exactRequest,
      requestBindingDrift,
      /binding does not match the exact Capability request identity/i
    );
    const bindingCapabilityIdDrift: ImplementationBinding = {
      ...exactBinding,
      runtimeCapability: {
        ...exactBinding.runtimeCapability,
        capabilityId: 'trademark.lifecycle.other'
      }
    };
    assertBothReject(
      exactRequest,
      bindingCapabilityIdDrift,
      /binding does not match the exact Capability request identity/i
    );
    const bindingCapabilityVersionDrift: ImplementationBinding = {
      ...exactBinding,
      runtimeCapability: {
        ...exactBinding.runtimeCapability,
        capabilityVersion: 'candidate-other'
      }
    };
    assertBothReject(
      exactRequest,
      bindingCapabilityVersionDrift,
      /binding does not match the exact Capability request identity/i
    );
  });

  it('rejects rejected activation, activation-limitation drift and historical Method-package substitution', () => {
    const rejected = syntheticFixtureActivation('REJECTED');
    expect(() => new CnTrademarkLifecycleHistoryCandidateRunnerV1(rejected.activation)).toThrow(
      /requires an APPROVED activation decision/i
    );

    const { activation, active } = syntheticFixtureActivation();
    if (!active) throw new Error('fixture drift');
    const limitationDrift = structuredClone(
      activation
    ) as Mutable<ExecutableMethodPackageActivationDecisionV1>;
    limitationDrift.target.limitations = ['Widened beyond the reviewed candidate limitations.'];
    expect(() => new CnTrademarkLifecycleHistoryCandidateRunnerV1(limitationDrift)).toThrow(
      /must preserve the exact reviewed candidate limitations/i
    );

    const runner = new CnTrademarkLifecycleHistoryCandidateRunnerV1(activation);

    const historicalReference: ExactOwnerReferenceV1 = {
      owner: 'BRAIN',
      kind: 'TEMPORAL_RESOLUTION_METHOD_PACKAGE',
      id: active.packageId,
      version: CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1.package.packageVersion,
      fingerprintSha256: executableMethodPackageFingerprintV1(
        CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1.package
      )
    };
    expect(() =>
      runner.run({
        request: request(active, signedInput(active, { methodReference: historicalReference })),
        binding: binding(),
        package: active
      })
    ).toThrow(/exact activated Method package version/i);
  });

  it.each([
    {
      label: 'input schema',
      mutate: (pkg: Mutable<ExecutableMethodPackageV1>) => {
        pkg.inputSchemaId = 'brain-input.cn-trademark-lifecycle-history.drifted';
      }
    },
    {
      label: 'output schema',
      mutate: (pkg: Mutable<ExecutableMethodPackageV1>) => {
        pkg.outputSchemaId = 'brain.cn-trademark-lifecycle-history.drifted';
      }
    },
    {
      label: 'Method id',
      mutate: (pkg: Mutable<ExecutableMethodPackageV1>) => {
        pkg.methodId = 'brain-method_cn-trademark-lifecycle-source-recorded-history-drifted';
      }
    },
    {
      label: 'Method version id',
      mutate: (pkg: Mutable<ExecutableMethodPackageV1>) => {
        pkg.methodVersionId =
          'brain-method-version_cn-trademark-lifecycle-source-recorded-history-drifted';
      }
    },
    {
      label: 'evaluation',
      mutate: (pkg: Mutable<ExecutableMethodPackageV1>) => {
        pkg.evaluation.evaluationId =
          'evaluation_cn-trademark-lifecycle-source-recorded-history-drifted';
      }
    },
    {
      label: 'limitations',
      mutate: (pkg: Mutable<ExecutableMethodPackageV1>) => {
        pkg.limitations = ['Widened beyond the exact activation successor.'];
      }
    },
    {
      label: 'selection priority',
      mutate: (pkg: Mutable<ExecutableMethodPackageV1>) => {
        pkg.selectionPriority += 1;
      }
    },
    {
      label: 'past but different activatedAt',
      mutate: (pkg: Mutable<ExecutableMethodPackageV1>) => {
        pkg.activatedAt = '2026-10-10T00:45:00.000Z';
      }
    },
    {
      label: 'executable kind',
      mutate: (pkg: Mutable<ExecutableMethodPackageV1>) => {
        pkg.executable.kind = 'DRIFTED_EXECUTABLE_KIND';
      }
    }
  ])('rejects ACTIVE successor $label drift', ({ mutate }) => {
    const { activation, active } = syntheticFixtureActivation();
    if (!active) throw new Error('fixture drift');
    const runner = new CnTrademarkLifecycleHistoryCandidateRunnerV1(activation);
    const drifted = structuredClone(active) as Mutable<ExecutableMethodPackageV1>;
    mutate(drifted);

    expect(() =>
      runner.run({ request: request(active), binding: binding(), package: drifted })
    ).toThrow(/does not match the exact governed activation successor/i);
  });

  it('rejects a missing activation clock and activation after request receipt', () => {
    const { activation, active } = syntheticFixtureActivation();
    if (!active) throw new Error('fixture drift');
    const runner = new CnTrademarkLifecycleHistoryCandidateRunnerV1(activation);
    const withoutActivatedAt = structuredClone(active) as Mutable<ExecutableMethodPackageV1>;
    delete withoutActivatedAt.activatedAt;
    expect(() =>
      runner.run({
        request: request(active),
        binding: binding(),
        package: withoutActivatedAt
      })
    ).toThrow(/requires an activatedAt timestamp/i);

    const future = syntheticFixtureActivation('APPROVED', '2026-10-10T03:00:00.000Z');
    const futureActive = future.active;
    if (!futureActive) throw new Error('fixture drift');
    const futureRunner = new CnTrademarkLifecycleHistoryCandidateRunnerV1(future.activation);
    expect(() =>
      futureRunner.run({
        request: request(futureActive),
        binding: binding(),
        package: futureActive
      })
    ).toThrow(/activatedAt must not follow Capability request receivedAt/i);
  });

  it('fails closed on boundary/grace inputs and on lifecycle EMPTY', () => {
    const { activation, active } = syntheticFixtureActivation();
    if (!active) throw new Error('fixture drift');
    const runner = new CnTrademarkLifecycleHistoryCandidateRunnerV1(activation);
    const withBoundaryAndGrace = {
      ...signedInput(active),
      boundaryDate: '2026-10-10',
      gracePeriodDays: 30
    };
    expect(() =>
      runner.run({
        request: request(active, withBoundaryAndGrace),
        binding: binding(),
        package: active
      })
    ).toThrow(/must contain exactly the bounded V1 fields/i);

    const emptyReadInput = structuredClone(signedInput(active)) as Mutable<
      ReturnType<typeof signedInput>
    >;
    emptyReadInput.sourceReads[0]!.state = 'EMPTY';
    emptyReadInput.sourceReads[0]!.sourceReferences = [];
    expect(() =>
      runner.run({
        request: request(active, emptyReadInput),
        binding: binding(),
        package: active
      })
    ).toThrow(/EMPTY is not admitted/i);
  });

  it('uses synthetic fixture activation only as a test harness, never production evidence', async () => {
    const { activation, active } = syntheticFixtureActivation();
    if (!active) throw new Error('fixture drift');
    const result = await new CnTrademarkLifecycleHistoryCandidateRunnerV1(activation).run({
      request: request(active),
      binding: binding(),
      package: active
    });

    expect(activation.approval.policyVersion).toContain('fixture-only');
    expect(CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1.package.lifecycle).toBe('VALIDATED');
    expect(result.evidenceRefs).toContain('candidate-boundary:runtime-registration=absent');
    expect(result.evidenceRefs).toContain('candidate-boundary:capability-admission=absent');
    expect(result.evidenceRefs.some((reference) => reference.includes('production-evidence'))).toBe(
      false
    );
  });
});
