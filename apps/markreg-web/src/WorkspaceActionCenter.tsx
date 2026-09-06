import { Alert, Card, ErrorState, LoadingState } from '@markorbit/ui';
import { useEffect, useState } from 'react';
import { MarkregApiError } from './api/errors.js';
import {
  createWorkspaceActionClient,
  type WorkspaceActionCenterView,
  type WorkspaceActionClient,
  type WorkspaceActionItemView
} from './api/workspace-action.js';
import { serializeMarkregRoute } from './routing/markreg-route.js';

type ActionCenterState =
  | { kind: 'LOADING' }
  | { kind: 'READY'; result: WorkspaceActionCenterView }
  | { kind: 'ERROR'; title: string; description: string; retryable: boolean };

const defaultClient = createWorkspaceActionClient();

function failure(error: unknown): Extract<ActionCenterState, { kind: 'ERROR' }> {
  if (error instanceof MarkregApiError) {
    if (error.kind === 'offline')
      return {
        kind: 'ERROR',
        title: 'Action Center is offline',
        description:
          'Reconnect to load the current Workspace Action projection. This failure is not being treated as an empty Action Center.',
        retryable: true
      };
    if (error.status === 401)
      return {
        kind: 'ERROR',
        title: 'Sign in to load Action Center',
        description:
          'An authenticated Workspace session is required. No action state is being inferred from cached or collection data.',
        retryable: false
      };
    if (error.status === 403)
      return {
        kind: 'ERROR',
        title: 'Workspace permission required',
        description:
          'Your current Workspace role cannot read the Action Center projection. Orders and Matters below remain separate reads.',
        retryable: false
      };
    if (error.status === 404)
      return {
        kind: 'ERROR',
        title: 'Action Center is unavailable for this Workspace',
        description:
          'The current Workspace Action projection was not found. This is not being converted into a successful empty state.',
        retryable: false
      };
  }
  return {
    kind: 'ERROR',
    title: 'Action Center temporarily unavailable',
    description:
      'MarkReg could not safely load the current Workspace Action projection. Existing durable records are unchanged, and this failure is not being treated as empty truth.',
    retryable: true
  };
}

const matterRoute = (item: WorkspaceActionItemView) =>
  serializeMarkregRoute({
    view: 'formal-matter',
    recordId: item.matterId,
    expectedVersion: String(item.matterVersion)
  });

function ActionItem({ item }: { item: WorkspaceActionItemView }) {
  const identity = item.trademark ?? item.matterId;
  return (
    <li>
      <Card>
        <article className="markreg-action-card">
          <header className="markreg-action-card-header">
            <div>
              <h4>{identity}</h4>
              <p className="markreg-action-card-currentness">{item.currentnessLabel}</p>
            </div>
            {item.jurisdiction && <span>{item.jurisdiction}</span>}
          </header>

          {item.actionTitle && (
            <div className="markreg-action-card-priority">
              <strong>{item.actionTitle}</strong>
              {item.actionExplanation && <p>{item.actionExplanation}</p>}
            </div>
          )}

          {item.lifecycleLabel && (
            <div className="markreg-action-card-context">
              <strong>{item.lifecycleLabel}</strong>
              {item.lifecycleSummary && <p>{item.lifecycleSummary}</p>}
            </div>
          )}

          {item.examinationLabel && (
            <div className="markreg-action-card-context">
              <strong>Examination view · {item.examinationLabel}</strong>
              {item.examinationSummary && <p>{item.examinationSummary}</p>}
            </div>
          )}

          <footer className="markreg-action-card-footer">
            <span>
              Changed <time dateTime={item.lastChangedAt}>{item.lastChangedAt}</time>
            </span>
            <a href={matterRoute(item)}>Open Matter</a>
          </footer>
        </article>
      </Card>
    </li>
  );
}

function ActionGroup({
  id,
  title,
  description,
  items
}: {
  id: string;
  title: string;
  description: string;
  items: readonly WorkspaceActionItemView[];
}) {
  return (
    <section className="markreg-action-group" aria-labelledby={id}>
      <div>
        <h3 id={id}>{title}</h3>
        <p>{description}</p>
      </div>
      {items.length ? (
        <ul className="markreg-action-list">
          {items.map((item) => (
            <ActionItem
              key={`${item.matterId}-${String(item.matterVersion)}-${item.lastChangedAt}`}
              item={item}
            />
          ))}
        </ul>
      ) : (
        <p className="markreg-action-group-empty">No items in this owner-projected group.</p>
      )}
    </section>
  );
}

export function WorkspaceActionCenter({
  workspaceKey,
  client = defaultClient
}: {
  /** Reload key only. The trusted Workspace is still resolved by the authenticated Gateway. */
  workspaceKey: string;
  client?: WorkspaceActionClient;
}) {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<ActionCenterState>({ kind: 'LOADING' });

  useEffect(() => {
    let active = true;
    setState({ kind: 'LOADING' });
    void client
      .get()
      .then((result) => {
        if (active) setState({ kind: 'READY', result });
      })
      .catch((error: unknown) => {
        if (active) setState(failure(error));
      });
    return () => {
      active = false;
    };
  }, [client, reloadToken, workspaceKey]);

  const empty =
    state.kind === 'READY' &&
    state.result.needsAttention.length === 0 &&
    state.result.waitingOrInProgress.length === 0 &&
    state.result.recentlyChanged.length === 0;

  return (
    <section className="markreg-action-center" aria-labelledby="workspace-action-center-heading">
      <header className="markreg-action-center-header">
        <div>
          <p className="markreg-action-center-kicker">Action Center</p>
          <h2 id="workspace-action-center-heading">What needs your attention</h2>
          <p>
            Start with owner-projected work, then inspect Service Orders and Formal Matters below.
            Recommendations guide review only; they do not authorize filing, payment, provider
            contact, or trademark-office action.
          </p>
        </div>
        {state.kind === 'READY' && (
          <p className="markreg-action-center-generated">
            Projection generated{' '}
            <time dateTime={state.result.generatedAt}>{state.result.generatedAt}</time>
          </p>
        )}
      </header>

      {state.kind === 'LOADING' && <LoadingState label="Loading current Workspace Action Center" />}

      {state.kind === 'ERROR' && (
        <ErrorState
          title={state.title}
          description={state.description}
          {...(state.retryable ? { onRetry: () => setReloadToken((value) => value + 1) } : {})}
        />
      )}

      {state.kind === 'READY' && state.result.truncated && (
        <Alert tone="warning" title="Bounded Action Center projection">
          MarkReg returned the bounded Workspace projection. Additional Formal Matters may exist;
          this notice does not imply urgency or Official Status.
        </Alert>
      )}

      {empty && (
        <Card>
          <h3>No current Action Center items</h3>
          <p>
            The authenticated owner returned a successful empty Workspace Action projection. This is
            a current empty result, not a dependency failure and not a statement about external
            trademark-office status.
          </p>
        </Card>
      )}

      {state.kind === 'READY' && !empty && (
        <div className="markreg-action-center-groups">
          <ActionGroup
            id="workspace-needs-attention-heading"
            title="Needs attention"
            description="Exact-current open Recommended Actions supplied by the MarkReg owner."
            items={state.result.needsAttention}
          />
          <ActionGroup
            id="workspace-waiting-heading"
            title="Waiting or in progress"
            description="Current Matters without an exact-current open action, including owner-marked stale or no-lifecycle cases."
            items={state.result.waitingOrInProgress}
          />
          <ActionGroup
            id="workspace-recently-changed-heading"
            title="Recently changed"
            description="Ordered by exact owner timestamps. Recency does not mean urgency."
            items={state.result.recentlyChanged}
          />
        </div>
      )}
    </section>
  );
}
