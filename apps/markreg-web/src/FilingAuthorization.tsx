import { useEffect, useMemo, useState } from 'react';
import type {
  AuthorizationAuthorityConsequences,
  FilingAuthorization,
  FilingAuthorizationAcknowledgementCode,
  PreparationLock
} from '@markorbit/contracts';
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
import { createMarkregClient, type MarkregClient } from './api/markreg.js';
export type FilingAuthorizationViewState =
  | 'AUTHORIZATION_SOURCE_LOADING'
  | 'AUTHORIZATION_DRAFT'
  | 'AUTHORIZATION_CONFIRMING'
  | 'AUTHORIZED'
  | 'AUTHORIZATION_STALE'
  | 'AUTHORIZATION_WITHDRAWN'
  | 'RECOVERABLE_ERROR';
export const authorizationAcknowledgements: ReadonlyArray<{
  code: FilingAuthorizationAcknowledgementCode;
  label: string;
}> = [
  { code: 'APPLICANT_OWNER_CONFIRMED', label: 'I confirm the applicant or owner information.' },
  { code: 'MARK_CONFIRMED', label: 'I confirm the trademark representation.' },
  {
    code: 'JURISDICTION_CLASSES_GOODS_CONFIRMED',
    label: 'I confirm the jurisdiction, classes and goods/services.'
  },
  {
    code: 'LOCKED_DOCUMENT_USE_AUTHORIZED',
    label: 'I authorize use of the locked document package.'
  },
  {
    code: 'FILING_INSTRUCTION_PREPARATION_AUTHORIZED',
    label: 'I authorize preparation of the filing instruction.'
  },
  {
    code: 'AUTHORIZATION_IS_NOT_SUBMISSION',
    label: 'I understand that authorization does not itself submit an application.'
  },
  {
    code: 'REPRESENTATIVE_APPOINTMENT_MAY_BE_REQUIRED',
    label:
      'I understand that a professional or representative may still need to accept appointment.'
  },
  {
    code: 'SCOPE_CHANGE_REQUIRES_REAUTHORIZATION',
    label: 'I understand that scope changes require a new review and authorization.'
  },
  {
    code: 'OFFICE_ACCEPTANCE_NOT_GUARANTEED',
    label: 'I understand that government-office acceptance is not guaranteed.'
  }
];
const version = (lock: PreparationLock) =>
  `${lock.documentPackageVersion}:${lock.instructionLedgerVersion}:${lock.lockedAt}`;
export function FilingAuthorizationView({
  client = createMarkregClient(),
  preparationLock,
  fixtureAuthorization,
  initialState
}: {
  client?: MarkregClient;
  preparationLock?: PreparationLock;
  fixtureAuthorization?: FilingAuthorization;
  initialState?: FilingAuthorizationViewState;
  long?: boolean;
}) {
  const [state, setState] = useState<FilingAuthorizationViewState>(
    initialState ?? (fixtureAuthorization ? 'AUTHORIZATION_DRAFT' : 'AUTHORIZATION_SOURCE_LOADING')
  );
  const [authorization, setAuthorization] = useState(fixtureAuthorization);
  const [consequences, setConsequences] = useState<AuthorizationAuthorityConsequences>();
  const [checked, setChecked] = useState<FilingAuthorizationAcknowledgementCode[]>([]);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!preparationLock || fixtureAuthorization || !client.createFilingAuthorization) return;
    let active = true;
    void client
      .createFilingAuthorization({
        preparationLockId: preparationLock.preparationLockId,
        preparationLockVersion: version(preparationLock),
        authorizedParty: {
          partyId: preparationLock.snapshot.documentPackage.customerId,
          displayName: 'Authorized customer'
        },
        authorizationCapacity: 'OWNER',
        executionChannel: 'OFFICE_PORTAL',
        idempotencyKey: `authorization:${preparationLock.preparationLockId}:${version(preparationLock)}`
      })
      .then((r) => {
        if (active) {
          setAuthorization(r.filingAuthorization);
          setConsequences(r.consequences);
          setState(
            r.filingAuthorization.status === 'AUTHORIZED' ? 'AUTHORIZED' : 'AUTHORIZATION_DRAFT'
          );
        }
      })
      .catch((e) => {
        if (active) {
          setMessage(e instanceof Error ? e.message : 'Authorization could not be loaded.');
          setState('RECOVERABLE_ERROR');
        }
      });
    return () => {
      active = false;
    };
  }, [client, fixtureAuthorization, preparationLock]);
  const all = checked.length === authorizationAcknowledgements.length;
  const status = authorization?.status;
  useEffect(() => {
    if (status === 'STALE') setState('AUTHORIZATION_STALE');
    if (status === 'WITHDRAWN') setState('AUTHORIZATION_WITHDRAWN');
  }, [status]);
  const consequenceItems = useMemo(
    () =>
      consequences
        ? Object.entries(consequences).map(([key, value]) => ({ key, value: String(value) }))
        : [],
    [consequences]
  );
  if (state === 'AUTHORIZATION_SOURCE_LOADING')
    return (
      <main className="markreg-page">
        <LoadingState label="Loading immutable filing authorization scope" />
      </main>
    );
  if (state === 'RECOVERABLE_ERROR')
    return (
      <main className="markreg-page">
        <ErrorState title="Authorization could not be loaded" description={message} />
      </main>
    );
  if (!authorization)
    return (
      <main className="markreg-page">
        <ErrorState
          title="Authorization unavailable"
          description="No governed authorization source was supplied."
        />
      </main>
    );
  const confirm = async () => {
    if (!client.confirmFilingAuthorization) return;
    setState('AUTHORIZATION_CONFIRMING');
    try {
      const r = await client.confirmFilingAuthorization(authorization.filingAuthorizationId, {
        acknowledgementCodes: checked,
        acknowledgedBy: authorization.authorizedParty.partyId,
        idempotencyKey: `confirm:${authorization.filingAuthorizationId}`
      });
      setAuthorization(r.filingAuthorization);
      setConsequences(r.consequences);
      setState('AUTHORIZED');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Confirmation failed.');
      setState('RECOVERABLE_ERROR');
    }
  };
  return (
    <main className="markreg-page" aria-labelledby="filing-authorization-title">
      <PageHeader
        title="Filing Authorization"
        description="Review the exact immutable Preparation Snapshot before actively authorizing internal execution review."
      />
      <Alert
        tone="warning"
        title={
          state === 'AUTHORIZED'
            ? 'Authorized for internal execution review — not submitted'
            : 'Authorization ≠ Submission'
        }
      >
        This does not submit an application, appoint a professional, charge money, or contact a
        trademark office.
      </Alert>
      <Card>
        <h2 id="filing-authorization-title">Immutable authorized scope</h2>
        <Badge>{authorization.status}</Badge>
        <KeyValueList
          items={[
            {
              key: 'Preparation Lock',
              value: `${authorization.preparationLockId} · ${authorization.preparationLockVersion}`
            },
            {
              key: 'Professional Review',
              value: `${authorization.professionalReviewCaseId} · ${authorization.professionalReviewVersion}`
            },
            { key: 'Applicant / owner', value: authorization.applicantOwnerReference },
            { key: 'Trademark', value: authorization.trademarkReference },
            { key: 'Jurisdiction', value: authorization.jurisdiction },
            { key: 'Classes', value: authorization.classes.join(', ') },
            { key: 'Goods / services', value: authorization.goodsServices.join('; ') },
            { key: 'Filing basis', value: authorization.filingBasis },
            {
              key: 'Locked documents',
              value:
                authorization.preparationSnapshot.documentPackage.documentItems
                  .map((x) => x.documentReference.fileName)
                  .join('; ') || 'No locked document files'
            },
            { key: 'Representative requirement', value: authorization.representativeRequirement },
            { key: 'Terms', value: authorization.termsVersion }
          ]}
        />
      </Card>
      {state === 'AUTHORIZED' ? (
        <Card>
          <h2>Authorization receipt</h2>
          <KeyValueList
            items={[
              { key: 'Filing Authorization ID', value: authorization.filingAuthorizationId },
              { key: 'Status', value: authorization.status },
              {
                key: 'Authorized party',
                value: `${authorization.authorizedParty.displayName} (${authorization.authorizationCapacity})`
              },
              { key: 'Authorized at', value: authorization.authorizedAt ?? '' },
              { key: 'Next permitted action', value: 'Internal Execution Release review only' },
              ...consequenceItems
            ]}
          />
          <a
            href={`http://127.0.0.1:4371/?filingAuthorizationId=${encodeURIComponent(authorization.filingAuthorizationId)}&filingAuthorizationVersion=${authorization.version}#work-execution-release`}
          >
            Open exact authorization in Lite Execution Release
          </a>
        </Card>
      ) : (
        <Card>
          <fieldset disabled={state !== 'AUTHORIZATION_DRAFT'}>
            <legend>
              <h2>Required active acknowledgements</h2>
            </legend>
            {authorizationAcknowledgements.map(({ code, label }) => (
              <div key={code} className="authorization-acknowledgement">
                <input
                  id={`authorization-${code}`}
                  type="checkbox"
                  checked={checked.includes(code)}
                  onChange={(e) =>
                    setChecked((v) =>
                      e.target.checked ? [...v, code] : v.filter((x) => x !== code)
                    )
                  }
                />
                <label htmlFor={`authorization-${code}`}>{label}</label>
              </div>
            ))}
          </fieldset>
          <Button disabled={!all || state !== 'AUTHORIZATION_DRAFT'} onClick={() => void confirm()}>
            {state === 'AUTHORIZATION_CONFIRMING' ? 'Confirming…' : 'Confirm Filing Authorization'}
          </Button>
          {(state === 'AUTHORIZATION_STALE' || state === 'AUTHORIZATION_WITHDRAWN') && (
            <p>No further authorization action is permitted for this record.</p>
          )}
        </Card>
      )}
    </main>
  );
}
