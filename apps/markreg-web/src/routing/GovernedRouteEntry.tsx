import type { FormalMatter } from '@markorbit/contracts';
import { Alert, Button, Card, LoadingState } from '@markorbit/ui';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  createDurablePreparationClient,
  type DurablePreparationClient,
  type DurablePreparationLockView
} from '../api/durable-preparation.js';
import { MarkregApiError } from '../api/errors.js';
import type { MarkregClient } from '../api/markreg.js';
import { createMarkregClient } from '../api/markreg.js';
import { CustomerConfirmationOrderEntry } from '../CustomerConfirmationOrderEntry.js';
import { FormalMatterWorkspace } from '../FormalMatterWorkspace.js';
import { OrderJourney } from '../OrderJourney.js';
import { parseMarkregRoute, type MarkregRoute, type MarkregRouteResult } from './markreg-route.js';

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
    'formalMatter',
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
  if (view === 'preparation-lock') return scalar(record.version, '1');
  return scalar(
    record.version ?? record.pricingRuleVersion ?? record.schemaVersion ?? record.updatedAt,
    '1'
  );
};

const defaultClient = createMarkregClient();
const defaultPreparationClient = createDurablePreparationClient();
export function GovernedRouteEntry({
  search = window.location.search,
  client = defaultClient,
  preparationClient = defaultPreparationClient
}: {
  search?: string;
  client?: MarkregClient;
  preparationClient?: DurablePreparationClient;
}) {
  const parsed = parseMarkregRoute(search);
  if (parsed.kind === 'VALID' && parsed.route.view === 'order')
    return (
      <OrderJourney
        orderId={parsed.route.recordId}
        expectedVersion={parsed.route.expectedVersion}
      />
    );
  if (parsed.kind === 'VALID' && parsed.route.view === 'customer-confirmation')
    return (
      <CustomerConfirmationOrderEntry
        confirmationId={parsed.route.recordId}
        expectedVersion={parsed.route.expectedVersion}
        client={client}
      />
    );
  return (
    <GenericGovernedRouteEntry
      parsed={parsed}
      client={client}
      preparationClient={preparationClient}
    />
  );
}

function loadRecord(
  client: MarkregClient,
  preparationClient: DurablePreparationClient,
  route: MarkregRoute
) {
  if (route.view === 'formal-matter') {
    if (!client.getFormalMatter)
      return Promise.reject(new Error('Formal Matter reader unavailable.'));
    return client.getFormalMatter(route.recordId);
  }
  if (route.view === 'preparation-lock') return preparationClient.validateCurrent(route.recordId);
  if (!client.getGovernedRecord)
    return Promise.reject(new Error('Governed record reader unavailable.'));
  return client.getGovernedRecord(route.view, route.recordId);
}

function readFailure(error: unknown): Extract<State, { kind: 'ERROR' }> {
  if (error instanceof Error && /not found/i.test(error.message))
    return {
      kind: 'ERROR',
      title: 'The requested record was not found. No latest record was selected.',
      retry: false
    };

  if (error instanceof MarkregApiError) {
    if (error.code?.includes('PERMISSION') || /permission/i.test(error.message))
      return {
        kind: 'ERROR',
        title: 'Workspace permission required',
        retry: false
      };
    if (error.kind === 'validation')
      return {
        kind: 'ERROR',
        title: 'The governed record request is invalid.',
        retry: false
      };
    if (error.kind === 'conflict')
      return {
        kind: 'ERROR',
        title: 'The governed record changed and cannot be loaded from this exact link.',
        retry: false
      };
    if (error.kind === 'blocking')
      return {
        kind: 'ERROR',
        title: 'The governed record could not be loaded safely.',
        retry: false
      };
  }

  return {
    kind: 'ERROR',
    title: 'The governed record service is unavailable.',
    retry: true
  };
}

function DurablePreparationRecord({ lock }: { lock: DurablePreparationLockView }) {
  return (
    <>
      <Alert tone="info" title="Current durable Preparation Lock">
        Preparation Lock ≠ Filing Authorization. Filing Authorization ≠ Filing Submission. This
        currentness check creates no payment, provider contact, external filing, or Official Truth.
      </Alert>
      <Card>
        <h2>Preparation state</h2>
        <dl>
          <dt>Preparation Lock</dt>
          <dd className="markreg-wrap">{lock.preparationLockId}</dd>
          <dt>Version</dt>
          <dd>{lock.version}</dd>
          <dt>Document Package</dt>
          <dd className="markreg-wrap">
            {lock.source.documentPackageId} · version {lock.source.documentPackageVersion}
          </dd>
          <dt>Created</dt>
          <dd>{lock.createdAt}</dd>
          <dt>Next permitted action</dt>
          <dd>Governed Filing Authorization review only</dd>
        </dl>
      </Card>
      <Card>
        <details>
          <summary>Exact source lineage and authority</summary>
          <dl>
            <dt>Canonical evidence hash</dt>
            <dd className="markreg-wrap">{lock.source.canonicalEvidenceHash}</dd>
            <dt>Formal Matter</dt>
            <dd className="markreg-wrap">
              {lock.source.formalMatterId} · version {lock.source.formalMatterVersion}
            </dd>
            <dt>Professional Review</dt>
            <dd className="markreg-wrap">
              {lock.source.professionalReviewCaseId} · version {lock.source.reviewVersion}
            </dd>
            <dt>Completed decision</dt>
            <dd className="markreg-wrap">{lock.source.completedDecisionId}</dd>
            <dt>Instruction entries</dt>
            <dd>{lock.source.instructionEntryCount}</dd>
            <dt>Instruction-set hash</dt>
            <dd className="markreg-wrap">{lock.source.instructionSetHash}</dd>
            <dt>Lock payload hash</dt>
            <dd className="markreg-wrap">{lock.lockPayloadHash}</dd>
          </dl>
          <ul>
            {Object.entries(lock.authority).map(([key, value]) => (
              <li key={key}>
                {key}: <strong>{String(value)}</strong>
              </li>
            ))}
          </ul>
        </details>
      </Card>
    </>
  );
}

function GenericGovernedRouteEntry({
  parsed,
  client,
  preparationClient
}: {
  parsed: MarkregRouteResult;
  client: MarkregClient;
  preparationClient: DurablePreparationClient;
}) {
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
    void loadRecord(client, preparationClient, parsed.route)
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
      .catch((error: unknown) => {
        setState(readFailure(error));
      });
  }, [attempt, client, parsed, preparationClient]);
  useLayoutEffect(() => {
    if (state.kind === 'ERROR') heading.current?.focus();
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

  if (parsed.route.view === 'formal-matter')
    return (
      <FormalMatterWorkspace
        matter={loaded.record as unknown as FormalMatter}
        expectedVersion={parsed.route.expectedVersion}
        actualVersion={loaded.actualVersion}
        versionMismatch={state.kind === 'VERSION_MISMATCH'}
        readOnly={readOnly}
      />
    );

  if (parsed.route.view === 'preparation-lock')
    return (
      <main aria-labelledby="governed-route-heading">
        <h1 id="governed-route-heading" ref={heading} tabIndex={-1}>
          Preparation Lock
        </h1>
        {state.kind === 'VERSION_MISMATCH' && (
          <Alert tone="warning" title="Version mismatch">
            Expected {parsed.route.expectedVersion}; actual {loaded.actualVersion}. Filing
            Authorization progression is disabled until the exact current link is reopened.
          </Alert>
        )}
        <DurablePreparationRecord lock={loaded.record as unknown as DurablePreparationLockView} />
        <p>
          <Button onClick={() => location.reload()}>Reload and revalidate current lock</Button>{' '}
          <a href="/">Back to MarkReg workspace</a>
        </p>
      </main>
    );

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
