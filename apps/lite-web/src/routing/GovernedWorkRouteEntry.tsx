import { Alert, Button, Card, LoadingState } from '@markorbit/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createLiteExecutionClient } from '../api/execution.js';
import { createProfessionalReviewClient } from '../api/professional-review.js';
import { parseLiteRoute } from './lite-route.js';

type Loaded = { record: Record<string, unknown>; id: string; version: string; status: string };
type State =
  | { kind: 'LOADING' }
  | { kind: 'READY' | 'VERSION_MISMATCH'; loaded: Loaded }
  | { kind: 'ERROR'; message: string; retry: boolean };
const reviewClient = createProfessionalReviewClient();
const executionClient = createLiteExecutionClient();
const scalar = (value: unknown, fallback = '') =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
async function load(view: string, id: string) {
  const response =
    view === 'professional-review'
      ? await reviewClient.get(id)
      : view === 'execution-release'
        ? await executionClient.getRelease(id)
        : await executionClient.getTaskDraft(id);
  const root = response as unknown as Record<string, unknown>;
  const record = (root.reviewCase ??
    root.executionRelease ??
    root.filingExecutionTaskDraft) as Record<string, unknown>;
  const actualId = scalar(
    record.reviewCaseId ?? record.executionReleaseId ?? record.filingExecutionTaskDraftId
  );
  return {
    record,
    id: actualId,
    version: scalar(record.version ?? record.updatedAt ?? record.schemaVersion, '1'),
    status: scalar(record.status, 'READY')
  };
}
export function GovernedWorkRouteEntry({ search = window.location.search }: { search?: string }) {
  const parsed = useMemo(() => parseLiteRoute(search), [search]);
  const heading = useRef<HTMLHeadingElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ kind: 'LOADING' });
  useEffect(() => {
    if (parsed.kind !== 'VALID') {
      setState({
        kind: 'ERROR',
        message:
          parsed.kind === 'UNSUPPORTED_ROUTE'
            ? `Unsupported Work view: ${parsed.view}`
            : parsed.reason,
        retry: false
      });
      return;
    }
    setState({ kind: 'LOADING' });
    load(parsed.route.view, parsed.route.recordId)
      .then((loaded) => {
        if (loaded.id !== parsed.route.recordId) {
          setState({
            kind: 'ERROR',
            message:
              'The requested Work record was not found. No queue item or latest record was selected.',
            retry: false
          });
          return;
        }
        setState({
          kind: loaded.version === parsed.route.expectedVersion ? 'READY' : 'VERSION_MISMATCH',
          loaded
        });
      })
      .catch((error: Error) =>
        setState({
          kind: 'ERROR',
          message: error.message.toLowerCase().includes('not found')
            ? 'The requested Work record was not found. No latest record was selected.'
            : 'The Work service is unavailable.',
          retry: true
        })
      );
  }, [attempt, parsed]);
  useEffect(() => {
    if (state.kind === 'ERROR' || state.kind === 'VERSION_MISMATCH') heading.current?.focus();
  }, [state]);
  if (state.kind === 'LOADING')
    return (
      <main aria-label="Work direct-link recovery">
        <LoadingState label="Loading exact Work record" />
      </main>
    );
  if (parsed.kind !== 'VALID' || state.kind === 'ERROR')
    return (
      <main aria-labelledby="work-recovery-heading">
        <h1 id="work-recovery-heading" ref={heading} tabIndex={-1}>
          {state.kind === 'ERROR' ? state.message : 'Invalid Work route'}
        </h1>
        {state.kind === 'ERROR' && state.retry && (
          <Button onClick={() => setAttempt((x) => x + 1)}>Retry same identity and version</Button>
        )}{' '}
        <a href="/?section=work">Back to Work</a>
      </main>
    );
  const { loaded } = state;
  const readOnly = ['STALE', 'WITHDRAWN', 'EXPIRED', 'CANCELLED'].includes(loaded.status);
  return (
    <main aria-labelledby="work-route-heading">
      <h1 id="work-route-heading" ref={heading} tabIndex={-1}>
        {parsed.route.view}
      </h1>
      {state.kind === 'VERSION_MISMATCH' && (
        <Alert tone="warning" title="Version mismatch">
          Expected {parsed.route.expectedVersion}; actual {loaded.version}. Progression is disabled.
        </Alert>
      )}
      {readOnly && (
        <Alert tone="warning" title={`${loaded.status} — read only`}>
          Review retained evidence; protected actions are unavailable.
        </Alert>
      )}
      <Card>
        <dl>
          <dt>Exact record ID</dt>
          <dd className="lite-long">{loaded.id}</dd>
          <dt>Expected version</dt>
          <dd>{parsed.route.expectedVersion}</dd>
          <dt>Actual version</dt>
          <dd>{loaded.version}</dd>
          <dt>Status</dt>
          <dd>{loaded.status}</dd>
        </dl>
        <strong>
          Internal Work evidence does not create appointment, execution, filing, submission, or an
          official application.
        </strong>
      </Card>
      <p>
        <Button onClick={() => location.reload()}>Reload exact record</Button>{' '}
        <a href="/?section=work">Back to Work</a>
      </p>
    </main>
  );
}
