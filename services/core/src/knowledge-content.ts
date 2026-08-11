import { createHash } from 'node:crypto';
import type { ReadyPackageContentExportV1 } from '@markorbit/contracts/knowledge-content-export';
import { serializeReadyPackageContentExportV1 } from '@markorbit/contracts/knowledge-content-export';
import type { QueryClient } from '@markorbit/persistence';
import type { KnowledgeIntake } from './knowledge-intake.js';

export interface KnowledgeReadyPackageContent {
  intakeId: string;
  workspaceId: string;
  readyPackageId: string;
  export: ReadyPackageContentExportV1;
  exportSha256: string;
  consumedAt: string;
}

export interface KnowledgeReadyPackageContentRepository {
  createOrFind(
    content: KnowledgeReadyPackageContent
  ): Promise<{ content: KnowledgeReadyPackageContent; created: boolean }>;
}

const clone = <T>(value: T): T => structuredClone(value);

export class MemoryKnowledgeReadyPackageContentRepository
  implements KnowledgeReadyPackageContentRepository
{
  private readonly rows = new Map<string, KnowledgeReadyPackageContent>();

  async createOrFind(candidate: KnowledgeReadyPackageContent) {
    await Promise.resolve();
    const existing = this.rows.get(candidate.intakeId);
    if (existing) return { content: clone(existing), created: false };
    this.rows.set(candidate.intakeId, clone(candidate));
    return { content: clone(candidate), created: true };
  }

  count() {
    return this.rows.size;
  }
}

function stable(value: unknown): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const sha256 = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex');

export function fingerprintReadyPackageContentExport(value: ReadyPackageContentExportV1): string {
  return sha256(serializeReadyPackageContentExportV1(value));
}

export type KnowledgeContentValidationIssue = {
  code:
    | 'KNOWLEDGE_CONTENT_INTAKE_MISMATCH'
    | 'KNOWLEDGE_CONTENT_STAGING_INTEGRITY_MISMATCH'
    | 'KNOWLEDGE_CONTENT_READY_PACKAGE_DIGEST_MISMATCH';
  message: string;
};

export function validateReadyPackageContentExport(
  intake: KnowledgeIntake,
  value: ReadyPackageContentExportV1
): KnowledgeContentValidationIssue | null {
  if (
    intake.request.readyPackageId !== value.readyPackageId ||
    intake.request.digest !== value.readyPackageDigest ||
    intake.request.evidence.stagingDocumentId !== value.stagingDocument.documentId ||
    intake.request.evidence.artifactIds.length !== 1 ||
    intake.request.evidence.artifactIds[0] !== value.rawArtifact.artifactId
  ) {
    return {
      code: 'KNOWLEDGE_CONTENT_INTAKE_MISMATCH',
      message: 'ReadyPackage content export does not match the frozen Core intake evidence.'
    };
  }

  const stagingBytes = Buffer.from(value.stagingDocument.content, 'utf8');
  if (
    stagingBytes.byteLength !== value.stagingDocument.sizeBytes ||
    sha256(stagingBytes) !== value.stagingDocument.sha256
  ) {
    return {
      code: 'KNOWLEDGE_CONTENT_STAGING_INTEGRITY_MISMATCH',
      message: 'Canonical staging content does not match its declared hash and size.'
    };
  }

  const evidenceDigest = sha256(
    stable({
      artifactIds: [value.rawArtifact.artifactId],
      stagingDocumentId: value.stagingDocument.documentId,
      sourceId: value.provenance.sourceId,
      conversionRunId: value.provenance.conversionRunId,
      rawArtifactSha256: value.rawArtifact.sha256,
      stagingSha256: value.stagingDocument.sha256,
      verificationId: value.provenance.verificationId,
      verificationOutcome: value.provenance.verificationOutcome,
      converter: value.provenance.converter,
      capturedAt: value.provenance.capturedAt,
      legalTruthVerified: false
    })
  );
  if (evidenceDigest !== value.readyPackageDigest) {
    return {
      code: 'KNOWLEDGE_CONTENT_READY_PACKAGE_DIGEST_MISMATCH',
      message: 'ReadyPackage content export does not match its declared ReadyPackage digest.'
    };
  }
  return null;
}

type Row = Record<string, unknown>;
const mapRow = (row: Row): KnowledgeReadyPackageContent => ({
  intakeId: row.intake_id as string,
  workspaceId: row.workspace_id as string,
  readyPackageId: row.ready_package_id as string,
  export: row.export_json as ReadyPackageContentExportV1,
  exportSha256: row.export_sha256 as string,
  consumedAt: (row.consumed_at as Date).toISOString()
});

export class PostgresKnowledgeReadyPackageContentRepository
  implements KnowledgeReadyPackageContentRepository
{
  constructor(private readonly query: QueryClient) {}

  async createOrFind(candidate: KnowledgeReadyPackageContent) {
    const result = await this.query.query(
      `INSERT INTO knowledge_intake_contents(
        intake_id,workspace_id,ready_package_id,knowledge_workspace_id,ready_package_digest,
        raw_artifact_id,raw_artifact_sha256,staging_document_id,staging_sha256,
        staging_markdown,export_sha256,export_json,consumed_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
      ON CONFLICT (intake_id) DO UPDATE
        SET intake_id=knowledge_intake_contents.intake_id
      RETURNING *, (xmax = 0) AS created`,
      [
        candidate.intakeId,
        candidate.workspaceId,
        candidate.readyPackageId,
        candidate.export.knowledgeWorkspaceId,
        candidate.export.readyPackageDigest,
        candidate.export.rawArtifact.artifactId,
        candidate.export.rawArtifact.sha256,
        candidate.export.stagingDocument.documentId,
        candidate.export.stagingDocument.sha256,
        candidate.export.stagingDocument.content,
        candidate.exportSha256,
        serializeReadyPackageContentExportV1(candidate.export),
        candidate.consumedAt
      ]
    );
    const row = result.rows[0] as Row & { created: boolean };
    return { content: mapRow(row), created: row.created };
  }
}
