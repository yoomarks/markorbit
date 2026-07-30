import { Alert, Button, Card, LoadingState } from '@markorbit/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MarkregClient } from '../api/markreg.js';
import { createMarkregClient } from '../api/markreg.js';
import { parseMarkregRoute, type MarkregRouteResult } from './markreg-route.js';

type Loaded = {
  record: Record<string, unknown>;
  actualId: string;
  actualVersion: string;
  status?: string;
};
type State =
  | { kind: 'LOADING' }
  | { kind: 'READY'; loaded: Loaded }
  | { kind: 'VERSION_MISMATCH'; loaded: Loaded }
  | { kind: 'ERROR'; title: string; retry: boolean };
const unwrap = (value: unknown): Record<string, unknown> => {
  const root = value as Record<string, unknown>;
  for (const key of [
    'intake',
    'recommendation',
    'quote',
    'confirmation',
    'matterDraft',
    'reviewCase',
    'preparationLock',
    'filingAuthorization'
  ])
    if (root[key] && typeof root[key] === 'object') return root[key] as Record<string, unknown>;
  return root;
};
const scalar = (value: unknown, fallback = '') =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
const identity = (record: Record<string, unknown>) =>
  scalar(Object.entries(record).find(([key]) => key.endsWith('Id'))?.[1]);
const version = (record: Record<string, unknown>, view: string) => {
  if (view === 'matter-draft') return scalar(record.updatedAt);
  if (view === 'documents')
    return scalar(
      (record.decision as Record<string, unknown> | undefined)?.decidedAt ?? record.updatedAt
    );
  if (view === 'preparation-lock')
    return `${scalar(record.documentPackageVersion)}:${scalar(record.instructionLedgerVersion)}`;
  return scalar(
    record.version ?? record.pricingRuleVersion ?? record.schemaVersion ?? record.updatedAt,
    '1'
  );
};

const defaultClient = createMarkregClient();
export function GovernedRouteEntry({
  search = window.location.search,
  client = defaultClient
}: {
  search?: string;
  client?: MarkregClient;
}) {
  const parsed: MarkregRouteResult = useMemo(() => parseMarkregRoute(search), [search]);
  const heading = useRef<HTMLHeadingElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ kind: 'LOADING' });
  useEffect(() => {
    if (parsed.kind !== 'VALID') {
      setState({
        kind: 'ERROR',
        title:
          parsed.kind === 'UNSUPPORTED_ROUTE'
            ? `Unsupported governed view: ${parsed.view}`
            : parsed.reason,
        retry: false
      });
      return;
    }
    setState({ kind: 'LOADING' });
    client
      .getGovernedRecord?.(parsed.route.view, parsed.route.recordId)
      .then((value) => {
        const record = unwrap(value);
        const loaded = {
          record,
          actualId: identity(record),
          actualVersion: version(record, parsed.route.view),
          status: typeof record.status === 'string' ? record.status : 'READY'
        };
        if (loaded.actualId !== parsed.route.recordId) {
          setState({
            kind: 'ERROR',
            title: 'The requested record was not found. No latest record was selected.',
            retry: false
          });
          return;
        }
        setState(
          loaded.actualVersion === parsed.route.expectedVersion
            ? { kind: 'READY', loaded }
            : { kind: 'VERSION_MISMATCH', loaded }
        );
      })
      .catch((error: Error) =>
        setState({
          kind: 'ERROR',
          title: error.message.includes('not found')
            ? 'The requested record was not found. No latest record was selected.'
            : 'The governed record service is unavailable.',
          retry: true
        })
      );
  }, [attempt, client, parsed]);
  useEffect(() => {
    if (state.kind === 'ERROR' || state.kind === 'VERSION_MISMATCH') heading.current?.focus();
  }, [state]);
  if (state.kind === 'LOADING')
    return (
      <main aria-label="Governed direct-link recovery">
        <LoadingState label="Loading exact governed record" />
      </main>
    );
  if (parsed.kind !== 'VALID' || state.kind === 'ERROR')
    return (
      <main aria-labelledby="route-recovery-heading">
        <h1 id="route-recovery-heading" ref={heading} tabIndex={-1}>
          {state.kind === 'ERROR' ? state.title : 'Invalid governed route'}
        </h1>
        {state.kind === 'ERROR' && state.retry && (
          <Button onClick={() => setAttempt((x) => x + 1)}>Retry same identity and version</Button>
        )}{' '}
        <a href="/">Back to MarkReg workspace</a>
      </main>
    );
  const loaded = state.loaded;
  const readOnly = ['STALE', 'WITHDRAWN', 'EXPIRED'].includes(loaded.status ?? '');
  return (
    <main aria-labelledby="governed-route-heading">
      <h1 id="governed-route-heading" ref={heading} tabIndex={-1}>
        {parsed.route.view}
      </h1>
      {state.kind === 'VERSION_MISMATCH' && (
        <Alert tone="warning" title="Version mismatch">
          Expected {parsed.route.expectedVersion}; actual {loaded.actualVersion}. Review or reload
          safely; progression is disabled.
        </Alert>
      )}
      {readOnly && (
        <Alert tone="warning" title={`${loaded.status} — read only`}>
          This evidence cannot progress the workflow.
        </Alert>
      )}
      <Card>
        <dl>
          <dt>Exact record ID</dt>
          <dd className="markreg-wrap">{loaded.actualId}</dd>
          <dt>Expected version</dt>
          <dd>{parsed.route.expectedVersion}</dd>
          <dt>Actual version</dt>
          <dd>{loaded.actualVersion}</dd>
          <dt>Governed status</dt>
          <dd>{loaded.status ?? 'READY'}</dd>
        </dl>
        <strong>
          No Order, filing, submission, appointment, payment, or official application is created by
          this view.
        </strong>
      </Card>
      <p>
        <Button onClick={() => location.reload()}>Reload exact record</Button>{' '}
        <a href="/">Back to MarkReg workspace</a>
      </p>
    </main>
  );
}
