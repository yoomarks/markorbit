import type { DurableDocumentPackageView, ProfessionalReviewCase } from '@markorbit/contracts';
import { Alert, Button, Card, LoadingState, TextInput } from '@markorbit/ui';
import { useEffect, useMemo, useState } from 'react';
import {
  createDurableDocumentPackageClient,
  type DurableDocumentPackageClient
} from './api/durable-document-package.js';
import {
  createDurablePreparationClient,
  type DurablePreparationClient,
  type DurablePreparationLockView
} from './api/durable-preparation.js';
import { MarkregApiError } from './api/errors.js';

const defaultPackageClient = createDurableDocumentPackageClient();
const defaultPreparationClient = createDurablePreparationClient();

const pointerKey = (reviewCaseId: string) => `markreg-durable-document-package:${reviewCaseId}`;
const lockPointerKey = (packageId: string) => `markreg-durable-preparation-lock:${packageId}`;

function itemRequirementKey(item: Readonly<Record<string, unknown>>): string {
  return typeof item.requirementKey === 'string' ? item.requirementKey : '';
}

function itemVerification(item: Readonly<Record<string, unknown>>): string {
  return typeof item.verificationStatus === 'string' ? item.verificationStatus : 'UNKNOWN';
}

function itemDisplayName(item: Readonly<Record<string, unknown>>): string {
  if (typeof item.displayName === 'string') return item.displayName;
  if (typeof item.documentType === 'string') return item.documentType;
  return 'Recorded evidence';
}

function errorCopy(error: unknown): string {
  if (error instanceof MarkregApiError) {
    if (error.kind === 'conflict')
      return 'The durable source changed. Reload the exact owner record.';
    if (error.kind === 'validation') return error.message;
    if (error.code?.includes('PERMISSION')) return 'Workspace permission is required.';
  }
  return error instanceof Error ? error.message : 'The durable preparation service is unavailable.';
}

export function DurableDocumentsPreparationWorkspace({
  review,
  packageClient = defaultPackageClient,
  preparationClient = defaultPreparationClient
}: {
  review: ProfessionalReviewCase;
  packageClient?: DurableDocumentPackageClient;
  preparationClient?: DurablePreparationClient;
}) {
  const [pkg, setPackage] = useState<DurableDocumentPackageView>();
  const [lock, setLock] = useState<DurablePreparationLockView>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRequirement, setSelectedRequirement] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [checksum, setChecksum] = useState('');
  const [storageReference, setStorageReference] = useState('');
  const reviewRecord = review as unknown as Record<string, unknown>;
  const exactReviewDecisionVersion =
    review.decision?.decidedAt ??
    (typeof reviewRecord.updatedAt === 'string' ? reviewRecord.updatedAt : undefined);

  const blockingMissing = useMemo(
    () =>
      pkg?.requirements.filter(
        (requirement) =>
          requirement.blocking &&
          !pkg.documentItems.some(
            (item) =>
              itemRequirementKey(item) === requirement.requirementKey &&
              ['RECORDED', 'VERIFIED'].includes(itemVerification(item))
          )
      ) ?? [],
    [pkg]
  );

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    const id = sessionStorage.getItem(pointerKey(review.reviewCaseId));
    if (!id) return;
    setLoading(true);
    void packageClient
      .get(id)
      .then(async (value) => {
        setPackage(value);
        if (value.status !== 'READY_FOR_PREPARATION_LOCK') return;
        const lockId = sessionStorage.getItem(lockPointerKey(value.documentPackageId));
        if (!lockId) return;
        setLock(await preparationClient.validateCurrent(lockId));
      })
      .catch((cause: unknown) => setError(errorCopy(cause)))
      .finally(() => setLoading(false));
  }, [packageClient, preparationClient, review.reviewCaseId]);

  const createPackage = async () => {
    setLoading(true);
    setError('');
    try {
      const created = await packageClient.createFromCompletedReview(
        review,
        `document-package-${review.reviewCaseId}-${review.version ?? 1}`
      );
      if (typeof sessionStorage !== 'undefined')
        sessionStorage.setItem(pointerKey(review.reviewCaseId), created.documentPackageId);
      setPackage(await packageClient.get(created.documentPackageId));
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setLoading(false);
    }
  };

  const recordEvidence = async () => {
    if (!pkg || !selectedRequirement || !displayName || !/^[a-f0-9]{64}$/i.test(checksum)) return;
    setLoading(true);
    setError('');
    try {
      const next = await packageClient.upsertEvidence(
        pkg.documentPackageId,
        pkg.version,
        {
          requirementKey: selectedRequirement,
          documentType: selectedRequirement,
          displayName,
          evidenceType: storageReference ? 'EXTERNAL_REFERENCE' : 'FILE_REFERENCE',
          checksum: checksum.toLowerCase(),
          ...(storageReference ? { storageReference } : {}),
          verificationStatus: 'RECORDED'
        },
        `document-evidence-${pkg.documentPackageId}-${pkg.version}-${selectedRequirement}`
      );
      setPackage(next);
      setDisplayName('');
      setChecksum('');
      setStorageReference('');
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setLoading(false);
    }
  };

  const addInstruction = async () => {
    if (!pkg) return;
    setLoading(true);
    setError('');
    try {
      setPackage(
        await packageClient.appendInstruction(
          pkg.documentPackageId,
          pkg.version,
          {
            instructionType: 'DOCUMENT_USE_AUTHORIZATION',
            structuredPayload: {
              authorized: true,
              packageVersion: pkg.version,
              acknowledgement: 'Preparation only; no filing submission is authorized.'
            }
          },
          `document-use-${pkg.documentPackageId}-${pkg.version}`
        )
      );
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setLoading(false);
    }
  };

  const markReady = async () => {
    if (!pkg) return;
    setLoading(true);
    setError('');
    try {
      setPackage(
        await packageClient.markReady(
          pkg.documentPackageId,
          pkg.version,
          `document-ready-${pkg.documentPackageId}-${pkg.version}`
        )
      );
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setLoading(false);
    }
  };

  const createLock = async () => {
    if (!pkg?.canonicalEvidenceHash || pkg.status !== 'READY_FOR_PREPARATION_LOCK') return;
    setLoading(true);
    setError('');
    const key = `preparation-lock-${pkg.documentPackageId}-${pkg.version}-${pkg.canonicalEvidenceHash}`;
    try {
      const created = await preparationClient.create({
        documentPackageId: pkg.documentPackageId,
        expectedDocumentPackageVersion: pkg.version,
        expectedCanonicalEvidenceHash: pkg.canonicalEvidenceHash,
        idempotencyKey: key
      });
      if (typeof sessionStorage !== 'undefined')
        sessionStorage.setItem(lockPointerKey(pkg.documentPackageId), created.preparationLockId);
      setLock(await preparationClient.validateCurrent(created.preparationLockId));
    } catch (cause) {
      setError(errorCopy(cause));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !pkg) return <LoadingState label="Loading durable Document Package" />;

  if (!pkg)
    return (
      <main className="preparation-workspace">
        <h1>Documents and Instructions</h1>
        {error && (
          <Alert tone="danger" title="Durable preparation could not start">
            {error}
          </Alert>
        )}
        <Card>
          <p>
            Professional Review <strong>{review.reviewCaseId}</strong> is complete. Start a durable
            Document Package pinned to that exact review version and decision fingerprint.
          </p>
          {exactReviewDecisionVersion && (
            <p className="markreg-wrap">
              Exact review decision: <strong>{exactReviewDecisionVersion}</strong>
            </p>
          )}
          <Button disabled={loading} onClick={() => void createPackage()}>
            Create durable Document Package
          </Button>
        </Card>
      </main>
    );

  return (
    <main className="preparation-workspace">
      <header>
        <p className="preparation-kicker">Durable owner truth</p>
        <h1>Documents and Instructions</h1>
        <p>
          Evidence and instructions are persisted by MarkReg. Preparation Lock ≠ Filing
          Authorization ≠ Filing Submission.
        </p>
        {exactReviewDecisionVersion && (
          <p className="markreg-wrap">
            Exact review decision: <strong>{exactReviewDecisionVersion}</strong>
          </p>
        )}
      </header>
      {error && (
        <Alert tone="danger" title="Preparation could not continue">
          {error}
        </Alert>
      )}
      <Card>
        <h2>Current package</h2>
        <dl>
          <dt>Document Package</dt>
          <dd className="markreg-wrap">{pkg.documentPackageId}</dd>
          <dt>Status</dt>
          <dd>{pkg.status}</dd>
          <dt>Version</dt>
          <dd>{pkg.version}</dd>
          <dt>Professional Review</dt>
          <dd className="markreg-wrap">
            {pkg.professionalReviewCaseId} · version {pkg.sourceReviewVersion}
          </dd>
          {pkg.canonicalEvidenceHash && (
            <>
              <dt>Canonical evidence hash</dt>
              <dd className="markreg-wrap">{pkg.canonicalEvidenceHash}</dd>
            </>
          )}
        </dl>
      </Card>

      <Card>
        <h2>Required evidence</h2>
        {pkg.requirements.length === 0 ? (
          <p>No document requirement was produced by the completed review.</p>
        ) : (
          <ul>
            {pkg.requirements.map((requirement) => {
              const item = pkg.documentItems.find(
                (candidate) => itemRequirementKey(candidate) === requirement.requirementKey
              );
              return (
                <li key={requirement.requirementKey}>
                  <strong>{requirement.displayName}</strong> —{' '}
                  {item ? `${itemDisplayName(item)} · ${itemVerification(item)}` : 'Missing'}
                  {requirement.blocking ? ' · blocking' : ''}
                </li>
              );
            })}
          </ul>
        )}
        {pkg.status === 'DRAFT' && pkg.requirements.length > 0 && (
          <div className="markreg-form">
            <label>
              Requirement
              <select
                value={selectedRequirement}
                onChange={(event) => setSelectedRequirement(event.target.value)}
              >
                <option value="">Select requirement</option>
                {pkg.requirements.map((requirement) => (
                  <option key={requirement.requirementKey} value={requirement.requirementKey}>
                    {requirement.displayName}
                  </option>
                ))}
              </select>
            </label>
            <TextInput
              label="Evidence display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <TextInput
              label="SHA-256 checksum"
              value={checksum}
              onChange={(event) => setChecksum(event.target.value)}
            />
            <TextInput
              label="External storage/reference (optional)"
              value={storageReference}
              onChange={(event) => setStorageReference(event.target.value)}
            />
            <Button
              disabled={
                loading || !selectedRequirement || !displayName || !/^[a-f0-9]{64}$/i.test(checksum)
              }
              onClick={() => void recordEvidence()}
            >
              Record evidence metadata
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h2>Preparation instruction</h2>
        <p>
          Current durable instruction entries: <strong>{pkg.instructionEntries.length}</strong>
        </p>
        {pkg.status === 'DRAFT' && pkg.instructionEntries.length === 0 && (
          <Button disabled={loading} onClick={() => void addInstruction()}>
            Authorize recorded documents for preparation only
          </Button>
        )}
        <p>This instruction does not authorize filing, payment, or external submission.</p>
      </Card>

      {pkg.status === 'DRAFT' && (
        <Card>
          <h2>Readiness</h2>
          <p>
            Blocking evidence missing: <strong>{blockingMissing.length}</strong> · Instructions:{' '}
            <strong>{pkg.instructionEntries.length}</strong>
          </p>
          <Button
            disabled={loading || blockingMissing.length > 0 || pkg.instructionEntries.length === 0}
            onClick={() => void markReady()}
          >
            Mark package ready for Preparation Lock
          </Button>
        </Card>
      )}

      {pkg.status === 'READY_FOR_PREPARATION_LOCK' && pkg.canonicalEvidenceHash && !lock && (
        <Card>
          <h2>Preparation Lock</h2>
          <p>The owner returned an exact ready package version and canonical evidence hash.</p>
          <Button disabled={loading} onClick={() => void createLock()}>
            Lock exact package for preparation
          </Button>
        </Card>
      )}

      {lock && (
        <Card>
          <h2>Locked for preparation — not submitted</h2>
          <dl>
            <dt>Preparation Lock</dt>
            <dd className="markreg-wrap">{lock.preparationLockId}</dd>
            <dt>Version</dt>
            <dd>{lock.version}</dd>
            <dt>Package</dt>
            <dd className="markreg-wrap">
              {lock.source.documentPackageId} · version {lock.source.documentPackageVersion}
            </dd>
            <dt>Created</dt>
            <dd>{lock.createdAt}</dd>
          </dl>
          <Alert tone="warning" title="Filing Authorization remains gated">
            The current durable Preparation Lock is saved and revalidated. Filing Authorization is
            intentionally unavailable here until Execution consumes this durable source contract
            under #731. No legacy snapshot is manufactured in the browser.
          </Alert>
        </Card>
      )}
    </main>
  );
}
