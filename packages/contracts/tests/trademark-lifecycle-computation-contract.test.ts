import { describe, expect, it, vi } from 'vitest';

import {
  noTrademarkLifecycleAuthorityConsequencesV1,
  parseTrademarkLifecycleComputationAdverseResultV1,
  parseTrademarkLifecycleComputationInputV1,
  parseTrademarkLifecycleComputationOutputV1,
  parseTrademarkLifecycleComputationResultV1,
  trademarkLifecycleComputationAdverseResultFingerprintSha256V1,
  trademarkLifecycleComputationInputFingerprintSha256V1,
  trademarkLifecycleComputationOutputFingerprintSha256V1,
  type ExactOwnerReferenceV1,
  type TrademarkLifecycleComputationAdverseResultFingerprintMaterialV1,
  type TrademarkLifecycleComputationAdverseResultV1,
  type TrademarkLifecycleComputationAdverseStateV1,
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

function adverseInputMaterial(
  state: TrademarkLifecycleComputationAdverseStateV1
): TrademarkLifecycleComputationInputFingerprintMaterialV1 {
  return {
    ...inputMaterial(),
    sourceReads: [
      {
        scopeId: 'cn-case-current_application-12345678',
        owner: 'DATA_ENGINE',
        state,
        asOf,
        sourceReferences: []
      }
    ],
    sourceDateObservations: [
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
    ]
  };
}

function signedAdverseInput(
  state: TrademarkLifecycleComputationAdverseStateV1
): TrademarkLifecycleComputationInputV1 {
  const material = adverseInputMaterial(state);
  return {
    ...material,
    normalizedInputFingerprintSha256:
      trademarkLifecycleComputationInputFingerprintSha256V1(material)
  };
}

function adverseResultMaterial(
  state: TrademarkLifecycleComputationAdverseStateV1,
  inputValue: TrademarkLifecycleComputationInputV1 = signedAdverseInput(state)
): TrademarkLifecycleComputationAdverseResultFingerprintMaterialV1 {
  const input = parseTrademarkLifecycleComputationInputV1(inputValue);
  const semantics = {
    NOT_OBSERVED: {
      coverageState: 'PARTIAL',
      dependencyState: 'AVAILABLE',
      reasonCodes: ['SOURCE_FACT_NOT_OBSERVED_WITHOUT_COMPLETE_SCOPE_EVIDENCE'],
      dependencyReasonCodes: []
    },
    NOT_COVERED: {
      coverageState: 'NOT_COVERED',
      dependencyState: 'AVAILABLE',
      reasonCodes: ['SOURCE_SCOPE_NOT_COVERED'],
      dependencyReasonCodes: []
    },
    UNAVAILABLE: {
      coverageState: 'PARTIAL',
      dependencyState: 'UNAVAILABLE',
      reasonCodes: ['SOURCE_READ_UNAVAILABLE'],
      dependencyReasonCodes: ['SOURCE_DEPENDENCY_UNAVAILABLE']
    }
  } as const;
  const expected = semantics[state];
  return {
    schemaVersion: 1,
    status: 'NOT_COMPUTED',
    sourceReadState: state,
    workspaceId: input.workspaceId,
    asset: input.asset,
    normalizedInputFingerprintSha256: input.normalizedInputFingerprintSha256,
    evaluatedAt: computedAt,
    asOf: input.asOf,
    track: input.track,
    sourceReads: input.sourceReads,
    coverageState: expected.coverageState,
    currentnessState: 'UNKNOWN',
    dependencyState: expected.dependencyState,
    reasonCodes: expected.reasonCodes,
    dependencyReasonCodes: expected.dependencyReasonCodes,
    limitationCodes: ['NOT_COMPUTED_DOES_NOT_ESTABLISH_NO_EVENT_DEADLINE_RISK_OR_ACTION'],
    methodPackageReference: input.methodPackageReference,
    materializedReferenceDependencies: input.materializedReferenceDependencies,
    professionalReviewReceiptReference: input.professionalReviewReceiptReference,
    authority: noTrademarkLifecycleAuthorityConsequencesV1
  };
}

function signedAdverseResult(
  state: TrademarkLifecycleComputationAdverseStateV1,
  inputValue: TrademarkLifecycleComputationInputV1 = signedAdverseInput(state)
): TrademarkLifecycleComputationAdverseResultV1 {
  const material = adverseResultMaterial(state, inputValue);
  return signedAdverseResultFromMaterial(material);
}

function signedAdverseResultFromMaterial(
  material: TrademarkLifecycleComputationAdverseResultFingerprintMaterialV1
): TrademarkLifecycleComputationAdverseResultV1 {
  return {
    ...material,
    adverseResultFingerprintSha256:
      trademarkLifecycleComputationAdverseResultFingerprintSha256V1(material)
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
  const input = parseTrademarkLifecycleComputationInputV1(signedInput());
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
    materializedReferenceDependencies: input.materializedReferenceDependencies,
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
  return signedOutputFromMaterial(material);
}

function signedOutputFromMaterial(
  material: TrademarkLifecycleComputationOutputFingerprintMaterialV1
): TrademarkLifecycleComputationOutputV1 {
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

  it('uses locale-independent binary ordering for the normalized input fingerprint', () => {
    const baseline = trademarkLifecycleComputationInputFingerprintSha256V1(inputMaterial());
    const localeCompare = vi.spyOn(String.prototype, 'localeCompare').mockImplementation(() => 0);

    try {
      expect(trademarkLifecycleComputationInputFingerprintSha256V1(inputMaterial())).toBe(baseline);
      expect(localeCompare).not.toHaveBeenCalled();
    } finally {
      localeCompare.mockRestore();
    }
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

  it('does not treat changed observation metadata as a second exact source version', () => {
    const changed = structuredClone(signedInput()) as Mutable<TrademarkLifecycleComputationInputV1>;
    const repeatedSourceVersion = {
      ...structuredClone(sourceReference),
      observedAt: '2026-10-09T00:00:00.000Z',
      freshness: 'STALE'
    } as const;
    changed.sourceReads.push({
      scopeId: 'cn-case-current_application-12345678-repeat',
      owner: 'DATA_ENGINE',
      state: 'OBSERVED',
      asOf,
      sourceReferences: [repeatedSourceVersion]
    });
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
            sourceReferences: [repeatedSourceVersion]
          }
        ],
        conflictId: 'conflict_filing-date-repeated-source-version',
        reasonCodes: ['SOURCE_DATES_CONFLICT']
      }
    ];

    expect(() => parseTrademarkLifecycleComputationInputV1(changed)).toThrow(
      /at least two distinct exact source references/i
    );
  });

  it.each([
    ['NOT_OBSERVED', 'PARTIAL', 'AVAILABLE'],
    ['NOT_COVERED', 'NOT_COVERED', 'AVAILABLE'],
    ['UNAVAILABLE', 'PARTIAL', 'UNAVAILABLE']
  ] as const)(
    'represents a pure %s read as a strict non-projecting adverse result',
    (state, coverageState, dependencyState) => {
      const input = signedAdverseInput(state);
      const signed = signedAdverseResult(state, input);
      const parsed = parseTrademarkLifecycleComputationAdverseResultV1(signed, input);
      const unionParsed = parseTrademarkLifecycleComputationResultV1(signed, input);

      expect(parsed.status).toBe('NOT_COMPUTED');
      expect(parsed.sourceReadState).toBe(state);
      expect(parsed.coverageState).toBe(coverageState);
      expect(parsed.currentnessState).toBe('UNKNOWN');
      expect(parsed.dependencyState).toBe(dependencyState);
      expect(parsed.limitationCodes).toEqual([
        'NOT_COMPUTED_DOES_NOT_ESTABLISH_NO_EVENT_DEADLINE_RISK_OR_ACTION'
      ]);
      expect(parsed.sourceReads).toHaveLength(1);
      expect(parsed.sourceReads[0]?.sourceReferences).toEqual([]);
      expect(parsed.authority).toEqual(noTrademarkLifecycleAuthorityConsequencesV1);
      expect(parsed.adverseResultFingerprintSha256).toBe(
        trademarkLifecycleComputationAdverseResultFingerprintSha256V1(parsed)
      );
      expect(unionParsed.status).toBe('NOT_COMPUTED');
      expect(parsed).not.toHaveProperty('stages');
      expect(parsed).not.toHaveProperty('currentPosition');
      expect(parsed).not.toHaveProperty('lastUndisputedPosition');
      expect(parsed).not.toHaveProperty('conflicts');
      expect(parsed).not.toHaveProperty('nextItemEvaluation');
      expect(parsed).not.toHaveProperty('recommendationEvaluation');
      expect(parsed).not.toHaveProperty('primaryTimeEvaluation');
    }
  );

  it('rejects mixed adverse states and repeated adverse scopes in the paired input', () => {
    const mixedMaterial = structuredClone(
      adverseInputMaterial('NOT_OBSERVED')
    ) as unknown as Mutable<TrademarkLifecycleComputationInputFingerprintMaterialV1>;
    mixedMaterial.sourceReads.push({
      scopeId: 'cn-case-current_application-12345678-secondary',
      owner: 'DATA_ENGINE',
      state: 'NOT_COVERED',
      asOf,
      sourceReferences: []
    });
    const mixedInput: TrademarkLifecycleComputationInputV1 = {
      ...mixedMaterial,
      normalizedInputFingerprintSha256:
        trademarkLifecycleComputationInputFingerprintSha256V1(mixedMaterial)
    };
    expect(() =>
      parseTrademarkLifecycleComputationAdverseResultV1(
        signedAdverseResult('NOT_OBSERVED'),
        mixedInput
      )
    ).toThrow(/one adverse state, no OBSERVED read/i);

    const repeatedMaterial = structuredClone(
      adverseInputMaterial('NOT_OBSERVED')
    ) as unknown as Mutable<TrademarkLifecycleComputationInputFingerprintMaterialV1>;
    repeatedMaterial.sourceReads.push({
      scopeId: 'cn-case-current_application-12345678-secondary',
      owner: 'DATA_ENGINE',
      state: 'NOT_OBSERVED',
      asOf,
      sourceReferences: []
    });
    const repeatedInput: TrademarkLifecycleComputationInputV1 = {
      ...repeatedMaterial,
      normalizedInputFingerprintSha256:
        trademarkLifecycleComputationInputFingerprintSha256V1(repeatedMaterial)
    };
    expect(() =>
      parseTrademarkLifecycleComputationAdverseResultV1(
        signedAdverseResult('NOT_OBSERVED'),
        repeatedInput
      )
    ).toThrow(/one adverse state, no OBSERVED read/i);
  });

  it('rejects OBSERVED, EMPTY and positive-reference inputs for an adverse result', () => {
    expect(() =>
      parseTrademarkLifecycleComputationAdverseResultV1(
        signedAdverseResult('NOT_OBSERVED'),
        signedInput()
      )
    ).toThrow(/one adverse state, no OBSERVED read/i);

    const emptyInput = structuredClone(
      signedAdverseInput('NOT_OBSERVED')
    ) as Mutable<TrademarkLifecycleComputationInputV1>;
    emptyInput.sourceReads[0]!.state = 'EMPTY';
    expect(() =>
      parseTrademarkLifecycleComputationAdverseResultV1(
        signedAdverseResult('NOT_OBSERVED'),
        emptyInput
      )
    ).toThrow(/EMPTY is not admitted/i);

    const referencedInput = structuredClone(
      signedAdverseInput('NOT_OBSERVED')
    ) as Mutable<TrademarkLifecycleComputationInputV1>;
    referencedInput.sourceReads[0]!.sourceReferences = [structuredClone(sourceReference)];
    expect(() =>
      parseTrademarkLifecycleComputationAdverseResultV1(
        signedAdverseResult('NOT_OBSERVED'),
        referencedInput
      )
    ).toThrow(/cannot carry positive source references/i);
  });

  it('rejects adverse-result tampering and a wrong fingerprint', () => {
    const input = signedAdverseInput('NOT_OBSERVED');
    const tampered = structuredClone(
      signedAdverseResult('NOT_OBSERVED', input)
    ) as Mutable<TrademarkLifecycleComputationAdverseResultV1>;
    tampered.reasonCodes = ['SOURCE_SCOPE_NOT_COVERED'];
    expect(() => parseTrademarkLifecycleComputationAdverseResultV1(tampered, input)).toThrow(
      /closed coverage, currentness, dependency, and reason-code mapping/i
    );

    const wrongFingerprint = {
      ...signedAdverseResult('NOT_OBSERVED', input),
      adverseResultFingerprintSha256: sha('a')
    };
    expect(() =>
      parseTrademarkLifecycleComputationAdverseResultV1(wrongFingerprint, input)
    ).toThrow(/fingerprint does not match/i);
  });

  it.each<
    [
      string,
      string,
      (material: Mutable<TrademarkLifecycleComputationAdverseResultFingerprintMaterialV1>) => void
    ]
  >([
    [
      'workspace while retaining the asset',
      'workspaceId',
      (material) => {
        material.workspaceId = '018f0000-0000-7000-8000-000000000099';
      }
    ],
    [
      'asset while retaining the workspace',
      'asset',
      (material) => {
        material.asset.id = 'trademark-asset_cn-87654321';
      }
    ],
    [
      'asset version',
      'asset',
      (material) => {
        material.asset.version = 8;
      }
    ],
    [
      'as-of anchor',
      'asOf',
      (material) => {
        material.asOf = '2026-10-10T00:00:00.500Z';
      }
    ],
    [
      'track',
      'track',
      (material) => {
        material.track.procedure = 'FILING_TO_REGISTRATION';
      }
    ],
    [
      'track fingerprint',
      'track',
      (material) => {
        material.track.trackFingerprintSha256 = sha('c');
      }
    ],
    [
      'normalized input fingerprint',
      'normalizedInputFingerprintSha256',
      (material) => {
        material.normalizedInputFingerprintSha256 = sha('b');
      }
    ],
    [
      'source-read lineage',
      'sourceReads',
      (material) => {
        material.sourceReads[0]!.scopeId = 'cn-case-current_application-87654321';
      }
    ],
    [
      'source-read as-of anchor',
      'sourceReads',
      (material) => {
        material.sourceReads[0]!.asOf = '2026-10-09T23:59:59.000Z';
      }
    ],
    [
      'method package',
      'methodPackageReference',
      (material) => {
        material.methodPackageReference.id =
          'executable-method-package_cn-lifecycle-observed-history-other-v1';
      }
    ],
    [
      'materialized dependencies',
      'materializedReferenceDependencies',
      (material) => {
        const dependency = material.materializedReferenceDependencies.find(
          (entry) => entry.id === sourceContractReference.id
        );
        if (!dependency) throw new Error('fixture drift');
        dependency.id = 'CN_CASE_CURRENT_PRELIMINARY_PUBLICATION_DISCOVERY_OTHER_V2';
      }
    ],
    [
      'professional-review receipt',
      'professionalReviewReceiptReference',
      (material) => {
        material.professionalReviewReceiptReference = structuredClone(sourceContractReference);
      }
    ]
  ])('rejects a re-fingerprinted adverse result with detached %s', (_label, binding, mutate) => {
    const input = signedAdverseInput('NOT_OBSERVED');
    const material = structuredClone(
      adverseResultMaterial('NOT_OBSERVED', input)
    ) as unknown as Mutable<TrademarkLifecycleComputationAdverseResultFingerprintMaterialV1>;
    mutate(material);
    const detached = signedAdverseResultFromMaterial(material);

    expect(() => parseTrademarkLifecycleComputationAdverseResultV1(detached, input)).toThrow(
      new RegExp(`paired normalized input snapshot:.*${binding}`, 'i')
    );
  });

  it.each([
    ['sourceReadState', 'NOT_COVERED'],
    ['coverageState', 'FULL'],
    ['currentnessState', 'CURRENT'],
    ['currentnessState', 'STALE'],
    ['dependencyState', 'DEGRADED'],
    ['dependencyReasonCodes', ['UNEXPECTED_DEPENDENCY_REASON']],
    ['limitationCodes', ['UNEXPECTED_LIMITATION']]
  ] as const)('rejects a closed adverse semantic mismatch in %s', (field, value) => {
    const input = signedAdverseInput('NOT_OBSERVED');
    const changed = structuredClone(
      signedAdverseResult('NOT_OBSERVED', input)
    ) as unknown as Record<string, unknown>;
    changed[field] = value;

    expect(() => parseTrademarkLifecycleComputationAdverseResultV1(changed, input)).toThrow(
      /one adverse source-read state|closed coverage, currentness, dependency, and reason-code mapping/i
    );
  });

  it('rejects an unknown adverse source-read state', () => {
    const input = signedAdverseInput('NOT_OBSERVED');
    const changed = {
      ...signedAdverseResult('NOT_OBSERVED', input),
      sourceReadState: 'UNKNOWN_ADVERSE_STATE'
    };

    expect(() => parseTrademarkLifecycleComputationAdverseResultV1(changed, input)).toThrow(
      /sourceReadState is invalid/i
    );
  });

  it('rejects authority claims, projection fields and positive result references', () => {
    const input = signedAdverseInput('UNAVAILABLE');
    const authorityClaim = structuredClone(
      signedAdverseResult('UNAVAILABLE', input)
    ) as unknown as {
      authority: { executionAuthorized: boolean };
    };
    authorityClaim.authority.executionAuthorized = true;
    expect(() => parseTrademarkLifecycleComputationAdverseResultV1(authorityClaim, input)).toThrow(
      /executionAuthorized must remain false/i
    );

    for (const [field, value] of [
      ['projectionId', 'trademark-lifecycle-projection_forbidden'],
      ['stages', []],
      ['nextItemEvaluation', null],
      ['destinationReference', null]
    ] as const) {
      const projectionOrActionField = {
        ...signedAdverseResult('UNAVAILABLE', input),
        [field]: value
      };
      expect(() =>
        parseTrademarkLifecycleComputationAdverseResultV1(projectionOrActionField, input)
      ).toThrow(/must contain exactly the bounded V1 fields/i);
    }

    const referencedResult = structuredClone(
      signedAdverseResult('UNAVAILABLE', input)
    ) as Mutable<TrademarkLifecycleComputationAdverseResultV1>;
    referencedResult.sourceReads[0]!.sourceReferences = [structuredClone(sourceReference)];
    expect(() =>
      parseTrademarkLifecycleComputationAdverseResultV1(referencedResult, input)
    ).toThrow(/cannot carry positive source references/i);
  });

  it('verifies a computed result without granting Product retention identity or authority', () => {
    const parsed = parseTrademarkLifecycleComputationOutputV1(signedOutput(), signedInput());

    expect(parsed.status).toBe('COMPUTED');
    expect(parsed.authority).toEqual(noTrademarkLifecycleAuthorityConsequencesV1);
    expect(parsed.outputFingerprintSha256).toBe(
      trademarkLifecycleComputationOutputFingerprintSha256V1(parsed)
    );
    expect(parsed).not.toHaveProperty('projectionId');
    expect(parsed).not.toHaveProperty('version');
    expect(parsed).not.toHaveProperty('capabilityExecution');
    expect(parseTrademarkLifecycleComputationResultV1(signedOutput(), signedInput()).status).toBe(
      'COMPUTED'
    );
  });

  it('rejects Product projection identity and head fields on transient output', () => {
    const changed = { ...signedOutput(), projectionId: 'trademark-lifecycle-projection_forbidden' };

    expect(() => parseTrademarkLifecycleComputationOutputV1(changed, signedInput())).toThrow(
      /must contain exactly the bounded V1 fields/i
    );
  });

  it('rejects a self-signed output detached from its paired tenant and asset input', () => {
    const changed = structuredClone(
      outputMaterial()
    ) as unknown as Mutable<TrademarkLifecycleComputationOutputFingerprintMaterialV1>;
    changed.workspaceId = '018f0000-0000-7000-8000-000000000099';
    changed.asset = { id: 'trademark-asset_cn-87654321', version: 1 };

    expect(() =>
      parseTrademarkLifecycleComputationOutputV1(
        signedOutputFromMaterial(
          changed as unknown as TrademarkLifecycleComputationOutputFingerprintMaterialV1
        ),
        signedInput()
      )
    ).toThrow(/paired normalized input snapshot: workspaceId, asset/i);
  });

  it('rejects a self-signed output detached from its paired source-read lineage', () => {
    const changed = structuredClone(
      outputMaterial()
    ) as unknown as Mutable<TrademarkLifecycleComputationOutputFingerprintMaterialV1>;
    changed.sourceReads[0]!.scopeId = 'cn-case-current_application-87654321';

    expect(() =>
      parseTrademarkLifecycleComputationOutputV1(
        signedOutputFromMaterial(
          changed as unknown as TrademarkLifecycleComputationOutputFingerprintMaterialV1
        ),
        signedInput()
      )
    ).toThrow(/paired normalized input snapshot: sourceReads/i);
  });

  it('inherits the A1 ban on reviewed timing and certified legal deadlines', () => {
    const reviewed = structuredClone(
      signedOutput()
    ) as unknown as Mutable<TrademarkLifecycleComputationOutputV1>;
    const assertion = reviewed.stages[0]!.milestones[0]!.timeAssertions[0]!;
    assertion.timeClass = 'REVIEWED_TIMING';
    assertion.presentationMeaning = 'REVIEWED_NON_CERTIFIED_TIME';

    expect(() => parseTrademarkLifecycleComputationOutputV1(reviewed, signedInput())).toThrow(
      /REVIEWED_TIMING is not admitted/i
    );

    const deadline = structuredClone(signedOutput()) as unknown as {
      stages: Array<{
        milestones: Array<{ timeAssertions: Array<{ legalDeadlineCertified: boolean }> }>;
      }>;
    };
    deadline.stages[0]!.milestones[0]!.timeAssertions[0]!.legalDeadlineCertified = true;
    expect(() => parseTrademarkLifecycleComputationOutputV1(deadline, signedInput())).toThrow(
      /legalDeadlineCertified must remain false/i
    );
  });

  it('rejects output tampering and a detached professional-review receipt', () => {
    const tampered = structuredClone(
      signedOutput()
    ) as unknown as Mutable<TrademarkLifecycleComputationOutputV1>;
    tampered.stages[0]!.name.zhCN = '被篡改';
    expect(() => parseTrademarkLifecycleComputationOutputV1(tampered, signedInput())).toThrow(
      /output fingerprint does not match/i
    );

    const detached = structuredClone(
      signedOutput()
    ) as unknown as Mutable<TrademarkLifecycleComputationOutputV1>;
    detached.materializedReferenceDependencies = [
      structuredClone(sourceContractReference)
    ] as Mutable<ExactOwnerReferenceV1>[];
    expect(() => parseTrademarkLifecycleComputationOutputV1(detached, signedInput())).toThrow(
      /professional-review receipt must be an exact materialized dependency/i
    );
  });
});
