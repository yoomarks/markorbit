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
      objectId: 'art_01M12SPMTVMHPRBJXW0QAR3R6D',
      objectKind: 'DOCUMENT',
      workspaceId: 'wsp_01ARZ3NDEKTSV4RRFFQ69G5FAV'
    }),
    chunkId: 'rch_462a27b264a66de229d3d3309ff79941',
    contentSha256: '462a27b264a66de229d3d3309ff799410d13159998bd234488d095c11e1a0fda',
    indexedAt: '2026-08-27T23:43:22.580Z',
    indexMode: 'SQLITE_FTS5_BM25',
    headingPath: Object.freeze([]) as readonly string[],
    retrievalRationale:
      'NUMERIC_AUTHORITY: exact accepted USPTO Fee Schedule lexical chunk for 2.6(a)(1)(iii) / fee code 7017.'
  }),
  Object.freeze({
    schemaVersion: 1 as const,
    sourceSystem: 'MARKORBIT_KNOWLEDGE' as const,
    content: Object.freeze({
      protocolVersion: '1.0' as const,
      objectType: 'CONTENT_OBJECT_REF' as const,
      objectId: 'art_01M127C5JTR5H69JT94XJBG8VA',
      objectKind: 'DOCUMENT',
      workspaceId: 'wsp_01ARZ3NDEKTSV4RRFFQ69G5FAV'
    }),
    chunkId: 'rch_8110a47a3bf17a82b248e1fb8e42b8d7',
    contentSha256: '8110a47a3bf17a82b248e1fb8e42b8d7e3f84e66578f840ace3a2f54a94e724f',
    indexedAt: '2026-08-27T18:23:04.916Z',
    indexMode: 'SQLITE_FTS5_BM25',
    headingPath: Object.freeze([]) as readonly string[],
    retrievalRationale:
      'APPLICABILITY_CONTEXT: exact accepted USPTO Trademark Fee Information lexical chunk for the frozen Section 1 / Section 44 pilot.'
  })
]) satisfies readonly Readonly<KnowledgeRetrievalLineageRefV1>[];

const ACCEPTED_DOCUMENT_EVIDENCE = Object.freeze([
  Object.freeze({
    role: 'NUMERIC_AUTHORITY',
    sourceUri:
      'https://www.uspto.gov/learning-and-resources/fees-and-payment/uspto-fee-schedule',
    documentId: 'art_01M12SPMTVMHPRBJXW0QAR3R6D',
    artifactVersion: 2,
    documentContentSha256:
      'af2821298d3de7c6d2146b0e2e0a7c2963752d1cea2c9728db665164d74e7258',
    chunkId: 'rch_462a27b264a66de229d3d3309ff79941',
    chunkContentSha256:
      '462a27b264a66de229d3d3309ff799410d13159998bd234488d095c11e1a0fda'
  }),
  Object.freeze({
    role: 'APPLICABILITY_CONTEXT',
    sourceUri: 'https://www.uspto.gov/trademarks/trademark-fee-information',
    documentId: 'art_01M127C5JTR5H69JT94XJBG8VA',
    artifactVersion: 2,
    documentContentSha256:
      'f8e1e0360fe59754ff6dea23df6cf6fd5e1c16769f0b22ecbbc693b796b07a7b',
    chunkId: 'rch_8110a47a3bf17a82b248e1fb8e42b8d7',
    chunkContentSha256:
      '8110a47a3bf17a82b248e1fb8e42b8d7e3f84e66578f840ace3a2f54a94e724f'
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
  | { status: 'UNRESOLVED' }
  | { status: 'NONE'; evidenceRef: string };

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
    evaluationId: `evaluation_uspto-official-fee-${versionKey}`,
    evaluatedAt: '2026-08-28T00:00:00.000Z',
    status: 'PASSED' as const,
    baseline: 'dual-official-source-exact-retrieval-v1',
    metrics: {
      sourceCount: 2,
      documentRecallAtK: 1,
      exactChunkHitRate: 1,
      provenanceCompletenessRate: 1,
      deterministicReplayRate: 1
    },
    evidenceSummary:
      'Both frozen USPTO authority roles passed real acquisition, exact lexical chunk retrieval, complete provenance, and deterministic replay. No fee amount is embedded in this method.'
  } as const;
  const methodId = 'brain-method_uspto-official-fee-resolution' as const;
  const methodVersionId = `brain-method-version_uspto-official-fee-resolution-${versionKey}` as const;
  const packageId = `executable-method-package_uspto-official-fee-resolution-${versionKey}` as const;
  const executable = {
    kind: 'OFFICIAL_SOURCE_RESOLUTION',
    authorityOrder: ['NUMERIC_AUTHORITY', 'APPLICABILITY_CONTEXT'],
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
    version: 1,
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
      'exact dual-source Knowledge lineage',
      'numeric authority row identity',
      'applicability context',
      'authoritative temporal applicability',
      'cross-source conflict resolution'
    ],
    algorithm: executable,
    outputSchemaId: 'brain.official-fee-resolution.v1',
    limitations: [
      'Only the frozen USPTO Section 1 / Section 44 electronic base application fee per class is applicable.',
      'The monetary value is an execution/materialization input derived from evidence and is not stored in the method.',
      'Temporal or cross-source ambiguity must reject compilation rather than infer from publication or crawl timestamps.'
    ],
    coverage: 'US / USPTO / new trademark application / Section 1 or Section 44 / electronic / per class.',
    evaluation,
    fallback: { behavior: 'NOT_APPLICABLE' },
    lineage,
    lifecycle: 'ACTIVE',
    supersedesMethodVersionIds: [],
    createdAt: '2026-08-28T00:00:00.000Z',
    validatedAt: '2026-08-28T00:00:00.000Z'
  });

  const pkg = parseExecutableMethodPackageV1({
    schemaVersion: 1,
    packageId,
    packageVersion: 1,
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
      RESOLVED: 'Exact accepted authority lineage and explicit temporal/conflict resolution are present.',
      NOT_APPLICABLE: 'Request is outside the frozen USPTO official-fee pilot.',
      TEMPORAL_UNRESOLVED: 'Authoritative fee applicability time is unresolved.',
      CONFLICT_UNRESOLVED: 'Cross-source authority conflict is unresolved.',
      LINEAGE_MISMATCH: 'Knowledge source/chunk/version lineage does not match the accepted evidence.'
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
