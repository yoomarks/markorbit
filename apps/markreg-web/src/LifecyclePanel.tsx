import { Alert, Button, Card, LoadingState } from '@markorbit/ui';
import { useCallback, useEffect, useState } from 'react';
import { TruthBadge, TruthContext } from './TruthContext.js';
import { MarkregApiError } from './api/errors.js';
import './recommended-action/recommended-action.css';
import {
  createCustomerLifecycleClient,
  type CustomerLifecycleClient,
  type CustomerLifecycleSurface
} from './api/lifecycle.js';

const defaultClient = createCustomerLifecycleClient();

type State =
  | { kind: 'LOADING' }
  | { kind: 'READY'; value: CustomerLifecycleSurface }
  | {
      kind: 'ERROR';
      title: string;
      message: string;
      truth: 'UNAVAILABLE_STALE' | 'GOVERNED_INTERNAL';
    };

const statusCopy = {
  OPEN: 'Needs your review',
  ACKNOWLEDGED: 'Acknowledged',
  DISMISSED: 'Dismissed'
} as const;

function loadError(error: unknown): Extract<State, { kind: 'ERROR' }> {
  if (error instanceof MarkregApiError && (error.status === 401 || error.status === 403)) {
    return {
      kind: 'ERROR',
      title: 'Access required',
      message:
        'Your authenticated customer relationship does not allow this Matter lifecycle to be viewed.',
      truth: 'GOVERNED_INTERNAL'
    };
  }
  return {
    kind: 'ERROR',
    title: 'Lifecycle unavailable',
    message:
      'Lifecycle information is temporarily unavailable. No recommendation or Matter state is inferred.',
    truth: 'UNAVAILABLE_STALE'
  };
}

export function LifecyclePanel({
  formalMatterId,
  disabled = false,
  embedded = false,
  client = defaultClient
}: {
  formalMatterId: string;
  disabled?: boolean;
  embedded?: boolean;
  client?: CustomerLifecycleClient;
}) {
  const [state, setState] = useState<State>({ kind: 'LOADING' });
  const [mutation, setMutation] = useState<'ACKNOWLEDGE' | 'DISMISS' | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setState({ kind: 'LOADING' });
    try {
      setState({ kind: 'READY', value: await client.get(formalMatterId) });
    } catch (error) {
      setState(loadError(error));
    }
  }, [client, formalMatterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (target: 'ACKNOWLEDGE' | 'DISMISS') => {
    if (state.kind !== 'READY' || !state.value.recommendedAction || disabled) return;
    const action = state.value.recommendedAction;
    setMutationError(null);
    setMutation(target);
    try {
      if (target === 'ACKNOWLEDGE')
        await client.acknowledge(action.recommendedActionId, action.version);
      else await client.dismiss(action.recommendedActionId, action.version);
      await load();
    } catch (error) {
      setMutationError(
        error instanceof MarkregApiError && error.kind === 'conflict'
          ? 'This recommendation changed in another session. Its current version is still shown below; reload before deciding again.'
          : 'The recommendation could not be updated. Its current version remains visible and no external action was taken.'
      );
    } finally {
      setMutation(null);
    }
  };

  if (state.kind === 'LOADING') return <LoadingState label="Loading lifecycle status" />;
  if (state.kind === 'ERROR')
    return (
      <Alert tone="warning" title={state.title}>
        <TruthBadge kind={state.truth} /> {state.message}{' '}
        <Button onClick={() => void load()}>Retry</Button>
      </Alert>
    );

  const { lifecycle, timeline, recommendedAction, noAction } = state.value;
  const content = (
    <>
      {!embedded && (
        <TruthContext
          kind="GOVERNED_INTERNAL"
          details={
            <p>
              Lifecycle Projection is not trademark-office Official Status. Recommended Action is
              guidance, not authorization, and its acknowledge/dismiss controls execute no filing,
              payment, or external contact.
            </p>
          }
        >
          Current MarkReg lifecycle and recommendation
        </TruthContext>
      )}

      <div className="markreg-lifecycle-grid">
        <Card className="markreg-recommendation-card">
          <div className="markreg-cockpit-card-heading">
            <h3>Current recommended action</h3>
            <TruthBadge kind="GOVERNED_INTERNAL" />
          </div>
          <div aria-live="polite">
            {recommendedAction ? (
              <>
                <div className="markreg-recommendation-heading">
                  <div>
                    <span
                      className={`markreg-recommendation-status is-${recommendedAction.status.toLowerCase()}`}
                    >
                      {statusCopy[recommendedAction.status]}
                    </span>
                    <span className="markreg-recommendation-status-code">
                      Status: {recommendedAction.status}
                    </span>
                    <h4>{recommendedAction.title}</h4>
                  </div>
                  <span className="markreg-recommendation-version">
                    v{recommendedAction.version}
                  </span>
                </div>
                <p className="markreg-recommendation-explanation">
                  {recommendedAction.explanation}
                </p>
                {recommendedAction.timingBasis && (
                  <p className="markreg-recommendation-timing">
                    <strong>Timing basis</strong>
                    <span>{recommendedAction.timingBasis}</span>
                  </p>
                )}
                <div className="markreg-authority-lock" role="note">
                  <span aria-hidden="true">◎</span>
                  <span>
                    <strong>Execution authority: FALSE</strong>
                    Acknowledging or dismissing changes only your advisory state.
                  </span>
                </div>
                {mutationError && (
                  <Alert tone="warning" title="Recommendation not updated">
                    {mutationError}
                  </Alert>
                )}
                {recommendedAction.status === 'OPEN' && (
                  <div className="markreg-recommendation-actions">
                    <Button
                      disabled={disabled || mutation !== null}
                      onClick={() => void act('ACKNOWLEDGE')}
                    >
                      {mutation === 'ACKNOWLEDGE' ? 'Saving…' : 'Acknowledge'}
                    </Button>{' '}
                    <Button
                      disabled={disabled || mutation !== null}
                      onClick={() => void act('DISMISS')}
                    >
                      {mutation === 'DISMISS' ? 'Saving…' : 'Dismiss'}
                    </Button>
                  </div>
                )}
                {disabled && recommendedAction.status === 'OPEN' && (
                  <p className="markreg-recommendation-readonly">
                    Read only — this customer relationship may view the recommendation but cannot
                    change its advisory state.
                  </p>
                )}
                <details className="markreg-cockpit-inline-details">
                  <summary>Recommendation boundary</summary>
                  <p>
                    Recommended Action is governed product guidance, not authorization.
                    Acknowledging or dismissing does not execute, file, contact a provider, or pay
                    for anything.
                  </p>
                  <p>
                    Exact recommendation: {recommendedAction.recommendedActionId} · version{' '}
                    {recommendedAction.version} · updated{' '}
                    {new Date(recommendedAction.updatedAt).toLocaleString()}
                  </p>
                </details>
              </>
            ) : noAction ? (
              <p>No customer action is currently recommended.</p>
            ) : (
              <p>No current recommendation is available.</p>
            )}
          </div>
        </Card>

        <Card className="markreg-current-lifecycle-card">
          <div className="markreg-cockpit-card-heading">
            <h3>Current lifecycle</h3>
            <TruthBadge kind="GOVERNED_INTERNAL" />
          </div>
          {lifecycle ? (
            <>
              <strong>{lifecycle.customerSafeLabel}</strong>
              <p>{lifecycle.customerSafeSummary}</p>
              <small>Updated {new Date(lifecycle.updatedAt).toLocaleString()}</small>
            </>
          ) : (
            <p>No governed lifecycle view has been recorded for this Matter yet.</p>
          )}
        </Card>
      </div>

      <details className="markreg-lifecycle-history markreg-cockpit-secondary-details">
        <summary>Lifecycle history ({timeline.length})</summary>
        <TruthContext kind="HISTORICAL">Prior governed lifecycle context</TruthContext>
        <Card>
          {timeline.length === 0 ? (
            <p>No lifecycle events yet.</p>
          ) : (
            <ol>
              {timeline.map((event) => (
                <li key={event.lifecycleEventId}>
                  <strong>{event.customerSafeLabel}</strong>
                  <div>{event.customerSafeSummary}</div>
                  <small>{new Date(event.occurredAt).toLocaleString()}</small>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </details>
    </>
  );

  if (embedded) return content;
  return (
    <section aria-labelledby="matter-lifecycle-heading">
      <h2 id="matter-lifecycle-heading">Matter lifecycle</h2>
      {content}
    </section>
  );
}
