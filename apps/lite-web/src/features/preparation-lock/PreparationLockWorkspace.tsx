import { useEffect, useMemo, useState } from 'react';
import type { DurableDocumentPackageView, DurablePreparationLockView } from '@markorbit/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  KeyValueList,
  LoadingState,
  PageHeader
} from '@markorbit/ui';
import {
  createDocumentPackageClient,
  type DocumentPackageClient,
  type PackageHttpError
} from '../../api/document-package.js';
import {
  createPreparationLockClient,
  type PreparationLockClient,
  type PreparationLockHttpError
} from '../../api/preparation-lock.js';

type ViewState =
  | 'loading'
  | 'ready'
  | 'unauthorized'
  | 'forbidden'
  | 'missing'
  | 'conflict'
  | 'validation'
  | 'unavailable'
  | 'error';

const errorState = (error: unknown): Exclude<ViewState, 'loading' | 'ready'> => {
  const status = (error as PackageHttpError | PreparationLockHttpError).status;
  return status === 401
    ? 'unauthorized'
    : status === 403
      ? 'forbidden'
      : status === 404
        ? 'missing'
        : status === 409
          ? 'conflict'
          : status === 400 || status === 422
            ? 'validation'
            : status === 503
              ? 'unavailable'
              : 'error';
};

const stateTitle: Record<Exclude<ViewState, 'loading' | 'ready'>, string> = {
  unauthorized: 'Sign in required',
  forbidden: 'Preparation Lock permission denied',
  missing: 'Preparation source not found',
  conflict: 'Preparation source changed',
  validation: 'Package is not ready to lock',
  unavailable: 'Preparation Lock service unavailable',
  error: 'Preparation Lock unavailable'
};

const authorityRows = [
  ['Filing authorized', 'No'],
  ['Execution released', 'No'],
  ['Application submitted', 'No'],
  ['Payment created', 'No'],
  ['Provider contacted', 'No'],
  ['Official Truth created', 'No']
] as const;

export function PreparationLockWorkspace({
  workspaceId,
  packageId,
  initialPackage,
  initialLock,
  packageClient,
  preparationClient
}: {
  workspaceId: string;
  packageId?: string;
  initialPackage?: DurableDocumentPackageView;
  initialLock?: DurablePreparationLockView;
  packageClient?: DocumentPackageClient;
  preparationClient?: PreparationLockClient;
}) {
  const packages = useMemo(
    () => packageClient ?? createDocumentPackageClient(workspaceId),
    [packageClient, workspaceId]
  );
  const locks = useMemo(
    () => preparationClient ?? createPreparationLockClient(workspaceId),
    [preparationClient, workspaceId]
  );
  const [pkg, setPackage] = useState(initialPackage);
  const [lock, setLock] = useState(initialLock);
  const [state, setState] = useState<ViewState>(initialPackage ? 'ready' : 'loading');
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (error: unknown) => {
    setState(errorState(error));
    setMessage(error instanceof Error ? error.message : 'No preparation evidence was changed.');
  };

  useEffect(() => {
    if (initialPackage) {
      setState('ready');
      return;
    }
    if (!packageId) {
      setState('missing');
      setMessage('An exact ready Document Package identity is required.');
      return;
    }
    setState('loading');
    void packages
      .get(packageId)
      .then((value) => {
        setPackage(value);
        setState('ready');
      })
      .catch(fail);
  }, [initialPackage, packageId, packages]);

  const createLock = async () => {
    if (!pkg?.canonicalEvidenceHash || pkg.status !== 'READY_FOR_PREPARATION_LOCK') return;
    setBusy(true);
    setMessage('');
    try {
      const created = await locks.create({
        documentPackageId: pkg.documentPackageId,
        expectedDocumentPackageVersion: pkg.version,
        expectedCanonicalEvidenceHash: pkg.canonicalEvidenceHash
      });
      const current = await locks.validateCurrent(created.preparationLockId);
      setLock(current);
      setState('ready');
      history.replaceState(
        { preparationLockId: current.preparationLockId },
        '',
        `?preparationLockId=${encodeURIComponent(current.preparationLockId)}&workspaceId=${encodeURIComponent(workspaceId)}`
      );
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') return <LoadingState label="Loading exact preparation source" />;
  if (state !== 'ready')
    return (
      <ErrorState
        title={stateTitle[state]}
        description={message || 'No preparation evidence was changed.'}
        onRetry={() => location.reload()}
      />
    );
  if (!pkg) return null;

  const ready = pkg.status === 'READY_FOR_PREPARATION_LOCK' && Boolean(pkg.canonicalEvidenceHash);
  const instructions = pkg.instructionEntries.length;
  const documents = pkg.documentItems.length;

  return (
    <section className="preparation-lock-workspace">
      <Button variant="secondary" onClick={() => history.back()}>
        ← Back to Documents and Instructions
      </Button>
      <div className="preparation-lock-heading">
        <PageHeader
          title="Preparation Lock"
          description="Freeze the exact reviewed package before any authority decision"
          actions={
            <Badge>{lock ? 'Locked · not submitted' : ready ? 'Ready to lock' : 'Not ready'}</Badge>
          }
        />
      </div>

      {lock ? (
        <>
          <Alert tone="success" title="Locked for preparation — not submitted">
            MarkReg revalidated the exact durable source and issued this immutable receipt. No
            filing, payment, provider contact or external submission was created.
          </Alert>
          <div className="preparation-lock-grid preparation-lock-grid--receipt">
            <Card>
              <p className="preparation-lock-eyebrow">Immutable receipt</p>
              <h2>Preparation Lock</h2>
              <KeyValueList
                items={[
                  { key: 'Lock ID', value: lock.preparationLockId },
                  { key: 'Version', value: String(lock.version) },
                  { key: 'Created', value: lock.createdAt },
                  { key: 'Created by', value: lock.createdBy },
                  { key: 'Lock payload hash', value: lock.lockPayloadHash }
                ]}
              />
            </Card>
            <Card>
              <p className="preparation-lock-eyebrow">Exact frozen source</p>
              <h2>Lineage</h2>
              <KeyValueList
                items={[
                  {
                    key: 'Document Package',
                    value: `${lock.source.documentPackageId} · v${lock.source.documentPackageVersion}`
                  },
                  {
                    key: 'Completed review',
                    value: `${lock.source.professionalReviewCaseId} · v${lock.source.reviewVersion}`
                  },
                  {
                    key: 'Formal Matter',
                    value: `${lock.source.formalMatterId} · v${lock.source.formalMatterVersion}`
                  },
                  {
                    key: 'Instructions',
                    value: `${lock.source.instructionEntryCount} frozen entries`
                  },
                  { key: 'Instruction set hash', value: lock.source.instructionSetHash }
                ]}
              />
            </Card>
          </div>
          <Card>
            <p className="preparation-lock-eyebrow">Authority boundary</p>
            <h2>Still requires a separate decision</h2>
            <div className="preparation-lock-authority" aria-label="Authority consequences">
              {authorityRows.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="preparation-lock-next">
              Next permitted action: <strong>Governed Filing Authorization review</strong>
            </p>
          </Card>
        </>
      ) : (
        <>
          {!ready && (
            <Alert tone="danger" title="Document Package is not ready">
              Return to Documents and Instructions. Every blocking requirement and the current
              Instruction Ledger must be ready before locking.
            </Alert>
          )}
          {ready && (
            <Alert tone="warning" title="Review before locking">
              This action freezes the exact Package version, evidence hash and instruction history.
              It cannot be used to imply filing authority or submission.
            </Alert>
          )}
          <div className="preparation-lock-grid">
            <Card>
              <p className="preparation-lock-eyebrow">Source 01</p>
              <h2>Exact ready Package</h2>
              <KeyValueList
                items={[
                  { key: 'Package ID', value: pkg.documentPackageId },
                  { key: 'Version', value: String(pkg.version) },
                  {
                    key: 'Status',
                    value: ready ? 'Ready for Preparation Lock' : 'Not ready for Preparation Lock'
                  },
                  {
                    key: 'Ready at',
                    value: pkg.readyAt ?? 'Unavailable — verify before continuing'
                  },
                  {
                    key: 'Canonical evidence hash',
                    value: pkg.canonicalEvidenceHash ?? 'Not available'
                  }
                ]}
              />
            </Card>
            <Card>
              <p className="preparation-lock-eyebrow">Source 02</p>
              <h2>What will be frozen</h2>
              <div className="preparation-lock-counts">
                <div>
                  <strong>{documents}</strong>
                  <span>document records</span>
                </div>
                <div>
                  <strong>{instructions}</strong>
                  <span>instruction entries</span>
                </div>
                <div>
                  <strong>1</strong>
                  <span>completed review</span>
                </div>
              </div>
              <KeyValueList
                items={[
                  {
                    key: 'Completed review',
                    value: `${pkg.professionalReviewCaseId} · v${pkg.sourceReviewVersion}`
                  },
                  {
                    key: 'Formal Matter',
                    value: `${pkg.formalMatterId} · v${pkg.sourceFormalMatterVersion}`
                  }
                ]}
              />
            </Card>
          </div>
          <Card>
            <p className="preparation-lock-eyebrow">Protected boundary</p>
            <h2>This lock does not</h2>
            <div className="preparation-lock-authority" aria-label="Actions not authorized">
              {authorityRows.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <label className="preparation-lock-confirmation">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={!ready || busy}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                I confirm this exact Package is ready to freeze for preparation only. I understand
                that no filing, payment or external action is authorized.
              </span>
            </label>
            <div className="preparation-lock-action" aria-live="polite">
              <Button disabled={!ready || !confirmed || busy} onClick={() => void createLock()}>
                {busy ? 'Locking exact Package…' : 'Create Preparation Lock'}
              </Button>
              <small>
                MarkReg will revalidate the current saved source before issuing the receipt.
              </small>
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
