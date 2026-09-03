import { Alert, Button, Card, LoadingState } from '@markorbit/ui';
import { useCallback, useEffect, useState } from 'react';
import {
  createCustomerLifecycleClient,
  type CustomerLifecycleClient,
  type CustomerLifecycleSurface
} from './api/lifecycle.js';

const defaultClient = createCustomerLifecycleClient();

type State =
  | { kind: 'LOADING' }
  | { kind: 'READY'; value: CustomerLifecycleSurface }
  | { kind: 'ERROR'; message: string };

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
  const load = useCallback(async () => {
    setState({ kind: 'LOADING' });
    try {
      setState({ kind: 'READY', value: await client.get(formalMatterId) });
    } catch {
      setState({
        kind: 'ERROR',
        message: 'Lifecycle information is temporarily unavailable. The Matter itself is unchanged.'
      });
    }
  }, [client, formalMatterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (target: 'ACKNOWLEDGE' | 'DISMISS') => {
    if (state.kind !== 'READY' || !state.value.recommendedAction || disabled) return;
    const action = state.value.recommendedAction;
    setMutation(target);
    try {
      if (target === 'ACKNOWLEDGE')
        await client.acknowledge(action.recommendedActionId, action.version);
      else await client.dismiss(action.recommendedActionId, action.version);
      await load();
    } catch {
      setState({
        kind: 'ERROR',
        message:
          'The action changed or could not be updated. Reload the exact Matter before trying again.'
      });
    } finally {
      setMutation(null);
    }
  };

  if (state.kind === 'LOADING') return <LoadingState label="Loading lifecycle status" />;
  if (state.kind === 'ERROR')
    return (
      <Alert tone="warning" title="Lifecycle unavailable">
        {state.message} <Button onClick={() => void load()}>Retry</Button>
      </Alert>
    );

  const { lifecycle, timeline, recommendedAction, noAction } = state.value;
  const content = (
    <>
      {!embedded && (
        <Alert tone="info" title="Internal governed status">
          This lifecycle view helps track the Matter. It is not trademark-office status or proof of
          filing.
        </Alert>
      )}
      <Card>
        <h3>Current recommended action</h3>
        <div aria-live="polite">
          {recommendedAction ? (
            <>
              <strong>{recommendedAction.title}</strong>
              <p>{recommendedAction.explanation}</p>
              {recommendedAction.timingBasis && <p>{recommendedAction.timingBasis}</p>}
              <p>Status: {recommendedAction.status}</p>
              {recommendedAction.status === 'OPEN' && (
                <p>
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
                </p>
              )}
              <small>
                Recommended Action is governed product guidance, not authorization. Acknowledging or
                dismissing does not execute, file or pay for anything.
              </small>
            </>
          ) : noAction ? (
            <p>No customer action is currently recommended.</p>
          ) : (
            <p>No current recommendation is available.</p>
          )}
        </div>
      </Card>
      <Card>
        <h3>Current lifecycle</h3>
        {lifecycle ? (
          <>
            <strong>{lifecycle.customerSafeLabel}</strong>
            <p>{lifecycle.customerSafeSummary}</p>
            <small>
              Updated {new Date(lifecycle.updatedAt).toLocaleString()} · internal governed state,
              not official-office status
            </small>
          </>
        ) : (
          <p>No governed lifecycle view has been recorded for this Matter yet.</p>
        )}
      </Card>
      <details className="markreg-lifecycle-history">
        <summary>Lifecycle history ({timeline.length})</summary>
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
