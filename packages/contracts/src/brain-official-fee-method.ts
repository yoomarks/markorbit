import {
  parseBrainMethodContractV1,
  parseExecutableMethodPackageV1,
  type BrainMethodContractV1,
  type ExecutableMethodPackageV1,
  type KnowledgeRetrievalLineageRefV1
} from './brain-method.js';

export const USPTO_OFFICIAL_FEE_PILOT_OPERATION =
  'USPTO_TM_NEW_APPLICATION_BASE_FEE_SECTION_1_44_ELECTRONIC_PER_CLASS' as const;

export const USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE = Object.freeze([
  Object.freeze({
    schemaVersion: 1 as const,
    sourceSystem: 'MARKORBIT_KNOWLEDGE' as const,
    content: Object.freeze({
      protocolVersion: '1.0' as const,
      objectType: 'CONTENT_OBJECT_REF' as const,
      objectId: 'art_01M139E6ANZXHGEWBVW35PME4K',
      objectKind: 'DOCUMENT',
      workspaceId: 'wsp_01ARZ3NDEKTSV4RRFFQ69G5FAV'
    }),
    chunkId: 'rch_186dc86dc9b2d2f609445c6683bceac6',
    contentSha256: '186dc86dc9b2d2f609445c6683bceac698e4a221bf33d0c6d3991b480bb6601e',
    indexedAt: '2026-08-28T04:18:22.805Z',
    indexMode: 'SQLITE_FTS5_BM25',
    headingPath: Object.freeze([]),
    retrievalRationale:
      'NUMERIC_AUTHORITY: exact Knowledge #559 live USPTO Fee Schedule chunk for 2.6(a)(1)(iii) / fee code 7017.'
  }),
  Object.freeze({
    schemaVersion: 1 as const,
    sourceSystem: 'MARKORBIT_KNOWLEDGE' as const,
    content: Object.freeze({
      protocolVersion: '1.0' as const,
      objectType: 'CONTENT_OBJECT_REF' as const,
      objectId: 'art_01M139ED672D4XQZVC46SK4377',
      objectKind: 'DOCUMENT',
      workspaceId: 'wsp_01ARZ3NDEKTSV4RRFFQ69G5FAV'
    }),
    chunkId: 'rch_0690b135ca8d2ad8625cf5a080fcfcf2',
    contentSha256: '0690b135ca8d2ad8625cf5a080fcfcf2e0988f582a8a0d07cd610b55dd5934e0',
    indexedAt: '2026-08-28T04:18:29.782Z',
    indexMode: 'SQLITE_FTS5_BM25',
    headingPath: Object.freeze([]),
    retrievalRationale:
      'TEMPORAL_AUTHORITY: exact Knowledge #559 live USPTO 2025 fee-change chunk containing the effective-date evidence.'
  }),
  Object.freeze({
    schemaVersion: 1 as const,
    sourceSystem: 'MARKORBIT_KNOWLEDGE' as const,
    content: Object.freeze({
      protocolVersion: '1.0' as const,
      objectType: 'CONTENT_OBJECT_REF' as const,
      objectId: 'art_01M139ED672D4XQZVC46SK4377',
      objectKind: 'DOCUMENT',
      workspaceId: 'wsp_01ARZ3NDEKTSV4RRFFQ69G5FAV'
    }),
    chunkId: 'rch_d046a12a21945953e850803c202dd6c3',
    contentSha256: 'd046a12a21945953e850803c202dd6c3bffd7ddd06b7b5cc5d8e0ace90cbee2a',
    indexedAt: '2026-08-28T04:18:29.782Z',
    indexMode: 'SQLITE_FTS5_BM25',
    headingPath: Object.freeze([]),
    retrievalRationale:
      'TEMPORAL_OPERATION_CONTEXT: exact Knowledge #559 live USPTO 2025 fee-change chunk tying Sections 1/44 base application fee per class to the temporal authority.'
  }),
  Object.freeze({
    schemaVersion: 1 as const,
    sourceSystem: 'MARKORBIT_KNOWLEDGE' as const,
    content: Object.freeze({
      protocolVersion: '1.0' as const,
      objectType: 'CONTENT_OBJECT_REF' as const,
      objectId: 'art_01M139ENHCJJK65BCQ786BKAZ4',
      objectKind: 'DOCUMENT',
      workspaceId: 'wsp_01ARZ3NDEKTSV4RRFFQ69G5FAV'
    }),
    chunkId: 'rch_f3f366e8a5bd59b838d5c6b9cd46ae49',
    contentSha256: 'f3f366e8a5bd59b838d5c6b9cd46ae492ce2578d2236eefa6c64784fafc8f742',
    indexedAt: '2026-08-28T04:18:38.334Z',
    indexMode: 'SQLITE_FTS5_BM25',
    headingPath: Object.freeze([]),
    retrievalRationale:
      'APPLICABILITY_CONTEXT: exact Knowledge #559 live USPTO Trademark Fee Information chunk for the frozen Section 1 / Section 44 pilot.'
  })
]) satisfies readonly Readonly<KnowledgeRetrievalLineageRefV1>[];

const ACCEPTED_DOCUMENT_EVIDENCE = Object.freeze([
  Object.freeze({
    role: 'NUMERIC_AUTHORITY',
    sourceUri: 'https://www.uspto.gov/learning-and-resources/fees-and-payment/uspto-fee-schedule',
    documentId: 'art_01M139E6ANZXHGEWBVW35PME4K',
    artifactVersion: 2,
    documentContentSha256: 'ce172f292949649024744be64aa283ffba840550f3159733b15813e13452314e',
    chunkId: 'rch_186dc86dc9b2d2f609445c6683bceac6',
    chunkContentSha256: '186dc86dc9b2d2f609445c6683bceac698e4a221bf33d0c6d3991b480bb6601e'
  }),
  Object.freeze({
    role: 'TEMPORAL_AUTHORITY',
    sourceUri:
      'https://www.uspto.gov/trademarks/fees-payment-information/summary-2025-trademark-fee-changes',
    documentId: 'art_01M139ED672D4XQZVC46SK4377',
    artifactVersion: 2,
    documentContentSha256: 'b993c19c9acb47a7ff5b0295269fee187219d9e2b273c456e46e42522edd1eb2',
    chunkId: 'rch_0690b135ca8d2ad8625cf5a080fcfcf2',
    chunkContentSha256: '0690b135ca8d2ad8625cf5a080fcfcf2e0988f582a8a0d07cd610b55dd5934e0'
  }),
  Object.freeze({
    role: 'TEMPORAL_OPERATION_CONTEXT',
    sourceUri:
      'https://www.uspto.gov/trademarks/fees-payment-information/summary-2025-trademark-fee-changes',
    documentId: 'art_01M139ED672D4XQZVC46SK4377',
    artifactVersion: 2,
    documentContentSha256: 'b993c19c9acb47a7ff5b0295269fee187219d9e2b273c456e46e42522edd1eb2',
    chunkId: 'rch_d046a12a21945953e850803c202dd6c3',
    chunkContentSha256: 'd046a12a21945953e850803c202dd6c3bffd7ddd06b7b5cc5d8e0ace90cbee2a'
  }),
  Object.freeze({
    role: 'APPLICABILITY_CONTEXT',
    sourceUri: 'https://www.uspto.gov/trademarks/trademark-fee-information',
    documentId: 'art_01M139ENHCJJK65BCQ786BKAZ4',
    artifactVersion: 2,
    documentContentSha256: 'eb0341c84179a46ab1cc2852b8924e9bf530b333cd8b3c62d67e84c53c5c1fbe',
    chunkId: 'rch_f3f366e8a5bd59b838d5c6b9cd46ae49',
    chunkContentSha256: 'f3f366e8a5bd59b838d5c6b9cd46ae492ce2578d2236eefa6c64784fafc8f742'
  })
]);

export type OfficialFeeTemporalResolutionV1 =
  | { status: 'UNRESOLVED' }
  | {
      status: 'RESOLVED';
      effectiveFrom: string;
      effectiveTo?: string;
      evidenceRef: string;
    };

export type OfficialFeeConflictResolutionV1 =
  { status: 'UNRESOLVED' } | { status: 'NONE'; evidenceRef: string };

export interface CompileUsptoOfficialFeeMethodInputV1 {
  knowledgeSources: readonly Readonly<KnowledgeRetrievalLineageRefV1>[];
  temporalResolution: OfficialFeeTemporalResolutionV1;
  conflictResolution: OfficialFeeConflictResolutionV1;
}

export type CompileUsptoOfficialFeeMethodResultV1 =
  | {
      status: 'REJECTED';
      reason: 'LINEAGE_MISMATCH' | 'TEMPORAL_UNRESOLVED' | 'CONFLICT_UNRESOLVED';
    }
  | {
      status: 'READY';
      method: Readonly<BrainMethodContractV1>;
      package: Readonly<ExecutableMethodPackageV1>;
    };

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
  if (sources.length !== USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE.length) return false;
  const supplied = sources.map(stableLineageIdentity).sort();
  const accepted = USPTO_OFFICIAL_FEE_ACCEPTED_LINEAGE.map(stableLineageIdentity).sort();
  return supplied.every((identity, index) => identity === accepted[index]);
}

function normalizedInstant(value: string): string | null {
  const cleaned = value.trim();
  if (!cleaned || Number.isNaN(Date.parse(cleaned))) return null;
  return cleaned;
}

function temporalVersionKey(effectiveFrom: string): string {
  return effectiveFrom.slice(0, 10).replaceAll('-', '');
}

export function compileUsptoOfficialFeeMethodPackageV1(
  input: Readonly<CompileUsptoOfficialFeeMethodInputV1>
): CompileUsptoOfficialFeeMethodResultV1 {
  if (!hasExactAcceptedLineage(input.knowledgeSources)) {
    return { status: 'REJECTED', reason: 'LINEAGE_MISMATCH' };
  }
  if (input.temporalResolution.status !== 'RESOLVED') {
    return { status: 'REJECTED', reason: 'TEMPORAL_UNRESOLVED' };
  }
  if (input.conflictResolution.status !== 'NONE') {
    return { status: 'REJECTED', reason: 'CONFLICT_UNRESOLVED' };
  }

  const effectiveFrom = normalizedInstant(input.temporalResolution.effectiveFrom);
  const effectiveTo = input.temporalResolution.effectiveTo
    ? normalizedInstant(input.temporalResolution.effectiveTo)
    : undefined;
  if (!effectiveFrom || (input.temporalResolution.effectiveTo && !effectiveTo)) {
    return { status: 'REJECTED', reason: 'TEMPORAL_UNRESOLVED' };
  }
  if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(effectiveFrom)) {
    return { status: 'REJECTED', reason: 'TEMPORAL_UNRESOLVED' };
  }
  if (!input.temporalResolution.evidenceRef.trim()) {
    return { status: 'REJECTED', reason: 'TEMPORAL_UNRESOLVED' };
  }
  if (!input.conflictResolution.evidenceRef.trim()) {
    return { status: 'REJECTED', reason: 'CONFLICT_UNRESOLVED' };
  }

  const versionKey = temporalVersionKey(effectiveFrom);
  const applicability = {
    jurisdictions: ['US'],
    authorities: ['USPTO'],
    objectTypes: ['TRADEMARK_APPLICATION'],
    operations: [USPTO_OFFICIAL_FEE_PILOT_OPERATION],
    procedures: ['ELECTRONIC_FILING'],
    stages: ['NEW_APPLICATION'],
    filingBases: ['SECTION_1', 'SECTION_44'],
    segments: ['BASE_FEE'],
    requiredData: ['FILING_BASIS', 'CLASS_COUNT', 'RESOLVED_OFFICIAL_FEE_VALUE'],
    effectiveFrom,
    ...(effectiveTo ? { effectiveTo } : {})
  } as const;
  const lineage = {
    knowledgeSources: input.knowledgeSources.map((source) => structuredClone(source)),
    researchDatasets: []
  } as const;
  const evaluation = {
    evaluationId: `evaluation_uspto-official-fee-${versionKey}-v2`,
    evaluatedAt: '2026-08-28T00:00:00.000Z',
    status: 'PASSED' as const,
    baseline: 'three-official-source-four-chunk-exact-retrieval-v2',
    metrics: {
      sourceCount: 3,
      documentRecallAtK: 1,
      exactChunkHitRate: 1,
      provenanceCompletenessRate: 1,
      deterministicReplayRate: 1
    },
    evidenceSummary:
      'The frozen USPTO pilot passed one live Knowledge #559 run across three official canonical sources and four exact lexical chunks, with complete provenance and deterministic replay. No fee amount is embedded in this method.'
  } as const;
  const methodId = 'brain-method_uspto-official-fee-resolution' as const;
  const previousMethodVersionId =
    `brain-method-version_uspto-official-fee-resolution-${versionKey}` as const;
  const methodVersionId =
    `brain-method-version_uspto-official-fee-resolution-${versionKey}-v2` as const;
  const packageId =
    `executable-method-package_uspto-official-fee-resolution-${versionKey}-v2` as const;
  const executable = {
    kind: 'OFFICIAL_SOURCE_RESOLUTION',
    authorityOrder: [
      'NUMERIC_AUTHORITY',
      'TEMPORAL_AUTHORITY',
      'TEMPORAL_OPERATION_CONTEXT',
      'APPLICABILITY_CONTEXT'
    ],
    numericRowIdentity: {
      regulation: '37_CFR_2_6_A_1_III',
      feeCode: '7017',
      label: 'base application, per class'
    },
    temporalResolutionEvidenceRef: input.temporalResolution.evidenceRef,
    conflictResolutionEvidenceRef: input.conflictResolution.evidenceRef,
    acceptedDocumentEvidence: ACCEPTED_DOCUMENT_EVIDENCE
  } as const;

  const method = parseBrainMethodContractV1({
    schemaVersion: 1,
    methodId,
    methodVersionId,
    methodFamily: 'SOURCE_RESOLUTION',
    version: 2,
    purpose:
      'Resolve the evidence-backed USPTO electronic trademark base application fee per class for the frozen Section 1 / Section 44 pilot without embedding the current fee amount.',
    targetObjectType: 'TRADEMARK_APPLICATION',
    applicability,
    requiredInputs: [
      'filingBasis',
      'classCount',
      'resolvedOfficialFeeValue',
      'temporalApplicability'
    ],
    featureDefinitions: [
      'exact four-chunk Knowledge lineage across three official sources',
      'numeric authority row identity',
      'authoritative effective-date evidence',
      'temporal operation context',
      'applicability context',
      'cross-source conflict resolution'
    ],
    algorithm: executable,
    outputSchemaId: 'brain.official-fee-resolution.v1',
    limitations: [
      'Only the frozen USPTO Section 1 / Section 44 electronic base application fee per class is applicable.',
      'The monetary value is an execution/materialization input derived from evidence and is not stored in the method.',
      'Temporal or cross-source ambiguity must reject compilation rather than infer from publication or crawl timestamps.'
    ],
    coverage:
      'US / USPTO / new trademark application / Section 1 or Section 44 / electronic / per class.',
    evaluation,
    fallback: { behavior: 'NOT_APPLICABLE' },
    lineage,
    lifecycle: 'ACTIVE',
    supersedesMethodVersionIds: [previousMethodVersionId],
    createdAt: '2026-08-28T00:00:00.000Z',
    validatedAt: '2026-08-28T00:00:00.000Z'
  });

  const pkg = parseExecutableMethodPackageV1({
    schemaVersion: 1,
    packageId,
    packageVersion: 2,
    methodId,
    methodVersionId,
    methodFamily: 'SOURCE_RESOLUTION',
    lifecycle: 'ACTIVE',
    selectionPriority: 100,
    applicability,
    inputSchemaId: 'brain-input.official-fee-resolution.v1',
    outputSchemaId: 'brain.official-fee-resolution.v1',
    executable,
    requiredData: applicability.requiredData,
    referenceDependencies: ['CORE_OFFICIAL_FEE_REFERENCE_STORE_V1'],
    reasonCodes: {
      RESOLVED:
        'Exact accepted authority lineage and explicit temporal/conflict resolution are present.',
      NOT_APPLICABLE: 'Request is outside the frozen USPTO official-fee pilot.',
      TEMPORAL_UNRESOLVED: 'Authoritative fee applicability time is unresolved.',
      CONFLICT_UNRESOLVED: 'Cross-source authority conflict is unresolved.',
      LINEAGE_MISMATCH:
        'Knowledge source/chunk/version lineage does not match the accepted evidence.'
    },
    fallback: { behavior: 'NOT_APPLICABLE' },
    evaluation,
    lineage,
    limitations: method.limitations,
    createdAt: '2026-08-28T00:00:00.000Z',
    activatedAt: '2026-08-28T00:00:00.000Z'
  });

  return { status: 'READY', method, package: pkg };
}
