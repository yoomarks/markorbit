import { Alert, Button, Card, Checkbox, LoadingState } from '@markorbit/ui';
import { useState } from 'react';

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
