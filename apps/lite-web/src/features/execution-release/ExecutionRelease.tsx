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
import {
  createLiteExecutionClient,
  ExecutionHttpError,
  type LiteExecutionClient
} from '../../api/execution.js';

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

function viewForRelease(release: ExecutionRelease): ReleaseViewState {
  return release.status === 'READY_FOR_RELEASE'
    ? 'RELEASE_READY'
    : release.status === 'RELEASED_FOR_EXECUTION'
      ? 'RELEASED_FOR_EXECUTION'
      : release.status === 'STALE'
        ? 'RELEASE_STALE'
        : release.status === 'WITHDRAWN'
          ? 'RELEASE_WITHDRAWN'
          : 'RELEASE_BLOCKED';
}

function executionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ExecutionHttpError)
    return `${error.status} ${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : fallback;
}

export function ExecutionReleaseView({
  workspaceId,
  client,
  fixtureReleases,
  state: initialState,
  initialFilingAuthorization
}: {
  workspaceId: string;
  client?: LiteExecutionClient;
  fixtureReleases?: ExecutionRelease[];
  state?: ReleaseViewState;
  long?: boolean;
  initialFilingAuthorization?: { id: string; version: number };
}) {
  const executionClient = useMemo(
    () => client ?? createLiteExecutionClient(workspaceId),
    [client, workspaceId]
  );
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
      setView(initialState ?? (fixtureReleases.length ? 'RELEASE_BLOCKED' : 'RELEASE_QUEUE_EMPTY'));
      return;
    }
    let active = true;
    void (async () => {
      try {
        const loaded = initialFilingAuthorization
          ? await (async () => {
              const created = await executionClient.createRelease({
                filingAuthorizationId:
                  initialFilingAuthorization.id as `filing-authorization_${string}`,
                filingAuthorizationVersion: initialFilingAuthorization.version,
                requestedExecutionChannel: 'OFFICE_PORTAL',
                idempotencyKey: `execution-release:${initialFilingAuthorization.id}:${initialFilingAuthorization.version}`
              });
              const durable = await executionClient.getRelease(created.executionRelease.executionReleaseId);
              return {
                executionReleases: [durable.executionRelease],
                consequences: durable.consequences
              };
            })()
          : await executionClient.listReleases();
        if (!active) return;
        setReleases(loaded.executionReleases);
        setConsequences(loaded.consequences);
        setView(loaded.executionReleases.length ? 'RELEASE_BLOCKED' : 'RELEASE_QUEUE_EMPTY');
      } catch (error) {
        if (!active) return;
        setMessage(executionErrorMessage(error, 'Release queue unavailable.'));
        setView('RECOVERABLE_ERROR');
      }
    })();
    return () => {
      active = false;
    };
  }, [executionClient, fixtureReleases, initialFilingAuthorization, initialState]);

  const rows = useMemo(() => {
    const filtered = releases.filter(
      (release) =>
        (status === 'ALL' || release.status === status) &&
        (jurisdiction === 'ALL' || release.jurisdiction === jurisdiction) &&
        (channel === 'ALL' || release.requestedExecutionChannel === channel) &&
        (assignment === 'ALL' ||
          (assignment === 'ASSIGNED' && release.assignment.internalExecutorId) ||
          (assignment === 'UNASSIGNED' && !release.assignment.internalExecutorId)) &&
        (currency === 'ALL' ||
          (currency === 'STALE' ? release.status === 'STALE' : release.status !== 'STALE'))
    );
    const source = releases.find((item) => item.executionReleaseId === origin.current);
    return source && !filtered.includes(source) ? [source, ...filtered] : filtered;
  }, [assignment, channel, currency, jurisdiction, releases, status]);

  const applyDurableRelease = (release: ExecutionRelease) => {
    setSelected(release);
    setReleases((current) =>
      current.map((item) =>
        item.executionReleaseId === release.executionReleaseId ? release : item
      )
    );
    setView(viewForRelease(release));
  };

  const reloadRelease = async (executionReleaseId: string) => {
    const durable = await executionClient.getRelease(executionReleaseId);
    setConsequences(durable.consequences);
    applyDurableRelease(durable.executionRelease);
    return durable.executionRelease;
  };

  const handleCommandFailure = async (error: unknown, executionReleaseId: string) => {
    setMessage(executionErrorMessage(error, 'Execution Release command failed.'));
    if (error instanceof ExecutionHttpError && error.status === 409) {
      try {
        const durable = await executionClient.getRelease(executionReleaseId);
        setConsequences(durable.consequences);
        setSelected(durable.executionRelease);
        setReleases((current) =>
          current.map((item) =>
            item.executionReleaseId === durable.executionRelease.executionReleaseId
              ? durable.executionRelease
              : item
          )
        );
      } catch {
        // Keep the conflict visible even when the follow-up read is also unavailable.
      }
      setView('RELEASE_STALE');
      return;
    }
    setView('RECOVERABLE_ERROR');
  };

  const open = async (value: ExecutionRelease, button: HTMLButtonElement) => {
    origin.current = button.dataset['releaseId'];
    setMessage('');
    setView('RELEASE_DETAIL_LOADING');
    try {
      const result = fixtureReleases
        ? { executionRelease: value, consequences: falseConsequences }
        : await executionClient.getRelease(value.executionReleaseId);
      setSelected(result.executionRelease);
      setConsequences(result.consequences);
      setView(viewForRelease(result.executionRelease));
    } catch (error) {
      setMessage(executionErrorMessage(error, 'Release unavailable.'));
      setView('RECOVERABLE_ERROR');
    }
  };

  const back = () => {
    setSelected(undefined);
    setTask(undefined);
    setMessage('');
    setView(releases.length ? 'RELEASE_BLOCKED' : 'RELEASE_QUEUE_EMPTY');
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(`[data-release-id="${origin.current}"]`)
        ?.focus()
    );
  };

  const evaluate = async () => {
    if (!selected) return;
    setMessage('');
    try {
      await executionClient.evaluateRelease(selected.executionReleaseId);
      await reloadRelease(selected.executionReleaseId);
    } catch (error) {
      await handleCommandFailure(error, selected.executionReleaseId);
    }
  };

  const assign = async () => {
    if (!selected) return;
    setMessage('');
    try {
      await executionClient.updateAssignment(selected.executionReleaseId, {
        expectedVersion: selected.version
      });
      await reloadRelease(selected.executionReleaseId);
    } catch (error) {
      await handleCommandFailure(error, selected.executionReleaseId);
    }
  };

  const release = async () => {
    if (!selected) return;
    const executionReleaseId = selected.executionReleaseId;
    setMessage('');
    setView('RELEASING');
    try {
      await executionClient.release(executionReleaseId, {
        rationale,
        idempotencyKey: `release:${executionReleaseId}`
      });
      await reloadRelease(executionReleaseId);
      try {
        const durableTask = await executionClient.getTaskDraftForRelease(executionReleaseId);
        setTask(durableTask.filingExecutionTaskDraft);
        setConsequences(durableTask.consequences);
      } catch (error) {
        setMessage(
          `Release is durable, but its task receipt could not be reloaded: ${executionErrorMessage(
            error,
            'Task receipt unavailable.'
          )}`
        );
      }
    } catch (error) {
      await handleCommandFailure(error, executionReleaseId);
    }
  };

  if (view === 'RELEASE_QUEUE_LOADING' || view === 'RELEASE_DETAIL_LOADING')
    return <LoadingState label="Loading authenticated Execution Release evidence" />;
  if (view === 'RECOVERABLE_ERROR')
    return <ErrorState title="Execution Release could not continue" description={message} />;

  if (!selected)
    return (
      <section aria-labelledby="release-queue-title">
        <PageHeader
          title="Execution Release"
          description="Work / Execution Release · authenticated Workspace release governance"
          actions={<Badge>Authenticated Workspace</Badge>}
        />
        <Alert title="Current authenticated Workspace">
          Durable Execution Release truth is loaded through Workspace {workspaceId}.
        </Alert>
        <Alert tone="warning" title="Release ≠ Execution">
          No application is submitted, sent, paid, accepted, or professionally appointed here.
        </Alert>
        <Card>
          <h2 id="release-queue-title">Release queue filters</h2>
          <div className="lite-filters">
            <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option>ALL</option>
              <option>BLOCKED</option>
              <option>READY_FOR_RELEASE</option>
            </Select>
            <Select
              label="Jurisdiction"
              value={jurisdiction}
              onChange={(event) => setJurisdiction(event.target.value)}
            >
              <option>ALL</option>
              <option>GB</option>
              <option>US</option>
            </Select>
            <Select
              label="Execution channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              <option>ALL</option>
              <option>OFFICE_PORTAL</option>
              <option>INTERNAL_MANUAL_PREPARATION</option>
            </Select>
            <Select
              label="Assignment"
              value={assignment}
              onChange={(event) => setAssignment(event.target.value)}
            >
              <option>ALL</option>
              <option>ASSIGNED</option>
              <option>UNASSIGNED</option>
            </Select>
            <Select
              label="Currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
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
            {rows.map((release) => (
              <Card key={release.executionReleaseId}>
                <h2>{release.executionReleaseId}</h2>
                <KeyValueList
                  items={[
                    { key: 'Filing Authorization', value: release.filingAuthorizationId },
                    { key: 'Customer', value: release.customerId },
                    { key: 'Jurisdiction', value: release.jurisdiction },
                    { key: 'Channel', value: release.requestedExecutionChannel },
                    { key: 'Status', value: release.status },
                    {
                      key: 'Assignment',
                      value: release.assignment.internalExecutorId ?? 'UNASSIGNED'
                    }
                  ]}
                />
                <Button
                  data-release-id={release.executionReleaseId}
                  onClick={(event) => void open(release, event.currentTarget)}
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
      <PageHeader
        title="Execution Release"
        description={`Work / Execution Release / Authenticated Workspace ${workspaceId}`}
        actions={<Badge>Durable owner truth</Badge>}
      />
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
      {view === 'RELEASE_STALE' && (
        <Alert tone="warning" title="Execution Release changed">
          The previous command was rejected as stale. Current durable Workspace truth was reloaded;
          review it before trying another protected action.
        </Alert>
      )}
      {message && view !== 'RELEASE_STALE' && (
        <Alert tone="warning" title="Durable receipt warning">
          {message}
        </Alert>
      )}
      <Card>
        <h2 id="release-title">{selected.executionReleaseId}</h2>
        <Badge>{selected.status}</Badge>
        <KeyValueList
          items={[
            { key: 'Workspace', value: workspaceId },
            { key: 'Release version', value: String(selected.version) },
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
            {
              key: 'Current internal assignee',
              value: selected.assignment.internalExecutorId ?? 'UNASSIGNED'
            }
          ]}
        />
      </Card>
      <Card>
        <h2>Evidence-based release checks</h2>
        <ul>
          {selected.checks.map((check) => (
            <li key={check.code}>
              <strong>{check.code}:</strong> {check.status} — {check.explanation}
            </li>
          ))}
        </ul>
        <TextInput
          label="Internal release rationale"
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
          onInput={(event) => setRationale(event.currentTarget.value)}
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
            disabled={
              selected.status === 'RELEASED_FOR_EXECUTION' ||
              view === 'RELEASE_STALE' ||
              view === 'RELEASE_WITHDRAWN'
            }
            onClick={() => void assign()}
          >
            Assign to me
          </Button>
          <Button
            disabled={
              selected.status !== 'READY_FOR_RELEASE' ||
              !selected.assignment.internalExecutorId ||
              !rationale.trim() ||
              view === 'RELEASE_STALE'
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
