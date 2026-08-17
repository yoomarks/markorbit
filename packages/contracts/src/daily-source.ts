import type { ProductLoopSourceReference } from './product-loop.js';

export interface CoreKnowledgeDailySourceProjection {
  schemaVersion: 1;
  readyPackageId: string;
  source: Readonly<ProductLoopSourceReference>;
  content: Readonly<{
    mediaType: 'text/markdown';
    encoding: 'utf-8';
    sha256: string;
    content: string;
    originalName: string;
    capturedAt: string;
    legalTruthVerified: false;
  }>;
}

const SHA256 = /^[0-9a-f]{64}$/u;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseCoreKnowledgeDailySourceProjection(
  value: unknown
): CoreKnowledgeDailySourceProjection | null {
  if (!record(value) || !record(value.source) || !record(value.content)) return null;
  const source = value.source;
  const content = value.content;
  if (
    value.schemaVersion !== 1 ||
    typeof value.readyPackageId !== 'string' ||
    !value.readyPackageId.trim() ||
    source.schemaVersion !== 1 ||
    source.owner !== 'CORE' ||
    source.kind !== 'KNOWLEDGE_READY_PACKAGE' ||
    source.sourceId !== value.readyPackageId ||
    !(
      (typeof source.sourceVersion === 'number' &&
        Number.isInteger(source.sourceVersion) &&
        source.sourceVersion > 0) ||
      (typeof source.sourceVersion === 'string' && source.sourceVersion.trim())
    ) ||
    typeof source.sourceFingerprintSha256 !== 'string' ||
    !SHA256.test(source.sourceFingerprintSha256) ||
    typeof source.observedAt !== 'string' ||
    Number.isNaN(Date.parse(source.observedAt)) ||
    content.mediaType !== 'text/markdown' ||
    content.encoding !== 'utf-8' ||
    typeof content.sha256 !== 'string' ||
    !SHA256.test(content.sha256) ||
    typeof content.content !== 'string' ||
    typeof content.originalName !== 'string' ||
    !content.originalName.trim() ||
    typeof content.capturedAt !== 'string' ||
    Number.isNaN(Date.parse(content.capturedAt)) ||
    content.legalTruthVerified !== false
  )
    return null;
  return structuredClone(value) as unknown as CoreKnowledgeDailySourceProjection;
}
