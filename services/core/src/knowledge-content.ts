import { createHash } from 'node:crypto';
import type { CoreIntakeRequest } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';

export const READY_PACKAGE_CONTENT_EXPORT_VERSION = '1.0' as const;

export type ReadyPackageContentExportV1 = {
  contractVersion: typeof READY_PACKAGE_CONTENT_EXPORT_VERSION;
  objectType: 'READY_PACKAGE_CONTENT_EXPORT';
  readyPackageId: string;
  knowledgeWorkspaceId: string;
  readyPackageDigest: string;
  provenance: {
    sourceId: string;
    conversionRunId: string;
    verificationId: string;
    verificationOutcome: 'PASS' | 'PASS_WITH_WARNINGS';
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
};

export interface KnowledgeContentExport {
  intakeId: string;
  workspaceId: string;
  readyPackageId: string;
  readyPackageDigest: string;
  contentExport: ReadyPackageContentExportV1;
  exportSha256: string;
  receivedAt: string;
}

export interface KnowledgeContentExportRepository {
  createOrFind(
    contentExport: KnowledgeContentExport
  ): Promise<{ contentExport: KnowledgeContentExport; created: boolean }>;
  findByIntakeId(intakeId: string): Promise<KnowledgeContentExport | null>;
}

const IDS = {
  readyPackage: /^rdp_[0-9A-HJKMNP-TV-Z]{26}$/u,
  workspace: /^wsp_[0-9A-HJKMNP-TV-Z]{26}$/u,
  source: /^src_[0-9A-HJKMNP-TV-Z]{26}$/u,
  conversionRun: /^cvr_[0-9A-HJKMNP-TV-Z]{26}$/u,
  verification: /^svr_[0-9A-HJKMNP-TV-Z]{26}$/u,
  artifact: /^art_[0-9A-HJKMNP-TV-Z]{26}$/u,
  stagingDocument: /^std_[0-9A-HJKMNP-TV-Z]{26}$/u
} as const;
const SHA256 = /^[a-f0-9]{64}$/u;
const MIME_TYPE = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/iu;
const CONVERTER_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]) => {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
};
const rfc3339 = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value) &&
  !Number.isNaN(Date.parse(value));

export function parseReadyPackageContentExportV1(
  value: unknown
): ReadyPackageContentExportV1 | null {
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
    !IDS.readyPackage.test(value.readyPackageId) ||
    typeof value.knowledgeWorkspaceId !== 'string' ||
    !IDS.workspace.test(value.knowledgeWorkspaceId) ||
    typeof value.readyPackageDigest !== 'string' ||
    !SHA256.test(value.readyPackageDigest) ||
    typeof provenance.sourceId !== 'string' ||
    !IDS.source.test(provenance.sourceId) ||
    typeof provenance.conversionRunId !== 'string' ||
    !IDS.conversionRun.test(provenance.conversionRunId) ||
    typeof provenance.verificationId !== 'string' ||
    !IDS.verification.test(provenance.verificationId) ||
    (provenance.verificationOutcome !== 'PASS' &&
      provenance.verificationOutcome !== 'PASS_WITH_WARNINGS') ||
    !rfc3339(provenance.capturedAt) ||
    typeof provenance.converter.converterId !== 'string' ||
    !CONVERTER_ID.test(provenance.converter.converterId) ||
    typeof provenance.converter.version !== 'string' ||
    !SEMVER.test(provenance.converter.version) ||
    provenance.legalTruthVerified !== false ||
    typeof rawArtifact.artifactId !== 'string' ||
    !IDS.artifact.test(rawArtifact.artifactId) ||
    typeof rawArtifact.sha256 !== 'string' ||
    !SHA256.test(rawArtifact.sha256) ||
    typeof rawArtifact.sizeBytes !== 'number' ||
    !Number.isSafeInteger(rawArtifact.sizeBytes) ||
    rawArtifact.sizeBytes < 0 ||
    typeof rawArtifact.mimeType !== 'string' ||
    !MIME_TYPE.test(rawArtifact.mimeType) ||
    typeof rawArtifact.originalName !== 'string' ||
    rawArtifact.originalName.length === 0 ||
    typeof stagingDocument.documentId !== 'string' ||
    !IDS.stagingDocument.test(stagingDocument.documentId) ||
    typeof stagingDocument.sha256 !== 'string' ||
    !SHA256.test(stagingDocument.sha256) ||
    typeof stagingDocument.sizeBytes !== 'number' ||
    !Number.isSafeInteger(stagingDocument.sizeBytes) ||
    stagingDocument.sizeBytes < 0 ||
    stagingDocument.mediaType !== 'text/markdown' ||
    stagingDocument.encoding !== 'utf-8' ||
    typeof stagingDocument.content !== 'string'
  )
    return null;

  return structuredClone(value) as ReadyPackageContentExportV1;
}

export function serializeReadyPackageContentExportV1(value: ReadyPackageContentExportV1): string {
  return JSON.stringify({
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
      legalTruthVerified: false
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
      mediaType: 'text/markdown',
      encoding: 'utf-8',
      content: value.stagingDocument.content
    }
  } satisfies ReadyPackageContentExportV1);
}

export const fingerprintReadyPackageContentExportV1 = (value: ReadyPackageContentExportV1) =>
  createHash('sha256').update(serializeReadyPackageContentExportV1(value), 'utf8').digest('hex');

export function contentExportHasValidStagingBytes(value: ReadyPackageContentExportV1): boolean {
  const bytes = Buffer.from(value.stagingDocument.content, 'utf8');
  return (
    bytes.byteLength === value.stagingDocument.sizeBytes &&
    createHash('sha256').update(bytes).digest('hex') === value.stagingDocument.sha256
  );
}

export function contentExportMatchesIntake(
  value: ReadyPackageContentExportV1,
  intake: CoreIntakeRequest
): boolean {
  return (
    value.readyPackageId === intake.readyPackageId &&
    value.readyPackageDigest === intake.digest &&
    value.stagingDocument.documentId === intake.evidence.stagingDocumentId &&
    intake.evidence.artifactIds.includes(value.rawArtifact.artifactId)
  );
}

const clone = <T>(value: T): T => structuredClone(value);
export class MemoryKnowledgeContentExportRepository implements KnowledgeContentExportRepository {
  private readonly rows = new Map<string, KnowledgeContentExport>();

  async createOrFind(candidate: KnowledgeContentExport) {
    await Promise.resolve();
    const existing = this.rows.get(candidate.intakeId);
    if (existing) return { contentExport: clone(existing), created: false };
    this.rows.set(candidate.intakeId, clone(candidate));
    return { contentExport: clone(candidate), created: true };
  }

  async findByIntakeId(intakeId: string) {
    await Promise.resolve();
    const value = this.rows.get(intakeId);
    return value ? clone(value) : null;
  }

  count() {
    return this.rows.size;
  }
}

type Row = Record<string, unknown>;
const mapRow = (row: Row): KnowledgeContentExport => ({
  intakeId: row.intake_id as string,
  workspaceId: row.workspace_id as string,
  readyPackageId: row.ready_package_id as string,
  readyPackageDigest: row.ready_package_digest as string,
  contentExport: row.export_json as ReadyPackageContentExportV1,
  exportSha256: row.export_sha256 as string,
  receivedAt: (row.received_at as Date).toISOString()
});

export class PostgresKnowledgeContentExportRepository implements KnowledgeContentExportRepository {
  constructor(private readonly query: QueryClient) {}

  async createOrFind(candidate: KnowledgeContentExport) {
    const value = candidate.contentExport;
    const result = await this.query.query(
      `INSERT INTO knowledge_content_exports(
        intake_id,workspace_id,ready_package_id,ready_package_digest,contract_version,
        knowledge_workspace_id,source_id,raw_artifact_id,raw_artifact_sha256,
        staging_document_id,staging_sha256,export_sha256,export_json,received_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)
      ON CONFLICT (intake_id) DO UPDATE SET intake_id=knowledge_content_exports.intake_id
      RETURNING *, (xmax = 0) AS created`,
      [
        candidate.intakeId,
        candidate.workspaceId,
        candidate.readyPackageId,
        candidate.readyPackageDigest,
        value.contractVersion,
        value.knowledgeWorkspaceId,
        value.provenance.sourceId,
        value.rawArtifact.artifactId,
        value.rawArtifact.sha256,
        value.stagingDocument.documentId,
        value.stagingDocument.sha256,
        candidate.exportSha256,
        serializeReadyPackageContentExportV1(value),
        candidate.receivedAt
      ]
    );
    const row = result.rows[0] as Row & { created: boolean };
    return { contentExport: mapRow(row), created: row.created };
  }

  async findByIntakeId(intakeId: string) {
    const result = await this.query.query(
      'SELECT * FROM knowledge_content_exports WHERE intake_id=$1',
      [intakeId]
    );
    return result.rows[0] ? mapRow(result.rows[0] as Row) : null;
  }
}
