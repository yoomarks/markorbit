import { Alert, Button, Card, KeyValueList, LoadingState } from '@markorbit/ui';
import { useCallback, useEffect, useState } from 'react';
import { TruthBadge, TruthContext } from './TruthContext.js';
import { MarkregApiError } from './api/errors.js';
import {
  createExaminationStageClient,
  type ExaminationStageClient,
  type ExaminationStageHistoryEntry,
  type ExaminationStageProjection,
  type ExaminationWorkflowState
} from './api/examination-stage.js';

const defaultClient = createExaminationStageClient();

const workflowLabels: Readonly<Record<ExaminationWorkflowState, string>> = Object.freeze({
  INTERNAL_PROCESSING: 'Internal processing',
  REVIEWED_PROVIDER_EVIDENCE: 'Reviewed provider evidence',
  WAITING_NO_ACTION: 'Waiting — no action indicated by the current internal workflow',
  CUSTOMER_ACTION_NEEDED: 'Customer action needed',
  CORRECTION_OR_REVIEW_ISSUE: 'Correction or review issue'
});

type State =
  | { kind: 'LOADING' }
  | { kind: 'READY'; value: ExaminationStageProjection }
  | { kind: 'ERROR'; status?: number };

const displayTimestamp = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

function HistoricalContext({ history }: { history: readonly ExaminationStageHistoryEntry[] }) {
  if (history.length === 0) return null;
  return (
    <details className="markreg-cockpit-secondary-details">
      <summary>Historical Examination context ({history.length})</summary>
      <TruthContext kind="HISTORICAL">Prior reviewed-evidence Examination context</TruthContext>
      <ol>
        {history.map((entry) => (
          <li key={entry.lifecycleEvent.id}>
            <strong>{entry.customerSafeLabel}</strong> · {workflowLabels[entry.workflowState]}
            <br />
            {entry.customerSafeSummary}
            <br />
            Occurred {displayTimestamp(entry.occurredAt)}
          </li>
        ))}
      </ol>
      <p>
        Historical context is not current trademark-office status and establishes no filing,
        deadline, payment, or external action.
      </p>
    </details>
  );
}

function ErrorState({ status, onRetry }: { status: number | undefined; onRetry: () => void }) {
  if (status === 409)
    return (
      <Alert tone="warning" title="Examination source needs review">
        <TruthBadge kind="UNAVAILABLE_STALE" /> The governed Examination source is stale or no
        longer matches the current Matter. No status has been guessed from older lifecycle data.{' '}
        <Button onClick={onRetry}>Reload</Button>
      </Alert>
    );
  if (status === 503)
    return (
      <Alert tone="warning" title="Examination source temporarily unavailable">
        <TruthBadge kind="UNAVAILABLE_STALE" /> Current governed Examination truth could not be
        established from the owner source. This is a source failure, not a “no Examination stage”
        result. <Button onClick={onRetry}>Retry</Button>
      </Alert>
    );
  if (status === 404)
    return (
      <Alert tone="warning" title="Formal Matter not available">
        <TruthBadge kind="UNAVAILABLE_STALE" /> This Matter could not be found in the current
        Workspace. No Examination state is shown.
      </Alert>
    );
  if (status === 401)
    return (
      <Alert tone="warning" title="Session required">
        <TruthBadge kind="UNAVAILABLE_STALE" /> Your authenticated session is required before this
        Matter can be read.
      </Alert>
    );
  return (
    <Alert tone="warning" title="Examination stage unavailable">
      <TruthBadge kind="UNAVAILABLE_STALE" /> The governed Examination read could not be loaded. No
      status or deadline has been inferred. <Button onClick={onRetry}>Retry</Button>
    </Alert>
  );
}

export function ExaminationPanel({
  formalMatterId,
  client = defaultClient
}: {
  formalMatterId: string;
  client?: ExaminationStageClient;
}) {
  const [state, setState] = useState<State>({ kind: 'LOADING' });
  const load = useCallback(async () => {
    setState({ kind: 'LOADING' });
    try {
      setState({ kind: 'READY', value: await client.get(formalMatterId) });
    } catch (error) {
      setState({
        kind: 'ERROR',
        ...(error instanceof MarkregApiError && error.status ? { status: error.status } : {})
      });
    }
  }, [client, formalMatterId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'LOADING') return <LoadingState label="Loading Examination stage" />;
  if (state.kind === 'ERROR')
    return <ErrorState status={state.status} onRetry={() => void load()} />;

  const { value } = state;
  if (value.status === 'ESTABLISHED' && !value.current)
    return (
      <Alert tone="warning" title="Examination projection unavailable">
        <TruthBadge kind="UNAVAILABLE_STALE" /> The owner response did not contain the current
        Examination entry required by its established state. No fallback status has been inferred.
      </Alert>
    );

  return (
    <>
      <TruthContext
        kind="GOVERNED_INTERNAL"
        details={
          <p>
            Examination Stage is an internal MarkReg workflow projection from reviewed evidence. It
            is not trademark-office Official Status or deadline truth and authorizes no filing,
            submission, payment, provider contact, or office mutation.
          </p>
        }
      >
        Internal Examination workflow
      </TruthContext>

      {value.status === 'NOT_ESTABLISHED' ? (
        <Card>
          <div className="markreg-cockpit-card-heading">
            <h3>Examination not established</h3>
            <TruthBadge kind="GOVERNED_INTERNAL" />
          </div>
          <p>
            No governed Examination stage is currently established from available MarkReg lifecycle
            evidence.
          </p>
          <p>
            This successful empty projection does not establish whether examination has begun,
            whether an office action exists, or whether any official deadline exists.
          </p>
        </Card>
      ) : (
        value.current && (
          <Card>
            <div className="markreg-cockpit-card-heading">
              <h3>{value.current.customerSafeLabel}</h3>
              <TruthBadge kind="GOVERNED_INTERNAL" />
            </div>
            <p>{value.current.customerSafeSummary}</p>
            <div className="markreg-cockpit-source-row">
              <TruthBadge kind="REVIEWED_EVIDENCE" />
              <span>Source for this internal projection</span>
            </div>
            <KeyValueList
              items={[
                { key: 'Internal workflow', value: workflowLabels[value.current.workflowState] },
                { key: 'Currentness', value: 'Current' },
                {
                  key: 'Governed deadline',
                  value:
                    value.deadlineStatus === 'UNAVAILABLE'
                      ? 'Unavailable from this Examination projection'
                      : 'Unavailable'
                }
              ]}
            />
          </Card>
        )
      )}

      <HistoricalContext history={value.history} />
    </>
  );
}
