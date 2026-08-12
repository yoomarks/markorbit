export const READY_PACKAGE_CONTENT_EXPORT_V2_VERSION = '2.0' as const;
export const READY_PACKAGE_CONTENT_EXPORT_V2_OBJECT_TYPE = 'READY_PACKAGE_CONTENT_EXPORT' as const;
export const READY_PACKAGE_V2_DELIVERY_PROTOCOL_VERSION = '1.0' as const;
export const READY_PACKAGE_V2_DELIVERY_REQUEST_OBJECT_TYPE =
  'READY_PACKAGE_V2_DELIVERY_REQUEST' as const;
export const READY_PACKAGE_V2_DELIVERY_RESULT_OBJECT_TYPE =
  'READY_PACKAGE_V2_DELIVERY_RESULT' as const;
export const READY_PACKAGE_V2_DELIVERY_TARGET_SERVICE = 'MARKORBIT_CORE' as const;
export const READY_PACKAGE_V2_DELIVERY_STATUSES = ['RECEIVED', 'ACCEPTED', 'REJECTED'] as const;

export type ReadyPackageV2DeliveryStatus = (typeof READY_PACKAGE_V2_DELIVERY_STATUSES)[number];

export type ReadyPackageContentExportV2 = {
  contractVersion: typeof READY_PACKAGE_CONTENT_EXPORT_V2_VERSION;
  objectType: typeof READY_PACKAGE_CONTENT_EXPORT_V2_OBJECT_TYPE;
  readyPackageId: string;
  knowledgeWorkspaceId: string;
  readyPackageDigest: string;
  canonicalDocument: {
    documentId: string;
    promotedAt: string;
  };
  provenance: {
    origin: {
      kind: 'VAULT_IMPORT';
      inspectionRunId: string;
      importIntentId: string;
      importExecutionId: string;
      vaultStagingDocumentId: string;
      verificationId: string;
      verificationOutcome: 'PASS' | 'PASS_WITH_WARNINGS';
      finalizationId: string;
      rootFingerprintSha256: string;
      binding: {
        bindingId: string;
        revision: number;
        relativeRoot: string;
      };
      vaultRelativePath: string;
      bindingRelativePath: string;
      observedAt: string;
      reviewedAt: string;
      importedAt: string;
      verifiedAt: string;
    };
    legalTruthVerified: false;
  };
  content: {
    sha256: string;
    sizeBytes: number;
    contentAddressedRef: string;
    mediaType: 'text/markdown';
    encoding: 'utf-8';
    content: string;
  };
};

export type ReadyPackageV2DeliveryRequestV1 = {
  protocolVersion: typeof READY_PACKAGE_V2_DELIVERY_PROTOCOL_VERSION;
  objectType: typeof READY_PACKAGE_V2_DELIVERY_REQUEST_OBJECT_TYPE;
  deliveryId: string;
  readyPackageId: string;
  knowledgeWorkspaceId: string;
  target: {
    service: typeof READY_PACKAGE_V2_DELIVERY_TARGET_SERVICE;
    workspaceId: string;
  };
  readyPackageDigest: string;
  contentExportSha256: string;
  contentExport: ReadyPackageContentExportV2;
  submittedAt: string;
};

export type ReadyPackageV2DeliveryResultV1 = {
  protocolVersion: typeof READY_PACKAGE_V2_DELIVERY_PROTOCOL_VERSION;
  objectType: typeof READY_PACKAGE_V2_DELIVERY_RESULT_OBJECT_TYPE;
  deliveryId: string;
  readyPackageId: string;
  status: ReadyPackageV2DeliveryStatus;
  requestSha256: string;
};

const SHA256 = /^[a-f0-9]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]) => {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
};
const timestamp = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));
const prefixed = (value: unknown, prefix: string): value is string =>
  typeof value === 'string' && value.startsWith(prefix);
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

function isVaultImportOrigin(
  value: unknown
): value is ReadyPackageContentExportV2['provenance']['origin'] {
  if (!record(value) || !record(value.binding)) return false;
  if (
    !exactKeys(value, [
      'kind',
      'inspectionRunId',
      'importIntentId',
      'importExecutionId',
      'vaultStagingDocumentId',
      'verificationId',
      'verificationOutcome',
      'finalizationId',
      'rootFingerprintSha256',
      'binding',
      'vaultRelativePath',
      'bindingRelativePath',
      'observedAt',
      'reviewedAt',
      'importedAt',
      'verifiedAt'
    ]) ||
    !exactKeys(value.binding, ['bindingId', 'revision', 'relativeRoot'])
  )
    return false;
  return (
    value.kind === 'VAULT_IMPORT' &&
    prefixed(value.inspectionRunId, 'vin_') &&
    prefixed(value.importIntentId, 'vmi_') &&
    prefixed(value.importExecutionId, 'vie_') &&
    prefixed(value.vaultStagingDocumentId, 'vst_') &&
    prefixed(value.verificationId, 'vsv_') &&
    (value.verificationOutcome === 'PASS' || value.verificationOutcome === 'PASS_WITH_WARNINGS') &&
    prefixed(value.finalizationId, 'vsf_') &&
    typeof value.rootFingerprintSha256 === 'string' &&
    SHA256.test(value.rootFingerprintSha256) &&
    prefixed(value.binding.bindingId, 'vlt_') &&
    typeof value.binding.revision === 'number' &&
    Number.isSafeInteger(value.binding.revision) &&
    value.binding.revision > 0 &&
    nonEmpty(value.binding.relativeRoot) &&
    nonEmpty(value.vaultRelativePath) &&
    nonEmpty(value.bindingRelativePath) &&
    timestamp(value.observedAt) &&
    timestamp(value.reviewedAt) &&
    timestamp(value.importedAt) &&
    timestamp(value.verifiedAt)
  );
}

export function isReadyPackageContentExportV2(
  value: unknown
): value is ReadyPackageContentExportV2 {
  if (
    !record(value) ||
    !exactKeys(value, [
      'contractVersion',
      'objectType',
      'readyPackageId',
      'knowledgeWorkspaceId',
      'readyPackageDigest',
      'canonicalDocument',
      'provenance',
      'content'
    ]) ||
    !record(value.canonicalDocument) ||
    !record(value.provenance) ||
    !record(value.content) ||
    !exactKeys(value.canonicalDocument, ['documentId', 'promotedAt']) ||
    !exactKeys(value.provenance, ['origin', 'legalTruthVerified']) ||
    !exactKeys(value.content, [
      'sha256',
      'sizeBytes',
      'contentAddressedRef',
      'mediaType',
      'encoding',
      'content'
    ])
  )
    return false;
  return (
    value.contractVersion === READY_PACKAGE_CONTENT_EXPORT_V2_VERSION &&
    value.objectType === READY_PACKAGE_CONTENT_EXPORT_V2_OBJECT_TYPE &&
    prefixed(value.readyPackageId, 'rdp_') &&
    prefixed(value.knowledgeWorkspaceId, 'wsp_') &&
    typeof value.readyPackageDigest === 'string' &&
    SHA256.test(value.readyPackageDigest) &&
    prefixed(value.canonicalDocument.documentId, 'cdd_') &&
    timestamp(value.canonicalDocument.promotedAt) &&
    isVaultImportOrigin(value.provenance.origin) &&
    value.provenance.legalTruthVerified === false &&
    typeof value.content.sha256 === 'string' &&
    SHA256.test(value.content.sha256) &&
    typeof value.content.sizeBytes === 'number' &&
    Number.isSafeInteger(value.content.sizeBytes) &&
    value.content.sizeBytes >= 0 &&
    value.content.contentAddressedRef === `cas:sha256:${value.content.sha256}` &&
    value.content.mediaType === 'text/markdown' &&
    value.content.encoding === 'utf-8' &&
    typeof value.content.content === 'string'
  );
}

export function assertReadyPackageContentExportV2(
  value: unknown
): asserts value is ReadyPackageContentExportV2 {
  if (!isReadyPackageContentExportV2(value))
    throw new TypeError('Invalid ReadyPackageContentExportV2');
}

export function serializeReadyPackageContentExportV2(value: ReadyPackageContentExportV2): string {
  assertReadyPackageContentExportV2(value);
  return JSON.stringify({
    contractVersion: value.contractVersion,
    objectType: value.objectType,
    readyPackageId: value.readyPackageId,
    knowledgeWorkspaceId: value.knowledgeWorkspaceId,
    readyPackageDigest: value.readyPackageDigest,
    canonicalDocument: {
      documentId: value.canonicalDocument.documentId,
      promotedAt: value.canonicalDocument.promotedAt
    },
    provenance: {
      origin: {
        kind: value.provenance.origin.kind,
        inspectionRunId: value.provenance.origin.inspectionRunId,
        importIntentId: value.provenance.origin.importIntentId,
        importExecutionId: value.provenance.origin.importExecutionId,
        vaultStagingDocumentId: value.provenance.origin.vaultStagingDocumentId,
        verificationId: value.provenance.origin.verificationId,
        verificationOutcome: value.provenance.origin.verificationOutcome,
        finalizationId: value.provenance.origin.finalizationId,
        rootFingerprintSha256: value.provenance.origin.rootFingerprintSha256,
        binding: {
          bindingId: value.provenance.origin.binding.bindingId,
          revision: value.provenance.origin.binding.revision,
          relativeRoot: value.provenance.origin.binding.relativeRoot
        },
        vaultRelativePath: value.provenance.origin.vaultRelativePath,
        bindingRelativePath: value.provenance.origin.bindingRelativePath,
        observedAt: value.provenance.origin.observedAt,
        reviewedAt: value.provenance.origin.reviewedAt,
        importedAt: value.provenance.origin.importedAt,
        verifiedAt: value.provenance.origin.verifiedAt
      },
      legalTruthVerified: false
    },
    content: {
      sha256: value.content.sha256,
      sizeBytes: value.content.sizeBytes,
      contentAddressedRef: value.content.contentAddressedRef,
      mediaType: 'text/markdown',
      encoding: 'utf-8',
      content: value.content.content
    }
  } satisfies ReadyPackageContentExportV2);
}

export function isReadyPackageV2DeliveryRequestV1(
  value: unknown
): value is ReadyPackageV2DeliveryRequestV1 {
  if (
    !record(value) ||
    !exactKeys(value, [
      'protocolVersion',
      'objectType',
      'deliveryId',
      'readyPackageId',
      'knowledgeWorkspaceId',
      'target',
      'readyPackageDigest',
      'contentExportSha256',
      'contentExport',
      'submittedAt'
    ]) ||
    !record(value.target) ||
    !exactKeys(value.target, ['service', 'workspaceId'])
  )
    return false;
  return (
    value.protocolVersion === READY_PACKAGE_V2_DELIVERY_PROTOCOL_VERSION &&
    value.objectType === READY_PACKAGE_V2_DELIVERY_REQUEST_OBJECT_TYPE &&
    prefixed(value.deliveryId, 'rvd_') &&
    prefixed(value.readyPackageId, 'rdp_') &&
    prefixed(value.knowledgeWorkspaceId, 'wsp_') &&
    value.target.service === READY_PACKAGE_V2_DELIVERY_TARGET_SERVICE &&
    typeof value.target.workspaceId === 'string' &&
    UUID.test(value.target.workspaceId) &&
    typeof value.readyPackageDigest === 'string' &&
    SHA256.test(value.readyPackageDigest) &&
    typeof value.contentExportSha256 === 'string' &&
    SHA256.test(value.contentExportSha256) &&
    isReadyPackageContentExportV2(value.contentExport) &&
    value.contentExport.readyPackageId === value.readyPackageId &&
    value.contentExport.knowledgeWorkspaceId === value.knowledgeWorkspaceId &&
    value.contentExport.readyPackageDigest === value.readyPackageDigest &&
    timestamp(value.submittedAt)
  );
}

export function assertReadyPackageV2DeliveryRequestV1(
  value: unknown
): asserts value is ReadyPackageV2DeliveryRequestV1 {
  if (!isReadyPackageV2DeliveryRequestV1(value))
    throw new TypeError('Invalid ReadyPackageV2DeliveryRequestV1');
}

export function serializeReadyPackageV2DeliveryRequestV1(
  value: ReadyPackageV2DeliveryRequestV1
): string {
  assertReadyPackageV2DeliveryRequestV1(value);
  return JSON.stringify({
    protocolVersion: value.protocolVersion,
    objectType: value.objectType,
    deliveryId: value.deliveryId,
    readyPackageId: value.readyPackageId,
    knowledgeWorkspaceId: value.knowledgeWorkspaceId,
    target: {
      service: value.target.service,
      workspaceId: value.target.workspaceId.toLowerCase()
    },
    readyPackageDigest: value.readyPackageDigest,
    contentExportSha256: value.contentExportSha256,
    contentExport: value.contentExport,
    submittedAt: value.submittedAt
  } satisfies ReadyPackageV2DeliveryRequestV1);
}

export function isReadyPackageV2DeliveryResultV1(
  value: unknown
): value is ReadyPackageV2DeliveryResultV1 {
  if (
    !record(value) ||
    !exactKeys(value, [
      'protocolVersion',
      'objectType',
      'deliveryId',
      'readyPackageId',
      'status',
      'requestSha256'
    ])
  )
    return false;
  return (
    value.protocolVersion === READY_PACKAGE_V2_DELIVERY_PROTOCOL_VERSION &&
    value.objectType === READY_PACKAGE_V2_DELIVERY_RESULT_OBJECT_TYPE &&
    prefixed(value.deliveryId, 'rvd_') &&
    prefixed(value.readyPackageId, 'rdp_') &&
    typeof value.status === 'string' &&
    READY_PACKAGE_V2_DELIVERY_STATUSES.includes(value.status as ReadyPackageV2DeliveryStatus) &&
    typeof value.requestSha256 === 'string' &&
    SHA256.test(value.requestSha256)
  );
}

export function assertReadyPackageV2DeliveryResultV1(
  value: unknown
): asserts value is ReadyPackageV2DeliveryResultV1 {
  if (!isReadyPackageV2DeliveryResultV1(value))
    throw new TypeError('Invalid ReadyPackageV2DeliveryResultV1');
}
