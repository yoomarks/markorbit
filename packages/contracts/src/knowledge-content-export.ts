export const READY_PACKAGE_CONTENT_EXPORT_VERSION = '1.0' as const;

export type ReadyPackageContentExportVerificationOutcome = 'PASS' | 'PASS_WITH_WARNINGS';

export interface ReadyPackageContentExportV1 {
  contractVersion: typeof READY_PACKAGE_CONTENT_EXPORT_VERSION;
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

export function parseReadyPackageContentExportV1(value: unknown): ReadyPackageContentExportV1 | null {
  if (
    !record(value) ||
    !exactKeys(value, [
      'contractVersion',
      'objectType',
      'readyPackageId',
      'knowledgeWorkspaceId',
      'readyPackageDigest',
      'provenance',
      'rawArtifact',
      'stagingDocument'
    ]) ||
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
    value.contractVersion !== READY_PACKAGE_CONTENT_EXPORT_VERSION ||
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
    typeof stagingDocument.content !== 'string'
  )
    return null;

  return structuredClone(value) as ReadyPackageContentExportV1;
}

export const serializeReadyPackageContentExportV1 = (value: ReadyPackageContentExportV1) =>
  JSON.stringify(value);
