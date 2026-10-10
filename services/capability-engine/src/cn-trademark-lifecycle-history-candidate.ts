import { createHash } from 'node:crypto';

import {
  CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1,
  CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_KIND,
  CN_TRADEMARK_LIFECYCLE_HISTORY_INPUT_SCHEMA_ID,
  CN_TRADEMARK_LIFECYCLE_HISTORY_LIMITATIONS,
  CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FINGERPRINT_SHA256,
  CN_TRADEMARK_LIFECYCLE_HISTORY_OUTPUT_SCHEMA_ID,
  CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_FINGERPRINT_SHA256,
  CN_TRADEMARK_LIFECYCLE_HISTORY_REASON_CODES,
  CN_TRADEMARK_LIFECYCLE_HISTORY_REQUIRED_DATA
} from '@markorbit/contracts/brain-cn-trademark-lifecycle-history';
import {
  activateExecutableMethodPackageV1,
  executableMethodActivationEvidenceRefV1,
  executableMethodPackageFingerprintV1,
  parseExecutableMethodPackageActivationDecisionV1,
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
  parseTrademarkLifecycleComputationInputV1,
  parseTrademarkLifecycleComputationOutputV1,
  parseTrademarkLifecycleComputationResultV1,
  trademarkLifecycleComputationAdverseLimitationCodeV1,
  trademarkLifecycleComputationAdverseResultFingerprintSha256V1,
  trademarkLifecycleComputationAdverseSemanticsBySourceReadStateV1,
  trademarkLifecycleComputationOutputFingerprintSha256V1,
  type ExactOwnerReferenceV1,
  type EvaluationV1,
  type StageV1,
  type TimeAssertionV1,
  type TrademarkLifecycleComputationAdverseStateV1,
  type TrademarkLifecycleComputationAdverseResultFingerprintMaterialV1,
  type TrademarkLifecycleComputationInputV1,
  type TrademarkLifecycleComputationOutputFingerprintMaterialV1,
  type TrademarkLifecycleComputationOutputV1,
  type TrademarkLifecycleComputationResultV1,
  type TrademarkLifecycleNodeReferenceV1,
  type TrademarkLifecycleSourceDateCandidateV1,
  type TrademarkLifecycleSourceDateObservationV1,
  type TrademarkLifecycleTimeAssertionReferenceV1
} from '@markorbit/contracts/trademark-lifecycle';

import type {
  ExecutableMethodPackageRunnerInputV1,
  ExecutableMethodPackageRunnerV1,
  MethodSelectionContextResolverV1
} from './executable-method-runtime.js';

export const CN_TRADEMARK_LIFECYCLE_HISTORY_STABLE_OUTCOME_CANDIDATE_V1 = Object.freeze({
  schemaVersion: 1,
  candidateId: 'stable-outcome-candidate_trademark-lifecycle-project-cn-history-v1',
  candidateState: 'CANDIDATE_ONLY',
  planningCoordinate: 'trademark.lifecycle.project',
  operation: 'PROJECT_TRADEMARK_LIFECYCLE',
  inputSchemaId: CN_TRADEMARK_LIFECYCLE_HISTORY_INPUT_SCHEMA_ID,
  outputSchemaId: CN_TRADEMARK_LIFECYCLE_HISTORY_OUTPUT_SCHEMA_ID,
  resultSemantics: 'TRANSIENT_SOURCE_RECORDED_COMPLETED_HISTORY_ONLY',
  runtimeRegistered: false,
  capabilityAdmitted: false,
  projectionPersistenceAuthorized: false,
  officialTruthCreated: false,
  legalDeadlineCertified: false,
  executionAuthorized: false
} as const);

const FACT_CODES = ['FILING_DATE', 'PRELIMINARY_PUBLICATION_DATE'] as const;
type SupportedFactCode = (typeof FACT_CODES)[number];

const CAPABILITY_ID = 'trademark.lifecycle.project';
const CAPABILITY_VERSION = 'candidate-lcr-a2b2c';

const FACT_PRESENTATION = {
  FILING_DATE: {
    stageCode: 'FILING',
    milestoneCode: 'APPLICATION_FILED',
    stageOrder: 1,
    stageName: { zhCN: '申请', en: 'Filing' },
    stageSummary: {
      zhCN: '仅展示来源记录的申请历史。',
      en: 'Shows only source-recorded filing history.'
    },
    milestoneName: { zhCN: '提交申请', en: 'Application filed' },
    milestoneSummary: {
      zhCN: '仅展示来源记录的申请日。',
      en: 'Shows only the filing date recorded by the source.'
    },
    labelCode: 'FILING_DATE_RECORDED'
  },
  PRELIMINARY_PUBLICATION_DATE: {
    stageCode: 'PRELIMINARY_PUBLICATION',
    milestoneCode: 'PRELIMINARY_PUBLICATION_RECORDED',
    stageOrder: 2,
    stageName: { zhCN: '初步审定公告', en: 'Preliminary publication' },
    stageSummary: {
      zhCN: '仅展示来源记录的初步审定公告历史。',
      en: 'Shows only source-recorded preliminary-publication history.'
    },
    milestoneName: { zhCN: '初步审定公告已记录', en: 'Preliminary publication recorded' },
    milestoneSummary: {
      zhCN: '仅展示来源记录的初步审定公告日。',
      en: 'Shows only the preliminary-publication date recorded by the source.'
    },
    labelCode: 'PRELIMINARY_PUBLICATION_DATE_RECORDED'
  }
} as const;

interface EvaluatedSourceState {
  adverseState: TrademarkLifecycleComputationAdverseStateV1 | null;
  ownerReferences: readonly TrademarkAssetSourceReference[];
  currentness: Readonly<{
    state: 'CURRENT' | 'STALE' | 'UNKNOWN';
    reasonCodes: readonly string[];
  }>;
}

function canonicalInstant(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new TypeError(`${field} must be a canonical ISO timestamp.`);
  }
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function unique<T>(values: readonly T[], identity: (value: T) => string): readonly T[] {
  return [...new Map(values.map((value) => [identity(value), value])).values()];
}

function sourceReferenceIdentity(reference: Readonly<TrademarkAssetSourceReference>): string {
  return JSON.stringify([
    reference.owner,
    reference.kind,
    reference.sourceId,
    reference.sourceVersion,
    reference.sourceFingerprintSha256 ?? null,
    reference.observedAt,
    reference.freshness
  ]);
}

function ownerReference(reference: Readonly<TrademarkAssetSourceReference>): ExactOwnerReferenceV1 {
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

function observationsByFact(
  input: Readonly<TrademarkLifecycleComputationInputV1>
): Readonly<Record<SupportedFactCode, TrademarkLifecycleSourceDateObservationV1>> {
  if (input.sourceDateObservations.length !== FACT_CODES.length) {
    throw new TypeError(
      'CN lifecycle history requires exactly one filing-date and one preliminary-publication-date observation record.'
    );
  }
  const byFact = new Map(
    input.sourceDateObservations.map((observation) => [observation.factCode, observation])
  );
  if (
    byFact.size !== FACT_CODES.length ||
    FACT_CODES.some((factCode) => !byFact.has(factCode)) ||
    [...byFact.keys()].some((factCode) => !FACT_CODES.includes(factCode as SupportedFactCode))
  ) {
    throw new TypeError(
      'CN lifecycle history accepts only the exact filing-date and preliminary-publication-date observation records.'
    );
  }
  return {
    FILING_DATE: byFact.get('FILING_DATE')!,
    PRELIMINARY_PUBLICATION_DATE: byFact.get('PRELIMINARY_PUBLICATION_DATE')!
  };
}

function evaluateSourceState(
  input: Readonly<TrademarkLifecycleComputationInputV1>
): EvaluatedSourceState {
  if (input.sourceReads.length !== 1) {
    throw new TypeError('CN lifecycle history requires exactly one exact-scope source read.');
  }
  if (input.sourceReads.some((read) => read.owner !== 'DATA_ENGINE')) {
    throw new TypeError('CN lifecycle history accepts only exact DATA_ENGINE source reads.');
  }
  const adverseStates = unique(
    input.sourceReads
      .map((read) => read.state)
      .filter(
        (state): state is TrademarkLifecycleComputationAdverseStateV1 => state !== 'OBSERVED'
      ),
    (state) => state
  );
  if (adverseStates.length > 1) {
    throw new TypeError(
      'CN lifecycle history requires one unambiguous exact-scope source-read state.'
    );
  }
  const references = unique(
    input.sourceReads.flatMap((read) => read.sourceReferences),
    sourceReferenceIdentity
  );
  if (
    references.some(
      (reference) =>
        reference.owner !== 'DATA_ENGINE' ||
        reference.kind !== 'DATA_ENGINE_TRADEMARK_RECORD' ||
        reference.sourceFingerprintSha256 === undefined
    )
  ) {
    throw new TypeError(
      'CN lifecycle history requires fingerprinted DATA_ENGINE trademark-record references.'
    );
  }

  const adverseState = adverseStates[0] ?? null;
  if (adverseState !== null) {
    return {
      adverseState,
      ownerReferences: references,
      currentness: {
        state: 'UNKNOWN',
        reasonCodes: [reasonCodeForAdverseState(adverseState)]
      }
    };
  }
  if (references.some((reference) => reference.freshness === 'CONFLICTING')) {
    return {
      adverseState: null,
      ownerReferences: references,
      currentness: {
        state: 'UNKNOWN',
        reasonCodes: ['SOURCE_OBSERVATION_CONFLICT']
      }
    };
  }
  if (references.some((reference) => reference.freshness === 'STALE')) {
    return {
      adverseState: null,
      ownerReferences: references,
      currentness: { state: 'STALE', reasonCodes: ['SOURCE_OBSERVATION_STALE'] }
    };
  }
  if (references.some((reference) => reference.freshness === 'UNKNOWN')) {
    return {
      adverseState: null,
      ownerReferences: references,
      currentness: {
        state: 'UNKNOWN',
        reasonCodes: ['PARTIAL_SOURCE_RECORDED_HISTORY']
      }
    };
  }
  return {
    adverseState: null,
    ownerReferences: references,
    currentness: { state: 'CURRENT', reasonCodes: [] }
  };
}

function reasonCodeForAdverseState(state: TrademarkLifecycleComputationAdverseStateV1): string {
  return trademarkLifecycleComputationAdverseSemanticsBySourceReadStateV1[state].reasonCodes[0]!;
}

function exactActivePackage(
  candidatePackage: Readonly<ExecutableMethodPackageV1>,
  decisionValue: unknown
): Readonly<{
  decision: ExecutableMethodPackageActivationDecisionV1;
  package: ExecutableMethodPackageV1;
  fingerprintSha256: string;
}> {
  const decision = parseExecutableMethodPackageActivationDecisionV1(decisionValue);
  if (decision.decision !== 'APPROVED') {
    throw new TypeError('CN lifecycle history runner requires an APPROVED activation decision.');
  }
  if (!sameValue(decision.target.limitations, CN_TRADEMARK_LIFECYCLE_HISTORY_LIMITATIONS)) {
    throw new TypeError(
      'CN lifecycle history activation must preserve the exact reviewed candidate limitations.'
    );
  }
  const activePackage = activateExecutableMethodPackageV1(candidatePackage, decision);
  return {
    decision,
    package: activePackage,
    fingerprintSha256: executableMethodPackageFingerprintV1(activePackage)
  };
}

function localCalendarDay(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(instant));
  const part = (type: 'year' | 'month' | 'day') =>
    parts.find((candidate) => candidate.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  if (!year || !month || !day) {
    throw new TypeError('CN lifecycle history could not resolve the source date time zone.');
  }
  return `${year}-${month}-${day}`;
}

function sourceDateIsDefinitelyAfterAsOf(
  candidate: Readonly<TrademarkLifecycleSourceDateCandidateV1>,
  asOf: string
): boolean {
  if (candidate.precision === 'SECOND') {
    return Date.parse(candidate.value) > Date.parse(asOf);
  }
  const localDay = localCalendarDay(asOf, candidate.jurisdictionTimeZone);
  const asOfCoordinate =
    candidate.precision === 'DAY'
      ? localDay
      : candidate.precision === 'MONTH'
        ? localDay.slice(0, 7)
        : localDay.slice(0, 4);
  return candidate.value > asOfCoordinate;
}

function assertCompletedHistoryTemporalIntegrity(
  observations: Readonly<Record<SupportedFactCode, TrademarkLifecycleSourceDateObservationV1>>,
  asOf: string
): void {
  const available = FACT_CODES.flatMap((factCode) => {
    const observation = observations[factCode];
    return observation.valueState === 'AVAILABLE'
      ? [{ factCode, candidate: observation.candidate }]
      : [];
  });
  for (const observation of available) {
    if (sourceDateIsDefinitelyAfterAsOf(observation.candidate, asOf)) {
      throw new TypeError(
        `CN lifecycle history ${observation.factCode} cannot occur after input.asOf.`
      );
    }
  }

  const filing = observations.FILING_DATE;
  const publication = observations.PRELIMINARY_PUBLICATION_DATE;
  if (filing.valueState !== 'AVAILABLE' || publication.valueState !== 'AVAILABLE') return;
  if (
    filing.candidate.precision !== publication.candidate.precision ||
    filing.candidate.jurisdictionTimeZone !== publication.candidate.jurisdictionTimeZone
  ) {
    throw new TypeError(
      'CN lifecycle history filing and preliminary-publication dates must use the same precision and time zone for deterministic ordering.'
    );
  }
  const definitelyInverted =
    filing.candidate.precision === 'SECOND'
      ? Date.parse(filing.candidate.value) > Date.parse(publication.candidate.value)
      : filing.candidate.value > publication.candidate.value;
  if (definitelyInverted) {
    throw new TypeError(
      'CN lifecycle history filing date cannot occur after preliminary-publication date.'
    );
  }
}

function assertRequestBoundary(
  request: Readonly<CapabilityRequestV2>,
  binding: Readonly<ImplementationBinding>,
  input: Readonly<TrademarkLifecycleComputationInputV1>
): void {
  if (request.capabilityId !== CAPABILITY_ID || request.capabilityVersion !== CAPABILITY_VERSION) {
    throw new TypeError(
      'CN lifecycle history request does not match the fixed candidate capability.'
    );
  }
  if (
    binding.capabilityRequestId !== request.capabilityRequestId ||
    binding.runtimeCapability.capabilityId !== request.capabilityId ||
    binding.runtimeCapability.capabilityVersion !== request.capabilityVersion
  ) {
    throw new TypeError(
      'CN lifecycle history binding does not match the exact Capability request identity.'
    );
  }
  if (request.caller.workspaceId !== input.workspaceId) {
    throw new TypeError(
      'CN lifecycle history caller Workspace does not match the normalized input Workspace.'
    );
  }
  if (
    request.inputSchemaId !== CN_TRADEMARK_LIFECYCLE_HISTORY_INPUT_SCHEMA_ID ||
    request.outputSchemaId !== CN_TRADEMARK_LIFECYCLE_HISTORY_OUTPUT_SCHEMA_ID
  ) {
    throw new TypeError('CN lifecycle history request schemas do not match the fixed candidate.');
  }
  const receivedAt = canonicalInstant(request.receivedAt, 'Capability request receivedAt');
  if (receivedAt < input.asOf) {
    throw new TypeError('CN lifecycle history request receivedAt must not precede input.asOf.');
  }
  if (
    input.track.jurisdiction !== 'CN' ||
    input.track.authority !== 'CNIPA' ||
    input.track.objectType !== 'TRADEMARK_APPLICATION' ||
    input.track.procedure !== 'FILING_TO_PRELIMINARY_PUBLICATION' ||
    input.track.applicationOrRegistrationBasis !== 'ANY'
  ) {
    throw new TypeError('CN lifecycle history input is outside the exact candidate applicability.');
  }
  assertCompletedHistoryTemporalIntegrity(observationsByFact(input), input.asOf);
}

function assertExactMethodReference(
  input: Readonly<TrademarkLifecycleComputationInputV1>,
  activePackage: Readonly<ExecutableMethodPackageV1>,
  fingerprintSha256: string
): void {
  const reference = input.methodPackageReference;
  if (
    reference.owner !== 'BRAIN' ||
    reference.kind !== 'TEMPORAL_RESOLUTION_METHOD_PACKAGE' ||
    reference.id !== activePackage.packageId ||
    reference.version !== activePackage.packageVersion ||
    reference.fingerprintSha256 !== fingerprintSha256
  ) {
    throw new TypeError(
      'CN lifecycle history input does not bind the exact activated Method package version.'
    );
  }
}

function timeAssertionId(factCode: SupportedFactCode, inputFingerprint: string): string {
  return `time_cn-history-${factCode.toLowerCase()}-${inputFingerprint.slice(0, 24)}`;
}

function sourceCurrentness(
  references: readonly Readonly<TrademarkAssetSourceReference>[]
): 'CURRENT' | 'STALE' | 'UNKNOWN' {
  if (references.some((reference) => reference.freshness === 'STALE')) return 'STALE';
  if (references.some((reference) => reference.freshness !== 'CURRENT')) return 'UNKNOWN';
  return 'CURRENT';
}

function availableStage(
  factCode: SupportedFactCode,
  observation: Extract<TrademarkLifecycleSourceDateObservationV1, { valueState: 'AVAILABLE' }>,
  input: Readonly<TrademarkLifecycleComputationInputV1>
): StageV1 {
  const presentation = FACT_PRESENTATION[factCode];
  const currentness = sourceCurrentness(observation.candidate.sourceReferences);
  if (
    observation.candidate.sourceReferences.some(
      (reference) => reference.freshness === 'CONFLICTING'
    )
  ) {
    throw new TypeError(
      'A conflicting source reference cannot produce an AVAILABLE historical node.'
    );
  }
  const assertion: TimeAssertionV1 = {
    timeAssertionId: timeAssertionId(factCode, input.normalizedInputFingerprintSha256),
    semanticRole: factCode,
    labelCode: presentation.labelCode,
    timeClass: 'SOURCE_RECORDED',
    presentationMeaning: 'RECORDED_FACT',
    valueState: 'AVAILABLE',
    value: {
      kind: 'POINT',
      value: observation.candidate.value,
      precision: observation.candidate.precision,
      jurisdictionTimeZone: observation.candidate.jurisdictionTimeZone
    },
    confidence: null,
    asOf: input.asOf,
    currentness,
    sourceReferences: observation.candidate.sourceReferences,
    ruleReferences: [],
    reasonCodes: [
      'SOURCE_RECORDED_HISTORY_COMPUTED',
      ...(currentness === 'STALE' ? ['SOURCE_OBSERVATION_STALE'] : [])
    ],
    legalDeadlineCertified: false
  };
  return {
    stageCode: presentation.stageCode,
    order: presentation.stageOrder,
    name: presentation.stageName,
    summary: presentation.stageSummary,
    processState: 'OCCURRED',
    timeAssertions: [],
    sourceReferences: observation.candidate.sourceReferences,
    ruleReferences: [input.methodPackageReference],
    reasonCodes: ['SOURCE_RECORDED_HISTORY_COMPUTED'],
    limitationCodes: [],
    milestones: [
      {
        milestoneCode: presentation.milestoneCode,
        order: 1,
        name: presentation.milestoneName,
        summary: presentation.milestoneSummary,
        processState: 'OCCURRED',
        timeAssertions: [assertion],
        sourceReferences: observation.candidate.sourceReferences,
        ruleReferences: [input.methodPackageReference],
        reasonCodes: ['SOURCE_RECORDED_HISTORY_COMPUTED'],
        limitationCodes: []
      }
    ]
  };
}

function conflictingStage(
  factCode: SupportedFactCode,
  observation: Extract<TrademarkLifecycleSourceDateObservationV1, { valueState: 'CONFLICTING' }>,
  input: Readonly<TrademarkLifecycleComputationInputV1>
): StageV1 {
  const presentation = FACT_PRESENTATION[factCode];
  const references = unique(
    observation.candidates.flatMap((candidate) => candidate.sourceReferences),
    sourceReferenceIdentity
  );
  return {
    stageCode: presentation.stageCode,
    order: presentation.stageOrder,
    name: presentation.stageName,
    summary: {
      zhCN: '来源日期存在冲突，未生成已发生节点。',
      en: 'Source dates conflict; no occurred node was produced.'
    },
    processState: 'UNKNOWN',
    timeAssertions: [],
    sourceReferences: references,
    ruleReferences: [input.methodPackageReference],
    reasonCodes: ['SOURCE_OBSERVATION_CONFLICT'],
    limitationCodes: ['SOURCE_OBSERVATION_CONFLICT'],
    milestones: [
      {
        milestoneCode: presentation.milestoneCode,
        order: 1,
        name: presentation.milestoneName,
        summary: {
          zhCN: '来源日期冲突，不能选择一个历史日期。',
          en: 'Conflicting source dates prevent selecting one historical date.'
        },
        processState: 'UNKNOWN',
        timeAssertions: [
          {
            timeAssertionId: timeAssertionId(factCode, input.normalizedInputFingerprintSha256),
            semanticRole: factCode,
            labelCode: `${factCode}_CONFLICTING`,
            timeClass: 'SOURCE_RECORDED',
            presentationMeaning: 'RECORDED_FACT',
            valueState: 'CONFLICTING',
            value: null,
            confidence: null,
            conflictIds: [observation.conflictId],
            asOf: input.asOf,
            currentness: 'UNKNOWN',
            sourceReferences: references,
            ruleReferences: [],
            reasonCodes: ['SOURCE_OBSERVATION_CONFLICT'],
            legalDeadlineCertified: false
          }
        ],
        sourceReferences: references,
        ruleReferences: [input.methodPackageReference],
        reasonCodes: ['SOURCE_OBSERVATION_CONFLICT'],
        limitationCodes: ['SOURCE_OBSERVATION_CONFLICT']
      }
    ]
  };
}

function unknownHistoryStage(
  input: Readonly<TrademarkLifecycleComputationInputV1>,
  sourceState: Readonly<EvaluatedSourceState>
): StageV1 {
  if (sourceState.ownerReferences.length === 0) {
    throw new TypeError(
      'CN lifecycle history cannot materialize an unknown stage without an exact owner source reference.'
    );
  }
  const reasonCode = 'NO_SOURCE_RECORDED_DATE_AVAILABLE';
  return {
    stageCode: 'SOURCE_RECORDED_HISTORY',
    order: 1,
    name: { zhCN: '来源记录历史', en: 'Source-recorded history' },
    summary: {
      zhCN: '当前证据不足以生成已发生的历史节点。',
      en: 'Current evidence is insufficient to produce an occurred historical node.'
    },
    processState: 'UNKNOWN',
    timeAssertions: [],
    sourceReferences: sourceState.ownerReferences,
    ruleReferences: [input.methodPackageReference],
    reasonCodes: [reasonCode],
    limitationCodes: [reasonCode],
    milestones: []
  };
}

function partialReasonCodes(
  observations: Readonly<Record<SupportedFactCode, TrademarkLifecycleSourceDateObservationV1>>,
  sourceState: Readonly<EvaluatedSourceState>
): readonly string[] {
  const codes = ['PARTIAL_SOURCE_RECORDED_HISTORY'];
  if (observations.FILING_DATE.valueState === 'UNKNOWN') codes.push('FILING_DATE_NOT_AVAILABLE');
  if (observations.PRELIMINARY_PUBLICATION_DATE.valueState === 'UNKNOWN') {
    codes.push('PRELIMINARY_PUBLICATION_DATE_NOT_AVAILABLE');
  }
  if (FACT_CODES.every((code) => observations[code].valueState !== 'AVAILABLE')) {
    codes.push('NO_SOURCE_RECORDED_DATE_AVAILABLE');
  }
  if (FACT_CODES.some((code) => observations[code].valueState === 'CONFLICTING')) {
    codes.push('SOURCE_OBSERVATION_CONFLICT');
  }
  if (sourceState.currentness.state === 'STALE') codes.push('SOURCE_OBSERVATION_STALE');
  return [...new Set(codes)];
}

function evaluationForAbsentTarget<T>(
  evaluatedAt: string,
  scopeFingerprintSha256: string,
  coverageFull: boolean,
  partialCodes: readonly string[]
): EvaluationV1<T> {
  if (coverageFull) {
    return {
      state: 'COMPLETE_NONE',
      evaluatedAt,
      scopeFingerprintSha256,
      reasonCodes: ['SOURCE_RECORDED_HISTORY_COMPUTED'],
      limitationCodes: [],
      dependencyReasonCodes: [],
      target: null
    };
  }
  return {
    state: 'PARTIAL',
    evaluatedAt,
    scopeFingerprintSha256,
    reasonCodes: ['PARTIAL_SOURCE_RECORDED_HISTORY'],
    limitationCodes: partialCodes,
    dependencyReasonCodes: [],
    target: null
  };
}

function semanticGlossary(
  codes: readonly string[]
): TrademarkLifecycleComputationOutputFingerprintMaterialV1['semanticGlossary'] {
  const descriptions: Readonly<Record<string, string>> =
    CN_TRADEMARK_LIFECYCLE_HISTORY_REASON_CODES;
  return [...new Set(codes)].sort().map((code) => {
    const description = descriptions[code] ?? code.replaceAll('_', ' ').toLowerCase();
    return { code, text: { zhCN: `语义：${description}`, en: description } };
  });
}

function buildOutput(
  input: Readonly<TrademarkLifecycleComputationInputV1>,
  computedAt: string,
  sourceState: Readonly<EvaluatedSourceState>
): TrademarkLifecycleComputationOutputV1 {
  if (sourceState.adverseState !== null) {
    throw new TypeError(
      'An adverse source read must use the canonical NOT_COMPUTED result branch.'
    );
  }
  const observations = observationsByFact(input);
  const stages: StageV1[] = [];
  for (const factCode of FACT_CODES) {
    const observation = observations[factCode];
    if (observation.valueState === 'AVAILABLE') {
      stages.push(availableStage(factCode, observation, input));
    } else if (observation.valueState === 'CONFLICTING') {
      stages.push(conflictingStage(factCode, observation, input));
    }
  }
  if (stages.length === 0) stages.push(unknownHistoryStage(input, sourceState));

  const partialCodes = partialReasonCodes(observations, sourceState);
  const hasConflict = FACT_CODES.some((code) => observations[code].valueState === 'CONFLICTING');
  const resultCurrentness = hasConflict
    ? ({ state: 'UNKNOWN', reasonCodes: ['SOURCE_OBSERVATION_CONFLICT'] } as const)
    : sourceState.currentness;
  const coverageFull =
    !hasConflict &&
    sourceState.currentness.state === 'CURRENT' &&
    FACT_CODES.every((factCode) => observations[factCode].valueState === 'AVAILABLE');
  const coverageState = coverageFull ? ('FULL' as const) : ('PARTIAL' as const);
  const coverageReasonCodes = coverageFull ? ['SOURCE_RECORDED_HISTORY_COMPUTED'] : partialCodes;
  const coverageIdentity = digest({
    input: input.normalizedInputFingerprintSha256,
    computedAt,
    coverageState,
    coverageReasonCodes
  });

  const occurredAssertions = stages.flatMap((stage) =>
    stage.milestones.flatMap((milestone) =>
      milestone.processState === 'OCCURRED'
        ? milestone.timeAssertions.filter((assertion) => assertion.valueState === 'AVAILABLE')
        : []
    )
  );
  const primaryAssertion = occurredAssertions.at(-1);
  const absentEvaluation = <T>(): EvaluationV1<T> =>
    evaluationForAbsentTarget<T>(
      computedAt,
      input.track.trackFingerprintSha256,
      coverageFull,
      partialCodes
    );
  const primaryTimeEvaluation: EvaluationV1<TrademarkLifecycleTimeAssertionReferenceV1> =
    primaryAssertion
      ? {
          state: 'PRESENT',
          evaluatedAt: computedAt,
          scopeFingerprintSha256: input.track.trackFingerprintSha256,
          reasonCodes: ['SOURCE_RECORDED_HISTORY_COMPUTED'],
          limitationCodes: [],
          dependencyReasonCodes: [],
          target: { timeAssertionId: primaryAssertion.timeAssertionId }
        }
      : absentEvaluation<TrademarkLifecycleTimeAssertionReferenceV1>();
  const lastOccurredStage = [...stages]
    .reverse()
    .find((stage) => stage.processState === 'OCCURRED');
  const lastOccurredMilestone = lastOccurredStage?.milestones.find(
    (milestone) => milestone.processState === 'OCCURRED'
  );

  const conflicts = FACT_CODES.flatMap((factCode) => {
    const observation = observations[factCode];
    if (observation.valueState !== 'CONFLICTING') return [];
    return [
      {
        conflictId: observation.conflictId,
        state: 'UNRESOLVED' as const,
        targetKind: 'TIME_ASSERTION' as const,
        targetReference: timeAssertionId(factCode, input.normalizedInputFingerprintSha256),
        competingReferences: unique(
          observation.candidates
            .flatMap((candidate) => candidate.sourceReferences)
            .map(ownerReference),
          (reference) => JSON.stringify(reference)
        ),
        resolutionOwner: 'DATA_ENGINE',
        resolutionReference: null,
        reasonCodes: ['SOURCE_OBSERVATION_CONFLICT']
      }
    ];
  });

  const missingInputCodes = [
    ...(observations.FILING_DATE.valueState === 'UNKNOWN' ? ['FILING_DATE_NOT_AVAILABLE'] : []),
    ...(observations.PRELIMINARY_PUBLICATION_DATE.valueState === 'UNKNOWN'
      ? ['PRELIMINARY_PUBLICATION_DATE_NOT_AVAILABLE']
      : [])
  ];
  const limitationCodes = ['CURRENT_POSITION_NOT_INFERRED', ...(coverageFull ? [] : partialCodes)];
  const nextItemEvaluation = absentEvaluation<TrademarkLifecycleNodeReferenceV1>();
  const recommendationEvaluation = absentEvaluation<ExactOwnerReferenceV1>();
  const material: TrademarkLifecycleComputationOutputFingerprintMaterialV1 = {
    schemaVersion: 1,
    status: 'COMPUTED',
    workspaceId: input.workspaceId,
    asset: input.asset,
    normalizedInputFingerprintSha256: input.normalizedInputFingerprintSha256,
    computedAt,
    asOf: input.asOf,
    track: input.track,
    coverage: {
      coverageEvaluationId: `coverage_cn-history-${coverageIdentity.slice(0, 32)}`,
      state: coverageState,
      scopeFingerprintSha256: input.track.trackFingerprintSha256,
      evaluatedAt: computedAt,
      reasonCodes: coverageReasonCodes,
      coverageFingerprintSha256: coverageIdentity
    },
    currentness: {
      state: resultCurrentness.state,
      evaluatedAt: computedAt,
      reasonCodes: resultCurrentness.reasonCodes
    },
    conflictState: conflicts.length > 0 ? 'UNRESOLVED' : 'NONE',
    currentPosition: {
      supportState: 'UNKNOWN',
      currentGranularity: null,
      currentStageCode: null,
      currentMilestoneCode: null,
      reasonCodes: ['CURRENT_POSITION_NOT_INFERRED']
    },
    lastUndisputedPosition:
      lastOccurredStage && lastOccurredMilestone
        ? {
            stageCode: lastOccurredStage.stageCode,
            milestoneCode: lastOccurredMilestone.milestoneCode,
            asOf: input.asOf
          }
        : null,
    stages,
    sourceReads: input.sourceReads,
    conflicts,
    missingInputCodes,
    limitationCodes,
    semanticGlossary: [],
    methodPackageReference: input.methodPackageReference,
    materializedReferenceDependencies: input.materializedReferenceDependencies,
    professionalReviewReceiptReference: input.professionalReviewReceiptReference,
    nextItemEvaluation,
    recommendationEvaluation,
    primaryTimeEvaluation,
    authority: noTrademarkLifecycleAuthorityConsequencesV1
  };
  const codes = [
    ...material.coverage.reasonCodes,
    ...material.currentness.reasonCodes,
    ...material.currentPosition.reasonCodes,
    ...material.missingInputCodes,
    ...material.limitationCodes,
    ...material.conflicts.flatMap((conflict) => conflict.reasonCodes),
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
    ...[nextItemEvaluation, recommendationEvaluation, primaryTimeEvaluation].flatMap(
      (evaluation) => [
        ...evaluation.reasonCodes,
        ...evaluation.limitationCodes,
        ...evaluation.dependencyReasonCodes
      ]
    )
  ];
  const completeMaterial = { ...material, semanticGlossary: semanticGlossary(codes) };
  const output = {
    ...completeMaterial,
    outputFingerprintSha256:
      trademarkLifecycleComputationOutputFingerprintSha256V1(completeMaterial)
  };
  return parseTrademarkLifecycleComputationOutputV1(output, input);
}

function buildAdverseResult(
  input: Readonly<TrademarkLifecycleComputationInputV1>,
  evaluatedAt: string,
  sourceReadState: TrademarkLifecycleComputationAdverseStateV1
): TrademarkLifecycleComputationResultV1 {
  const semantics =
    trademarkLifecycleComputationAdverseSemanticsBySourceReadStateV1[sourceReadState];
  const material: TrademarkLifecycleComputationAdverseResultFingerprintMaterialV1 = {
    schemaVersion: 1,
    status: 'NOT_COMPUTED',
    sourceReadState,
    workspaceId: input.workspaceId,
    asset: input.asset,
    normalizedInputFingerprintSha256: input.normalizedInputFingerprintSha256,
    evaluatedAt,
    asOf: input.asOf,
    track: input.track,
    sourceReads: input.sourceReads,
    coverageState: semantics.coverageState,
    currentnessState: semantics.currentnessState,
    dependencyState: semantics.dependencyState,
    reasonCodes: semantics.reasonCodes,
    dependencyReasonCodes: semantics.dependencyReasonCodes,
    limitationCodes: [trademarkLifecycleComputationAdverseLimitationCodeV1],
    methodPackageReference: input.methodPackageReference,
    materializedReferenceDependencies: input.materializedReferenceDependencies,
    professionalReviewReceiptReference: input.professionalReviewReceiptReference,
    authority: noTrademarkLifecycleAuthorityConsequencesV1
  };
  return parseTrademarkLifecycleComputationResultV1(
    {
      ...material,
      adverseResultFingerprintSha256:
        trademarkLifecycleComputationAdverseResultFingerprintSha256V1(material)
    },
    input
  );
}

export class CnTrademarkLifecycleHistorySelectionContextResolverV1 implements MethodSelectionContextResolverV1 {
  resolve(request: Readonly<CapabilityRequestV2>, binding: Readonly<ImplementationBinding>) {
    const input = parseTrademarkLifecycleComputationInputV1(request.input);
    assertRequestBoundary(request, binding, input);
    evaluateSourceState(input);
    return {
      methodFamily: 'TEMPORAL_RESOLUTION' as const,
      jurisdiction: 'CN',
      authority: 'CNIPA',
      objectType: 'TRADEMARK_APPLICATION',
      operation: 'PROJECT_TRADEMARK_LIFECYCLE',
      procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
      stage: 'SOURCE_RECORDED_COMPLETED_HISTORY',
      filingBasis: 'ANY',
      segment: 'SOURCE_RECORDED_COMPLETED_HISTORY',
      availableData: [...CN_TRADEMARK_LIFECYCLE_HISTORY_REQUIRED_DATA],
      asOf: request.receivedAt
    };
  }
}

export class CnTrademarkLifecycleHistoryCandidateRunnerV1 implements ExecutableMethodPackageRunnerV1 {
  private readonly activation: ReturnType<typeof exactActivePackage>;

  constructor(activationDecision: unknown) {
    this.activation = exactActivePackage(
      CN_TRADEMARK_LIFECYCLE_HISTORY_CANDIDATE_V1.package,
      activationDecision
    );
  }

  run(runnerInput: Readonly<ExecutableMethodPackageRunnerInputV1>): Promise<{
    output: TrademarkLifecycleComputationResultV1;
    evidenceRefs: readonly string[];
  }> {
    const pkg = runnerInput.package;
    const receivedAt = canonicalInstant(
      runnerInput.request.receivedAt,
      'Capability request receivedAt'
    );
    if (pkg.activatedAt === undefined) {
      throw new TypeError('CN lifecycle history runner requires an activatedAt timestamp.');
    }
    const activatedAt = canonicalInstant(
      pkg.activatedAt,
      'CN lifecycle history package activatedAt'
    );
    if (activatedAt > receivedAt) {
      throw new TypeError(
        'CN lifecycle history package activatedAt must not follow Capability request receivedAt.'
      );
    }
    if (
      pkg.lifecycle !== 'ACTIVE' ||
      executableMethodPackageFingerprintV1(pkg) !== this.activation.fingerprintSha256 ||
      pkg.packageId !== this.activation.package.packageId ||
      pkg.packageVersion !== this.activation.package.packageVersion ||
      pkg.methodId !== this.activation.package.methodId ||
      pkg.methodVersionId !== this.activation.package.methodVersionId ||
      pkg.evaluation.evaluationId !== this.activation.package.evaluation.evaluationId ||
      pkg.inputSchemaId !== CN_TRADEMARK_LIFECYCLE_HISTORY_INPUT_SCHEMA_ID ||
      pkg.outputSchemaId !== CN_TRADEMARK_LIFECYCLE_HISTORY_OUTPUT_SCHEMA_ID ||
      pkg.executable.kind !== CN_TRADEMARK_LIFECYCLE_HISTORY_EXECUTABLE_KIND ||
      !sameValue(pkg.limitations, CN_TRADEMARK_LIFECYCLE_HISTORY_LIMITATIONS)
    ) {
      throw new TypeError(
        'CN lifecycle history ACTIVE package does not match the exact governed activation successor.'
      );
    }
    const input = parseTrademarkLifecycleComputationInputV1(runnerInput.request.input);
    assertRequestBoundary(runnerInput.request, runnerInput.binding, input);
    assertExactMethodReference(input, pkg, this.activation.fingerprintSha256);
    const sourceState = evaluateSourceState(input);
    const output =
      sourceState.adverseState === null
        ? buildOutput(input, receivedAt, sourceState)
        : buildAdverseResult(input, receivedAt, sourceState.adverseState);
    const resultFingerprintEvidence =
      output.status === 'COMPUTED'
        ? `trademark-lifecycle-output:${output.outputFingerprintSha256}`
        : `trademark-lifecycle-adverse-result:${output.adverseResultFingerprintSha256}`;
    return Promise.resolve({
      output,
      evidenceRefs: [
        executableMethodActivationEvidenceRefV1(this.activation.decision),
        `brain-method-candidate:${CN_TRADEMARK_LIFECYCLE_HISTORY_METHOD_FINGERPRINT_SHA256}`,
        `brain-method-package-candidate:${CN_TRADEMARK_LIFECYCLE_HISTORY_PACKAGE_FINGERPRINT_SHA256}`,
        `trademark-lifecycle-input:${input.normalizedInputFingerprintSha256}`,
        resultFingerprintEvidence,
        'candidate-boundary:runtime-registration=absent',
        'candidate-boundary:capability-admission=absent',
        'candidate-boundary:projection-persistence=absent'
      ]
    });
  }
}
