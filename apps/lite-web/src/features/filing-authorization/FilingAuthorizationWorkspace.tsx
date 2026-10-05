import { useEffect, useMemo, useState } from 'react';
import type {
  AuthorizationAuthorityConsequences,
  FilingAuthorization,
  FilingAuthorizationAcknowledgementCode
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
import {
  createFilingAuthorizationClient,
  FilingAuthorizationHttpError,
  type FilingAuthorizationClient
} from '../../api/filing-authorization.js';

type ViewState =
  | 'loading'
  | 'ready'
  | 'confirming'
  | 'unauthorized'
  | 'forbidden'
  | 'missing'
  | 'conflict'
  | 'validation'
  | 'unavailable'
  | 'error';

const groups: ReadonlyArray<{
  title: string;
  description: string;
  items: ReadonlyArray<{ code: FilingAuthorizationAcknowledgementCode; label: string }>;
}> = [
  {
    title: 'Confirm the exact filing identity',
    description: 'These values come from the immutable Preparation Lock.',
    items: [
      { code: 'APPLICANT_OWNER_CONFIRMED', label: 'Applicant / owner details are correct.' },
      { code: 'MARK_CONFIRMED', label: 'Trademark representation is correct.' },
      {
        code: 'JURISDICTION_CLASSES_GOODS_CONFIRMED',
        label: 'Jurisdiction, classes and goods / services are correct.'
      }
    ]
  },
  {
    title: 'Authorize bounded preparation',
    description: 'This permission is limited to the exact frozen source below.',
    items: [
      {
        code: 'LOCKED_DOCUMENT_USE_AUTHORIZED',
        label: 'Use of the locked document package is authorized.'
      },
      {
        code: 'FILING_INSTRUCTION_PREPARATION_AUTHORIZED',
        label: 'Preparation of the filing instruction is authorized.'
      }
    ]
  },
  {
    title: 'Acknowledge the authority boundary',
    description: 'Authorization is not external execution or an official outcome.',
    items: [
      {
        code: 'AUTHORIZATION_IS_NOT_SUBMISSION',
        label: 'This authorization does not submit an application.'
      },
      {
        code: 'REPRESENTATIVE_APPOINTMENT_MAY_BE_REQUIRED',
        label: 'A professional or representative may still need to accept appointment.'
      },
      {
        code: 'SCOPE_CHANGE_REQUIRES_REAUTHORIZATION',
        label: 'Any scope change requires a new review and authorization.'
      },
      {
        code: 'OFFICE_ACCEPTANCE_NOT_GUARANTEED',
        label: 'Trademark-office acceptance is not guaranteed.'
      }
    ]
  }
];

export const filingAuthorizationAcknowledgements = groups.flatMap((group) => group.items);

const noAuthorityRows = [
  ['Application submitted', 'No'],
  ['Payment or invoice created', 'No'],
  ['Professional appointed', 'No'],
  ['Provider contacted', 'No'],
  ['Office reference received', 'No'],
  ['Official Truth created', 'No']
] as const;

const stateTitle: Record<Exclude<ViewState, 'loading' | 'ready' | 'confirming'>, string> = {
  unauthorized: 'Sign in required',
  forbidden: 'Filing Authorization permission denied',
  missing: 'Filing Authorization not found',
  conflict: 'Authorization source changed',
  validation: 'Authorization is incomplete',
  unavailable: 'Filing Authorization service unavailable',
  error: 'Filing Authorization unavailable'
};

function failureState(error: unknown): Exclude<ViewState, 'loading' | 'ready' | 'confirming'> {
  const status = (error as FilingAuthorizationHttpError).status;
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
}

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC'
      }).format(new Date(value)) + ' UTC'
    : 'Not available';

export function FilingAuthorizationWorkspace({
  workspaceId,
  filingAuthorizationId,
  initialAuthorization,
  initialConsequences,
  client
}: {
  workspaceId: string;
  filingAuthorizationId?: string;
  initialAuthorization?: FilingAuthorization;
  initialConsequences?: AuthorizationAuthorityConsequences;
  client?: FilingAuthorizationClient;
}) {
  const authorizationClient = useMemo(
    () => client ?? createFilingAuthorizationClient(workspaceId),
    [client, workspaceId]
  );
  const [authorization, setAuthorization] = useState(initialAuthorization);
  const [consequences, setConsequences] = useState(initialConsequences);
  const [view, setView] = useState<ViewState>(initialAuthorization ? 'ready' : 'loading');
  const [checked, setChecked] = useState<FilingAuthorizationAcknowledgementCode[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (initialAuthorization) {
      setView('ready');
      return;
    }
    if (!filingAuthorizationId) {
      setView('missing');
      setMessage('An exact Filing Authorization identity is required.');
      return;
    }
    setView('loading');
    void authorizationClient
      .get(filingAuthorizationId)
      .then((response) => {
        setAuthorization(response.filingAuthorization);
        setConsequences(response.consequences);
        setView('ready');
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'No authorization was changed.');
        setView(failureState(error));
      });
  }, [authorizationClient, filingAuthorizationId, initialAuthorization]);

  if (view === 'loading') return <LoadingState label="Loading exact authorization scope" />;
  if (view !== 'ready' && view !== 'confirming')
    return (
      <ErrorState
        title={stateTitle[view]}
        description={message || 'No authorization was changed.'}
        onRetry={() => location.reload()}
      />
    );
  if (!authorization) return null;

  const terminal = ['AUTHORIZED', 'STALE', 'EXPIRED', 'WITHDRAWN'].includes(authorization.status);
  const authorized = authorization.status === 'AUTHORIZED';
  const allChecked = checked.length === filingAuthorizationAcknowledgements.length;
  const source = authorization.durablePreparationSource;

  const confirm = async () => {
    if (!allChecked || terminal) return;
    setView('confirming');
    setMessage('');
    try {
      const response = await authorizationClient.confirm(
        authorization.filingAuthorizationId,
        checked
      );
      setAuthorization(response.filingAuthorization);
      setConsequences(response.consequences);
      setView('ready');
      history.replaceState(
        { filingAuthorizationId: response.filingAuthorization.filingAuthorizationId },
        '',
        `?filingAuthorizationId=${encodeURIComponent(response.filingAuthorization.filingAuthorizationId)}&workspaceId=${encodeURIComponent(workspaceId)}&scenario=authorized`
      );
    } catch (error) {
      if (error instanceof FilingAuthorizationHttpError && error.status === 409) {
        try {
          const current = await authorizationClient.get(authorization.filingAuthorizationId);
          setAuthorization(current.filingAuthorization);
          setConsequences(current.consequences);
        } catch {
          // Keep the exact reviewed record visible when current truth cannot be reloaded.
        }
      }
      setMessage(error instanceof Error ? error.message : 'No authorization was changed.');
      setView(failureState(error));
    }
  };

  const statusLabel = authorized
    ? 'Authorized · not submitted'
    : authorization.status === 'PENDING_CONFIRMATION'
      ? '9 confirmations required'
      : authorization.status;

  return (
    <section
      className="filing-authorization-workspace"
      aria-labelledby="filing-authorization-title"
    >
      <Button variant="secondary" onClick={() => history.back()}>
        ← Back to Preparation Lock
      </Button>
      <div className="filing-authorization-heading">
        <PageHeader
          title="Filing Authorization"
          description="Authorize one exact locked scope for internal execution review"
          actions={<Badge>{statusLabel}</Badge>}
        />
      </div>

      <Alert
        tone={authorized ? 'success' : terminal ? 'danger' : 'warning'}
        title={
          authorized
            ? 'Authorized for internal execution review — not submitted'
            : terminal
              ? `Authorization ${authorization.status.toLowerCase()} — no further action permitted`
              : 'Authorization is a protected boundary — not a submission'
        }
      >
        {authorized
          ? 'Execution may now perform a separate internal release review. No external filing, payment, appointment or office contact occurred.'
          : terminal
            ? 'This record remains visible as evidence. A new current source and governed review are required before any later authorization.'
            : 'Review the immutable source and every scope limit below. All nine confirmations must be actively completed.'}
      </Alert>

      <div className="filing-authorization-grid filing-authorization-grid--source">
        <Card>
          <p className="filing-authorization-eyebrow">Source 01 · immutable</p>
          <h2 id="filing-authorization-title">Preparation Lock</h2>
          <KeyValueList
            items={[
              { key: 'Lock ID', value: authorization.preparationLockId },
              { key: 'Lock version', value: authorization.preparationLockVersion },
              {
                key: 'Document Package',
                value: source
                  ? `${source.documentPackage.documentPackageId} · v${source.documentPackage.documentPackageVersion}`
                  : 'Legacy source — durable Package lineage unavailable'
              },
              {
                key: 'Completed review',
                value: `${authorization.professionalReviewCaseId} · ${authorization.professionalReviewVersion}`
              },
              {
                key: 'Evidence hash',
                value: source?.documentPackage.canonicalEvidenceHash ?? 'Not available'
              }
            ]}
          />
        </Card>
        <Card>
          <p className="filing-authorization-eyebrow">Scope 02 · exact</p>
          <h2>Filing subject</h2>
          <KeyValueList
            items={[
              { key: 'Applicant / owner', value: authorization.scope.applicantOwnerReference },
              { key: 'Trademark', value: authorization.scope.trademarkReference },
              { key: 'Jurisdiction', value: authorization.scope.jurisdiction },
              { key: 'Classes', value: authorization.scope.classes.join(', ') || 'None recorded' },
              {
                key: 'Goods / services',
                value: authorization.scope.goodsServices.join('; ') || 'None recorded'
              },
              { key: 'Filing basis', value: authorization.scope.filingBasis },
              { key: 'Priority claim', value: authorization.scope.priorityClaim ?? 'None' }
            ]}
          />
        </Card>
      </div>

      <Card>
        <p className="filing-authorization-eyebrow">Authority 03 · bounded</p>
        <h2>Who may authorize what</h2>
        <div className="filing-authorization-authority-summary">
          <div>
            <span>Authorized party</span>
            <strong>{authorization.authorizedParty.displayName}</strong>
            <small>{authorization.authorizedParty.partyId}</small>
          </div>
          <div>
            <span>Capacity</span>
            <strong>{authorization.authorizationCapacity.replaceAll('_', ' ')}</strong>
            <small>Authenticated Workspace identity</small>
          </div>
          <div>
            <span>Permitted channel</span>
            <strong>{authorization.scope.permittedFilingChannel.replaceAll('_', ' ')}</strong>
            <small>Later internal execution only</small>
          </div>
          <div>
            <span>Execution window</span>
            <strong>{formatDate(authorization.scope.permittedExecutionWindow.startsAt)}</strong>
            <small>until {formatDate(authorization.scope.permittedExecutionWindow.endsAt)}</small>
          </div>
        </div>
        <div className="filing-authorization-zero" aria-label="Actions not performed">
          {noAuthorityRows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </Card>

      {authorized ? (
        <Card>
          <p className="filing-authorization-eyebrow">Receipt 04 · durable</p>
          <h2>Authorization receipt</h2>
          <div className="filing-authorization-receipt">
            <div className="filing-authorization-receipt__mark" aria-hidden="true">
              ✓
            </div>
            <KeyValueList
              items={[
                { key: 'Authorization ID', value: authorization.filingAuthorizationId },
                { key: 'Version', value: String(authorization.version) },
                { key: 'Status', value: authorization.status },
                { key: 'Authorized at', value: formatDate(authorization.authorizedAt) },
                { key: 'Terms', value: authorization.termsVersion },
                {
                  key: 'Recorded confirmations',
                  value: `${authorization.acknowledgements.length} of 9`
                }
              ]}
            />
          </div>
          {consequences && Object.values(consequences).every((value) => value === false) && (
            <p className="filing-authorization-next">
              Next permitted action: <strong>Separate internal release review</strong>
            </p>
          )}
        </Card>
      ) : terminal ? null : (
        <Card>
          <div className="filing-authorization-checklist-heading">
            <div>
              <p className="filing-authorization-eyebrow">Confirm 04 · active</p>
              <h2>Required confirmations</h2>
            </div>
            <div className="filing-authorization-progress" aria-live="polite">
              <strong>{checked.length} / 9</strong>
              <span>confirmed</span>
            </div>
          </div>
          <div
            className="filing-authorization-progress-track"
            role="progressbar"
            aria-label="Authorization confirmations completed"
            aria-valuemin={0}
            aria-valuemax={9}
            aria-valuenow={checked.length}
          >
            <span style={{ width: `${(checked.length / 9) * 100}%` }} />
          </div>
          <fieldset disabled={view === 'confirming'}>
            <legend className="visually-hidden">Required filing authorization confirmations</legend>
            {groups.map((group, groupIndex) => (
              <section className="filing-authorization-check-group" key={group.title}>
                <div className="filing-authorization-check-group__heading">
                  <span>{String(groupIndex + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{group.title}</h3>
                    <p>{group.description}</p>
                  </div>
                </div>
                <div className="filing-authorization-checks">
                  {group.items.map((item) => (
                    <label key={item.code}>
                      <input
                        type="checkbox"
                        checked={checked.includes(item.code)}
                        onChange={(event) =>
                          setChecked((current) =>
                            event.target.checked
                              ? [...current, item.code]
                              : current.filter((code) => code !== item.code)
                          )
                        }
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </fieldset>
          <div className="filing-authorization-action">
            <div>
              <strong>One explicit decision</strong>
              <small>The owner service will record all nine confirmations as evidence.</small>
            </div>
            <Button disabled={!allChecked || view === 'confirming'} onClick={() => void confirm()}>
              {view === 'confirming'
                ? 'Recording authorization…'
                : 'Authorize internal execution review'}
            </Button>
          </div>
        </Card>
      )}
    </section>
  );
}
