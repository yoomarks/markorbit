import type { KnowledgeReadyPackageContentRepository } from './knowledge-content.js';
import type { KnowledgeIntakeRepository } from './knowledge-intake.js';

export async function resolveAcceptedKnowledgeDailySource(
  knowledgeIntakes: KnowledgeIntakeRepository,
  knowledgeContents: KnowledgeReadyPackageContentRepository,
  workspaceId: string,
  readyPackageId: string
) {
  const intake = await knowledgeIntakes.findAcceptedByReadyPackage(workspaceId, readyPackageId);
  if (!intake) return null;
  const content = await knowledgeContents.findByReadyPackage(workspaceId, readyPackageId);
  if (!content || content.intakeId !== intake.intakeId) return null;
  return {
    schemaVersion: 1 as const,
    readyPackageId,
    source: {
      schemaVersion: 1 as const,
      owner: 'CORE' as const,
      kind: 'KNOWLEDGE_READY_PACKAGE' as const,
      sourceId: readyPackageId,
      sourceVersion: 'CORE_CONTENT_V1' as const,
      sourceFingerprintSha256: content.exportSha256,
      observedAt: content.consumedAt
    },
    content: {
      mediaType: 'text/markdown' as const,
      encoding: 'utf-8' as const,
      sha256: content.export.stagingDocument.sha256,
      content: content.export.stagingDocument.content,
      originalName: content.export.rawArtifact.originalName,
      capturedAt: content.export.provenance.capturedAt,
      legalTruthVerified: false as const
    }
  };
}
