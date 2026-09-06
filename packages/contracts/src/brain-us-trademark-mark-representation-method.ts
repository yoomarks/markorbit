import {
  parseBrainMethodContractV1,
  parseExecutableMethodPackageV1,
  type BrainMethodContractV1,
  type ExecutableMethodPackageV1,
  type KnowledgeRetrievalLineageRefV1
} from './brain-method.js';
import {
  activateExecutableMethodPackageV1,
  executableMethodActivationEvidenceRefV1,
  executableMethodPackageFingerprintV1,
  prepareExecutableMethodPackageActivationDecisionV1,
  type ExecutableMethodPackageActivationDecisionV1
} from './brain-method-activation.js';
import {
  noRecommendationSourceAuthorityConsequences,
  type ProductionIntakeInputV1,
  type RecommendationSourceAuthorityConsequencesV1
} from './markreg-early-funnel.js';

export const US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID =
  'brain-method_us-trademark-mark-representation-strategy' as const;
export const US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID =
  'brain-method-version_us-trademark-mark-representation-strategy-20260906' as const;
export const US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID =
  'executable-method-package_us-trademark-mark-representation-strategy-20260906' as const;
export const US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID =
  'brain-input.us-trademark-mark-representation-strategy.v1' as const;
export const US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID =
  'brain.us-trademark-mark-representation-strategy.v1' as const;
export const US_TRADEMARK_MARK_REPRESENTATION_REFERENCE_DEPENDENCY =
  'KNOWLEDGE_USPTO_MARK_DRAWING_STRATEGY_V1' as const;

const KNOWLEDGE_WORKSPACE_ID = 'wsp_01ARZ3NDEKTSV4RRFFQ69G5FAV';
const KNOWLEDGE_DOCUMENT_ID = 'art_01M1W0DV47JED4RVBMVY8CGV0N';
const KNOWLEDGE_INDEXED_AT = '2026-09-06T18:41:55.021Z';
const KNOWLEDGE_HEADING = Object.freeze(['Drawing of your trademark']);

function lineage(
  chunkId: string,
  contentSha256: string,
  retrievalRationale: string
): Readonly<KnowledgeRetrievalLineageRefV1> {
  return Object.freeze({
    schemaVersion: 1 as const,
    sourceSystem: 'MARKORBIT_KNOWLEDGE' as const,
    content: Object.freeze({
      protocolVersion: '1.0' as const,
      objectType: 'CONTENT_OBJECT_REF' as const,
      objectId: KNOWLEDGE_DOCUMENT_ID,
      objectKind: 'DOCUMENT',
      workspaceId: KNOWLEDGE_WORKSPACE_ID
    }),
    chunkId,
    contentSha256,
    indexedAt: KNOWLEDGE_INDEXED_AT,
    indexMode: 'SQLITE_FTS5_BM25',
    headingPath: KNOWLEDGE_HEADING,
    retrievalRationale
  });
}

export const USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE = Object.freeze([
  lineage(
    'rch_b002fe081a4a658a96ecab518ecdf6c4',
    'b002fe081a4a658a96ecab518ecdf6c40a39a4c827bced34c0d1ca57481eb14e',
    'MARK_FORMAT_DEFINITIONS: exact governed USPTO chunk supporting both the text-only standard-character and stylization/design special-form facts.'
  ),
  lineage(
    'rch_bea5cef8d9d245612387ec1c3d48c8a1',
    'bea5cef8d9d245612387ec1c3d48c8a1cfbe775f1b0a97e2a077e333ca865565',
    'PROTECTION_SCOPE: exact governed USPTO chunk supporting the drawing-type protection-scope distinction.'
  )
]) satisfies readonly Readonly<KnowledgeRetrievalLineageRefV1>[];
export const USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE = Object.freeze({
  profileId: 'uspto-mark-format-reference-v1',
  sourceKey: 'MARK_DRAWINGS',
  sourceVersion: '2025-01-18',
  sourceId: 'src_01M1W0DKQ8FZATW86G84302ZSV',
  documentId: KNOWLEDGE_DOCUMENT_ID,
  artifactVersion: 2,
  documentContentSha256: '53b4392acfa3cccecccf6290c14a943995e3a7f835e812fa90232a51e23dd198',
  rawArtifactId: KNOWLEDGE_DOCUMENT_ID,
  canonicalUri: 'https://www.uspto.gov/trademarks/basics/mark-drawings-trademarks',
  sourceLastUpdatedDate: '2025-01-18',
  httpLastUpdatedDate: '2025-01-18',
  capturedAt: '2026-09-06T18:41:54.821Z',
  retrievalDocumentCurrent: true,
  httpBodySha256: 'db194da64476a406684ec709b8715eee054c6bbcfe7cdc8c19b211aa0344caa4',
  indexedAt: KNOWLEDGE_INDEXED_AT
});

export interface UsTrademarkMarkRepresentationReferenceStateV1 {
  profileId: string;
  sourceKey: string;
  sourceVersion: string;
  sourceId: string;
  documentId: string;
  artifactVersion: number;
  documentContentSha256: string;
  rawArtifactId: string;
  canonicalUri: string;
  sourceLastUpdatedDate: string;
  httpLastUpdatedDate: string;
  capturedAt: string;
  retrievalDocumentCurrent: boolean;
  httpBodySha256: string;
  indexedAt: string;
  currentness: 'CURRENT' | 'STALE' | 'DRIFT' | 'UNVERIFIED';
}
export interface CompileUsTrademarkMarkRepresentationMethodInputV1 {
  knowledgeSources: readonly Readonly<KnowledgeRetrievalLineageRefV1>[];
  reference: Readonly<UsTrademarkMarkRepresentationReferenceStateV1>;
}

export type CompileUsTrademarkMarkRepresentationMethodResultV1 =
  | {
      status: 'REJECTED';
      reason: 'LINEAGE_MISMATCH' | 'REFERENCE_MISMATCH' | 'REFERENCE_NOT_CURRENT';
    }
  | {
      status: 'READY';
      method: Readonly<BrainMethodContractV1>;
      package: Readonly<ExecutableMethodPackageV1>;
    };

export type UsTrademarkProtectionDimensionV1 =
  'WORDING_STANDARD_CHARACTER' | 'DESIGN_STYLIZATION_SPECIAL_FORM';

export interface UsTrademarkProtectionDimensionCandidateV1 {
  dimension: UsTrademarkProtectionDimensionV1;
  support: 'SUPPORTED_FOR_HUMAN_REVIEW';
  rationaleCode:
    'CUSTOMER_SUPPLIED_WORDING_DIMENSION' | 'CUSTOMER_SUPPLIED_DESIGN_OR_STYLIZATION_DIMENSION';
  evidenceRoles: readonly [
    'DECISION_FACTORS',
    'DRAWING_TYPE_DEFINITIONS',
    'PROTECTION_SCOPE_AND_SPECIAL_FORM_REQUIRED'
  ];
}
export const US_TRADEMARK_STRATEGY_ASSUMPTIONS = Object.freeze([
  'Trademark type and representation text are customer-supplied intake classifications, not USPTO drawing determinations.',
  'A protection dimension is only a candidate for human strategy review; it is not a filing instruction or legal conclusion.',
  'Actual use, the elements the customer considers important, and available budget can change the drawing strategy.'
]);

export const US_TRADEMARK_STRATEGY_LIMITATIONS = Object.freeze([
  'Only US mark-representation strategy is in scope; non-US targets are NOT_APPLICABLE.',
  'Filing basis or use claims are not established.',
  'Registrability, clearance, Nice classification, deadlines, legal eligibility, and office status are not established.',
  'No candidate authorizes filing, payment, provider contact, customer selection, or any protected action.'
]);

export const US_TRADEMARK_UNSUPPORTED_CONCLUSIONS = Object.freeze({
  filingBasis: 'NOT_ESTABLISHED' as const,
  useClaim: 'NOT_ESTABLISHED' as const,
  registrability: 'NOT_ESTABLISHED' as const,
  clearance: 'NOT_ESTABLISHED' as const,
  classes: 'NOT_ESTABLISHED' as const,
  deadlines: 'NOT_ESTABLISHED' as const,
  legalEligibility: 'NOT_ESTABLISHED' as const,
  officeStatus: 'NOT_ESTABLISHED' as const
});

export type ExecuteUsTrademarkMarkRepresentationStrategyResultV1 =
  | {
      status: 'NOT_APPLICABLE';
      reasonCode: 'NON_US_TARGET' | 'UNSUPPORTED_MARK_TYPE' | 'INSUFFICIENT_REPRESENTATION';
      candidates: readonly [];
      unsupportedConclusions: typeof US_TRADEMARK_UNSUPPORTED_CONCLUSIONS;
      authorityConsequences: RecommendationSourceAuthorityConsequencesV1;
    }
  | {
      status: 'APPLICABLE';
      reasonCode: 'BOUNDED_MARK_REPRESENTATION_DIMENSIONS';
      candidates: readonly UsTrademarkProtectionDimensionCandidateV1[];
      assumptions: readonly string[];
      limitations: readonly string[];
      provenanceRefs: readonly string[];
      unsupportedConclusions: typeof US_TRADEMARK_UNSUPPORTED_CONCLUSIONS;
      authorityConsequences: RecommendationSourceAuthorityConsequencesV1;
    };

const EVIDENCE_ROLES = Object.freeze([
  'DECISION_FACTORS',
  'DRAWING_TYPE_DEFINITIONS',
  'PROTECTION_SCOPE_AND_SPECIAL_FORM_REQUIRED'
] as const);

function candidate(
  dimension: UsTrademarkProtectionDimensionV1,
  rationaleCode: UsTrademarkProtectionDimensionCandidateV1['rationaleCode']
): UsTrademarkProtectionDimensionCandidateV1 {
  return {
    dimension,
    support: 'SUPPORTED_FOR_HUMAN_REVIEW',
    rationaleCode,
    evidenceRoles: EVIDENCE_ROLES
  };
}
function notApplicable(
  reasonCode: Extract<
    ExecuteUsTrademarkMarkRepresentationStrategyResultV1,
    { status: 'NOT_APPLICABLE' }
  >['reasonCode']
): ExecuteUsTrademarkMarkRepresentationStrategyResultV1 {
  return {
    status: 'NOT_APPLICABLE',
    reasonCode,
    candidates: [],
    unsupportedConclusions: US_TRADEMARK_UNSUPPORTED_CONCLUSIONS,
    authorityConsequences: noRecommendationSourceAuthorityConsequences
  };
}

export function executeUsTrademarkMarkRepresentationStrategyV1(
  input: Readonly<ProductionIntakeInputV1>
): ExecuteUsTrademarkMarkRepresentationStrategyResultV1 {
  if (
    !input.targetJurisdictions.some((jurisdiction) => jurisdiction.trim().toUpperCase() === 'US')
  ) {
    return notApplicable('NON_US_TARGET');
  }
  if (!input.trademark.representationText.trim()) {
    return notApplicable('INSUFFICIENT_REPRESENTATION');
  }
  if (input.trademark.type === 'OTHER') return notApplicable('UNSUPPORTED_MARK_TYPE');

  const candidates: UsTrademarkProtectionDimensionCandidateV1[] = [];
  if (
    input.trademark.type === 'WORD' ||
    input.trademark.type === 'STYLIZED_WORD' ||
    input.trademark.type === 'COMPOSITE'
  ) {
    candidates.push(candidate('WORDING_STANDARD_CHARACTER', 'CUSTOMER_SUPPLIED_WORDING_DIMENSION'));
  }
  if (
    input.trademark.type === 'STYLIZED_WORD' ||
    input.trademark.type === 'DEVICE' ||
    input.trademark.type === 'COMPOSITE'
  ) {
    candidates.push(
      candidate(
        'DESIGN_STYLIZATION_SPECIAL_FORM',
        'CUSTOMER_SUPPLIED_DESIGN_OR_STYLIZATION_DIMENSION'
      )
    );
  }

  return {
    status: 'APPLICABLE',
    reasonCode: 'BOUNDED_MARK_REPRESENTATION_DIMENSIONS',
    candidates,
    assumptions: US_TRADEMARK_STRATEGY_ASSUMPTIONS,
    limitations: US_TRADEMARK_STRATEGY_LIMITATIONS,
    provenanceRefs: USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE.map(
      (source) => `knowledge:${source.content.objectId}:${source.chunkId}:${source.contentSha256}`
    ),
    unsupportedConclusions: US_TRADEMARK_UNSUPPORTED_CONCLUSIONS,
    authorityConsequences: noRecommendationSourceAuthorityConsequences
  };
}

function stableLineageIdentity(source: Readonly<KnowledgeRetrievalLineageRefV1>): string {
  return [
    source.sourceSystem,
    source.content.workspaceId,
    source.content.objectType,
    source.content.objectId,
    source.content.objectKind,
    source.chunkId,
    source.contentSha256,
    source.indexedAt,
    source.indexMode,
    JSON.stringify(source.headingPath)
  ].join('|');
}

function hasExactAcceptedLineage(
  sources: readonly Readonly<KnowledgeRetrievalLineageRefV1>[]
): boolean {
  if (sources.length !== USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE.length) return false;
  const supplied = sources.map(stableLineageIdentity).sort();
  const accepted = USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE.map(stableLineageIdentity).sort();
  return supplied.every((identity, index) => identity === accepted[index]);
}

function exactReference(
  reference: Readonly<UsTrademarkMarkRepresentationReferenceStateV1>
): boolean {
  const accepted = USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE;
  return Object.entries(accepted).every(
    ([key, value]) => reference[key as keyof typeof accepted] === value
  );
}
export function compileUsTrademarkMarkRepresentationMethodPackageV1(
  input: Readonly<CompileUsTrademarkMarkRepresentationMethodInputV1>
): CompileUsTrademarkMarkRepresentationMethodResultV1 {
  if (!hasExactAcceptedLineage(input.knowledgeSources)) {
    return { status: 'REJECTED', reason: 'LINEAGE_MISMATCH' };
  }
  if (!exactReference(input.reference)) {
    return { status: 'REJECTED', reason: 'REFERENCE_MISMATCH' };
  }
  if (input.reference.currentness !== 'CURRENT') {
    return { status: 'REJECTED', reason: 'REFERENCE_NOT_CURRENT' };
  }

  const applicability = {
    jurisdictions: ['US'],
    authorities: ['USPTO'],
    objectTypes: ['TRADEMARK_APPLICATION'],
    operations: ['MARK_REPRESENTATION_STRATEGY'],
    procedures: ['PRE_FILING_STRATEGY'],
    stages: ['CUSTOMER_INTAKE'],
    filingBases: ['ANY'],
    segments: ['MARK_REPRESENTATION'],
    requiredData: [
      'TRADEMARK_TYPE',
      'TRADEMARK_REPRESENTATION_TEXT',
      'TARGET_JURISDICTIONS',
      'SOURCE_LINEAGE'
    ],
    effectiveFrom: KNOWLEDGE_INDEXED_AT
  } as const;
  const evaluation = {
    evaluationId: 'evaluation_us-trademark-mark-representation-strategy-v1',
    evaluatedAt: '2026-09-06T19:00:00.000Z',
    status: 'PASSED' as const,
    baseline: 'exact-uspto-mark-drawing-source-plus-deterministic-intake-cases-v1',
    metrics: {
      exactSourceCount: 1,
      exactChunkCount: 2,
      positiveCasePassRate: 1,
      notApplicableCasePassRate: 1,
      staleTamperRejectionRate: 1,
      deterministicReplayRate: 1,
      authorityConsequenceFalseRate: 1
    },
    evidenceSummary:
      'One current USPTO primary-authority document and two exact governed retrieval chunks support a deterministic mark-representation candidate classifier; all unsupported legal and filing conclusions remain NOT_ESTABLISHED.'
  } as const;
  const lineageValue = {
    knowledgeSources: input.knowledgeSources.map((source) => structuredClone(source)),
    researchDatasets: []
  } as const;
  const executable = {
    kind: 'BOUNDED_MARK_REPRESENTATION_CLASSIFICATION',
    inputContract: 'ProductionIntakeInputV1',
    supportedTrademarkTypes: ['WORD', 'STYLIZED_WORD', 'DEVICE', 'COMPOSITE'],
    unsupportedTrademarkTypes: ['OTHER'],
    candidateDimensions: ['WORDING_STANDARD_CHARACTER', 'DESIGN_STYLIZATION_SPECIAL_FORM'],
    assumptions: US_TRADEMARK_STRATEGY_ASSUMPTIONS,
    limitations: US_TRADEMARK_STRATEGY_LIMITATIONS,
    unsupportedConclusions: US_TRADEMARK_UNSUPPORTED_CONCLUSIONS,
    authorityConsequences: noRecommendationSourceAuthorityConsequences,
    acceptedReference: USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE
  } as const;

  const method = parseBrainMethodContractV1({
    schemaVersion: 1,
    methodId: US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID,
    methodVersionId: US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID,
    methodFamily: 'CLASSIFICATION',
    version: 1,
    purpose:
      'Identify bounded US trademark mark-representation protection dimensions supportable from customer-supplied Production Intake for human strategy review.',
    targetObjectType: 'TRADEMARK_APPLICATION',
    applicability,
    requiredInputs: [
      'trademark.type',
      'trademark.representationText',
      'targetJurisdictions',
      'currentKnowledgeReference'
    ],
    featureDefinitions: [
      'customer-supplied mark form',
      'customer-supplied representation text',
      'US target jurisdiction',
      'exact current USPTO drawing-strategy evidence lineage'
    ],
    algorithm: executable,
    outputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID,
    limitations: US_TRADEMARK_STRATEGY_LIMITATIONS,
    coverage:
      'US / USPTO / customer intake / mark-representation protection dimensions only; no filing, legal, class, basis, deadline, clearance, or registrability conclusion.',
    evaluation,
    fallback: { behavior: 'NOT_APPLICABLE' },
    lineage: lineageValue,
    lifecycle: 'VALIDATED',
    supersedesMethodVersionIds: [],
    createdAt: '2026-09-06T19:00:00.000Z',
    validatedAt: '2026-09-06T19:00:00.000Z'
  });

  const pkg = parseExecutableMethodPackageV1({
    schemaVersion: 1,
    packageId: US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID,
    packageVersion: 1,
    methodId: method.methodId,
    methodVersionId: method.methodVersionId,
    methodFamily: method.methodFamily,
    lifecycle: 'VALIDATED',
    selectionPriority: 0,
    applicability,
    inputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID,
    outputSchemaId: US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID,
    executable,
    requiredData: applicability.requiredData,
    referenceDependencies: [US_TRADEMARK_MARK_REPRESENTATION_REFERENCE_DEPENDENCY],
    reasonCodes: {
      APPLICABLE:
        'Exact current USPTO lineage is present and customer-supplied mark representation supports bounded protection dimensions for human review.',
      NOT_APPLICABLE:
        'Request is outside the frozen US mark-representation strategy scope or has insufficient supported intake.',
      LINEAGE_MISMATCH:
        'Knowledge chunk identity or fingerprint does not match the accepted source set.',
      REFERENCE_MISMATCH:
        'Knowledge source/document/artifact/reference identity does not match the accepted production evidence.',
      REFERENCE_NOT_CURRENT: 'The accepted Knowledge reference is not CURRENT and must fail closed.'
    },
    fallback: { behavior: 'NOT_APPLICABLE' },
    evaluation,
    lineage: lineageValue,
    limitations: US_TRADEMARK_STRATEGY_LIMITATIONS,
    createdAt: '2026-09-06T19:00:00.000Z'
  });

  return { status: 'READY', method, package: pkg };
}

export interface UsTrademarkMarkRepresentationGovernedActivationV1 {
  predecessor: Readonly<ExecutableMethodPackageV1>;
  predecessorFingerprintSha256: string;
  decision: Readonly<ExecutableMethodPackageActivationDecisionV1>;
  activePackage: Readonly<ExecutableMethodPackageV1>;
  activationEvidenceRef: string;
}

export function activateUsTrademarkMarkRepresentationMethodPackageV1(
  packageValue: unknown
): UsTrademarkMarkRepresentationGovernedActivationV1 {
  const predecessor = parseExecutableMethodPackageV1(packageValue);
  const canonical = compileUsTrademarkMarkRepresentationMethodPackageV1({
    knowledgeSources: USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE,
    reference: {
      ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
      currentness: 'CURRENT'
    }
  });
  if (canonical.status !== 'READY') {
    throw new Error('Canonical US trademark mark-representation package could not compile.');
  }
  const predecessorFingerprintSha256 = executableMethodPackageFingerprintV1(predecessor);
  if (predecessorFingerprintSha256 !== executableMethodPackageFingerprintV1(canonical.package)) {
    throw new Error(
      'Governance activation requires the exact accepted US trademark mark-representation predecessor package.'
    );
  }

  const activeLimitations = [
    ...US_TRADEMARK_STRATEGY_LIMITATIONS,
    'ACTIVE status grants only governed analytical Method selection; Recommendation, authorization, and action authority remain false.'
  ];
  const decision = prepareExecutableMethodPackageActivationDecisionV1(predecessor, {
    decision: 'APPROVED',
    selectionPriority: 100,
    limitations: activeLimitations,
    policyVersion: 'brain-governance.markreg-strategy-method.v1',
    approvedBy: 'markorbit-core-governance',
    approvalTicketRef: 'github:yoomarks/markorbit#903',
    approvedAt: '2026-09-06T19:05:00.000Z',
    rationale:
      'Activate only the evidence-backed US mark-representation strategy classifier for bounded human-review candidates; no legal conclusion, Recommendation, filing authorization, payment, provider contact, customer selection, or protected action authority is granted.'
  });
  const activePackage = activateExecutableMethodPackageV1(predecessor, decision);
  return {
    predecessor,
    predecessorFingerprintSha256,
    decision,
    activePackage,
    activationEvidenceRef: executableMethodActivationEvidenceRefV1(decision)
  };
}
