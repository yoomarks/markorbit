import type { CoreKnowledgeDailySourceProjection } from '@markorbit/contracts/daily-source';
import type { KnowledgeReadyPackageContentRepository } from './knowledge-content.js';
import type { KnowledgeIntakeRepository } from './knowledge-intake.js';

export async function resolveAcceptedKnowledgeDailySource(
  knowledgeIntakes: KnowledgeIntakeRepository,
  knowledgeContents: KnowledgeReadyPackageContentRepository,
  workspaceId: string,
  readyPackageId: string
): Promise<CoreKnowledgeDailySourceProjection | null> {
  const intake = await knowledgeIntakes.findAcceptedByReadyPackage(workspaceId, readyPackageId);
  if (!intake) return null;
  const content = await knowledgeContents.findByReadyPackage(workspaceId, readyPackageId);
  if (!content || content.intakeId !== intake.intakeId) return null;
  return {
    schemaVersion: 1,
    readyPackageId,
    source: {
      schemaVersion: 1,
      owner: 'CORE',
      kind: 'KNOWLEDGE_READY_PACKAGE',
      sourceId: readyPackageId,
      sourceVersion: 'CORE_CONTENT_V1',
      sourceFingerprintSha256: content.exportSha256,
      observedAt: content.consumedAt
    },
    content: {
      mediaType: 'text/markdown',
      encoding: 'utf-8',
      sha256: content.export.stagingDocument.sha256,
      content: content.export.stagingDocument.content,
      originalName: content.export.rawArtifact.originalName,
      capturedAt: content.export.provenance.capturedAt,
      legalTruthVerified: false
    }
  };
}
