import type { DurableDocumentPackageView, DurablePreparationLockView } from '@markorbit/contracts';
import { PackageHttpError, type DocumentPackageClient } from '../api/document-package.js';
import { PreparationLockHttpError, type PreparationLockClient } from '../api/preparation-lock.js';
import { readyPackageFixture } from '../documents-instructions-preview/fixtures.js';

export type PreparationLockPreviewScenario =
  | 'ready'
  | 'loading'
  | 'partial'
  | 'unauthorized'
  | 'permission'
  | 'missing'
  | 'conflict'
  | 'validation'
  | 'unavailable'
  | 'error'
  | 'locked'
  | 'stale';

export const previewPackage = structuredClone(readyPackageFixture);
export const previewWorkspaceId = previewPackage.workspaceId;
export const previewPackageId = previewPackage.documentPackageId;

export const previewLock: DurablePreparationLockView = {
  schemaVersion: 1,
  preparationLockId: 'preparation-lock_fixture-1478',
  workspaceId: previewWorkspaceId,
  version: 1,
  source: {
    documentPackageId: previewPackage.documentPackageId,
    documentPackageVersion: previewPackage.version,
    canonicalEvidenceHash: previewPackage.canonicalEvidenceHash!,
    formalMatterId: previewPackage.formalMatterId,
    formalMatterVersion: previewPackage.sourceFormalMatterVersion,
    formalMatterHash: previewPackage.sourceFormalMatterHash,
    professionalReviewCaseId: previewPackage.professionalReviewCaseId,
    reviewVersion: previewPackage.sourceReviewVersion,
    completedDecisionId: previewPackage.sourceCompletedDecisionId,
    completedDecisionHash: previewPackage.sourceCompletedDecisionHash,
    instructionEntryCount: previewPackage.instructionEntries.length,
    instructionEntries: previewPackage.instructionEntries.map((entry) => ({
      instructionEntryId: String(entry.instructionEntryId),
      sequence: Number(entry.sequence),
      canonicalFingerprint:
        typeof entry.canonicalFingerprint === 'string' ? entry.canonicalFingerprint : '4'.repeat(64)
    })),
    instructionSetHash: '5'.repeat(64)
  },
  lockPayloadHash: '6'.repeat(64),
  createdBy: 'user_fixture-preparation-1478',
  createdAt: '2026-10-04T09:12:00.000Z',
  authority: {
    filingAuthorizationCreated: false,
    executionReleaseCreated: false,
    externalFilingCreated: false,
    paymentCreated: false,
    providerContacted: false,
    officialTruthCreated: false
  }
};

const packageFailure = (status: number, code: string, message: string) =>
  Promise.reject(new PackageHttpError(status, code, message));
const lockFailure = (status: number, code: string, message: string) =>
  Promise.reject(new PreparationLockHttpError(status, code, message));

const readonlyPackageClient = (value: DurableDocumentPackageView): DocumentPackageClient => {
  const unsupported = () => Promise.reject(new Error('The ready Package is immutable.'));
  return {
    create: unsupported,
    get: () => Promise.resolve(structuredClone(value)),
    save: unsupported,
    evidence: unsupported,
    append: unsupported,
    supersede: unsupported,
    ready: unsupported
  };
};

export function packageClientForScenario(
  scenario: PreparationLockPreviewScenario
): DocumentPackageClient {
  const partial = structuredClone(previewPackage);
  delete partial.readyAt;
  delete partial.readyBy;
  const client = readonlyPackageClient(scenario === 'partial' ? partial : previewPackage);
  if (scenario === 'loading')
    return { ...client, get: () => new Promise<DurableDocumentPackageView>(() => undefined) };
  if (scenario === 'unauthorized')
    return {
      ...client,
      get: () =>
        packageFailure(401, 'SESSION_REQUIRED', 'Sign in before reviewing the exact Package.')
    };
  if (scenario === 'missing')
    return {
      ...client,
      get: () =>
        packageFailure(404, 'DOCUMENT_PACKAGE_NOT_FOUND', 'The exact Package was not found.')
    };
  if (scenario === 'unavailable')
    return {
      ...client,
      get: () =>
        packageFailure(503, 'PACKAGE_SERVICE_UNAVAILABLE', 'Package owner truth is unavailable.')
    };
  if (scenario === 'error')
    return {
      ...client,
      get: () =>
        packageFailure(500, 'PACKAGE_REQUEST_FAILED', 'The preparation source could not be loaded.')
    };
  return client;
}

export function lockClientForScenario(
  scenario: PreparationLockPreviewScenario
): PreparationLockClient {
  const create = () => Promise.resolve(structuredClone(previewLock));
  return {
    create:
      scenario === 'permission'
        ? () => lockFailure(403, 'PERMISSION_DENIED', 'Preparation Lock permission is required.')
        : scenario === 'conflict'
          ? () =>
              lockFailure(
                409,
                'STALE_PREPARATION_SOURCE',
                'The exact Package version or evidence hash changed. Reload before locking.'
              )
          : scenario === 'validation'
            ? () =>
                lockFailure(
                  422,
                  'DOCUMENT_PACKAGE_INCOMPLETE',
                  'The Package is not complete enough to lock.'
                )
            : create,
    get: () => Promise.resolve(structuredClone(previewLock)),
    validateCurrent:
      scenario === 'stale'
        ? () =>
            lockFailure(
              409,
              'STALE_PREPARATION_SOURCE',
              'The source changed while MarkReg revalidated the lock.'
            )
        : () => Promise.resolve(structuredClone(previewLock))
  };
}
