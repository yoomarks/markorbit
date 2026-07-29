import { Alert, Button, Card, Checkbox, LoadingState } from '@markorbit/ui';
import { useState } from 'react';
import type {
  DocumentPackage,
  CustomerInstructionLedger,
  PreparationLock,
  ProfessionalReviewCase,
  CustomerInstructionAcknowledgement
} from '@markorbit/contracts';
import type { MarkregClient } from './api/markreg.js';
import { FilingAuthorizationView } from './FilingAuthorization.js';

export type PreparationViewState =
  | 'SOURCE_LOADING'
  | 'SOURCE_ERROR'
  | 'NEEDS_DOCUMENTS'
  | 'DOCUMENT_REVIEW_NEEDED'
  | 'DOCUMENTS_READY'
  | 'INSTRUCTIONS_INCOMPLETE'
  | 'INSTRUCTIONS_CONFIRMING'
  | 'READY_TO_LOCK'
  | 'LOCKED_FOR_PREPARATION'
  | 'STALE'
  | 'WITHDRAWN'
  | 'RECOVERABLE_ERROR';
const acknowledgements = [
  'I confirm the applicant and owner information shown.',
  'I confirm the trademark representation shown.',
  'I confirm the jurisdiction, classes and goods/services shown.',
  'I authorize the listed documents to be used for preparation.',
  'I understand that confirmation does not submit an application.',
  'I understand that changes may require a new review or quote.'
];
export function DocumentsInstructionsWorkspace({
  state = 'NEEDS_DOCUMENTS',
  long = false
}: {
  state?: PreparationViewState;
  long?: boolean;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  if (state === 'SOURCE_LOADING')
    return <LoadingState label="Loading Professional Review source" />;
  if (state === 'SOURCE_ERROR')
    return (
      <Alert tone="danger" title="Professional Review source unavailable">
        The governed source could not be verified. No preparation record was changed.
      </Alert>
    );
  if (state === 'STALE' || state === 'WITHDRAWN' || state === 'RECOVERABLE_ERROR')
    return (
      <Alert
        tone={state === 'RECOVERABLE_ERROR' ? 'danger' : 'warning'}
        title={
          state === 'STALE'
            ? 'Package is stale'
            : state === 'WITHDRAWN'
              ? 'Package withdrawn'
              : 'Preparation could not continue'
        }
      >
        {state === 'STALE'
          ? 'Source lineage changed. Create a new package and confirmation.'
          : state === 'WITHDRAWN'
            ? 'A withdrawn package cannot be locked.'
            : 'Your confirmed records are unchanged. Try again.'}
      </Alert>
    );
  if (state === 'LOCKED_FOR_PREPARATION')
    return (
      <section role="region" aria-labelledby="lock-heading" className="preparation-workspace">
        <Card>
          <h2 id="lock-heading">Locked for preparation — not submitted</h2>
          <dl>
            <dt>Preparation Lock ID</dt>
            <dd>preparation-lock_fixture-011</dd>
            <dt>Package</dt>
            <dd>document-package_fixture · version 4</dd>
            <dt>Instruction ledger</dt>
            <dd>instruction-ledger_fixture · version 8</dd>
            <dt>Review decision</dt>
            <dd>decision-v1</dd>
            <dt>Matter Draft</dt>
            <dd>matter-v1</dd>
            <dt>Locked</dt>
            <dd>29 July 2026, 12:00 UTC</dd>
            <dt>Next permitted action</dt>
            <dd>Governed filing-authority review</dd>
          </dl>
          <h3>Authority consequences</h3>
          <ul>
            {[
              'Order created',
              'Payment created',
              'Formal Matter created',
              'Professional appointed',
              'Filing created',
              'Filing submitted',
              'Customer message sent',
              'External document sent',
              'Trademark office contacted'
            ].map((x) => (
              <li key={x}>
                {x}: <strong>false</strong>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    );
  const ready = state === 'READY_TO_LOCK';
  return (
    <main className="preparation-workspace">
      <header>
        <p className="preparation-kicker">Professional Review complete</p>
        <h1>Documents and Instructions</h1>
        <p>
          Prepare an evidence-backed package without filing, sending, charging, or appointing
          anyone.
        </p>
      </header>
      <section aria-labelledby="source-heading">
        <Card>
          <h2 id="source-heading">Source lineage</h2>
          <dl>
            <dt>Review Case</dt>
            <dd>professional-review_fixture</dd>
            <dt>Decision version</dt>
            <dd>decision-v1</dd>
            <dt>Matter Draft version</dt>
            <dd>matter-v1</dd>
            <dt>Customer Confirmation</dt>
            <dd>confirmation_fixture</dd>
            <dt>Jurisdiction</dt>
            <dd>United States</dd>
            <dt>Applicant</dt>
            <dd>Ada Orbit Ltd</dd>
            <dt>Trademark</dt>
            <dd>MARKORBIT</dd>
            <dt>Classes and goods/services</dt>
            <dd>
              {long
                ? 'Class 9 — downloadable software for governed international trademark portfolio preparation, evidence lineage, customer instruction history, and controlled professional review workflows'.repeat(
                    2
                  )
                : 'Class 9 — downloadable workflow software'}
            </dd>
          </dl>
        </Card>
      </section>
      <section aria-labelledby="requirements-heading">
        <Card>
          <h2 id="requirements-heading">Document requirements</h2>
          <ul className="document-requirements">
            <li>
              <strong>Applicant identity evidence</strong>
              <span>
                Required · {state === 'NEEDS_DOCUMENTS' ? 'Missing' : 'Accepted for preparation'} ·
                blocking
              </span>
              <small>Illustrative fixture rule; not authoritative legal advice.</small>
            </li>
            <li>
              <strong>Mark representation file</strong>
              <span>
                {state === 'DOCUMENT_REVIEW_NEEDED'
                  ? 'Received · Review needed'
                  : 'Accepted for preparation · version 2'}
              </span>
              <small className="long-value">
                {long
                  ? 'an-extraordinarily-long-customer-supplied-mark-representation-filename-with-version-lineage-and-language-metadata.pdf'
                  : 'mark-representation-v2.pdf'}
              </small>
            </li>
          </ul>
          <p>
            <strong>Document metadata recorded — binary storage not enabled</strong>
          </p>
        </Card>
      </section>
      <section aria-labelledby="validation-heading">
        <Card>
          <h2 id="validation-heading">Validation checks</h2>
          <ul>
            <li>
              Required document present: {state === 'NEEDS_DOCUMENTS' ? 'FAIL — blocking' : 'PASS'}
            </li>
            <li>Checksum present: PASS</li>
            <li>
              Language identified:{' '}
              {state === 'DOCUMENT_REVIEW_NEEDED' ? 'UNKNOWN — blocking' : 'PASS'}
            </li>
            <li>Commercial scope unchanged: PASS</li>
          </ul>
        </Card>
      </section>
      <section aria-labelledby="instructions-heading">
        <Card>
          <h2 id="instructions-heading">Customer Instruction Ledger</h2>
          <ol>
            <li>APPLICANT_IDENTITY · Ada Orbit Ltd · CONFIRMED</li>
            <li>GOODS_SERVICES · Class 9 scope · SUPERSEDED</li>
            <li>GOODS_SERVICES · Current Class 9 scope · CONFIRMED · supersedes previous entry</li>
          </ol>
          <fieldset>
            <legend>Confirm the exact preparation instructions</legend>
            {acknowledgements.map((label) => (
              <Checkbox
                key={label}
                label={label}
                checked={checked.includes(label)}
                onChange={(e) =>
                  setChecked((v) =>
                    e.target.checked ? [...v, label] : v.filter((x) => x !== label)
                  )
                }
              />
            ))}
          </fieldset>
          <Button disabled={!ready || checked.length !== acknowledgements.length}>
            Lock package for preparation
          </Button>
          <p>Preparation Lock ≠ Filing Submission. This action performs no external action.</p>
        </Card>
      </section>
    </main>
  );
}

export function ConnectedDocumentsInstructionsWorkspace({
  client,
  review
}: {
  client: MarkregClient;
  review: ProfessionalReviewCase;
}) {
  const [pkg, setPackage] = useState<DocumentPackage>();
  const [ledger, setLedger] = useState<CustomerInstructionLedger>();
  const [lock, setLock] = useState<PreparationLock>();
  const [authorizationOpen, setAuthorizationOpen] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [error, setError] = useState('');
  const createPackage = async () => {
    if (!review.decision) return;
    await client.createDocumentPackage!({
      professionalReviewCaseId: review.reviewCaseId,
      professionalReviewDecisionVersion: review.decision.decidedAt,
      matterDraftVersion: review.source.matterDraftVersion,
      idempotencyKey: `preparation-${review.reviewCaseId}-${review.decision.decidedAt}`
    })
      .then(setPackage)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Preparation could not start.')
      );
  };
  if (error)
    return (
      <Alert tone="danger" title="Preparation could not continue">
        {error}
      </Alert>
    );
  if (!pkg)
    return (
      <main className="preparation-workspace">
        <h1>Documents and Instructions</h1>
        <Button onClick={() => void createPackage()}>Create Document Package</Button>
      </main>
    );
  if (lock && authorizationOpen)
    return <FilingAuthorizationView client={client} preparationLock={lock} />;
  if (lock)
    return (
      <section role="region" aria-labelledby="connected-lock" className="preparation-workspace">
        <Card>
          <h1 id="connected-lock">Locked for preparation — not submitted</h1>
          <dl>
            <dt>Preparation Lock ID</dt>
            <dd>{lock.preparationLockId}</dd>
            <dt>Package</dt>
            <dd>
              {lock.documentPackageId} · version {lock.documentPackageVersion}
            </dd>
            <dt>Instruction ledger</dt>
            <dd>
              {lock.instructionLedgerId} · version {lock.instructionLedgerVersion}
            </dd>
            <dt>Review decision version</dt>
            <dd>{lock.snapshot.sourceReviewDecisionVersion}</dd>
            <dt>Matter Draft version</dt>
            <dd>{lock.snapshot.sourceMatterDraftVersion}</dd>
            <dt>Locked</dt>
            <dd>{lock.lockedAt}</dd>
          </dl>
          <h2>Authority consequences</h2>
          <ul>
            {Object.entries(lock.consequences).map(([key, value]) => (
              <li key={key}>
                {key}: <strong>{String(value)}</strong>
              </li>
            ))}
          </ul>
          <Button onClick={() => setAuthorizationOpen(true)}>Open Filing Authorization</Button>
          <p>
            Customer Instruction ≠ Filing Authorization. Filing Authorization ≠ Filing Submission.
          </p>
        </Card>
      </section>
    );
  const record = async () => {
    for (const requirement of pkg.requirements)
      if (
        !pkg.documentItems.some(
          (x) => x.requirementCode === requirement.code && x.status !== 'SUPERSEDED'
        )
      )
        await client.addDocument!(pkg.documentPackageId, {
          requirementCode: requirement.code,
          documentType: requirement.code,
          suppliedBy: pkg.customerId,
          documentReference: {
            fileName: `${requirement.code}-${'long-governed-filename-'.repeat(5)}.pdf`,
            contentType: 'application/pdf',
            byteSize: 2048,
            checksum: 'sha256:fixture-011',
            uploadedAt: new Date().toISOString(),
            uploadedBy: pkg.customerId,
            source: 'FIXTURE',
            originalOrCopy: 'COPY'
          }
        });
    setPackage(await client.getDocumentPackage!(pkg.documentPackageId));
  };
  const evaluate = async () =>
    setPackage(await client.evaluateDocumentPackage!(pkg.documentPackageId));
  const completeMetadata = async () => {
    for (const item of pkg.documentItems.filter((x) => x.status !== 'SUPERSEDED'))
      await client.updateDocument!(pkg.documentPackageId, item.documentItemId, {
        documentReference: {
          language: 'en',
          signatureStatus: 'NOT_REQUIRED',
          notarizationStatus: 'NOT_REQUIRED',
          legalizationStatus: 'NOT_REQUIRED'
        }
      });
    await evaluate();
  };
  const createLedger = async () => {
    const value = await client.createInstructionLedger!(pkg.documentPackageId);
    const entry = await client.appendInstruction!(value.instructionLedgerId, {
      type: 'DOCUMENT_USE_AUTHORIZATION',
      structuredValue: { authorized: true, packageVersion: pkg.version }
    });
    setLedger(
      await client.confirmInstruction!(value.instructionLedgerId, entry.instructionEntryId)
    );
  };
  const confirm = async () => {
    const at = new Date().toISOString();
    const codes = [
      'APPLICANT_OWNER',
      'MARK_REPRESENTATION',
      'SCOPE',
      'DOCUMENT_USE',
      'NO_SUBMISSION',
      'CHANGE_REVIEW_OR_QUOTE'
    ] as const;
    const acknowledgements: CustomerInstructionAcknowledgement[] = codes.map((code) => ({
      code,
      acknowledged: true,
      acknowledgedBy: pkg.customerId,
      acknowledgedAt: at,
      evidenceReference: `browser:${code}`
    }));
    const response = await client.confirmInstructionLedger!(
      ledger!.instructionLedgerId,
      acknowledgements
    );
    setLedger(response.instructionLedger);
  };
  return (
    <main className="preparation-workspace">
      <header>
        <p className="preparation-kicker">Professional Review complete</p>
        <h1>Documents and Instructions</h1>
        <p>Preparation Lock ≠ Filing Submission.</p>
      </header>
      <section aria-labelledby="connected-source">
        <Card>
          <h2 id="connected-source">Source lineage</h2>
          <dl>
            <dt>Professional Review Case</dt>
            <dd>{review.reviewCaseId}</dd>
            <dt>Review decision version</dt>
            <dd>{review.decision?.decidedAt}</dd>
            <dt>Matter Draft version</dt>
            <dd>{review.source.matterDraftVersion}</dd>
            <dt>Document Package</dt>
            <dd>
              {pkg.documentPackageId} · version {pkg.version}
            </dd>
            <dt>Goods/services</dt>
            <dd>{review.source.preparation.goodsServices}</dd>
          </dl>
        </Card>
      </section>
      <section aria-labelledby="connected-documents">
        <Card>
          <h2 id="connected-documents">Document requirements</h2>
          <ul className="document-requirements">
            {pkg.requirements.map((r) => (
              <li key={r.code}>
                <strong>{r.name}</strong>
                <span>
                  {pkg.missingRequirements.includes(r.code)
                    ? 'Required · Missing'
                    : 'Received · metadata recorded'}
                </span>
                <small>{r.reason}</small>
              </li>
            ))}
          </ul>
          {pkg.documentItems.map((i) => (
            <p className="long-value" key={i.documentItemId}>
              {i.documentReference.fileName} · version {i.version}
            </p>
          ))}
          <p>Document metadata recorded — binary storage not enabled</p>
          {pkg.documentItems.length === 0 && (
            <Button onClick={() => void record()}>Record fixture document metadata</Button>
          )}{' '}
          {pkg.documentItems.length > 0 && pkg.validationChecks.length === 0 && (
            <Button onClick={() => void evaluate()}>Evaluate documents</Button>
          )}{' '}
          {pkg.validationChecks.some((x) => x.status === 'UNKNOWN') && (
            <Button onClick={() => void completeMetadata()}>
              Complete required metadata and reevaluate
            </Button>
          )}
          <ul>
            {pkg.validationChecks.map((x, i) => (
              <li key={`${x.code}-${i}`}>
                {x.code}: {x.status}
                {x.blocking ? ' — blocking' : ''}
              </li>
            ))}
          </ul>
        </Card>
      </section>
      {pkg.status === 'READY_FOR_CUSTOMER_CONFIRMATION' && !ledger && (
        <Button onClick={() => void createLedger()}>Review customer instructions</Button>
      )}
      {ledger && (
        <section aria-labelledby="connected-ledger">
          <Card>
            <h2 id="connected-ledger">Customer Instruction Ledger</h2>
            <p>
              {ledger.instructionLedgerId} · version {ledger.version}
            </p>
            <ol>
              {ledger.entries.map((e) => (
                <li key={e.instructionEntryId}>
                  {e.type} · {e.status} · {e.instructionEntryId}
                </li>
              ))}
            </ol>
            {ledger.status === 'DRAFT' && (
              <fieldset>
                <legend>Confirm the exact preparation instructions</legend>
                {acknowledgements.map((label) => (
                  <Checkbox
                    key={label}
                    label={label}
                    checked={checked.includes(label)}
                    onChange={(e) =>
                      setChecked((v) =>
                        e.target.checked ? [...v, label] : v.filter((x) => x !== label)
                      )
                    }
                  />
                ))}
              </fieldset>
            )}
            {ledger.status === 'DRAFT' && (
              <Button
                disabled={checked.length !== acknowledgements.length}
                onClick={() => void confirm()}
              >
                Confirm customer instructions
              </Button>
            )}
            {ledger.status === 'CONFIRMED' && (
              <Button
                onClick={() =>
                  void client.createPreparationLock!(
                    pkg.documentPackageId,
                    ledger.instructionLedgerId
                  ).then(setLock)
                }
              >
                Lock package for preparation
              </Button>
            )}
          </Card>
        </section>
      )}
    </main>
  );
}
