import { describe, expect, it } from 'vitest';
import {
  noTrademarkLifecycleAuthorityConsequencesV1,
  parseTrademarkLifecycleExternalReadResponseV1,
  parseTrademarkLifecycleProjectionV1,
  parseTrademarkLifecycleReadResultV1 as parseTrademarkLifecycleReadResultContractV1,
  trademarkLifecycleProjectionFingerprintMaterialV1,
  trademarkLifecycleProjectionFingerprintSha256V1,
  type ExactOwnerReferenceV1,
  type TrademarkLifecycleAuthorizedReadV1,
  type TrademarkLifecycleExternalReadResponseV1,
  type TrademarkLifecycleProjectionV1
} from '../src/trademark-lifecycle.js';

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

const sha = (character: string): string => character.repeat(64);
const evaluatedAt = '2026-10-10T01:00:00.000Z';
const asOf = '2026-10-10T00:00:00.000Z';
const trackFingerprintSha256 = sha('1');
const workspaceId = '018f0000-0000-7000-8000-000000000001';
const privateReasonByStatus = {
  UNAUTHENTICATED: 'AUTHENTICATION_REQUIRED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  FORBIDDEN: 'RESOURCE_NOT_AVAILABLE',
  NOT_FOUND: 'RESOURCE_NOT_AVAILABLE',
  TRANSPORT_ERROR: 'TEMPORARILY_UNAVAILABLE'
} as const;

const dataRecordReference = {
  owner: 'DATA_ENGINE',
  kind: 'DATA_ENGINE_TRADEMARK_RECORD',
  id: 'data-record_us-98123456',
  version: '2026-10-10',
  fingerprintSha256: sha('2')
} as const satisfies ExactOwnerReferenceV1;

const dataRecordSourceReference = {
  owner: 'DATA_ENGINE',
  kind: 'DATA_ENGINE_TRADEMARK_RECORD',
  sourceId: 'data-record_us-98123456',
  sourceVersion: '2026-10-10',
  sourceFingerprintSha256: sha('2'),
  observedAt: asOf,
  freshness: 'CURRENT'
} as const;

const methodReference = {
  owner: 'BRAIN',
  kind: 'TEMPORAL_RESOLUTION_METHOD_PACKAGE',
  id: 'method_us-lifecycle',
  version: 4,
  fingerprintSha256: sha('4')
} as const satisfies ExactOwnerReferenceV1;

const ruleReference = {
  owner: 'KNOWLEDGE',
  kind: 'MATERIALIZED_RULE_REFERENCE',
  id: 'rule_us-lifecycle',
  version: '2026.10',
  fingerprintSha256: sha('5')
} as const satisfies ExactOwnerReferenceV1;

const workbenchReference = {
  owner: 'MARKREG',
  kind: 'TRADEMARK_SERVICE_WORKBENCH',
  id: 'workbench_us-98123456',
  version: 1,
  fingerprintSha256: sha('6')
} as const satisfies ExactOwnerReferenceV1;

const recommendationReference = {
  owner: 'MARKREG',
  kind: 'LIFECYCLE_RECOMMENDATION',
  id: 'recommendation_us-98123456',
  version: 2,
  fingerprintSha256: sha('a')
} as const satisfies ExactOwnerReferenceV1;

function semanticGlossaryForCodes(codes: readonly string[]) {
  return [...new Set(codes)].sort().map((code) => ({
    code,
    text: {
      zhCN: `语义代码：${code}`,
      en: `Semantic code: ${code}`
    }
  }));
}

function projectionSemanticCodes(
  value:
    | TrademarkLifecycleProjectionV1
    | Omit<TrademarkLifecycleProjectionV1, 'projectionFingerprintSha256'>
): string[] {
  return [
    ...value.coverage.reasonCodes,
    ...value.currentness.reasonCodes,
    ...value.currentPosition.reasonCodes,
    ...value.missingInputCodes,
    ...value.limitationCodes,
    ...value.conflicts.flatMap((conflict) => conflict.reasonCodes),
    ...value.stages.flatMap((stage) => [
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
      value.nextItemEvaluation,
      value.recommendationEvaluation,
      value.primaryTimeEvaluation
    ].flatMap((evaluation) => [
      ...evaluation.reasonCodes,
      ...evaluation.limitationCodes,
      ...evaluation.dependencyReasonCodes
    ])
  ];
}

function projectionBody(): Omit<TrademarkLifecycleProjectionV1, 'projectionFingerprintSha256'> {
  const body: Omit<TrademarkLifecycleProjectionV1, 'projectionFingerprintSha256'> = {
    schemaVersion: 1,
    projectionId: 'trademark-lifecycle-projection_us-98123456',
    version: 7,
    workspaceId,
    asset: {
      id: 'trademark-asset_us-98123456',
      version: 9
    },
    normalizedInputFingerprintSha256: sha('8'),
    generatedAt: evaluatedAt,
    asOf,
    track: {
      jurisdiction: 'US',
      authority: 'USPTO',
      objectType: 'TRADEMARK_APPLICATION',
      procedure: 'NATIONAL_APPLICATION',
      applicationOrRegistrationBasis: 'SECTION_1B',
      trackFingerprintSha256,
      relatedOwnerReferences: [dataRecordReference]
    },
    coverage: {
      coverageEvaluationId: 'coverage_us-98123456',
      state: 'FULL',
      scopeFingerprintSha256: trackFingerprintSha256,
      evaluatedAt,
      reasonCodes: ['EXACT_SCOPE_ADMITTED'],
      coverageFingerprintSha256: sha('9')
    },
    currentness: {
      state: 'CURRENT',
      evaluatedAt,
      reasonCodes: ['SOURCE_READ_CURRENT']
    },
    conflictState: 'NONE',
    currentPosition: {
      supportState: 'SUPPORTED',
      currentGranularity: 'MILESTONE',
      currentStageCode: 'EXAMINATION',
      currentMilestoneCode: 'SUBSTANTIVE_EXAMINATION',
      reasonCodes: ['OWNER_SELECTED_CURRENT_POSITION']
    },
    lastUndisputedPosition: null,
    stages: [
      {
        stageCode: 'FILING',
        order: 1,
        name: { zhCN: '申请', en: 'Filing' },
        summary: {
          zhCN: '申请已提交并由官方接收。',
          en: 'The application was filed and received.'
        },
        processState: 'OCCURRED',
        timeAssertions: [],
        sourceReferences: [dataRecordSourceReference],
        ruleReferences: [ruleReference],
        reasonCodes: [],
        limitationCodes: [],
        milestones: [
          {
            milestoneCode: 'APPLICATION_RECEIVED',
            order: 1,
            name: { zhCN: '申请已接收', en: 'Application received' },
            summary: { zhCN: '官方已记录申请。', en: 'The authority recorded the application.' },
            processState: 'OCCURRED',
            timeAssertions: [],
            sourceReferences: [dataRecordSourceReference],
            ruleReferences: [ruleReference],
            reasonCodes: [],
            limitationCodes: [],
            destinationReference: {
              kind: 'EVIDENCE_INSPECTION',
              reference: dataRecordReference
            }
          }
        ]
      },
      {
        stageCode: 'EXAMINATION',
        order: 2,
        name: { zhCN: '审查', en: 'Examination' },
        summary: { zhCN: '商标当前处于审查阶段。', en: 'The trademark is under examination.' },
        processState: 'CURRENT',
        timeAssertions: [],
        sourceReferences: [dataRecordSourceReference],
        ruleReferences: [ruleReference],
        reasonCodes: ['CURRENT_OWNER_POSITION'],
        limitationCodes: [],
        milestones: [
          {
            milestoneCode: 'SUBSTANTIVE_EXAMINATION',
            order: 1,
            name: { zhCN: '实质审查', en: 'Substantive examination' },
            summary: {
              zhCN: '官方正在进行实质审查。',
              en: 'Substantive examination is in progress.'
            },
            processState: 'CURRENT',
            timeAssertions: [],
            sourceReferences: [dataRecordSourceReference],
            ruleReferences: [ruleReference],
            reasonCodes: ['CURRENT_OWNER_POSITION'],
            limitationCodes: []
          }
        ]
      },
      {
        stageCode: 'PUBLICATION',
        order: 3,
        name: { zhCN: '公告', en: 'Publication' },
        summary: { zhCN: '公告阶段尚未开始。', en: 'The publication stage has not started.' },
        processState: 'UPCOMING',
        timeAssertions: [],
        sourceReferences: [dataRecordSourceReference],
        ruleReferences: [ruleReference],
        reasonCodes: ['OWNER_SELECTED_NEXT_STAGE'],
        limitationCodes: [],
        milestones: [
          {
            milestoneCode: 'PUBLICATION_WINDOW',
            order: 1,
            name: { zhCN: '公告期', en: 'Publication window' },
            summary: {
              zhCN: '预计公告窗口等待确认。',
              en: 'The expected publication window awaits confirmation.'
            },
            processState: 'UPCOMING',
            timeAssertions: [
              {
                timeAssertionId: 'time_publication-window',
                semanticRole: 'RULE_WINDOW',
                labelCode: 'EXPECTED_PUBLICATION_WINDOW',
                timeClass: 'RULE_WINDOW',
                presentationMeaning: 'RULE_DERIVED_WINDOW',
                valueState: 'AVAILABLE',
                value: {
                  kind: 'INTERVAL',
                  start: '2026-12-01',
                  end: '2026-12-31',
                  precision: 'DAY',
                  jurisdictionTimeZone: 'America/New_York',
                  startInclusive: true,
                  endInclusive: true
                },
                confidence: null,
                asOf,
                currentness: 'CURRENT',
                sourceReferences: [dataRecordSourceReference],
                ruleReferences: [ruleReference],
                reasonCodes: ['RULE_WINDOW_CALCULATED'],
                legalDeadlineCertified: false
              }
            ],
            sourceReferences: [dataRecordSourceReference],
            ruleReferences: [ruleReference],
            reasonCodes: ['OWNER_SELECTED_NEXT_ITEM'],
            limitationCodes: [],
            destinationReference: {
              kind: 'EXISTING_WORKBENCH',
              reference: workbenchReference
            }
          }
        ]
      }
    ],
    sourceReads: [
      {
        scopeId: 'source-scope_us-98123456',
        owner: 'DATA_ENGINE',
        state: 'OBSERVED',
        asOf,
        sourceReferences: [dataRecordSourceReference]
      }
    ],
    conflicts: [],
    missingInputCodes: [],
    limitationCodes: [],
    semanticGlossary: [],
    methodPackageReference: methodReference,
    materializedReferenceDependencies: [ruleReference],
    nextItemEvaluation: {
      state: 'PRESENT',
      evaluatedAt,
      scopeFingerprintSha256: trackFingerprintSha256,
      reasonCodes: ['OWNER_SELECTED_NEXT_ITEM'],
      limitationCodes: [],
      dependencyReasonCodes: [],
      target: {
        kind: 'MILESTONE',
        stageCode: 'PUBLICATION',
        milestoneCode: 'PUBLICATION_WINDOW'
      }
    },
    recommendationEvaluation: {
      state: 'COMPLETE_NONE',
      evaluatedAt,
      scopeFingerprintSha256: trackFingerprintSha256,
      reasonCodes: ['NO_RECOMMENDATION_FOR_EXACT_SCOPE'],
      limitationCodes: [],
      dependencyReasonCodes: [],
      target: null
    },
    primaryTimeEvaluation: {
      state: 'PRESENT',
      evaluatedAt,
      scopeFingerprintSha256: trackFingerprintSha256,
      reasonCodes: ['OWNER_SELECTED_PRIMARY_TIME'],
      limitationCodes: [],
      dependencyReasonCodes: [],
      target: { timeAssertionId: 'time_publication-window' }
    },
    authority: noTrademarkLifecycleAuthorityConsequencesV1
  };
  return body;
}

function signProjection(
  value: Omit<TrademarkLifecycleProjectionV1, 'projectionFingerprintSha256'>
): TrademarkLifecycleProjectionV1 {
  const material = {
    ...value,
    semanticGlossary: semanticGlossaryForCodes(projectionSemanticCodes(value))
  };
  return {
    ...material,
    projectionFingerprintSha256: trademarkLifecycleProjectionFingerprintSha256V1(material)
  };
}

function projection(): TrademarkLifecycleProjectionV1 {
  return signProjection(projectionBody());
}

function mutableProjection(): Mutable<TrademarkLifecycleProjectionV1> {
  return structuredClone(projection()) as unknown as Mutable<TrademarkLifecycleProjectionV1>;
}

function mutableTrack(): Mutable<TrademarkLifecycleProjectionV1['track']> {
  return structuredClone(projection().track) as unknown as Mutable<
    TrademarkLifecycleProjectionV1['track']
  >;
}

function resignProjection(
  value: Mutable<TrademarkLifecycleProjectionV1>
): TrademarkLifecycleProjectionV1 {
  const { projectionFingerprintSha256, ...body } = value;
  void projectionFingerprintSha256;
  return signProjection(
    body as unknown as Omit<TrademarkLifecycleProjectionV1, 'projectionFingerprintSha256'>
  );
}

function resignProjectionWithoutSemanticNormalization(
  value: Mutable<TrademarkLifecycleProjectionV1>
): TrademarkLifecycleProjectionV1 {
  const { projectionFingerprintSha256, ...body } = value;
  void projectionFingerprintSha256;
  const material = body as unknown as Omit<
    TrademarkLifecycleProjectionV1,
    'projectionFingerprintSha256'
  >;
  return {
    ...material,
    projectionFingerprintSha256: trademarkLifecycleProjectionFingerprintSha256V1(material)
  };
}

function synchronizeReadSemanticGlossary(value: Mutable<TrademarkLifecycleAuthorizedReadV1>): void {
  const projectionGlossaryCodes = new Set(
    value.projection?.semanticGlossary.map((entry) => entry.code) ?? []
  );
  const usedCodes = [
    ...value.dependencyReasonCodes,
    ...value.currentness.reasonCodes,
    ...value.selection.reasonCodes,
    ...value.selection.missingInputCodes,
    ...value.coverage.reasonCodes,
    ...value.interactionAccess.flatMap((access) => access.reasonCodes)
  ].filter((code) => !projectionGlossaryCodes.has(code));
  value.readSemanticGlossary = semanticGlossaryForCodes(usedCodes);
}

function parseTrademarkLifecycleReadResultV1(
  value: TrademarkLifecycleAuthorizedReadV1 | Mutable<TrademarkLifecycleAuthorizedReadV1>
): TrademarkLifecycleAuthorizedReadV1 {
  const fixture = value as unknown as Mutable<TrademarkLifecycleAuthorizedReadV1>;
  synchronizeReadSemanticGlossary(fixture);
  return parseTrademarkLifecycleReadResultContractV1(fixture);
}

function authorizedRead(
  selectedProjection: TrademarkLifecycleProjectionV1 | null = projection()
): TrademarkLifecycleAuthorizedReadV1 {
  const selectedTrack = projection().track;
  const coverage = selectedProjection?.coverage ?? projection().coverage;
  const value: TrademarkLifecycleAuthorizedReadV1 = {
    schemaVersion: 1,
    status: 'AUTHORIZED_FOUND',
    evaluatedAt,
    workspaceId,
    asset: {
      id: 'trademark-asset_us-98123456',
      version: 9
    },
    dependencyState: 'AVAILABLE',
    dependencyReasonCodes: [],
    currentness: {
      state: 'CURRENT',
      evaluatedAt,
      reasonCodes: []
    },
    readSemanticGlossary: [],
    selection: {
      state: 'SELECTED',
      candidates: [selectedTrack],
      selectedTrackFingerprintSha256: selectedTrack.trackFingerprintSha256,
      reasonCodes: ['EXACT_TRACK_SELECTED'],
      missingInputCodes: []
    },
    projectionAvailability: selectedProjection === null ? 'NO_PROJECTION' : 'AVAILABLE',
    coverage,
    projection: selectedProjection,
    interactionAccess:
      selectedProjection === null
        ? []
        : [
            {
              interactionId: 'interaction_start-publication-preparation',
              projectionReference: {
                projectionId: selectedProjection.projectionId,
                version: selectedProjection.version,
                projectionFingerprintSha256: selectedProjection.projectionFingerprintSha256
              },
              trackFingerprintSha256: selectedProjection.track.trackFingerprintSha256,
              target: {
                kind: 'MILESTONE',
                stageCode: 'PUBLICATION',
                milestoneCode: 'PUBLICATION_WINDOW',
                ownerReference: null
              },
              destination: {
                kind: 'EXISTING_WORKBENCH',
                reference: workbenchReference
              },
              intendedOperation: 'OPEN_EXISTING_WORKBENCH',
              accessState: 'ALLOWED',
              reasonCodes: ['CURRENT_ACTOR_ELIGIBLE'],
              evaluatedAt,
              permissionPolicyVersion: 'core-permission-v3',
              entitlementPolicyVersion: 'lite-plus-v2',
              executionAuthorized: false
            }
          ]
  };
  synchronizeReadSemanticGlossary(value as unknown as Mutable<TrademarkLifecycleAuthorizedReadV1>);
  return value;
}

function mutableAuthorizedRead(
  value: TrademarkLifecycleAuthorizedReadV1 = authorizedRead()
): Mutable<TrademarkLifecycleAuthorizedReadV1> {
  return structuredClone(value) as unknown as Mutable<TrademarkLifecycleAuthorizedReadV1>;
}

function authorizedRecommendationRead(): Mutable<TrademarkLifecycleAuthorizedReadV1> {
  const value = mutableAuthorizedRead(authorizedRead(projectionWithRecommendation()));
  value.interactionAccess[0]!.target = {
    kind: 'RECOMMENDATION',
    stageCode: null,
    milestoneCode: null,
    ownerReference: structuredClone(recommendationReference)
  };
  value.interactionAccess[0]!.intendedOperation = 'OPEN_EXISTING_WORKBENCH';
  return value;
}

function authorizedOwnerEvidenceRead(): Mutable<TrademarkLifecycleAuthorizedReadV1> {
  const value = mutableAuthorizedRead();
  value.interactionAccess[0]!.target = {
    kind: 'OWNER_EVIDENCE',
    stageCode: null,
    milestoneCode: null,
    ownerReference: structuredClone(ruleReference)
  };
  value.interactionAccess[0]!.destination = {
    kind: 'EVIDENCE_INSPECTION',
    reference: structuredClone(ruleReference)
  };
  value.interactionAccess[0]!.intendedOperation = 'INSPECT_EVIDENCE';
  return value;
}

function authorizedSourceEvidenceRead(): Mutable<TrademarkLifecycleAuthorizedReadV1> {
  const value = mutableAuthorizedRead();
  value.interactionAccess[0]!.target = {
    kind: 'SOURCE_EVIDENCE',
    stageCode: null,
    milestoneCode: null,
    sourceReference: structuredClone(dataRecordSourceReference)
  };
  value.interactionAccess[0]!.destination = {
    kind: 'EVIDENCE_INSPECTION',
    reference: structuredClone(dataRecordReference)
  };
  value.interactionAccess[0]!.intendedOperation = 'INSPECT_EVIDENCE';
  return value;
}

function authorizedReviewableHandoffRead(): Mutable<TrademarkLifecycleAuthorizedReadV1> {
  const selectedProjection = mutateAndResign((value) => {
    value.stages[2]!.milestones[0]!.destinationReference = {
      kind: 'REVIEWABLE_HANDOFF',
      reference: structuredClone(workbenchReference)
    };
  });
  const value = mutableAuthorizedRead(authorizedRead(selectedProjection));
  value.interactionAccess[0]!.intendedOperation = 'BEGIN_REVIEWABLE_HANDOFF';
  value.interactionAccess[0]!.destination = {
    kind: 'REVIEWABLE_HANDOFF',
    reference: structuredClone(workbenchReference)
  };
  value.interactionAccess[0]!.accessState = 'DENIED';
  value.interactionAccess[0]!.reasonCodes = ['REVIEWABLE_HANDOFF_NOT_ADMITTED'];
  return value;
}

function mutateAndResign(
  mutate: (value: Mutable<TrademarkLifecycleProjectionV1>) => void
): TrademarkLifecycleProjectionV1 {
  const value = mutableProjection();
  mutate(value);
  return resignProjection(value);
}

function projectionWithRecommendation(): TrademarkLifecycleProjectionV1 {
  return mutateAndResign((value) => {
    value.stages[2]!.milestones[0]!.attentionOrRecommendationReference =
      structuredClone(recommendationReference);
    value.recommendationEvaluation = {
      state: 'PRESENT',
      evaluatedAt,
      scopeFingerprintSha256: trackFingerprintSha256,
      reasonCodes: ['OWNER_BACKED_RECOMMENDATION'],
      limitationCodes: [],
      dependencyReasonCodes: [],
      target: structuredClone(recommendationReference)
    };
  });
}

function projectionWithUnresolvedMilestoneConflict(
  targetReference: string
): TrademarkLifecycleProjectionV1 {
  return mutateAndResign((value) => {
    value.conflictState = 'UNRESOLVED';
    value.recommendationEvaluation = {
      state: 'PARTIAL',
      evaluatedAt,
      scopeFingerprintSha256: trackFingerprintSha256,
      reasonCodes: ['UNRESOLVED_CONFLICT'],
      limitationCodes: ['CONFLICT_LIMITS_RECOMMENDATION'],
      dependencyReasonCodes: [],
      target: null
    };
    value.conflicts = [
      {
        conflictId: 'MILESTONE_SOURCE_CONFLICT',
        state: 'UNRESOLVED',
        targetKind: 'MILESTONE',
        targetReference,
        competingReferences: [
          structuredClone(dataRecordReference),
          {
            owner: 'WORKSPACE_USER',
            kind: 'WORKSPACE_CONFIRMATION',
            id: 'confirmation_us-98123456',
            version: 1,
            fingerprintSha256: sha('b')
          }
        ],
        resolutionOwner: 'MARKREG',
        resolutionReference: null,
        reasonCodes: ['SOURCE_CONFLICT']
      }
    ];
  });
}

function configureConflictingCurrentPosition(
  value: Mutable<TrademarkLifecycleProjectionV1>,
  targetKind: 'FIELD' | 'MILESTONE',
  targetReference: string,
  conflictState: 'UNRESOLVED' | 'RESOLVED'
): void {
  value.currentPosition = {
    supportState: 'CONFLICTING',
    currentGranularity: null,
    currentStageCode: null,
    currentMilestoneCode: null,
    reasonCodes: ['POSITION_CONFLICTING']
  };
  value.stages[1]!.processState = 'UNKNOWN';
  value.stages[1]!.milestones[0]!.processState = 'UNKNOWN';
  value.conflictState = conflictState;
  value.recommendationEvaluation = {
    state: 'PARTIAL',
    evaluatedAt,
    scopeFingerprintSha256: trackFingerprintSha256,
    reasonCodes: ['CURRENT_POSITION_CONFLICT'],
    limitationCodes: ['CURRENT_POSITION_CONFLICT'],
    dependencyReasonCodes: [],
    target: null
  };
  value.conflicts = [
    {
      conflictId: 'CURRENT_POSITION_CONFLICT',
      state: conflictState,
      targetKind,
      targetReference,
      competingReferences: [
        structuredClone(dataRecordReference),
        {
          owner: 'WORKSPACE_USER',
          kind: 'WORKSPACE_CONFIRMATION',
          id: 'confirmation_us-98123456',
          version: 1,
          fingerprintSha256: sha('a')
        }
      ],
      resolutionOwner: 'MARKREG',
      resolutionReference: conflictState === 'RESOLVED' ? structuredClone(methodReference) : null,
      reasonCodes: ['CURRENT_POSITION_CONFLICT']
    }
  ];
}

function projectionWithConflictingTime(options: {
  conflictState: 'UNRESOLVED' | 'RESOLVED';
  targetKind: 'TIME_ASSERTION' | 'FIELD';
  targetReference: string;
}): TrademarkLifecycleProjectionV1 {
  return mutateAndResign((value) => {
    const assertion = value.stages[2]!.milestones[0]!.timeAssertions[0]! as unknown as Record<
      string,
      unknown
    >;
    Object.assign(assertion, {
      valueState: 'CONFLICTING',
      value: null,
      confidence: null,
      conflictIds: ['PUBLICATION_TIME_CONFLICT']
    });
    value.conflictState = options.conflictState;
    value.primaryTimeEvaluation = {
      state: 'PARTIAL',
      evaluatedAt,
      scopeFingerprintSha256: trackFingerprintSha256,
      reasonCodes: ['TIME_ASSERTION_CONFLICT'],
      limitationCodes: ['PRIMARY_TIME_UNRESOLVED'],
      dependencyReasonCodes: [],
      target: null
    };
    value.recommendationEvaluation = {
      state: 'PARTIAL',
      evaluatedAt,
      scopeFingerprintSha256: trackFingerprintSha256,
      reasonCodes: ['TIME_ASSERTION_CONFLICT'],
      limitationCodes: ['TIME_CONFLICT_LIMITS_RECOMMENDATION'],
      dependencyReasonCodes: [],
      target: null
    };
    value.conflicts = [
      {
        conflictId: 'PUBLICATION_TIME_CONFLICT',
        state: options.conflictState,
        targetKind: options.targetKind,
        targetReference: options.targetReference,
        competingReferences: [structuredClone(dataRecordReference), structuredClone(ruleReference)],
        resolutionOwner: 'MARKREG',
        resolutionReference:
          options.conflictState === 'RESOLVED' ? structuredClone(methodReference) : null,
        reasonCodes: ['TIME_ASSERTION_CONFLICT']
      }
    ];
  });
}

describe('Trademark Lifecycle Projection V1', () => {
  it('accepts the exact MILESTONE projection and produces a deterministic fingerprint', () => {
    const value = projection();
    const body = projectionBody();
    const expectedMaterial = {
      ...body,
      semanticGlossary: semanticGlossaryForCodes(projectionSemanticCodes(body))
    };
    expect(parseTrademarkLifecycleProjectionV1(value)).toEqual(value);
    expect(trademarkLifecycleProjectionFingerprintMaterialV1(value)).toEqual(expectedMaterial);
    expect(trademarkLifecycleProjectionFingerprintSha256V1(expectedMaterial)).toBe(
      trademarkLifecycleProjectionFingerprintSha256V1(structuredClone(expectedMaterial))
    );
  });

  it.each([
    [
      'missing stage summary',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        delete (value.stages[0] as unknown as Record<string, unknown>).summary;
      }
    ],
    [
      'empty milestone English summary',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.stages[0]!.milestones[0]!.summary.en = '';
      }
    ],
    [
      'markup in stage Chinese summary',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.stages[0]!.summary.zhCN = '<strong>申请已提交</strong>';
      }
    ]
  ] as const)('rejects unsafe bilingual node semantics: %s', (_label, mutate) => {
    expect(() => parseTrademarkLifecycleProjectionV1(mutateAndResign(mutate))).toThrow();
  });

  it.each([
    [
      'missing used code',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.semanticGlossary.splice(0, 1);
      }
    ],
    [
      'duplicate code',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.semanticGlossary.push(structuredClone(value.semanticGlossary[0]!));
      }
    ],
    [
      'markup in locale text',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.semanticGlossary[0]!.text.en = '<b>Unsafe</b>';
      }
    ],
    [
      'empty locale text',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.semanticGlossary[0]!.text.zhCN = '';
      }
    ],
    [
      'unused orphan code',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.semanticGlossary.push({
          code: 'ORPHAN_SEMANTIC_CODE',
          text: { zhCN: '未使用语义', en: 'Unused semantic' }
        });
      }
    ]
  ] as const)('rejects unsafe projection glossary: %s', (_label, mutate) => {
    const value = mutableProjection();
    mutate(value);
    expect(() =>
      parseTrademarkLifecycleProjectionV1(resignProjectionWithoutSemanticNormalization(value))
    ).toThrow();
  });

  it('accepts STAGE_ONLY only when the current stage has no CURRENT milestone', () => {
    const value = mutateAndResign((candidate) => {
      candidate.currentPosition = {
        supportState: 'SUPPORTED',
        currentGranularity: 'STAGE_ONLY',
        currentStageCode: 'EXAMINATION',
        currentMilestoneCode: null,
        reasonCodes: ['OWNER_SELECTED_CURRENT_STAGE']
      };
      candidate.stages[1]!.milestones[0]!.processState = 'FUTURE';
    });
    expect(parseTrademarkLifecycleProjectionV1(value)).toEqual(value);
  });

  it.each(['UNKNOWN', 'CONFLICTING'] as const)(
    'accepts %s position only without a false current node',
    (supportState) => {
      const value = mutateAndResign((candidate) => {
        candidate.currentPosition = {
          supportState,
          currentGranularity: null,
          currentStageCode: null,
          currentMilestoneCode: null,
          reasonCodes: [`POSITION_${supportState}`]
        };
        candidate.stages[1]!.processState = supportState === 'UNKNOWN' ? 'UNKNOWN' : 'UNKNOWN';
        candidate.stages[1]!.milestones[0]!.processState = 'UNKNOWN';
        if (supportState === 'CONFLICTING') {
          configureConflictingCurrentPosition(candidate, 'FIELD', 'currentPosition', 'UNRESOLVED');
        }
      });
      expect(parseTrademarkLifecycleProjectionV1(value)).toEqual(value);
    }
  );

  it('allows lastUndisputedPosition only when its exact stage and milestone are OCCURRED', () => {
    const withHistoricalPosition = (stageCode: string, milestoneCode: string) =>
      mutateAndResign((candidate) => {
        candidate.currentPosition = {
          supportState: 'UNKNOWN',
          currentGranularity: null,
          currentStageCode: null,
          currentMilestoneCode: null,
          reasonCodes: ['CURRENT_POSITION_UNKNOWN']
        };
        candidate.stages[1]!.processState = 'UNKNOWN';
        candidate.stages[1]!.milestones[0]!.processState = 'UNKNOWN';
        candidate.lastUndisputedPosition = { stageCode, milestoneCode, asOf };
      });

    const occurred = withHistoricalPosition('FILING', 'APPLICATION_RECEIVED');
    expect(parseTrademarkLifecycleProjectionV1(occurred)).toEqual(occurred);
    expect(() => withHistoricalPosition('EXAMINATION', 'SUBSTANTIVE_EXAMINATION')).toThrow();
    expect(() => withHistoricalPosition('PUBLICATION', 'PUBLICATION_WINDOW')).toThrow();
  });

  it('rejects current-position conflict support from unrelated or resolved conflicts', () => {
    expect(() =>
      mutateAndResign((value) => {
        configureConflictingCurrentPosition(
          value,
          'MILESTONE',
          'FILING/APPLICATION_RECEIVED',
          'UNRESOLVED'
        );
      })
    ).toThrow();
    expect(() =>
      mutateAndResign((value) => {
        configureConflictingCurrentPosition(value, 'FIELD', 'currentPosition', 'RESOLVED');
      })
    ).toThrow();
  });

  it('rejects a supported current position contradicted by an exact unresolved conflict', () => {
    expect(() =>
      projectionWithUnresolvedMilestoneConflict('EXAMINATION/SUBSTANTIVE_EXAMINATION')
    ).toThrow();

    expect(() =>
      mutateAndResign((value) => {
        value.conflictState = 'UNRESOLVED';
        value.recommendationEvaluation = {
          state: 'PARTIAL',
          evaluatedAt,
          scopeFingerprintSha256: trackFingerprintSha256,
          reasonCodes: ['UNRESOLVED_CURRENT_POSITION_CONFLICT'],
          limitationCodes: ['CURRENT_POSITION_REQUIRES_RESOLUTION'],
          dependencyReasonCodes: [],
          target: null
        };
        value.conflicts = [
          {
            conflictId: 'SUPPORTED_CURRENT_POSITION_CONFLICT',
            state: 'UNRESOLVED',
            targetKind: 'FIELD',
            targetReference: 'currentPosition',
            competingReferences: [
              structuredClone(dataRecordReference),
              structuredClone(ruleReference)
            ],
            resolutionOwner: 'MARKREG',
            resolutionReference: null,
            reasonCodes: ['UNRESOLVED_CURRENT_POSITION_CONFLICT']
          }
        ];
      })
    ).toThrow();
  });

  it('keeps next item, recommendation and primary time as independent evaluations', () => {
    const value = projection();
    expect(value.nextItemEvaluation.state).toBe('PRESENT');
    expect(value.recommendationEvaluation.state).toBe('COMPLETE_NONE');
    expect(value.primaryTimeEvaluation.state).toBe('PRESENT');
    expect(parseTrademarkLifecycleProjectionV1(value)).toEqual(value);
  });

  it('allows a PRESENT stage only when that stage is the sole UPCOMING node', () => {
    const value = mutateAndResign((candidate) => {
      candidate.nextItemEvaluation = {
        state: 'PRESENT',
        evaluatedAt,
        scopeFingerprintSha256: trackFingerprintSha256,
        reasonCodes: ['OWNER_SELECTED_NEXT_STAGE'],
        limitationCodes: [],
        dependencyReasonCodes: [],
        target: { kind: 'STAGE', stageCode: 'PUBLICATION', milestoneCode: null }
      };
      candidate.stages[2]!.milestones[0]!.processState = 'FUTURE';
    });
    expect(parseTrademarkLifecycleProjectionV1(value)).toEqual(value);

    expect(() =>
      mutateAndResign((candidate) => {
        candidate.nextItemEvaluation = {
          state: 'PRESENT',
          evaluatedAt,
          scopeFingerprintSha256: trackFingerprintSha256,
          reasonCodes: ['OWNER_SELECTED_NEXT_STAGE'],
          limitationCodes: [],
          dependencyReasonCodes: [],
          target: { kind: 'STAGE', stageCode: 'PUBLICATION', milestoneCode: null }
        };
      })
    ).toThrow();
  });

  it('allows a PRESENT milestone plus its containing stage and rejects any extra UPCOMING node', () => {
    const exactMilestone = projection();
    expect(parseTrademarkLifecycleProjectionV1(exactMilestone)).toEqual(exactMilestone);

    expect(() =>
      mutateAndResign((candidate) => {
        const existing = candidate.stages[2]!.milestones[0]!;
        candidate.stages[2]!.milestones.push({
          milestoneCode: 'SECOND_PUBLICATION_ACTION',
          order: 2,
          name: { zhCN: '其他公告事项', en: 'Other publication action' },
          summary: { zhCN: '不得同时成为下一事项。', en: 'Must not be a second next item.' },
          processState: 'UPCOMING',
          timeAssertions: [],
          sourceReferences: structuredClone(existing.sourceReferences),
          ruleReferences: structuredClone(existing.ruleReferences),
          reasonCodes: ['EXTRA_UPCOMING_ITEM'],
          limitationCodes: []
        });
      })
    ).toThrow();
  });

  it.each(['COMPLETE_NONE', 'PARTIAL', 'UNAVAILABLE'] as const)(
    'forbids every UPCOMING node when nextItemEvaluation is %s',
    (state) => {
      expect(() =>
        mutateAndResign((candidate) => {
          candidate.nextItemEvaluation =
            state === 'COMPLETE_NONE'
              ? {
                  state,
                  evaluatedAt,
                  scopeFingerprintSha256: trackFingerprintSha256,
                  reasonCodes: ['NO_NEXT_ITEM_FOR_EXACT_SCOPE'],
                  limitationCodes: [],
                  dependencyReasonCodes: [],
                  target: null
                }
              : state === 'PARTIAL'
                ? {
                    state,
                    evaluatedAt,
                    scopeFingerprintSha256: trackFingerprintSha256,
                    reasonCodes: ['NEXT_ITEM_PARTIAL'],
                    limitationCodes: ['NEXT_ITEM_NOT_RESOLVED'],
                    dependencyReasonCodes: [],
                    target: null
                  }
                : {
                    state,
                    evaluatedAt,
                    scopeFingerprintSha256: trackFingerprintSha256,
                    reasonCodes: ['NEXT_ITEM_UNAVAILABLE'],
                    limitationCodes: [],
                    dependencyReasonCodes: ['NEXT_ITEM_DEPENDENCY_UNAVAILABLE'],
                    target: null
                  };
        })
      ).toThrow();
    }
  );

  it.each([
    [
      'PRESENT without its own target',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        Object.assign(value.nextItemEvaluation, { target: null });
      }
    ],
    [
      'COMPLETE_NONE carrying a recommendation',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        Object.assign(value.recommendationEvaluation, { target: structuredClone(methodReference) });
      }
    ],
    [
      'PARTIAL without a limitation',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        Object.assign(value.recommendationEvaluation, {
          state: 'PARTIAL',
          limitationCodes: [],
          dependencyReasonCodes: [],
          target: null
        });
      }
    ],
    [
      'UNAVAILABLE without a dependency reason',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        Object.assign(value.primaryTimeEvaluation, {
          state: 'UNAVAILABLE',
          limitationCodes: [],
          dependencyReasonCodes: [],
          target: null
        });
      }
    ],
    [
      'PRESENT evaluation scope fingerprint drift',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.nextItemEvaluation.scopeFingerprintSha256 = sha('d');
      }
    ],
    [
      'COMPLETE_NONE evaluation scope fingerprint drift',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.recommendationEvaluation.scopeFingerprintSha256 = sha('d');
      }
    ],
    [
      'FULL coverage scope fingerprint drift',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.coverage.scopeFingerprintSha256 = sha('d');
      }
    ]
  ] as const)('rejects overloaded evaluation state: %s', (_label, mutate) => {
    expect(() => parseTrademarkLifecycleProjectionV1(mutateAndResign(mutate))).toThrow();
  });

  it.each([
    [
      'unknown root key',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => Object.assign(value, { extra: true })
    ],
    [
      'invalid projection id',
      (value: Mutable<TrademarkLifecycleProjectionV1>) =>
        Object.assign(value, { projectionId: 'projection_123' })
    ],
    [
      'non-positive version',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => Object.assign(value, { version: 0 })
    ],
    [
      'invalid input hash',
      (value: Mutable<TrademarkLifecycleProjectionV1>) =>
        Object.assign(value, { normalizedInputFingerprintSha256: sha('G') })
    ],
    [
      'invented owner-unsupported asset fingerprint',
      (value: Mutable<TrademarkLifecycleProjectionV1>) =>
        Object.assign(value.asset, { fingerprintSha256: sha('7') })
    ],
    [
      'impossible timestamp',
      (value: Mutable<TrademarkLifecycleProjectionV1>) =>
        Object.assign(value, { generatedAt: '2026-02-30T01:00:00Z' })
    ],
    [
      'missing English semantics',
      (value: Mutable<TrademarkLifecycleProjectionV1>) =>
        Object.assign(value.stages[0]!.name, { en: '' })
    ]
  ] as const)('rejects %s', (_label, mutate) => {
    const value = mutableProjection();
    mutate(value);
    expect(() => parseTrademarkLifecycleProjectionV1(resignProjection(value))).toThrow();
  });

  it.each([
    [
      'duplicate stage code',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.stages[2]!.stageCode = value.stages[1]!.stageCode;
      }
    ],
    [
      'duplicate or non-monotonic stage order',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.stages[2]!.order = value.stages[1]!.order;
      }
    ],
    [
      'duplicate milestone code',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.stages[2]!.milestones.push(structuredClone(value.stages[2]!.milestones[0]!));
        value.stages[2]!.milestones[1]!.order = 2;
      }
    ],
    [
      'duplicate time assertion id',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.stages[2]!.milestones[0]!.timeAssertions.push(
          structuredClone(value.stages[2]!.milestones[0]!.timeAssertions[0]!)
        );
      }
    ],
    [
      'dangling primary time reference',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        if (value.primaryTimeEvaluation.state !== 'PRESENT') throw new Error('fixture drift');
        value.primaryTimeEvaluation.target.timeAssertionId = 'time_missing';
      }
    ],
    [
      'dangling next milestone reference',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        if (value.nextItemEvaluation.state !== 'PRESENT') throw new Error('fixture drift');
        if (value.nextItemEvaluation.target.kind !== 'MILESTONE') throw new Error('fixture drift');
        value.nextItemEvaluation.target.milestoneCode = 'MISSING';
      }
    ]
  ] as const)('rejects %s after a fresh semantic fingerprint', (_label, mutate) => {
    expect(() => parseTrademarkLifecycleProjectionV1(mutateAndResign(mutate))).toThrow();
  });

  it.each([
    [
      'STAGE_ONLY with a CURRENT milestone',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.currentPosition = {
          supportState: 'SUPPORTED',
          currentGranularity: 'STAGE_ONLY',
          currentStageCode: 'EXAMINATION',
          currentMilestoneCode: null,
          reasonCodes: []
        };
      }
    ],
    [
      'MILESTONE with a dangling current milestone',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        if (value.currentPosition.supportState !== 'SUPPORTED') throw new Error('fixture drift');
        value.currentPosition.currentMilestoneCode = 'MISSING';
      }
    ],
    [
      'UNKNOWN while a node remains CURRENT',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.currentPosition = {
          supportState: 'UNKNOWN',
          currentGranularity: null,
          currentStageCode: null,
          currentMilestoneCode: null,
          reasonCodes: ['INSUFFICIENT_EVIDENCE']
        };
      }
    ],
    [
      'more than one current stage',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.stages[2]!.processState = 'CURRENT';
      }
    ],
    [
      'NOT_APPLICABLE as next item',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.stages[2]!.milestones[0]!.processState = 'NOT_APPLICABLE';
      }
    ]
  ] as const)('rejects illegal current/upcoming state: %s', (_label, mutate) => {
    expect(() => parseTrademarkLifecycleProjectionV1(mutateAndResign(mutate))).toThrow();
  });

  it.each([
    [
      'EMPTY without an admitted complete exact-scope receipt',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.sourceReads[0]!.state = 'EMPTY';
        value.sourceReads[0]!.sourceReferences = [];
      }
    ],
    [
      'EMPTY with an ordinary source record masquerading as a receipt',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.sourceReads[0]!.state = 'EMPTY';
      }
    ],
    [
      'OBSERVED without an observed source',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.sourceReads[0]!.sourceReferences = [];
      }
    ],
    [
      'source owner mismatch',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.sourceReads[0]!.owner = 'KNOWLEDGE';
      }
    ],
    [
      'UNAVAILABLE carrying positive facts',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.sourceReads[0]!.state = 'UNAVAILABLE';
      }
    ],
    [
      'OBSERVED source without observedAt',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        const source = value.sourceReads[0]!.sourceReferences[0] as unknown as Record<
          string,
          unknown
        >;
        delete source.observedAt;
      }
    ],
    [
      'OBSERVED source with invented freshness',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        Object.assign(value.sourceReads[0]!.sourceReferences[0]!, { freshness: 'FRESH' });
      }
    ]
  ] as const)('prevents false-zero/source-read ambiguity: %s', (_label, mutate) => {
    expect(() => parseTrademarkLifecycleProjectionV1(mutateAndResign(mutate))).toThrow();
  });

  it('retains owner source observedAt and freshness instead of flattening provenance', () => {
    const parsed = parseTrademarkLifecycleProjectionV1(projection());
    expect(parsed.sourceReads[0]!.sourceReferences[0]).toEqual(dataRecordSourceReference);
  });

  it('rejects a node or time source reference absent from exact projection source reads', () => {
    expect(() =>
      parseTrademarkLifecycleProjectionV1(
        mutateAndResign((value) => {
          const sourceReference =
            value.stages[2]!.milestones[0]!.timeAssertions[0]!.sourceReferences[0]!;
          value.stages[2]!.milestones[0]!.timeAssertions[0]!.sourceReferences[0] = {
            ...sourceReference,
            sourceId: 'data-record_not-read'
          };
        })
      )
    ).toThrow();
  });

  it('rejects a node or time rule reference absent from projection rule dependencies', () => {
    expect(() =>
      parseTrademarkLifecycleProjectionV1(
        mutateAndResign((value) => {
          const rule = value.stages[2]!.milestones[0]!.timeAssertions[0]!.ruleReferences[0]!;
          value.stages[2]!.milestones[0]!.timeAssertions[0]!.ruleReferences[0] = {
            ...rule,
            id: 'rule_not-materialized',
            fingerprintSha256: sha('c')
          };
        })
      )
    ).toThrow();
  });

  it.each([
    [
      'source read after projection generation',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.sourceReads[0]!.asOf = '2026-10-10T01:00:01.000Z';
      }
    ],
    [
      'time assertion evaluated after projection generation',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.stages[2]!.milestones[0]!.timeAssertions[0]!.asOf = '2026-10-10T01:00:01.000Z';
      }
    ],
    [
      'evaluation completed after projection generation',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.nextItemEvaluation.evaluatedAt = '2026-10-10T01:00:01.000Z';
      }
    ]
  ] as const)('rejects future embedded projection time: %s', (_label, mutate) => {
    expect(() => parseTrademarkLifecycleProjectionV1(mutateAndResign(mutate))).toThrow();
  });

  it.each([
    [
      'AVAILABLE without a value',
      (assertion: Record<string, unknown>) => Object.assign(assertion, { value: null })
    ],
    [
      'interval whose end precedes its start',
      (assertion: Record<string, unknown>) =>
        Object.assign(assertion.value as Record<string, unknown>, {
          start: '2027-01-01',
          end: '2026-12-01'
        })
    ],
    [
      'invalid jurisdiction time zone',
      (assertion: Record<string, unknown>) =>
        Object.assign(assertion.value as Record<string, unknown>, {
          jurisdictionTimeZone: 'US/Eastern-ish'
        })
    ],
    [
      'confidence on a non-prediction',
      (assertion: Record<string, unknown>) =>
        Object.assign(assertion, {
          confidence: {
            probability: 0.75,
            calibrationMethodReference: methodReference,
            evaluationState: 'ADMITTED',
            evaluatedAt
          }
        })
    ],
    [
      'certified deadline claim',
      (assertion: Record<string, unknown>) =>
        Object.assign(assertion, { legalDeadlineCertified: true })
    ],
    [
      'blocked professional deadline class',
      (assertion: Record<string, unknown>) =>
        Object.assign(assertion, { timeClass: 'PROFESSIONALLY_REVIEWED_DEADLINE' })
    ],
    [
      'reviewed timing without an admitted owner review receipt',
      (assertion: Record<string, unknown>) =>
        Object.assign(assertion, {
          timeClass: 'REVIEWED_TIMING',
          presentationMeaning: 'REVIEWED_NON_CERTIFIED_TIME'
        })
    ],
    [
      'source-recorded fact using a rule-derived window presentation',
      (assertion: Record<string, unknown>) =>
        Object.assign(assertion, {
          timeClass: 'SOURCE_RECORDED',
          semanticRole: 'OFFICIAL_DATE',
          labelCode: 'SOURCE_RECORDED_OFFICIAL_DATE',
          presentationMeaning: 'RULE_DERIVED_WINDOW'
        })
    ],
    [
      'legacy free-text label beside the governed label code',
      (assertion: Record<string, unknown>) =>
        Object.assign(assertion, {
          label: { zhCN: '法定截止期限', en: 'Legal deadline' }
        })
    ]
  ] as const)('rejects unsafe time assertion: %s', (_label, mutate) => {
    const value = mutableProjection();
    const assertion = value.stages[2]!.milestones[0]!.timeAssertions[0]! as unknown as Record<
      string,
      unknown
    >;
    mutate(assertion);
    expect(() => parseTrademarkLifecycleProjectionV1(resignProjection(value))).toThrow();
  });

  it('accepts SOURCE_RECORDED only as a typed RECORDED_FACT without inferring a deadline', () => {
    const value = mutateAndResign((candidate) => {
      const assertion = candidate.stages[2]!.milestones[0]!.timeAssertions[0]!;
      assertion.timeClass = 'SOURCE_RECORDED';
      assertion.presentationMeaning = 'RECORDED_FACT';
      assertion.semanticRole = 'OFFICIAL_DATE';
      assertion.labelCode = 'SOURCE_RECORDED_OFFICIAL_DATE';
    });
    expect(parseTrademarkLifecycleProjectionV1(value)).toEqual(value);
  });

  it('accepts a prediction without confidence and rejects numeric confidence without an owner receipt', () => {
    const predictionWithoutConfidence = mutateAndResign((value) => {
      const assertion = value.stages[2]!.milestones[0]!.timeAssertions[0]!;
      assertion.timeClass = 'PREDICTION';
      assertion.presentationMeaning = 'PREDICTED_TIME';
    });
    expect(parseTrademarkLifecycleProjectionV1(predictionWithoutConfidence)).toEqual(
      predictionWithoutConfidence
    );

    const confidenceWithoutReceipt = mutableProjection();
    Object.assign(confidenceWithoutReceipt.stages[2]!.milestones[0]!.timeAssertions[0]!, {
      timeClass: 'PREDICTION',
      presentationMeaning: 'PREDICTED_TIME',
      confidence: {
        probability: 0.75,
        calibrationMethodReference: structuredClone(methodReference),
        evaluationState: 'ADMITTED',
        evaluatedAt
      }
    });
    expect(() =>
      parseTrademarkLifecycleProjectionV1(resignProjection(confidenceWithoutReceipt))
    ).toThrow();
  });

  it('accepts conflicting time only with its exact unresolved affected conflict', () => {
    const value = projectionWithConflictingTime({
      conflictState: 'UNRESOLVED',
      targetKind: 'TIME_ASSERTION',
      targetReference: 'time_publication-window'
    });
    expect(parseTrademarkLifecycleProjectionV1(value)).toEqual(value);
  });

  it('rejects conflicting time supported by an unrelated or resolved conflict', () => {
    expect(() =>
      projectionWithConflictingTime({
        conflictState: 'UNRESOLVED',
        targetKind: 'FIELD',
        targetReference: 'track.applicationOrRegistrationBasis'
      })
    ).toThrow();
    expect(() =>
      projectionWithConflictingTime({
        conflictState: 'RESOLVED',
        targetKind: 'TIME_ASSERTION',
        targetReference: 'time_publication-window'
      })
    ).toThrow();
  });

  it('rejects invalid duration ranges and uncalibrated prediction confidence', () => {
    const duration = mutableProjection();
    const assertion = duration.stages[2]!.milestones[0]!.timeAssertions[0]! as unknown as Record<
      string,
      unknown
    >;
    Object.assign(assertion, {
      timeClass: 'TYPICAL_RANGE',
      presentationMeaning: 'TYPICAL_DURATION',
      value: {
        kind: 'DURATION_RANGE',
        minimumDays: 30,
        maximumDays: 10,
        dayBasis: 'CALENDAR_DAYS'
      }
    });
    expect(() => parseTrademarkLifecycleProjectionV1(resignProjection(duration))).toThrow();

    const prediction = mutableProjection();
    const predictionAssertion = prediction.stages[2]!.milestones[0]!
      .timeAssertions[0]! as unknown as Record<string, unknown>;
    Object.assign(predictionAssertion, {
      timeClass: 'PREDICTION',
      presentationMeaning: 'PREDICTED_TIME',
      confidence: { probability: 0.7 }
    });
    expect(() => parseTrademarkLifecycleProjectionV1(resignProjection(prediction))).toThrow();
  });

  it.each([
    [
      'NONE while conflict records exist',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.conflicts = [
          {
            conflictId: 'TRACK_BASIS_CONFLICT',
            state: 'UNRESOLVED',
            targetKind: 'FIELD',
            targetReference: 'track.basis',
            competingReferences: [
              structuredClone(dataRecordReference),
              structuredClone(ruleReference)
            ],
            resolutionOwner: 'MARKREG',
            resolutionReference: null,
            reasonCodes: ['SOURCE_CONFLICT']
          }
        ];
      }
    ],
    [
      'unresolved conflict with a resolution receipt',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.conflictState = 'UNRESOLVED';
        value.conflicts = [
          {
            conflictId: 'TRACK_BASIS_CONFLICT',
            state: 'UNRESOLVED',
            targetKind: 'FIELD',
            targetReference: 'track.basis',
            competingReferences: [
              structuredClone(dataRecordReference),
              structuredClone(ruleReference)
            ],
            resolutionOwner: 'MARKREG',
            resolutionReference: structuredClone(methodReference),
            reasonCodes: ['SOURCE_CONFLICT']
          }
        ];
      }
    ],
    [
      'resolved conflict without a resolution receipt',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.conflictState = 'RESOLVED';
        value.conflicts = [
          {
            conflictId: 'TRACK_BASIS_CONFLICT',
            state: 'RESOLVED',
            targetKind: 'FIELD',
            targetReference: 'track.basis',
            competingReferences: [
              structuredClone(dataRecordReference),
              structuredClone(ruleReference)
            ],
            resolutionOwner: 'MARKREG',
            resolutionReference: null,
            reasonCodes: ['SOURCE_CONFLICT_RESOLVED']
          }
        ];
      }
    ],
    [
      'conflict with fewer than two competing references',
      (value: Mutable<TrademarkLifecycleProjectionV1>) => {
        value.conflictState = 'UNRESOLVED';
        value.conflicts = [
          {
            conflictId: 'TRACK_BASIS_CONFLICT',
            state: 'UNRESOLVED',
            targetKind: 'FIELD',
            targetReference: 'track.basis',
            competingReferences: [structuredClone(dataRecordReference)],
            resolutionOwner: 'MARKREG',
            resolutionReference: null,
            reasonCodes: ['SOURCE_CONFLICT']
          }
        ];
      }
    ]
  ] as const)('rejects conflict/receipt violation: %s', (_label, mutate) => {
    expect(() => parseTrademarkLifecycleProjectionV1(mutateAndResign(mutate))).toThrow();
  });

  it('rejects authority escalation and stale fingerprints independently', () => {
    const authority = mutableProjection();
    authority.authority.officialTruthCreated = true as never;
    expect(() => parseTrademarkLifecycleProjectionV1(resignProjection(authority))).toThrow();

    const staleFingerprint = projection();
    expect(() =>
      parseTrademarkLifecycleProjectionV1({
        ...staleFingerprint,
        workspaceId: '018f0000-0000-7000-8000-000000000002'
      })
    ).toThrow(/fingerprint/iu);
  });
});

describe('Trademark Lifecycle authorized read and privacy boundary', () => {
  it('accepts the exact selected projection with actor-scoped access', () => {
    const value = authorizedRead();
    expect(parseTrademarkLifecycleReadResultV1(value)).toEqual(value);
    expect(parseTrademarkLifecycleExternalReadResponseV1(value)).toEqual(value);
  });

  it.each([
    [
      'missing used code',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.readSemanticGlossary.splice(0, 1);
      }
    ],
    [
      'duplicate code',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.readSemanticGlossary.push(structuredClone(value.readSemanticGlossary[0]!));
      }
    ],
    [
      'markup in locale text',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.readSemanticGlossary[0]!.text.en = '<b>Unsafe</b>';
      }
    ],
    [
      'empty locale text',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.readSemanticGlossary[0]!.text.zhCN = '';
      }
    ],
    [
      'unused orphan code',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.readSemanticGlossary.push({
          code: 'ORPHAN_READ_SEMANTIC_CODE',
          text: { zhCN: '未使用读取语义', en: 'Unused read semantic' }
        });
      }
    ]
  ] as const)('rejects unsafe read glossary: %s', (_label, mutate) => {
    const value = mutableAuthorizedRead();
    mutate(value);
    expect(() => parseTrademarkLifecycleReadResultContractV1(value)).toThrow();
  });

  it('binds dependency reasons to DEGRADED/UNAVAILABLE and forbids them for AVAILABLE', () => {
    const availableWithReason = mutableAuthorizedRead();
    availableWithReason.dependencyReasonCodes = ['DEPENDENCY_DELAYED'];
    expect(() => parseTrademarkLifecycleReadResultV1(availableWithReason)).toThrow();

    for (const state of ['DEGRADED', 'UNAVAILABLE'] as const) {
      const missingReason = mutableAuthorizedRead();
      missingReason.dependencyState = state;
      missingReason.interactionAccess = [];
      expect(() => parseTrademarkLifecycleReadResultV1(missingReason)).toThrow();

      const bounded = mutableAuthorizedRead();
      bounded.dependencyState = state;
      bounded.dependencyReasonCodes = [`${state}_DEPENDENCY`];
      bounded.currentness = {
        state: 'UNKNOWN',
        evaluatedAt,
        reasonCodes: [`${state}_CURRENTNESS_UNAVAILABLE`]
      };
      bounded.interactionAccess = [];
      expect(parseTrademarkLifecycleReadResultV1(bounded)).toEqual(bounded);

      const falseCurrent = mutableAuthorizedRead();
      falseCurrent.dependencyState = state;
      falseCurrent.dependencyReasonCodes = [`${state}_DEPENDENCY`];
      falseCurrent.interactionAccess = [];
      expect(() => parseTrademarkLifecycleReadResultV1(falseCurrent)).toThrow();
    }
  });

  it.each(['STALE', 'UNKNOWN'] as const)(
    'returns immutable CURRENT projection as read-time %s while suppressing ALLOWED',
    (state) => {
      const value = mutableAuthorizedRead();
      const signedFingerprint = value.projection!.projectionFingerprintSha256;
      expect(value.projection!.currentness.state).toBe('CURRENT');
      value.currentness = {
        state,
        evaluatedAt,
        reasonCodes: [`READ_TIME_${state}`]
      };
      value.interactionAccess = [];
      const parsed = parseTrademarkLifecycleReadResultV1(value);
      expect(parsed.currentness.state).toBe(state);
      expect(parsed.projection!.currentness.state).toBe('CURRENT');
      expect(parsed.projection!.projectionFingerprintSha256).toBe(signedFingerprint);

      const unsafe = mutableAuthorizedRead();
      unsafe.currentness = structuredClone(value.currentness);
      expect(() => parseTrademarkLifecycleReadResultV1(unsafe)).toThrow();
    }
  );

  it('requires bounded read-currentness reasons and evaluation no later than the read', () => {
    const missingReason = mutableAuthorizedRead();
    missingReason.currentness = { state: 'STALE', evaluatedAt, reasonCodes: [] };
    missingReason.interactionAccess = [];
    expect(() => parseTrademarkLifecycleReadResultV1(missingReason)).toThrow();

    const futureEvaluation = mutableAuthorizedRead();
    futureEvaluation.currentness.evaluatedAt = '2026-10-10T01:00:01.000Z';
    expect(() => parseTrademarkLifecycleReadResultV1(futureEvaluation)).toThrow();
  });

  it('requires read currentness to be evaluated for the exact read timestamp', () => {
    const value = mutableAuthorizedRead();
    value.evaluatedAt = '2026-10-10T01:00:01.000Z';
    value.interactionAccess = [];
    expect(() => parseTrademarkLifecycleReadResultV1(value)).toThrow();
  });

  it('rejects read-time currentness evaluated before the selected projection was generated', () => {
    const value = mutableAuthorizedRead();
    value.currentness.evaluatedAt = '2026-10-10T00:59:59.000Z';
    expect(() => parseTrademarkLifecycleReadResultV1(value)).toThrow();
  });

  it('rejects a read that predates its immutable projection', () => {
    const value = mutableAuthorizedRead();
    value.evaluatedAt = '2026-10-10T00:59:59.000Z';
    value.currentness.evaluatedAt = value.evaluatedAt;
    value.interactionAccess[0]!.evaluatedAt = value.evaluatedAt;
    expect(() => parseTrademarkLifecycleReadResultV1(value)).toThrow();
  });

  it('accepts ALLOWED recommendation, owner evidence and source evidence interactions', () => {
    const recommendation = authorizedRecommendationRead();
    expect(parseTrademarkLifecycleReadResultV1(recommendation)).toEqual(recommendation);

    const ownerEvidence = authorizedOwnerEvidenceRead();
    expect(parseTrademarkLifecycleReadResultV1(ownerEvidence)).toEqual(ownerEvidence);

    const sourceEvidence = authorizedSourceEvidenceRead();
    expect(parseTrademarkLifecycleReadResultV1(sourceEvidence)).toEqual(sourceEvidence);
  });

  it('retains reviewable handoff only as a non-ALLOWED A1 interaction', () => {
    const value = authorizedReviewableHandoffRead();
    expect(parseTrademarkLifecycleReadResultV1(value)).toEqual(value);
  });

  it.each(['OPEN_WORKBENCH', 'START_PREPARATION'] as const)(
    'rejects legacy interaction operation %s',
    (legacyOperation) => {
      const value = mutableAuthorizedRead();
      (value.interactionAccess[0] as unknown as Record<string, unknown>).intendedOperation =
        legacyOperation;
      expect(() => parseTrademarkLifecycleReadResultV1(value)).toThrow();
    }
  );

  it('rejects ALLOWED reviewable handoff before handoff lineage is admitted', () => {
    const value = authorizedReviewableHandoffRead();
    value.interactionAccess[0]!.accessState = 'ALLOWED';
    expect(() => parseTrademarkLifecycleReadResultV1(value)).toThrow();
  });

  it('rejects an interaction operation paired with the wrong typed destination kind', () => {
    const workbenchOperation = mutableAuthorizedRead();
    workbenchOperation.interactionAccess[0]!.destination.kind = 'EVIDENCE_INSPECTION';
    expect(() => parseTrademarkLifecycleReadResultV1(workbenchOperation)).toThrow();

    const evidenceOperation = authorizedOwnerEvidenceRead();
    evidenceOperation.interactionAccess[0]!.destination.kind = 'EXISTING_WORKBENCH';
    expect(() => parseTrademarkLifecycleReadResultV1(evidenceOperation)).toThrow();
  });

  it('does not globally suppress an unaffected interaction for an unrelated unresolved conflict', () => {
    const selectedProjection = projectionWithUnresolvedMilestoneConflict(
      'FILING/APPLICATION_RECEIVED'
    );
    const value = authorizedRead(selectedProjection);
    expect(parseTrademarkLifecycleReadResultV1(value)).toEqual(value);
  });

  it('rejects ALLOWED interaction references or destinations not carried by the exact projection', () => {
    const recommendationReferenceDrift = authorizedRecommendationRead();
    if (recommendationReferenceDrift.interactionAccess[0]!.target.kind !== 'RECOMMENDATION') {
      throw new Error('fixture drift');
    }
    recommendationReferenceDrift.interactionAccess[0]!.target.ownerReference.id =
      'recommendation_other';
    expect(() => parseTrademarkLifecycleReadResultV1(recommendationReferenceDrift)).toThrow();

    const recommendationDestinationDrift = authorizedRecommendationRead();
    recommendationDestinationDrift.interactionAccess[0]!.destination = {
      kind: 'EXISTING_WORKBENCH',
      reference: structuredClone(ruleReference)
    };
    expect(() => parseTrademarkLifecycleReadResultV1(recommendationDestinationDrift)).toThrow();

    const evidenceReferenceDrift = authorizedOwnerEvidenceRead();
    if (evidenceReferenceDrift.interactionAccess[0]!.target.kind !== 'OWNER_EVIDENCE') {
      throw new Error('fixture drift');
    }
    evidenceReferenceDrift.interactionAccess[0]!.target.ownerReference.id = 'evidence_not_carried';
    evidenceReferenceDrift.interactionAccess[0]!.destination.reference.id = 'evidence_not_carried';
    expect(() => parseTrademarkLifecycleReadResultV1(evidenceReferenceDrift)).toThrow();

    const evidenceDestinationDrift = authorizedOwnerEvidenceRead();
    evidenceDestinationDrift.interactionAccess[0]!.destination = {
      kind: 'EVIDENCE_INSPECTION',
      reference: structuredClone(dataRecordReference)
    };
    expect(() => parseTrademarkLifecycleReadResultV1(evidenceDestinationDrift)).toThrow();

    const sourceEvidenceReferenceDrift = authorizedSourceEvidenceRead();
    if (sourceEvidenceReferenceDrift.interactionAccess[0]!.target.kind !== 'SOURCE_EVIDENCE') {
      throw new Error('fixture drift');
    }
    sourceEvidenceReferenceDrift.interactionAccess[0]!.target.sourceReference = {
      ...sourceEvidenceReferenceDrift.interactionAccess[0]!.target.sourceReference,
      sourceId: 'data-record_not-carried'
    };
    expect(() => parseTrademarkLifecycleReadResultV1(sourceEvidenceReferenceDrift)).toThrow();

    const sourceEvidenceDestinationDrift = authorizedSourceEvidenceRead();
    sourceEvidenceDestinationDrift.interactionAccess[0]!.destination = {
      kind: 'EVIDENCE_INSPECTION',
      reference: structuredClone(ruleReference)
    };
    expect(() => parseTrademarkLifecycleReadResultV1(sourceEvidenceDestinationDrift)).toThrow();

    const sourceEvidenceWrongReferenceKind = authorizedSourceEvidenceRead();
    Object.assign(sourceEvidenceWrongReferenceKind.interactionAccess[0]!.target, {
      sourceReference: structuredClone(ruleReference)
    });
    expect(() => parseTrademarkLifecycleReadResultV1(sourceEvidenceWrongReferenceKind)).toThrow();

    const affectedConflict = authorizedRead(
      projectionWithUnresolvedMilestoneConflict('PUBLICATION/PUBLICATION_WINDOW')
    );
    expect(() => parseTrademarkLifecycleReadResultV1(affectedConflict)).toThrow();
  });

  it('accepts SELECTED plus NO_PROJECTION without claiming completion', () => {
    const value = authorizedRead(null) as unknown as Mutable<TrademarkLifecycleAuthorizedReadV1>;
    value.selection.reasonCodes = ['PROJECTION_NOT_MATERIALIZED'];
    expect(parseTrademarkLifecycleReadResultV1(value)).toEqual(value);
  });

  it('accepts legal non-selected states without fabricating a projection', () => {
    const alternateTrack = {
      ...mutableTrack(),
      applicationOrRegistrationBasis: 'SECTION_1A',
      trackFingerprintSha256: sha('b')
    };
    const multiple = authorizedRead(null) as unknown as Mutable<TrademarkLifecycleAuthorizedReadV1>;
    multiple.selection = {
      state: 'MULTIPLE_CANDIDATES',
      candidates: [mutableTrack(), alternateTrack],
      selectedTrackFingerprintSha256: null,
      reasonCodes: ['MULTIPLE_EXACT_TRACKS'],
      missingInputCodes: []
    };
    multiple.coverage.state = 'PARTIAL';
    expect(parseTrademarkLifecycleReadResultV1(multiple)).toEqual(multiple);

    const missing = authorizedRead(null) as unknown as Mutable<TrademarkLifecycleAuthorizedReadV1>;
    missing.selection = {
      state: 'MISSING_INPUT',
      candidates: [],
      selectedTrackFingerprintSha256: null,
      reasonCodes: ['BASIS_REQUIRED'],
      missingInputCodes: ['APPLICATION_BASIS']
    };
    missing.coverage.state = 'PARTIAL';
    expect(parseTrademarkLifecycleReadResultV1(missing)).toEqual(missing);

    const unsupported = authorizedRead(
      null
    ) as unknown as Mutable<TrademarkLifecycleAuthorizedReadV1>;
    unsupported.selection = {
      state: 'UNSUPPORTED',
      candidates: [mutableTrack()],
      selectedTrackFingerprintSha256: null,
      reasonCodes: ['TRACK_NOT_ADMITTED'],
      missingInputCodes: []
    };
    unsupported.coverage.state = 'NOT_COVERED';
    expect(parseTrademarkLifecycleReadResultV1(unsupported)).toEqual(unsupported);
  });

  it.each([
    [
      'AVAILABLE without a projection',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.projection = null;
      }
    ],
    [
      'NO_PROJECTION with a projection',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.projectionAvailability = 'NO_PROJECTION';
      }
    ],
    [
      'NO_PROJECTION without selection or dependency explanation',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.projectionAvailability = 'NO_PROJECTION';
        value.projection = null;
        value.interactionAccess = [];
        value.selection.reasonCodes = [];
        value.dependencyReasonCodes = [];
      }
    ],
    [
      'MULTIPLE_CANDIDATES with one candidate',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.selection = {
          state: 'MULTIPLE_CANDIDATES',
          candidates: [mutableTrack()],
          selectedTrackFingerprintSha256: null,
          reasonCodes: ['MULTIPLE_EXACT_TRACKS'],
          missingInputCodes: []
        };
        value.projectionAvailability = 'NO_PROJECTION';
        value.projection = null;
        value.interactionAccess = [];
      }
    ],
    [
      'MISSING_INPUT without a missing input',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.selection = {
          state: 'MISSING_INPUT',
          candidates: [],
          selectedTrackFingerprintSha256: null,
          reasonCodes: ['BASIS_REQUIRED'],
          missingInputCodes: []
        };
        value.projectionAvailability = 'NO_PROJECTION';
        value.projection = null;
        value.interactionAccess = [];
      }
    ],
    [
      'UNSUPPORTED with covered scope',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.selection = {
          state: 'UNSUPPORTED',
          candidates: [mutableTrack()],
          selectedTrackFingerprintSha256: null,
          reasonCodes: ['TRACK_NOT_ADMITTED'],
          missingInputCodes: []
        };
        value.projectionAvailability = 'NO_PROJECTION';
        value.projection = null;
        value.interactionAccess = [];
      }
    ],
    [
      'selected fingerprint not present among candidates',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.selection.selectedTrackFingerprintSha256 = sha('c');
      }
    ],
    [
      'coverage drift from the selected projection',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.coverage.coverageFingerprintSha256 = sha('d');
      }
    ]
  ] as const)('rejects invalid selection/availability combination: %s', (_label, mutate) => {
    const value = structuredClone(
      authorizedRead()
    ) as unknown as Mutable<TrademarkLifecycleAuthorizedReadV1>;
    mutate(value);
    expect(() => parseTrademarkLifecycleReadResultV1(value)).toThrow();
  });

  it.each([
    [
      'stale read-time currentness with ALLOWED access',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.currentness = {
          state: 'STALE',
          evaluatedAt,
          reasonCodes: ['READ_SCOPE_STALE']
        };
      }
    ],
    [
      'unavailable dependency with ALLOWED access',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.dependencyState = 'UNAVAILABLE';
        value.dependencyReasonCodes = ['DEPENDENCY_UNAVAILABLE'];
      }
    ],
    [
      'interaction bound to another projection',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.interactionAccess[0]!.projectionReference.version += 1;
      }
    ],
    [
      'interaction bound to a dangling milestone',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        if (value.interactionAccess[0]!.target.kind !== 'MILESTONE')
          throw new Error('fixture drift');
        value.interactionAccess[0]!.target.milestoneCode = 'MISSING';
      }
    ],
    [
      'milestone interaction destination not carried by that node',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.interactionAccess[0]!.destination = {
          kind: 'EXISTING_WORKBENCH',
          reference: structuredClone(ruleReference)
        };
      }
    ],
    [
      'interaction evaluated before the current read response',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.evaluatedAt = '2026-10-10T01:00:01.000Z';
      }
    ],
    [
      'ALLOWED interaction without a decision reason',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.interactionAccess[0]!.reasonCodes = [];
      }
    ],
    [
      'interaction granting execution authority',
      (value: Mutable<TrademarkLifecycleAuthorizedReadV1>) => {
        value.interactionAccess[0]!.executionAuthorized = true as never;
      }
    ]
  ] as const)('rejects unsafe interaction access: %s', (_label, mutate) => {
    const value = structuredClone(
      authorizedRead()
    ) as unknown as Mutable<TrademarkLifecycleAuthorizedReadV1>;
    mutate(value);
    expect(() => parseTrademarkLifecycleReadResultV1(value)).toThrow();
  });

  it.each([
    ['UNAUTHENTICATED', false],
    ['SESSION_EXPIRED', false],
    ['FORBIDDEN', false],
    ['NOT_FOUND', false],
    ['TRANSPORT_ERROR', true]
  ] as const)('keeps %s privacy-safe and redacted', (status, retryable) => {
    const value: TrademarkLifecycleExternalReadResponseV1 = {
      schemaVersion: 1,
      status,
      evaluatedAt,
      retryable,
      publicReasonCode: privateReasonByStatus[status]
    };
    expect(parseTrademarkLifecycleExternalReadResponseV1(value)).toEqual(value);
  });

  it.each([
    'UNAUTHENTICATED',
    'SESSION_EXPIRED',
    'FORBIDDEN',
    'NOT_FOUND',
    'TRANSPORT_ERROR'
  ] as const)('rejects unbounded or resource-revealing %s reason codes', (status) => {
    expect(() =>
      parseTrademarkLifecycleExternalReadResponseV1({
        schemaVersion: 1,
        status,
        evaluatedAt,
        retryable: status === 'TRANSPORT_ERROR',
        publicReasonCode: 'ASSET_EXISTS_BUT_ACCESS_IS_DENIED'
      })
    ).toThrow();
  });

  it.each([
    'workspaceId',
    'asset',
    'selection',
    'coverage',
    'projection',
    'interactionAccess'
  ] as const)('rejects private failure leaking %s', (field) => {
    const failure: Record<string, unknown> = {
      schemaVersion: 1,
      status: 'NOT_FOUND',
      evaluatedAt,
      retryable: false,
      publicReasonCode: privateReasonByStatus.NOT_FOUND
    };
    failure[field] = field === 'projection' ? null : 'sensitive';
    expect(() => parseTrademarkLifecycleExternalReadResponseV1(failure)).toThrow();
  });

  it('rejects malformed privacy status/retryability combinations', () => {
    expect(() =>
      parseTrademarkLifecycleExternalReadResponseV1({
        schemaVersion: 1,
        status: 'NOT_FOUND',
        evaluatedAt,
        retryable: true,
        publicReasonCode: privateReasonByStatus.NOT_FOUND
      })
    ).toThrow();
    expect(() =>
      parseTrademarkLifecycleExternalReadResponseV1({
        schemaVersion: 1,
        status: 'AUTHORIZED_FOUND',
        evaluatedAt,
        retryable: false,
        publicReasonCode: 'FOUND'
      })
    ).toThrow();
  });
});
