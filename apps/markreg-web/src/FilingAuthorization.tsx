import { useState } from 'react';
import { Alert, Button, Card, KeyValueList, LoadingState, PageHeader, Badge } from '@markorbit/ui';
export type FilingAuthorizationViewState =
  | 'AUTHORIZATION_SOURCE_LOADING'
  | 'AUTHORIZATION_DRAFT'
  | 'AUTHORIZATION_CONFIRMING'
  | 'AUTHORIZED'
  | 'AUTHORIZATION_STALE'
  | 'AUTHORIZATION_WITHDRAWN'
  | 'RECOVERABLE_ERROR';
const acknowledgements = [
  'I confirm the applicant or owner information.',
  'I confirm the trademark representation.',
  'I confirm the jurisdiction, classes and goods/services.',
  'I authorize use of the locked document package.',
  'I authorize preparation of the filing instruction.',
  'I understand that authorization does not itself submit an application.',
  'I understand that a professional or representative may still need to accept appointment.',
  'I understand that scope changes require a new review and authorization.',
  'I understand that government-office acceptance is not guaranteed.'
];
export function FilingAuthorizationView({
  initialState = 'AUTHORIZATION_DRAFT',
  long = false
}: {
  initialState?: FilingAuthorizationViewState;
  long?: boolean;
}) {
  const [state, setState] = useState(initialState);
  const [checked, setChecked] = useState<boolean[]>(acknowledgements.map(() => false));
  if (state === 'AUTHORIZATION_SOURCE_LOADING')
    return (
      <main className="markreg-page">
        <LoadingState label="Loading immutable filing authorization scope" />
      </main>
    );
  if (state === 'RECOVERABLE_ERROR')
    return (
      <main className="markreg-page">
        <Alert tone="danger" title="Authorization could not be loaded">
          Try again. No authorization or filing was created.
        </Alert>
      </main>
    );
  const authorized = state === 'AUTHORIZED';
  return (
    <main className="markreg-page" aria-labelledby="filing-authorization-title">
      <PageHeader
        title="Filing Authorization"
        description="Review the exact immutable Preparation Snapshot before actively authorizing internal execution review."
      />
      <Alert
        tone="warning"
        title={
          authorized
            ? 'Authorized for internal execution review — not submitted'
            : 'Authorization ≠ Submission'
        }
      >
        This does not submit an application, appoint a professional, charge money, or contact a
        trademark office.
      </Alert>
      <Card>
        <h2 id="filing-authorization-title">Immutable authorized scope</h2>
        <Badge>{state}</Badge>
        <KeyValueList
          items={[
            { key: 'Preparation Lock', value: 'preparation-lock_012 · version 2:3' },
            { key: 'Professional Review', value: 'professional-review_012 · review-v1' },
            { key: 'Applicant / owner', value: 'MarkOrbit Labs Ltd' },
            { key: 'Trademark', value: 'MARKORBIT' },
            { key: 'Jurisdiction', value: 'GB' },
            { key: 'Classes', value: '9, 35, 42' },
            {
              key: 'Goods / services',
              value: long
                ? 'Software for governed intellectual-property workflows; business administration and an intentionally long locked description that wraps safely on a 390px viewport.'
                : 'Software and business administration services'
            },
            { key: 'Filing basis', value: 'Intent to use' },
            {
              key: 'Locked documents',
              value: 'owner-authority-evidence.pdf; mark-representation.svg'
            },
            {
              key: 'Representative requirement',
              value: 'Evaluated; appointment may still be required'
            },
            { key: 'Terms', value: 'filing-authorization-terms-v1' }
          ]}
        />
      </Card>
      {authorized ? (
        <Card>
          <h2>Authorization receipt</h2>
          <KeyValueList
            items={[
              { key: 'Filing Authorization ID', value: 'filing-authorization_012' },
              { key: 'Status', value: 'AUTHORIZED' },
              { key: 'Authorized party', value: 'Alex Owner (OWNER)' },
              { key: 'Authorized at', value: '29 July 2026 · 12:00 UTC' },
              { key: 'Next permitted action', value: 'Internal Execution Release review only' },
              { key: 'Filing submitted', value: 'false' },
              { key: 'Official application created', value: 'false' },
              { key: 'Professional appointed', value: 'false' },
              { key: 'Customer message sent', value: 'false' }
            ]}
          />
        </Card>
      ) : (
        <Card>
          <fieldset
            disabled={
              state === 'AUTHORIZATION_CONFIRMING' ||
              state === 'AUTHORIZATION_STALE' ||
              state === 'AUTHORIZATION_WITHDRAWN'
            }
          >
            <legend>
              <h2>Required active acknowledgements</h2>
            </legend>
            {acknowledgements.map((label, index) => (
              <label key={label} style={{ display: 'flex', gap: '.75rem', margin: '1rem 0' }}>
                <input
                  type="checkbox"
                  checked={checked[index]}
                  onChange={(e) =>
                    setChecked((v) => v.map((x, i) => (i === index ? e.target.checked : x)))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <Button
            disabled={!checked.every(Boolean) || state !== 'AUTHORIZATION_DRAFT'}
            onClick={() => {
              setState('AUTHORIZATION_CONFIRMING');
              queueMicrotask(() => setState('AUTHORIZED'));
            }}
          >
            {state === 'AUTHORIZATION_CONFIRMING' ? 'Confirming…' : 'Confirm Filing Authorization'}
          </Button>
        </Card>
      )}
    </main>
  );
}
