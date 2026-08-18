export const READY_PACKAGE_CONTENT_EXPORT_VERSION = '1.0' as const;
export const READY_PACKAGE_CONTENT_EXPORT_V1_1_VERSION = '1.1' as const;
export const SOURCE_GOVERNANCE_SNAPSHOT_VERSION = '1.0' as const;

export type ReadyPackageContentExportVerificationOutcome = 'PASS' | 'PASS_WITH_WARNINGS';

export type StandardSourceGovernanceSnapshotV1 = {
  snapshotVersion: typeof SOURCE_GOVERNANCE_SNAPSHOT_VERSION;
  kind: 'STANDARD_SOURCE';
  sourceId: string;
};

export type GlobalReferenceSourceGovernanceSnapshotV1 = {
  snapshotVersion: typeof SOURCE_GOVERNANCE_SNAPSHOT_VERSION;
  kind: 'GLOBAL_REFERENCE';
  sourceId: string;
  referenceProtocolVersion: '1.0';
  sourceRole:
    | 'COUNTRY_CONTEXT'
    | 'INVESTMENT_GUIDE'
    | 'COUNTRY_STATISTICS'
    | 'PROPERTY_RIGHTS_INDEX'
    | 'TM_PRACTICE_GUIDE'
    | 'TM_CHANGE_SIGNAL'
    | 'IP_AUTHORITY_REFERENCE'
    | 'IP_CASE_STUDY'
    | 'IP_LEGAL_SOURCE'
    | 'TM_EXPERT_GUIDE'
    | 'CONTENT_MARKETING_REFERENCE'
    | 'COMPETITOR_BENCHMARK'
    | 'LEGACY_REFERENCE';
  authorityTier: 'A_PLUS' | 'A' | 'B_PLUS' | 'B' | 'C_PLUS' | 'C' | 'D';
  intendedUses: Array<
    | 'COUNTRY_PROFILE'
    | 'TRADEMARK_PROFILE'
    | 'CHANGE_SIGNAL'
    | 'CASE_LIBRARY'
    | 'CONTENT_IDEATION'
    | 'PROVIDER_BENCHMARK'
    | 'LEGACY_CROSSCHECK'
  >;
  factEligibility:
    | 'PRIMARY'
    | 'AUTHORITATIVE_AGGREGATOR'
    | 'SECONDARY'
    | 'SUPPORTING_ONLY'
    | 'NONE';
  verification: {
    policy: 'NOT_REQUIRED' | 'CONDITIONAL' | 'REQUIRED';
    verifyAgainstSourceIds: string[];
    verifyAgainstJurisdictionOfficialSource: boolean;
  };
  contentReusePolicy:
    | 'FACT_EXTRACTION_WITH_PROVENANCE'
    | 'STRUCTURE_AND_TOPIC_ONLY'
    | 'BENCHMARK_ONLY'
    | 'LEGACY_CROSSCHECK_ONLY';
};

export type SourceGovernanceSnapshotV1 =
  | StandardSourceGovernanceSnapshotV1
  | GlobalReferenceSourceGovernanceSnapshotV1;

export interface ReadyPackageContentExportV1 {
  contractVersion:
    | typeof READY_PACKAGE_CONTENT_EXPORT_VERSION
    | typeof READY_PACKAGE_CONTENT_EXPORT_V1_1_VERSION;
  objectType: 'READY_PACKAGE_CONTENT_EXPORT';
  readyPackageId: string;
  knowledgeWorkspaceId: string;
  readyPackageDigest: string;
  provenance: {
    sourceId: string;
    conversionRunId: string;
    verificationId: string;
    verificationOutcome: ReadyPackageContentExportVerificationOutcome;
    capturedAt: string;
    converter: {
      converterId: string;
      version: string;
    };
    legalTruthVerified: false;
  };
  rawArtifact: {
    artifactId: string;
    sha256: string;
    sizeBytes: number;
    mimeType: string;
    originalName: string;
  };
  stagingDocument: {
    documentId: string;
    sha256: string;
    sizeBytes: number;
    mediaType: 'text/markdown';
    encoding: 'utf-8';
    content: string;
  };
  sourceGovernance?: SourceGovernanceSnapshotV1;
}

export interface ReadyPackageContentConsumptionResult {
  intakeId: string;
  readyPackageId: string;
  status: 'STORED';
  exportSha256: string;
}

const patterns = {
  readyPackage: /^rdp_[A-Za-z0-9][A-Za-z0-9_-]*$/u,
  workspace: /^wsp_[0-9A-HJKMNP-TV-Z]{26}$/u,
  source: /^src_[0-9A-HJKMNP-TV-Z]{26}$/u,
  conversionRun: /^cvr_[0-9A-HJKMNP-TV-Z]{26}$/u,
  verification: /^svr_[0-9A-HJKMNP-TV-Z]{26}$/u,
  artifact: /^art_[0-9A-HJKMNP-TV-Z]{26}$/u,
  stagingDocument: /^std_[0-9A-HJKMNP-TV-Z]{26}$/u,
  sha256: /^[a-f0-9]{64}$/u,
  mimeType: /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/iu,
  converterId: /^[a-z0-9]+(?:-[a-z0-9]+)*$/u,
  semver: /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u
} as const;

const SOURCE_ROLES = [
  'COUNTRY_CONTEXT',
  'INVESTMENT_GUIDE',
  'COUNTRY_STATISTICS',
  'PROPERTY_RIGHTS_INDEX',
  'TM_PRACTICE_GUIDE',
  'TM_CHANGE_SIGNAL',
  'IP_AUTHORITY_REFERENCE',
  'IP_CASE_STUDY',
  'IP_LEGAL_SOURCE',
  'TM_EXPERT_GUIDE',
  'CONTENT_MARKETING_REFERENCE',
  'COMPETITOR_BENCHMARK',
  'LEGACY_REFERENCE'
] as const;
const AUTHORITY_TIERS = ['A_PLUS', 'A', 'B_PLUS', 'B', 'C_PLUS', 'C', 'D'] as const;
const INTENDED_USES = [
  'COUNTRY_PROFILE',
  'TRADEMARK_PROFILE',
  'CHANGE_SIGNAL',
  'CASE_LIBRARY',
  'CONTENT_IDEATION',
  'PROVIDER_BENCHMARK',
  'LEGACY_CROSSCHECK'
] as const;
const FACT_ELIGIBILITY = [
  'PRIMARY',
  'AUTHORITATIVE_AGGREGATOR',
  'SECONDARY',
  'SUPPORTING_ONLY',
  'NONE'
] as const;
const VERIFICATION_POLICIES = ['NOT_REQUIRED', 'CONDITIONAL', 'REQUIRED'] as const;
const CONTENT_REUSE_POLICIES = [
  'FACT_EXTRACTION_WITH_PROVENANCE',
  'STRUCTURE_AND_TOPIC_ONLY',
  'BENCHMARK_ONLY',
  'LEGACY_CROSSCHECK_ONLY'
] as const;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, expected: string[]) => {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
};
const validTimestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value) &&
  Number.isFinite(Date.parse(value));
const nonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const uniqueStrings = (value: string[]) => new Set(value).size === value.length;
const isAllowed = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && allowed.includes(value as T);

function isSourceGovernanceSnapshot(value: unknown, sourceId: string): value is SourceGovernanceSnapshotV1 {
  if (!record(value) || value.snapshotVersion !== SOURCE_GOVERNANCE_SNAPSHOT_VERSION) return false;
  if (value.kind === 'STANDARD_SOURCE') {
    return exactKeys(value, ['snapshotVersion', 'kind', 'sourceId']) && value.sourceId === sourceId;
  }
  if (
    value.kind !== 'GLOBAL_REFERENCE' ||
    !exactKeys(value, [
      'snapshotVersion',
      'kind',
      'sourceId',
      'referenceProtocolVersion',
      'sourceRole',
      'authorityTier',
      'intendedUses',
      'factEligibility',
      'verification',
      'contentReusePolicy'
    ]) ||
    value.sourceId !== sourceId ||
    value.referenceProtocolVersion !== '1.0' ||
    !isAllowed(value.sourceRole, SOURCE_ROLES) ||
    !isAllowed(value.authorityTier, AUTHORITY_TIERS) ||
    !Array.isArray(value.intendedUses) ||
    !value.intendedUses.every((item) => isAllowed(item, INTENDED_USES)) ||
    !uniqueStrings(value.intendedUses as string[]) ||
    !isAllowed(value.factEligibility, FACT_ELIGIBILITY) ||
    !record(value.verification) ||
    !exactKeys(value.verification, [
      'policy',
      'verifyAgainstSourceIds',
      'verifyAgainstJurisdictionOfficialSource'
    ]) ||
    !isAllowed(value.verification.policy, VERIFICATION_POLICIES) ||
    !Array.isArray(value.verification.verifyAgainstSourceIds) ||
    !value.verification.verifyAgainstSourceIds.every(
      (item) => typeof item === 'string' && item.trim().length > 0
    ) ||
    !uniqueStrings(value.verification.verifyAgainstSourceIds as string[]) ||
    typeof value.verification.verifyAgainstJurisdictionOfficialSource !== 'boolean' ||
    !isAllowed(value.contentReusePolicy, CONTENT_REUSE_POLICIES)
  ) {
    return false;
  }
  return true;
}

export function parseReadyPackageContentExportV1(
  value: unknown
): ReadyPackageContentExportV1 | null {
  if (!record(value)) return null;
  const isV1 = value.contractVersion === READY_PACKAGE_CONTENT_EXPORT_VERSION;
  const isV1_1 = value.contractVersion === READY_PACKAGE_CONTENT_EXPORT_V1_1_VERSION;
  if (!isV1 && !isV1_1) return null;
  const topLevelKeys = [
    'contractVersion',
    'objectType',
    'readyPackageId',
    'knowledgeWorkspaceId',
    'readyPackageDigest',
    'provenance',
    'rawArtifact',
    'stagingDocument',
    ...(isV1_1 ? ['sourceGovernance'] : [])
  ];
  if (
    !exactKeys(value, topLevelKeys) ||
    !record(value.provenance) ||
    !record(value.rawArtifact) ||
    !record(value.stagingDocument)
  )
    return null;

  const provenance = value.provenance;
  const rawArtifact = value.rawArtifact;
  const stagingDocument = value.stagingDocument;
  if (
    !exactKeys(provenance, [
      'sourceId',
      'conversionRunId',
      'verificationId',
      'verificationOutcome',
      'capturedAt',
      'converter',
      'legalTruthVerified'
    ]) ||
    !record(provenance.converter) ||
    !exactKeys(provenance.converter, ['converterId', 'version']) ||
    !exactKeys(rawArtifact, ['artifactId', 'sha256', 'sizeBytes', 'mimeType', 'originalName']) ||
    !exactKeys(stagingDocument, [
      'documentId',
      'sha256',
      'sizeBytes',
      'mediaType',
      'encoding',
      'content'
    ])
  )
    return null;

  if (
    value.objectType !== 'READY_PACKAGE_CONTENT_EXPORT' ||
    typeof value.readyPackageId !== 'string' ||
    !patterns.readyPackage.test(value.readyPackageId) ||
    typeof value.knowledgeWorkspaceId !== 'string' ||
    !patterns.workspace.test(value.knowledgeWorkspaceId) ||
    typeof value.readyPackageDigest !== 'string' ||
    !patterns.sha256.test(value.readyPackageDigest) ||
    typeof provenance.sourceId !== 'string' ||
    !patterns.source.test(provenance.sourceId) ||
    typeof provenance.conversionRunId !== 'string' ||
    !patterns.conversionRun.test(provenance.conversionRunId) ||
    typeof provenance.verificationId !== 'string' ||
    !patterns.verification.test(provenance.verificationId) ||
    (provenance.verificationOutcome !== 'PASS' &&
      provenance.verificationOutcome !== 'PASS_WITH_WARNINGS') ||
    !validTimestamp(provenance.capturedAt) ||
    typeof provenance.converter.converterId !== 'string' ||
    !patterns.converterId.test(provenance.converter.converterId) ||
    typeof provenance.converter.version !== 'string' ||
    !patterns.semver.test(provenance.converter.version) ||
    provenance.legalTruthVerified !== false ||
    typeof rawArtifact.artifactId !== 'string' ||
    !patterns.artifact.test(rawArtifact.artifactId) ||
    typeof rawArtifact.sha256 !== 'string' ||
    !patterns.sha256.test(rawArtifact.sha256) ||
    !nonNegativeSafeInteger(rawArtifact.sizeBytes) ||
    typeof rawArtifact.mimeType !== 'string' ||
    !patterns.mimeType.test(rawArtifact.mimeType) ||
    typeof rawArtifact.originalName !== 'string' ||
    rawArtifact.originalName.length === 0 ||
    typeof stagingDocument.documentId !== 'string' ||
    !patterns.stagingDocument.test(stagingDocument.documentId) ||
    typeof stagingDocument.sha256 !== 'string' ||
    !patterns.sha256.test(stagingDocument.sha256) ||
    !nonNegativeSafeInteger(stagingDocument.sizeBytes) ||
    stagingDocument.mediaType !== 'text/markdown' ||
    stagingDocument.encoding !== 'utf-8' ||
    typeof stagingDocument.content !== 'string' ||
    (isV1_1 && !isSourceGovernanceSnapshot(value.sourceGovernance, provenance.sourceId))
  )
    return null;

  return structuredClone(value) as unknown as ReadyPackageContentExportV1;
}

export const serializeReadyPackageContentExportV1 = (value: ReadyPackageContentExportV1) => {
  const serialized = {
    contractVersion: value.contractVersion,
    objectType: value.objectType,
    readyPackageId: value.readyPackageId,
    knowledgeWorkspaceId: value.knowledgeWorkspaceId,
    readyPackageDigest: value.readyPackageDigest,
    provenance: {
      sourceId: value.provenance.sourceId,
      conversionRunId: value.provenance.conversionRunId,
      verificationId: value.provenance.verificationId,
      verificationOutcome: value.provenance.verificationOutcome,
      capturedAt: value.provenance.capturedAt,
      converter: {
        converterId: value.provenance.converter.converterId,
        version: value.provenance.converter.version
      },
      legalTruthVerified: false as const
    },
    rawArtifact: {
      artifactId: value.rawArtifact.artifactId,
      sha256: value.rawArtifact.sha256,
      sizeBytes: value.rawArtifact.sizeBytes,
      mimeType: value.rawArtifact.mimeType,
      originalName: value.rawArtifact.originalName
    },
    stagingDocument: {
      documentId: value.stagingDocument.documentId,
      sha256: value.stagingDocument.sha256,
      sizeBytes: value.stagingDocument.sizeBytes,
      mediaType: 'text/markdown' as const,
      encoding: 'utf-8' as const,
      content: value.stagingDocument.content
    }
  };
  if (value.contractVersion === READY_PACKAGE_CONTENT_EXPORT_V1_1_VERSION) {
    if (!isSourceGovernanceSnapshot(value.sourceGovernance, value.provenance.sourceId)) {
      throw new TypeError('Invalid ReadyPackage Content Export V1.1 source governance');
    }
    return JSON.stringify({ ...serialized, sourceGovernance: value.sourceGovernance });
  }
  return JSON.stringify(serialized);
};
