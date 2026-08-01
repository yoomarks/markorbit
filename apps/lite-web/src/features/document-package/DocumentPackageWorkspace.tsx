import { useEffect, useMemo, useState } from 'react';
import type { DurableDocumentPackageView, ProfessionalReviewCase } from '@markorbit/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  KeyValueList,
  LoadingState,
  PageHeader,
  Select,
  TextInput
} from '@markorbit/ui';
import { createProfessionalReviewClient } from '../../api/professional-review.js';
import { createDocumentPackageClient } from '../../api/document-package.js';
import type { PackageHttpError } from '../../api/document-package.js';

const hash = async (value: unknown) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)))
    )
  )
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
const canonical = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.entries(value as Record<string, unknown>)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
          .join(',')}}`
      : (JSON.stringify(value) ?? 'null');

export function DocumentPackageWorkspace({
  workspaceId,
  reviewCaseId,
  packageId,
  initialPackage,
  initialReview
}: {
  workspaceId: string;
  reviewCaseId?: string;
  packageId?: string;
  initialPackage?: DurableDocumentPackageView;
  initialReview?: ProfessionalReviewCase;
}) {
  const client = useMemo(() => createDocumentPackageClient(workspaceId), [workspaceId]);
  const reviews = useMemo(() => createProfessionalReviewClient(workspaceId), [workspaceId]);
  const [value, setValue] = useState<DurableDocumentPackageView | undefined>(initialPackage);
  const [review, setReview] = useState<ProfessionalReviewCase | undefined>(initialReview);
  const [state, setState] = useState<
    'loading' | 'ready' | 'error' | 'forbidden' | 'missing' | 'conflict' | 'unavailable'
  >('loading');
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  const [instruction, setInstruction] = useState(
    'File in the reviewed jurisdiction and class scope.'
  );
  const [busy, setBusy] = useState(false);
  const alternateWorkspaceId = new URLSearchParams(window.location.search).get('otherWorkspaceId');
  const fail = (error: unknown) => {
    const e = error as PackageHttpError;
    setMessage(e.message);
    setState(
      e.status === 403
        ? 'forbidden'
        : e.status === 404
          ? 'missing'
          : e.status === 409
            ? 'conflict'
            : e.status === 503
              ? 'unavailable'
              : 'error'
    );
  };
  useEffect(() => {
    if (initialPackage || initialReview) {
      setState('ready');
      return;
    }
    setState('loading');
    setValue(undefined);
    const work = packageId
      ? client.get(packageId).then(setValue)
      : reviewCaseId
        ? reviews.get(reviewCaseId).then(({ reviewCase }) => setReview(reviewCase))
        : Promise.reject(new Error('A Package or completed Review identity is required.'));
    void work.then(() => setState('ready')).catch(fail);
  }, [client, reviews, packageId, reviewCaseId, workspaceId, initialPackage, initialReview]);
  const mutate = (work: () => Promise<DurableDocumentPackageView>) => {
    setBusy(true);
    void work()
      .then((next) => {
        setValue(next);
        setState('ready');
        history.replaceState(
          { packageId: next.documentPackageId },
          '',
          `?documentPackageId=${encodeURIComponent(next.documentPackageId)}&workspaceId=${encodeURIComponent(workspaceId)}${alternateWorkspaceId ? `&otherWorkspaceId=${encodeURIComponent(alternateWorkspaceId)}` : ''}`
        );
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  if (state === 'loading') return <LoadingState label="Loading exact Document Package" />;
  if (state !== 'ready')
    return (
      <ErrorState
        title={
          {
            forbidden: 'Package permission denied',
            missing: 'Document Package not found',
            conflict: 'Package version conflict',
            unavailable: 'Package service unavailable',
            error: 'Document Package unavailable'
          }[state] ?? 'Document Package unavailable'
        }
        description={message || 'No Package evidence was changed.'}
        onRetry={() => location.reload()}
      />
    );
  if (!value && review)
    return (
      <section className="package-workspace">
        <PageHeader
          title="Documents and Instructions"
          description={`Completed Review ${review.reviewCaseId}`}
        />
        <Alert title="Completed Review — Package not started">
          A completed Review is source evidence; it is not a ready Document Package.
        </Alert>
        <Button
          disabled={busy || !review.decision || !review.completedAt}
          onClick={() =>
            void hash(review.decision).then((fingerprint) =>
              mutate(() =>
                client.create({
                  professionalReviewCaseId: review.reviewCaseId,
                  expectedReviewVersion: review.version ?? 1,
                  expectedCompletedDecisionId: review.decision!.decidedAt,
                  expectedCompletedDecisionHash: fingerprint
                })
              )
            )
          }
        >
          Start Package
        </Button>
      </section>
    );
  if (!value) return null;
  const ready = value.status === 'READY_FOR_PREPARATION_LOCK';
  const currentInstruction = value.instructionEntries.at(-1);
  return (
    <section className="package-workspace">
      <Button variant="secondary" onClick={() => history.back()}>
        ← Back to Matter
      </Button>
      {alternateWorkspaceId && (
        <Select
          label="Workspace"
          value={workspaceId}
          onChange={(event) => {
            const target = new URL(window.location.href);
            target.search = '';
            target.searchParams.set('workspaceId', event.target.value);
            target.hash = 'matters';
            window.location.assign(target);
          }}
        >
          <option value={workspaceId}>{workspaceId}</option>
          <option value={alternateWorkspaceId}>{alternateWorkspaceId}</option>
        </Select>
      )}
      <PageHeader
        title="Documents and Instructions"
        description="Durable preparation workspace"
        actions={<Badge>{ready ? 'Ready for Preparation Lock' : value.status}</Badge>}
      />
      {ready && (
        <Alert title="Ready for Preparation Lock — read only">
          This does not authorize filing, release execution, create a Preparation Lock, or submit an
          application.
        </Alert>
      )}
      <Card>
        <h2>Exact Package</h2>
        <KeyValueList
          items={[
            { key: 'Package ID', value: value.documentPackageId },
            { key: 'Version', value: String(value.version) },
            { key: 'Status', value: ready ? 'Ready for Preparation Lock' : value.status },
            { key: 'Review Case', value: value.professionalReviewCaseId },
            { key: 'Review version', value: String(value.sourceReviewVersion) },
            {
              key: 'Formal Matter',
              value: `${value.formalMatterId} · v${value.sourceFormalMatterVersion}`
            },
            { key: 'Ready evidence', value: value.canonicalEvidenceHash ?? 'Not ready' }
          ]}
        />
      </Card>
      <div className="package-grid">
        <Card>
          <h2>Required documents</h2>
          {value.requirements.map((requirement) => {
            const recorded = value.documentItems.find(
              (item) => item.requirementKey === requirement.requirementKey
            );
            return (
              <div key={requirement.requirementKey} className="package-item">
                <strong>{requirement.displayName}</strong>
                <span>
                  {recorded
                    ? `Recorded · ${typeof recorded.originalFileName === 'string' ? recorded.originalFileName : typeof recorded.storageReference === 'string' ? recorded.storageReference : ''}`
                    : 'Required'}
                </span>
                {!ready && !recorded && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      mutate(() =>
                        client.evidence(value.documentPackageId, value.version, {
                          requirementKey: requirement.requirementKey,
                          documentType: 'REVIEW_EVIDENCE',
                          displayName: requirement.displayName,
                          evidenceType: 'FILE_REFERENCE',
                          originalFileName: 'review-evidence.pdf',
                          mediaType: 'application/pdf',
                          sizeBytes: 128,
                          checksum: 'a'.repeat(64),
                          storageReference: `evidence:${requirement.requirementKey}`,
                          verificationStatus: 'RECORDED',
                          structuredNote: { note }
                        })
                      )
                    }
                  >
                    Record evidence
                  </Button>
                )}
              </div>
            );
          })}
          {!ready && (
            <>
              <TextInput
                label="Structured evidence note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                disabled={busy}
                onClick={() =>
                  mutate(() => client.save(value.documentPackageId, value.version, { note }))
                }
              >
                Save Draft
              </Button>
            </>
          )}
        </Card>
        <Card>
          <h2>Instruction Ledger</h2>
          <ol className="lite-timeline">
            {value.instructionEntries.map((entry) => (
              <li key={String(entry.instructionEntryId)}>
                <strong>
                  #{String(entry.sequence)} · {String(entry.instructionType)}
                </strong>
                <p>{JSON.stringify(entry.structuredPayload)}</p>
                {Boolean(entry.supersedesEntryId) && (
                  <small>Supersedes {String(entry.supersedesEntryId)}</small>
                )}
              </li>
            ))}
          </ol>
          {!ready && (
            <>
              <TextInput
                label="Structured filing instruction"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              />
              <Button
                disabled={busy || !instruction.trim()}
                onClick={() =>
                  mutate(() =>
                    client.append(value.documentPackageId, value.version, {
                      instructionType: 'FILING_SCOPE',
                      structuredPayload: { text: instruction }
                    })
                  )
                }
              >
                Append instruction
              </Button>
              {currentInstruction && (
                <Button
                  variant="secondary"
                  disabled={busy || !instruction.trim()}
                  onClick={() =>
                    mutate(() =>
                      client.supersede(
                        value.documentPackageId,
                        String(currentInstruction.instructionEntryId),
                        value.version,
                        {
                          instructionType: 'FILING_SCOPE',
                          structuredPayload: { text: instruction }
                        }
                      )
                    )
                  }
                >
                  Supersede latest instruction
                </Button>
              )}
            </>
          )}
        </Card>
      </div>
      {!ready && (
        <Button
          disabled={busy}
          onClick={() => {
            if (confirm('Mark this exact Package ready for the later Preparation Lock step?'))
              mutate(() => client.ready(value.documentPackageId, value.version));
          }}
        >
          Mark Ready for Preparation Lock
        </Button>
      )}
    </section>
  );
}
