import { describe, expect, it } from 'vitest';

import {
  noTrademarkLifecycleAuthorityConsequencesV1,
  parseTrademarkLifecycleComputationInputV1,
  parseTrademarkLifecycleComputationOutputV1,
  trademarkLifecycleComputationInputFingerprintSha256V1,
  trademarkLifecycleComputationOutputFingerprintSha256V1,
  type ExactOwnerReferenceV1,
  type TrademarkLifecycleComputationInputFingerprintMaterialV1,
  type TrademarkLifecycleComputationInputV1,
  type TrademarkLifecycleComputationOutputFingerprintMaterialV1,
  type TrademarkLifecycleComputationOutputV1
} from '../src/trademark-lifecycle.js';

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

const sha = (character: string): string => character.repeat(64);
const workspaceId = '018f0000-0000-7000-8000-000000000001';
const asOf = '2026-10-10T00:00:00.000Z';
const computedAt = '2026-10-10T00:00:01.000Z';
const trackFingerprintSha256 = sha('1');

const sourceReference = {
  owner: 'DATA_ENGINE',
  kind: 'DATA_ENGINE_TRADEMARK_RECORD',
  sourceId: 'cn-case-current_12345678',
  sourceVersion: 'cn-serving-epoch-2026-10-10',
  sourceFingerprintSha256: sha('2'),
  observedAt: asOf,
  freshness: 'CURRENT'
} as const;

const sourceOwnerReference = {
  owner: 'DATA_ENGINE',
  kind: 'DATA_ENGINE_TRADEMARK_RECORD',
  id: sourceReference.sourceId,
  version: sourceReference.sourceVersion,
  fingerprintSha256: sourceReference.sourceFingerprintSha256
} as const satisfies ExactOwnerReferenceV1;

const methodPackageReference = {
  owner: 'BRAIN',
  kind: 'TEMPORAL_RESOLUTION_METHOD_PACKAGE',
  id: 'executable-method-package_cn-lifecycle-observed-history-candidate-v1',
  version: 1,
  fingerprintSha256: sha('3')
} as const satisfies ExactOwnerReferenceV1;

const sourceContractReference = {
  owner: 'DATA_ENGINE',
  kind: 'SOURCE_CONTRACT',
  id: 'CN_CASE_CURRENT_PRELIMINARY_PUBLICATION_DISCOVERY_V2',
  version: 2,
  fingerprintSha256: sha('4')
} as const satisfies ExactOwnerReferenceV1;

const professionalReviewReceiptReference = {
  owner: 'MARKREG',
  kind: 'LIFECYCLE_RULE_REVIEW_RECEIPT',
  id: 'lifecycle-rule-review_cn-observed-history-candidate-v1',
  version: 1,
  fingerprintSha256: sha('5')
} as const satisfies ExactOwnerReferenceV1;

function inputMaterial(): TrademarkLifecycleComputationInputFingerprintMaterialV1 {
  return {
    schemaVersion: 1,
    workspaceId,
    asset: { id: 'trademark-asset_cn-12345678', version: 7 },
    asOf,
    track: {
      jurisdiction: 'CN',
      authority: 'CNIPA',
      objectType: 'TRADEMARK_APPLICATION',
      procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
      applicationOrRegistrationBasis: 'ANY',
      trackFingerprintSha256,
      relatedOwnerReferences: [sourceOwnerReference]
    },
    sourceReads: [
      {
        scopeId: 'cn-case-current_application-12345678',
        owner: 'DATA_ENGINE',
        state: 'OBSERVED',
        asOf,
        sourceReferences: [sourceReference]
      }
    ],
    sourceDateObservations: [
      {
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
      {
        factCode: 'PRELIMINARY_PUBLICATION_DATE',
        valueState: 'UNKNOWN',
        candidate: null,
        sourceReferences: [sourceReference],
        reasonCodes: ['SOURCE_FIELD_NOT_RECORDED']
      }
    ],
    methodPackageReference,
    materializedReferenceDependencies: [
      professionalReviewReceiptReference,
      sourceContractReference
    ],
    professionalReviewReceiptReference
  };
}

function signedInput(): TrademarkLifecycleComputationInputV1 {
  const material = inputMaterial();
  return {
    ...material,
    normalizedInputFingerprintSha256:
      trademarkLifecycleComputationInputFingerprintSha256V1(material)
  };
}

function semanticGlossaryForCodes(codes: readonly string[]) {
  return [...new Set(codes)].sort().map((code) => ({
    code,
    text: {
      zhCN: `语义代码：${code}`,
      en: `Semantic code: ${code}`
    }
  }));
}

function outputMaterial(): TrademarkLifecycleComputationOutputFingerprintMaterialV1 {
  const input = signedInput();
  const material: TrademarkLifecycleComputationOutputFingerprintMaterialV1 = {
    schemaVersion: 1,
    status: 'COMPUTED',
    workspaceId,
    asset: input.asset,
    normalizedInputFingerprintSha256: input.normalizedInputFingerprintSha256,
    computedAt,
    asOf,
    track: input.track,
    coverage: {
      coverageEvaluationId: 'coverage_cn-observed-history-12345678',
      state: 'FULL',
      scopeFingerprintSha256: trackFingerprintSha256,
      evaluatedAt: computedAt,
      reasonCodes: ['EXACT_SOURCE_RECORDED_SLICE'],
      coverageFingerprintSha256: sha('6')
    },
    currentness: {
      state: 'CURRENT',
      evaluatedAt: computedAt,
      reasonCodes: []
    },
    conflictState: 'NONE',
    currentPosition: {
      supportState: 'UNKNOWN',
      currentGranularity: null,
      currentStageCode: null,
      currentMilestoneCode: null,
      reasonCodes: ['CURRENT_POSITION_NOT_INFERRED']
    },
    lastUndisputedPosition: {
      stageCode: 'FILING',
      milestoneCode: 'APPLICATION_FILED',
      asOf
    },
    stages: [
      {
        stageCode: 'FILING',
        order: 1,
        name: { zhCN: '申请', en: 'Filing' },
        summary: {
          zhCN: '来源记录显示该申请已提交。',
          en: 'The source records that the application was filed.'
        },
        processState: 'OCCURRED',
        timeAssertions: [],
        sourceReferences: [sourceReference],
        ruleReferences: [methodPackageReference],
        reasonCodes: ['SOURCE_FACT_MAPPED'],
        limitationCodes: [],
        milestones: [
          {
            milestoneCode: 'APPLICATION_FILED',
            order: 1,
            name: { zhCN: '提交申请', en: 'Application filed' },
            summary: {
              zhCN: '仅展示来源记录的申请日。',
              en: 'Shows only the filing date recorded by the source.'
            },
            processState: 'OCCURRED',
            timeAssertions: [
              {
                timeAssertionId: 'time_cn-filing-date-12345678',
                semanticRole: 'FILING_DATE',
                labelCode: 'FILING_DATE_RECORDED',
                timeClass: 'SOURCE_RECORDED',
                presentationMeaning: 'RECORDED_FACT',
                valueState: 'AVAILABLE',
                value: {
                  kind: 'POINT',
                  value: '2025-01-02',
                  precision: 'DAY',
                  jurisdictionTimeZone: 'Asia/Shanghai'
                },
                confidence: null,
                asOf,
                currentness: 'CURRENT',
                sourceReferences: [sourceReference],
                ruleReferences: [],
                reasonCodes: ['SOURCE_DATE_RECORDED'],
                legalDeadlineCertified: false
              }
            ],
            sourceReferences: [sourceReference],
            ruleReferences: [methodPackageReference],
            reasonCodes: ['SOURCE_FACT_MAPPED'],
            limitationCodes: []
          }
        ]
      }
    ],
    sourceReads: input.sourceReads,
    conflicts: [],
    missingInputCodes: [],
    limitationCodes: ['HISTORICAL_FACTS_DO_NOT_ESTABLISH_CURRENT_POSITION'],
    semanticGlossary: [],
    methodPackageReference,
    materializedReferenceDependencies: [
      professionalReviewReceiptReference,
      sourceContractReference
    ],
    professionalReviewReceiptReference,
    nextItemEvaluation: {
      state: 'COMPLETE_NONE',
      evaluatedAt: computedAt,
      scopeFingerprintSha256: trackFingerprintSha256,
      reasonCodes: ['NO_NEXT_ITEM_IN_OBSERVED_HISTORY_SLICE'],
      limitationCodes: [],
      dependencyReasonCodes: [],
      target: null
    },
    recommendationEvaluation: {
      state: 'COMPLETE_NONE',
      evaluatedAt: computedAt,
      scopeFingerprintSha256: trackFingerprintSha256,
      reasonCodes: ['NO_RECOMMENDATION_IN_OBSERVED_HISTORY_SLICE'],
      limitationCodes: [],
      dependencyReasonCodes: [],
      target: null
    },
    primaryTimeEvaluation: {
      state: 'PRESENT',
      evaluatedAt: computedAt,
      scopeFingerprintSha256: trackFingerprintSha256,
      reasonCodes: ['SOURCE_RECORDED_PRIMARY_TIME'],
      limitationCodes: [],
      dependencyReasonCodes: [],
      target: { timeAssertionId: 'time_cn-filing-date-12345678' }
    },
    authority: noTrademarkLifecycleAuthorityConsequencesV1
  };
  const codes = [
    ...material.coverage.reasonCodes,
    ...material.currentness.reasonCodes,
    ...material.currentPosition.reasonCodes,
    ...material.missingInputCodes,
    ...material.limitationCodes,
    ...material.stages.flatMap((stage) => [
      ...stage.reasonCodes,
      ...stage.limitationCodes,
      ...stage.timeAssertions.flatMap((assertion) => [
        assertion.labelCode,
        ...assertion.reasonCodes
      ]),
      ...stage.milestones.flatMap((milestone) => [
        ...milestone.reasonCodes,
        ...milestone.limitationCodes,
        ...milestone.timeAssertions.flatMap((assertion) => [
          assertion.labelCode,
          ...assertion.reasonCodes
        ])
      ])
    ]),
    ...[
      material.nextItemEvaluation,
      material.recommendationEvaluation,
      material.primaryTimeEvaluation
    ].flatMap((evaluation) => [
      ...evaluation.reasonCodes,
      ...evaluation.limitationCodes,
      ...evaluation.dependencyReasonCodes
    ])
  ];
  return { ...material, semanticGlossary: semanticGlossaryForCodes(codes) };
}

function signedOutput(): TrademarkLifecycleComputationOutputV1 {
  const material = outputMaterial();
  return {
    ...material,
    outputFingerprintSha256: trademarkLifecycleComputationOutputFingerprintSha256V1(material)
  };
}

describe('Trademark Lifecycle transient computation contracts', () => {
  it('normalizes and verifies a complete exact computation input snapshot', () => {
    const parsed = parseTrademarkLifecycleComputationInputV1(signedInput());

    expect(parsed.workspaceId).toBe(workspaceId);
    expect(parsed.sourceDateObservations.map((observation) => observation.factCode)).toEqual([
      'FILING_DATE',
      'PRELIMINARY_PUBLICATION_DATE'
    ]);
    expect(parsed.normalizedInputFingerprintSha256).toBe(
      trademarkLifecycleComputationInputFingerprintSha256V1(parsed)
    );
  });

  it('binds the input fingerprint to every normalized fact and dependency', () => {
    const changed = structuredClone(signedInput()) as Mutable<TrademarkLifecycleComputationInputV1>;
    const filing = changed.sourceDateObservations[0];
    if (filing?.valueState !== 'AVAILABLE') throw new Error('fixture drift');
    filing.candidate.value = '2025-01-03';

    expect(() => parseTrademarkLifecycleComputationInputV1(changed)).toThrow(
      /input fingerprint does not match/i
    );
  });

  it('normalizes unordered facts, reason codes and materialized dependencies', () => {
    const left = structuredClone(
      inputMaterial()
    ) as unknown as Mutable<TrademarkLifecycleComputationInputFingerprintMaterialV1>;
    const right = structuredClone(
      inputMaterial()
    ) as unknown as Mutable<TrademarkLifecycleComputationInputFingerprintMaterialV1>;
    const leftUnknown = left.sourceDateObservations.find(
      (observation) => observation.valueState === 'UNKNOWN'
    );
    const rightUnknown = right.sourceDateObservations.find(
      (observation) => observation.valueState === 'UNKNOWN'
    );
    if (leftUnknown?.valueState !== 'UNKNOWN' || rightUnknown?.valueState !== 'UNKNOWN') {
      throw new Error('fixture drift');
    }
    leftUnknown.reasonCodes = ['SOURCE_FIELD_NOT_RECORDED', 'REQUIRED_INPUT_MISSING'];
    rightUnknown.reasonCodes = ['REQUIRED_INPUT_MISSING', 'SOURCE_FIELD_NOT_RECORDED'];
    right.sourceDateObservations.reverse();
    right.materializedReferenceDependencies.reverse();

    expect(trademarkLifecycleComputationInputFingerprintSha256V1(right)).toBe(
      trademarkLifecycleComputationInputFingerprintSha256V1(left)
    );
  });

  it('rejects observation evidence that is not admitted by the exact source read', () => {
    const changed = structuredClone(signedInput()) as Mutable<TrademarkLifecycleComputationInputV1>;
    const filing = changed.sourceDateObservations[0];
    if (filing?.valueState !== 'AVAILABLE') throw new Error('fixture drift');
    filing.candidate.sourceReferences[0] = {
      ...filing.candidate.sourceReferences[0]!,
      sourceId: 'cn-case-current_other'
    };

    expect(() => parseTrademarkLifecycleComputationInputV1(changed)).toThrow(
      /must be admitted by an exact computation input source read/i
    );
  });

  it('requires the professional-review receipt to be a materialized dependency', () => {
    const changed = structuredClone(signedInput()) as Mutable<TrademarkLifecycleComputationInputV1>;
    changed.materializedReferenceDependencies = [
      structuredClone(sourceContractReference)
    ] as Mutable<ExactOwnerReferenceV1>[];

    expect(() => parseTrademarkLifecycleComputationInputV1(changed)).toThrow(
      /professional-review receipt must be an exact materialized dependency/i
    );
  });

  it('rejects conflicting observations that repeat the same temporal candidate', () => {
    const changed = structuredClone(signedInput()) as Mutable<TrademarkLifecycleComputationInputV1>;
    changed.sourceDateObservations = [
      {
        factCode: 'FILING_DATE',
        valueState: 'CONFLICTING',
        candidates: [
          {
            value: '2025-01-02',
            precision: 'DAY',
            jurisdictionTimeZone: 'Asia/Shanghai',
            sourceReferences: [structuredClone(sourceReference)]
          },
          {
            value: '2025-01-02',
            precision: 'DAY',
            jurisdictionTimeZone: 'Asia/Shanghai',
            sourceReferences: [structuredClone(sourceReference)]
          }
        ],
        conflictId: 'conflict_filing-date',
        reasonCodes: ['SOURCE_DATES_CONFLICT']
      }
    ];

    expect(() => parseTrademarkLifecycleComputationInputV1(changed)).toThrow(
      /distinct temporal candidates/i
    );
  });

  it('requires conflicting observations to retain competing exact source references', () => {
    const changed = structuredClone(signedInput()) as Mutable<TrademarkLifecycleComputationInputV1>;
    changed.sourceDateObservations = [
      {
        factCode: 'FILING_DATE',
        valueState: 'CONFLICTING',
        candidates: [
          {
            value: '2025-01-02',
            precision: 'DAY',
            jurisdictionTimeZone: 'Asia/Shanghai',
            sourceReferences: [structuredClone(sourceReference)]
          },
          {
            value: '2025-01-03',
            precision: 'DAY',
            jurisdictionTimeZone: 'Asia/Shanghai',
            sourceReferences: [structuredClone(sourceReference)]
          }
        ],
        conflictId: 'conflict_filing-date',
        reasonCodes: ['SOURCE_DATES_CONFLICT']
      }
    ];

    expect(() => parseTrademarkLifecycleComputationInputV1(changed)).toThrow(
      /at least two distinct exact source references/i
    );
  });

  it('verifies a computed result without granting Product retention identity or authority', () => {
    const parsed = parseTrademarkLifecycleComputationOutputV1(signedOutput());

    expect(parsed.status).toBe('COMPUTED');
    expect(parsed.authority).toEqual(noTrademarkLifecycleAuthorityConsequencesV1);
    expect(parsed.outputFingerprintSha256).toBe(
      trademarkLifecycleComputationOutputFingerprintSha256V1(parsed)
    );
    expect(parsed).not.toHaveProperty('projectionId');
    expect(parsed).not.toHaveProperty('version');
    expect(parsed).not.toHaveProperty('capabilityExecution');
  });

  it('rejects Product projection identity and head fields on transient output', () => {
    const changed = { ...signedOutput(), projectionId: 'trademark-lifecycle-projection_forbidden' };

    expect(() => parseTrademarkLifecycleComputationOutputV1(changed)).toThrow(
      /must contain exactly the bounded V1 fields/i
    );
  });

  it('inherits the A1 ban on reviewed timing and certified legal deadlines', () => {
    const reviewed = structuredClone(
      signedOutput()
    ) as unknown as Mutable<TrademarkLifecycleComputationOutputV1>;
    const assertion = reviewed.stages[0]!.milestones[0]!.timeAssertions[0]!;
    assertion.timeClass = 'REVIEWED_TIMING';
    assertion.presentationMeaning = 'REVIEWED_NON_CERTIFIED_TIME';

    expect(() => parseTrademarkLifecycleComputationOutputV1(reviewed)).toThrow(
      /REVIEWED_TIMING is not admitted/i
    );

    const deadline = structuredClone(signedOutput()) as unknown as {
      stages: Array<{
        milestones: Array<{ timeAssertions: Array<{ legalDeadlineCertified: boolean }> }>;
      }>;
    };
    deadline.stages[0]!.milestones[0]!.timeAssertions[0]!.legalDeadlineCertified = true;
    expect(() => parseTrademarkLifecycleComputationOutputV1(deadline)).toThrow(
      /legalDeadlineCertified must remain false/i
    );
  });

  it('rejects output tampering and a detached professional-review receipt', () => {
    const tampered = structuredClone(
      signedOutput()
    ) as unknown as Mutable<TrademarkLifecycleComputationOutputV1>;
    tampered.stages[0]!.name.zhCN = '被篡改';
    expect(() => parseTrademarkLifecycleComputationOutputV1(tampered)).toThrow(
      /output fingerprint does not match/i
    );

    const detached = structuredClone(
      signedOutput()
    ) as unknown as Mutable<TrademarkLifecycleComputationOutputV1>;
    detached.materializedReferenceDependencies = [
      structuredClone(sourceContractReference)
    ] as Mutable<ExactOwnerReferenceV1>[];
    expect(() => parseTrademarkLifecycleComputationOutputV1(detached)).toThrow(
      /professional-review receipt must be an exact materialized dependency/i
    );
  });
});
