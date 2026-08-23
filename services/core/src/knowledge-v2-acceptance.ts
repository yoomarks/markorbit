import { createHash } from 'node:crypto';
import {
  isReadyPackageV2DeliveryRequestV1,
  serializeReadyPackageContentExportV2,
  type ReadyPackageContentExportV2,
  type ReadyPackageV2DeliveryRequestV1
} from '@markorbit/contracts';

const SHA256 = /^[a-f0-9]{64}$/u;
const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

export const CORE_KNOWLEDGE_V2_ACCEPTANCE_EVIDENCE_VERSION =
  'CORE_KNOWLEDGE_V2_ACCEPTANCE_V1' as const;

export interface KnowledgeV2AcceptanceEvidence {
  evidenceVersion: typeof CORE_KNOWLEDGE_V2_ACCEPTANCE_EVIDENCE_VERSION;
  protocolVersion: '1.0';
  contentExportContractVersion: '2.0';
  targetWorkspaceId: string;
  readyPackageId: string;
  knowledgeWorkspaceId: string;
  readyPackageDigest: string;
  requestSha256: string;
  contentExportSha256: string;
  content: {
    sha256: string;
    sizeBytes: number;
    contentAddressedRef: string;
    mediaType: 'text/markdown';
    encoding: 'utf-8';
  };
  canonicalDocument: ReadyPackageContentExportV2['canonicalDocument'];
  provenance: ReadyPackageContentExportV2['provenance'];
}

export interface KnowledgeV2AcceptanceInput {
  deliveryId: string;
  idempotencyKey: string;
  targetWorkspaceId: string;
  knowledgeWorkspaceId: string;
  readyPackageId: string;
  readyPackageDigest: string;
  contentExportSha256: string;
  requestSha256: string;
  request: ReadyPackageV2DeliveryRequestV1;
}

function fail(message: string): never {
  throw new Error(`Knowledge V2 durable acceptance invariant failed: ${message}`);
}

export function buildKnowledgeV2AcceptanceEvidence(
  input: KnowledgeV2AcceptanceInput
): KnowledgeV2AcceptanceEvidence {
  const request = input.request;
  if (!isReadyPackageV2DeliveryRequestV1(request)) fail('stored request is not frozen V1.');
  if (input.deliveryId !== request.deliveryId) fail('delivery identity differs from stored request.');
  if (input.idempotencyKey !== `ready-package-v2-delivery:${request.deliveryId}`)
    fail('idempotency identity differs from frozen request.');
  if (input.targetWorkspaceId.toLowerCase() !== request.target.workspaceId.toLowerCase())
    fail('target Workspace differs from frozen request.');
  if (input.knowledgeWorkspaceId !== request.knowledgeWorkspaceId)
    fail('Knowledge Workspace differs from frozen request.');
  if (input.readyPackageId !== request.readyPackageId)
    fail('ReadyPackage identity differs from frozen request.');
  if (input.readyPackageDigest !== request.readyPackageDigest)
    fail('ReadyPackage digest differs from frozen request.');
  if (input.contentExportSha256 !== request.contentExportSha256)
    fail('Content Export digest differs from frozen request.');
  if (!SHA256.test(input.requestSha256)) fail('exact request SHA-256 is invalid.');

  const canonicalExportSha256 = sha256(serializeReadyPackageContentExportV2(request.contentExport));
  if (canonicalExportSha256 !== request.contentExportSha256)
    fail('canonical Content Export V2 digest does not match.');

  const contentBytes = Buffer.from(request.contentExport.content.content, 'utf8');
  if (contentBytes.byteLength !== request.contentExport.content.sizeBytes)
    fail('Markdown byte size does not match.');
  if (sha256(contentBytes) !== request.contentExport.content.sha256)
    fail('Markdown SHA-256 does not match.');

  return {
    evidenceVersion: CORE_KNOWLEDGE_V2_ACCEPTANCE_EVIDENCE_VERSION,
    protocolVersion: request.protocolVersion,
    contentExportContractVersion: request.contentExport.contractVersion,
    targetWorkspaceId: request.target.workspaceId.toLowerCase(),
    readyPackageId: request.readyPackageId,
    knowledgeWorkspaceId: request.knowledgeWorkspaceId,
    readyPackageDigest: request.readyPackageDigest,
    requestSha256: input.requestSha256,
    contentExportSha256: request.contentExportSha256,
    content: {
      sha256: request.contentExport.content.sha256,
      sizeBytes: request.contentExport.content.sizeBytes,
      contentAddressedRef: request.contentExport.content.contentAddressedRef,
      mediaType: request.contentExport.content.mediaType,
      encoding: request.contentExport.content.encoding
    },
    canonicalDocument: structuredClone(request.contentExport.canonicalDocument),
    provenance: structuredClone(request.contentExport.provenance)
  };
}
