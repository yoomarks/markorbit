import { createHash } from 'node:crypto';
import {
  READY_PACKAGE_V2_DELIVERY_PROTOCOL_VERSION,
  READY_PACKAGE_V2_DELIVERY_RESULT_OBJECT_TYPE,
  isReadyPackageV2DeliveryRequestV1,
  serializeReadyPackageContentExportV2,
  type ReadyPackageV2DeliveryRequestV1,
  type ReadyPackageV2DeliveryResultV1,
  type ReadyPackageV2DeliveryStatus
} from '@markorbit/contracts';

const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

export const READY_PACKAGE_V2_PROTOCOL_HEADER = 'x-markorbit-ready-package-v2-delivery-protocol';

export function parseReadyPackageV2DeliveryRequest(
  value: unknown
): ReadyPackageV2DeliveryRequestV1 | null {
  return isReadyPackageV2DeliveryRequestV1(value) ? value : null;
}

export function fingerprintExactReadyPackageV2Request(rawBody: Uint8Array): string {
  return sha256(rawBody);
}

export function expectedReadyPackageV2IdempotencyKey(deliveryId: string): string {
  return `ready-package-v2-delivery:${deliveryId}`;
}

export type ReadyPackageV2IntegrityIssue = {
  code:
    | 'KNOWLEDGE_V2_CONTENT_EXPORT_DIGEST_MISMATCH'
    | 'KNOWLEDGE_V2_CONTENT_DIGEST_MISMATCH'
    | 'KNOWLEDGE_V2_CONTENT_SIZE_MISMATCH';
  message: string;
};

export function validateReadyPackageV2DeliveryIntegrity(
  request: ReadyPackageV2DeliveryRequestV1
): ReadyPackageV2IntegrityIssue | null {
  const exportSha256 = sha256(serializeReadyPackageContentExportV2(request.contentExport));
  if (exportSha256 !== request.contentExportSha256) {
    return {
      code: 'KNOWLEDGE_V2_CONTENT_EXPORT_DIGEST_MISMATCH',
      message: 'Content Export V2 does not match its frozen SHA-256.'
    };
  }
  const contentBytes = Buffer.from(request.contentExport.content.content, 'utf8');
  if (contentBytes.byteLength !== request.contentExport.content.sizeBytes) {
    return {
      code: 'KNOWLEDGE_V2_CONTENT_SIZE_MISMATCH',
      message: 'Content Export V2 Markdown does not match its declared byte size.'
    };
  }
  if (sha256(contentBytes) !== request.contentExport.content.sha256) {
    return {
      code: 'KNOWLEDGE_V2_CONTENT_DIGEST_MISMATCH',
      message: 'Content Export V2 Markdown does not match its declared SHA-256.'
    };
  }
  return null;
}

export function readyPackageV2DeliveryResult(
  request: ReadyPackageV2DeliveryRequestV1,
  requestSha256: string,
  status: ReadyPackageV2DeliveryStatus = 'RECEIVED'
): ReadyPackageV2DeliveryResultV1 {
  return {
    protocolVersion: READY_PACKAGE_V2_DELIVERY_PROTOCOL_VERSION,
    objectType: READY_PACKAGE_V2_DELIVERY_RESULT_OBJECT_TYPE,
    deliveryId: request.deliveryId,
    readyPackageId: request.readyPackageId,
    status,
    requestSha256
  };
}
