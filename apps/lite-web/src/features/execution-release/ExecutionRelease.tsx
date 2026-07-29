import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AuthorizationAuthorityConsequences,
  ExecutionRelease,
  FilingExecutionTaskDraft
} from '@markorbit/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  KeyValueList,
  LoadingState,
  PageHeader,
  Select,
  TextInput
} from '@markorbit/ui';
import { createLiteExecutionClient, type LiteExecutionClient } from '../../api/execution.js';
export type ReleaseViewState =
  | 'RELEASE_QUEUE_LOADING'
  | 'RELEASE_QUEUE_EMPTY'
  | 'RELEASE_DETAIL_LOADING'
  | 'RELEASE_BLOCKED'
  | 'RELEASE_READY'
  | 'RELEASING'
  | 'RELEASED_FOR_EXECUTION'
  | 'RELEASE_STALE'
  | 'RELEASE_WITHDRAWN'
  | 'RECOVERABLE_ERROR';
const falseConsequences: AuthorizationAuthorityConsequences = {
  orderCreated: false,
  paymentCreated: false,
  invoiceCreated: false,
  formalMatterCreated: false,
  professionalAppointed: false,
  providerAssignedExternally: false,
  filingCreated: false,
  filingSubmitted: false,
  officialApplicationCreated: false,
  officialApplicationNumberReceived: false,
  customerMessageSent: false,
  externalDocumentSent: false,
  trademarkOfficeContacted: false
};
const defaultExecutionClient = createLiteExecutionClient();
export function ExecutionReleaseView({
  client = defaultExecutionClient,
  fixtureReleases,
  state: initialState,
  initialFilingAuthorization
}: {
  client?: LiteExecutionClient;
  fixtureReleases?: ExecutionRelease[];
  state?: ReleaseViewState;
  long?: boolean;
  initialFilingAuthorization?: { id: string; version: number };
}) {
  const [view, setView] = useState<ReleaseViewState>(initialState ?? 'RELEASE_QUEUE_LOADING');
  const [releases, setReleases] = useState<ExecutionRelease[]>(fixtureReleases ?? []);
  const [selected, setSelected] = useState<ExecutionRelease>();
  const [task, setTask] = useState<FilingExecutionTaskDraft>();
  const [consequences, setConsequences] =
    useState<AuthorizationAuthorityConsequences>(falseConsequences);
  const [status, setStatus] = useState('ALL');
  const [jurisdiction, setJurisdiction] = useState('ALL');
  const [channel, setChannel] = useState('ALL');
  const [assignment, setAssignment] = useState('ALL');
  const [currency, setCurrency] = useState('CURRENT');
  const [rationale, setRationale] = useState('');
  const [message, setMessage] = useState('');
  const origin = useRef<string>();
  useEffect(() => {
    if (fixtureReleases) {
      setView(fixtureReleases.length ? 'RELEASE_BLOCKED' : 'RELEASE_QUEUE_EMPTY');
      return;
    }
    let active = true;
    void (
      initialFilingAuthorization
        ? client
            .createRelease({
              filingAuthorizationId:
                initialFilingAuthorization.id as `filing-authorization_${string}`,
              filingAuthorizationVersion: initialFilingAuthorization.version,
              requestedExecutionChannel: 'OFFICE_PORTAL',
              idempotencyKey: `execution-release:${initialFilingAuthorization.id}:${initialFilingAuthorization.version}`
            })
            .then((created) => ({
              executionReleases: [created.executionRelease],
              consequences: created.consequences
            }))
        : client.listReleases()
    )
      .then((r) => {
        if (active) {
          setReleases(r.executionReleases);
          setConsequences(r.consequences);
          setView(r.executionReleases.length ? 'RELEASE_BLOCKED' : 'RELEASE_QUEUE_EMPTY');
        }
      })
      .catch((e) => {
        if (active) {
          setMessage(e instanceof Error ? e.message : 'Release queue unavailable.');
          setView('RECOVERABLE_ERROR');
        }
      });
    return () => {
      active = false;
    };
  }, [client, fixtureReleases, initialFilingAuthorization]);
  const rows = useMemo(() => {
    const filtered = releases.filter(
      (r) =>
        (status === 'ALL' || r.status === status) &&
        (jurisdiction === 'ALL' || r.jurisdiction === jurisdiction) &&
        (channel === 'ALL' || r.requestedExecutionChannel === channel) &&
        (assignment === 'ALL' ||
          (assignment === 'ASSIGNED' && r.assignment.internalExecutorId) ||
          (assignment === 'UNASSIGNED' && !r.assignment.internalExecutorId)) &&
        (currency === 'ALL' || (currency === 'STALE' ? r.status === 'STALE' : r.status !== 'STALE'))
    );
    const source = releases.find((item) => item.executionReleaseId === origin.current);
    return source && !filtered.includes(source) ? [source, ...filtered] : filtered;
  }, [assignment, channel, currency, jurisdiction, releases, status]);
  const open = async (value: ExecutionRelease, button: HTMLButtonElement) => {
    origin.current = button.dataset['releaseId'];
    setView('RELEASE_DETAIL_LOADING');
    try {
      const r = fixtureReleases
        ? { executionRelease: value, consequences: falseConsequences }
        : await client.getRelease(value.executionReleaseId);
      setSelected(r.executionRelease);
      setConsequences(r.consequences);
      setView(
        r.executionRelease.status === 'READY_FOR_RELEASE'
          ? 'RELEASE_READY'
          : r.executionRelease.status === 'RELEASED_FOR_EXECUTION'
            ? 'RELEASED_FOR_EXECUTION'
            : r.executionRelease.status === 'STALE'
              ? 'RELEASE_STALE'
              : r.executionRelease.status === 'WITHDRAWN'
                ? 'RELEASE_WITHDRAWN'
                : 'RELEASE_BLOCKED'
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Release unavailable.');
      setView('RECOVERABLE_ERROR');
    }
  };
  const save = (r: ExecutionRelease) => {
    setSelected(r);
    setReleases((v) => v.map((x) => (x.executionReleaseId === r.executionReleaseId ? r : x)));
    setView(
      r.status === 'READY_FOR_RELEASE'
        ? 'RELEASE_READY'
        : r.status === 'RELEASED_FOR_EXECUTION'
          ? 'RELEASED_FOR_EXECUTION'
          : r.status === 'STALE'
            ? 'RELEASE_STALE'
            : r.status === 'WITHDRAWN'
              ? 'RELEASE_WITHDRAWN'
              : 'RELEASE_BLOCKED'
    );
  };
  const back = () => {
    setSelected(undefined);
    setTask(undefined);
    setView(releases.length ? 'RELEASE_BLOCKED' : 'RELEASE_QUEUE_EMPTY');
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`[data-release-id="${origin.current}"]`)?.focus()
    );
  };
  const evaluate = async () => {
    if (!selected) return;
    const r = await client.evaluateRelease(selected.executionReleaseId);
    setConsequences(r.consequences);
    save(r.executionRelease);
  };
  const assign = async () => {
    if (!selected) return;
    const r = await client.updateAssignment(selected.executionReleaseId, {
      internalExecutorId: 'executor_fixture'
    });
    setConsequences(r.consequences);
    save(r.executionRelease);
  };
  const release = async () => {
    if (!selected) return;
    setView('RELEASING');
    try {
      const r = await client.release(selected.executionReleaseId, {
        decidedBy: 'reviewer_fixture',
        rationale,
        idempotencyKey: `release:${selected.executionReleaseId}`
      });
      setConsequences(r.consequences);
      setTask(r.releaseResult.taskDraft);
      save(r.releaseResult.release);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Release failed.');
      setView('RECOVERABLE_ERROR');
    }
  };
  if (view === 'RELEASE_QUEUE_LOADING' || view === 'RELEASE_DETAIL_LOADING')
    return <LoadingState label="Loading Execution Release evidence" />;
  if (view === 'RECOVERABLE_ERROR')
    return <ErrorState title="Execution Release could not continue" description={message} />;
  if (!selected)
    return (
      <section aria-labelledby="release-queue-title">
        <PageHeader
          title="Execution Release"
          description="Work / Execution Release · internal governed release review"
          actions={<Badge>Governed evidence</Badge>}
        />
        <Alert tone="warning" title="Release ≠ Execution">
          No application is submitted, sent, paid, accepted, or professionally appointed here.
        </Alert>
        <Card>
          <h2 id="release-queue-title">Release queue filters</h2>
          <div className="lite-filters">
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>ALL</option>
              <option>BLOCKED</option>
              <option>READY_FOR_RELEASE</option>
            </Select>
            <Select
              label="Jurisdiction"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
            >
              <option>ALL</option>
              <option>GB</option>
              <option>US</option>
            </Select>
            <Select
              label="Execution channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option>ALL</option>
              <option>OFFICE_PORTAL</option>
              <option>INTERNAL_MANUAL_PREPARATION</option>
            </Select>
            <Select
              label="Assignment"
              value={assignment}
              onChange={(e) => setAssignment(e.target.value)}
            >
              <option>ALL</option>
              <option>ASSIGNED</option>
              <option>UNASSIGNED</option>
            </Select>
            <Select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option>CURRENT</option>
              <option>STALE</option>
              <option>ALL</option>
            </Select>
          </div>
        </Card>
        {view === 'RELEASE_QUEUE_EMPTY' || !rows.length ? (
          <EmptyState
            title="No Execution Releases"
            description="No releases match these retained filters."
          />
        ) : (
          <div className="lite-list">
            {rows.map((r) => (
              <Card key={r.executionReleaseId}>
                <h2>{r.executionReleaseId}</h2>
                <KeyValueList
                  items={[
                    { key: 'Filing Authorization', value: r.filingAuthorizationId },
                    { key: 'Customer', value: r.customerId },
                    { key: 'Jurisdiction', value: r.jurisdiction },
                    { key: 'Channel', value: r.requestedExecutionChannel },
                    { key: 'Status', value: r.status },
                    { key: 'Assignment', value: r.assignment.internalExecutorId ?? 'UNASSIGNED' }
                  ]}
                />
                <Button
                  data-release-id={r.executionReleaseId}
                  onClick={(e) => void open(r, e.currentTarget)}
                >
                  Open release
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    );
  return (
    <section aria-labelledby="release-title">
      <Button variant="secondary" onClick={back}>
        ← Back to release queue
      </Button>
      <PageHeader title="Execution Release" description="Work / Execution Release / Detail" />
      <Alert
        tone="warning"
        title={
          selected.status === 'RELEASED_FOR_EXECUTION'
            ? 'Released for execution — no external filing performed'
            : 'Release ≠ Execution'
        }
      >
        No external filing is performed by this release decision.
      </Alert>
      <Card>
        <h2 id="release-title">{selected.executionReleaseId}</h2>
        <Badge>{selected.status}</Badge>
        <KeyValueList
          items={[
            {
              key: 'Filing Authorization',
              value: `${selected.filingAuthorizationId} · version ${selected.filingAuthorizationVersion}`
            },
            {
              key: 'Preparation Lock',
              value: `${selected.preparationLockId} · ${selected.preparationLockVersion}`
            },
            {
              key: 'Professional Review',
              value: `${selected.professionalReviewCaseId} · ${selected.professionalReviewVersion}`
            },
            { key: 'Jurisdiction', value: selected.jurisdiction },
            { key: 'Execution channel', value: selected.requestedExecutionChannel },
            { key: 'Assignment', value: selected.assignment.internalExecutorId ?? 'UNASSIGNED' }
          ]}
        />
      </Card>
      <Card>
        <h2>Evidence-based release checks</h2>
        <ul>
          {selected.checks.map((c) => (
            <li key={c.code}>
              <strong>{c.code}:</strong> {c.status} — {c.explanation}
            </li>
          ))}
        </ul>
        <TextInput
          label="Internal release rationale"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          onInput={(e) => setRationale(e.currentTarget.value)}
        />
        <div className="release-actions">
          <Button
            disabled={
              selected.status === 'RELEASED_FOR_EXECUTION' ||
              view === 'RELEASE_STALE' ||
              view === 'RELEASE_WITHDRAWN'
            }
            onClick={() => void evaluate()}
          >
            Evaluate release
          </Button>
          <Button
            variant="secondary"
            disabled={selected.status === 'RELEASED_FOR_EXECUTION'}
            onClick={() => void assign()}
          >
            Assign internal executor
          </Button>
          <Button
            disabled={
              selected.status !== 'READY_FOR_RELEASE' ||
              !selected.assignment.internalExecutorId ||
              !rationale.trim()
            }
            onClick={() => void release()}
          >
            Release for execution
          </Button>
        </div>
      </Card>
      {task && (
        <Card>
          <h2>Filing Execution Task Draft</h2>
          <KeyValueList
            items={[
              { key: 'Task Draft ID', value: task.filingExecutionTaskDraftId },
              { key: 'Status', value: task.status },
              { key: 'Trademark', value: task.trademark },
              { key: 'Goods / services', value: task.goodsServices.join('; ') },
              ...Object.entries(consequences).map(([key, value]) => ({ key, value: String(value) }))
            ]}
          />
        </Card>
      )}
    </section>
  );
}
