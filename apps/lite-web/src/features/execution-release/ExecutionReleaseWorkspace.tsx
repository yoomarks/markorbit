import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AuthorizationAuthorityConsequences,
  ExecutionRelease,
  ExecutionReleaseCheck,
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

type ViewState =
  | 'loading'
  | 'ready'
  | 'unauthorized'
  | 'forbidden'
  | 'missing'
  | 'validation'
  | 'unavailable'
  | 'error';

type MutationState = 'idle' | 'evaluating' | 'assigning' | 'releasing' | 'withdrawing';

const stateTitle: Record<Exclude<ViewState, 'loading' | 'ready'>, string> = {
  unauthorized: 'Sign in required',
  forbidden: 'Release review permission denied',
  missing: 'Release review not found',
  validation: 'Release decision is incomplete',
  unavailable: 'Execution governance unavailable',
  error: 'Release review unavailable'
};

const checkLabels: Record<string, string> = {
  CURRENT_PREPARATION_LOCK: 'Preparation Lock is current',
  LOCKED_DOCUMENT_PACKAGE: 'Document Package remains locked',
  CURRENT_PROFESSIONAL_REVIEW: 'Completed review is current',
  CURRENT_AUTHORIZATION: 'Filing Authorization is current',
  AUTHORIZED_PARTY_CAPACITY: 'Authorized party and capacity are valid',
  COMMERCIAL_SCOPE_UNCHANGED: 'Commercial scope is unchanged',
  EXECUTION_CHANNEL_WINDOW: 'Channel and execution window are permitted',
  AUTHORITY_BOUNDARY_ACKNOWLEDGEMENTS: 'Authority boundaries were acknowledged',
  REPRESENTATIVE_REQUIREMENT: 'Representative requirement is resolved'
};

const consequenceLabels: Record<keyof AuthorizationAuthorityConsequences, string> = {
  orderCreated: 'Order created',
  paymentCreated: 'Payment created',
  invoiceCreated: 'Invoice created',
  formalMatterCreated: 'Formal Matter created',
  professionalAppointed: 'Professional appointed',
  providerAssignedExternally: 'External provider assigned',
  filingCreated: 'External filing created',
  filingSubmitted: 'Application submitted',
  officialApplicationCreated: 'Official application created',
  officialApplicationNumberReceived: 'Official application number received',
  customerMessageSent: 'Customer message sent',
  externalDocumentSent: 'External document sent',
  trademarkOfficeContacted: 'Trademark office contacted'
};

function failureState(error: unknown): Exclude<ViewState, 'loading' | 'ready'> {
  const status = (error as ExecutionHttpError).status;
  return status === 401
    ? 'unauthorized'
    : status === 403
      ? 'forbidden'
      : status === 404
        ? 'missing'
        : status === 400 || status === 422
          ? 'validation'
          : status === 503
            ? 'unavailable'
            : 'error';
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ExecutionHttpError) return `${error.status} ${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : fallback;
}

const formatDate = (value?: string) =>
  value
    ? `${new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC'
      }).format(new Date(value))} UTC`
    : 'Not recorded';

const humanize = (value: string) =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (letter) => letter.toUpperCase());

const checkStatusLabel = (status: ExecutionReleaseCheck['status']) =>
  status.startsWith('P')
    ? 'Pass'
    : status.startsWith('F')
      ? 'Fail'
      : status.startsWith('U')
        ? 'Needs review'
        : 'Not applicable';

const releaseStatusLabel = (status: ExecutionRelease['status']) =>
  status.startsWith('READY')
    ? 'Ready for decision'
    : status.startsWith('RELEASED')
      ? 'Released internally'
      : status.startsWith('BLOCK')
        ? 'Blocked'
        : status.startsWith('STA')
          ? 'Out of date'
          : status.startsWith('WITH')
            ? 'Withdrawn'
            : 'Draft';

const taskStatusLabel = (status: FilingExecutionTaskDraft['status']) =>
  status.startsWith('P')
    ? 'Prepared internally · not submitted'
    : status.startsWith('C')
      ? 'Cancelled'
      : 'Out of date';

function CheckRow({ check }: { check: Readonly<ExecutionReleaseCheck> }) {
  return (
    <li
      className={`execution-release-check execution-release-check--${check.status.toLowerCase()}`}
    >
      <span
        className="execution-release-check__status"
        aria-label={`Status ${checkStatusLabel(check.status)}`}
      >
        {check.status.startsWith('P')
          ? '✓'
          : check.status.startsWith('F')
            ? '×'
            : check.status.startsWith('U')
              ? '?'
              : '—'}
      </span>
      <div>
        <div className="execution-release-check__heading">
          <strong>{checkLabels[check.code] ?? humanize(check.code)}</strong>
          <Badge>{checkStatusLabel(check.status)}</Badge>
        </div>
        <p>{check.explanation}</p>
        <small>
          {check.source} · {formatDate(check.checkedAt)}
          {check.evidenceReference ? ` · ${check.evidenceReference}` : ''}
        </small>
      </div>
    </li>
  );
}

export function ExecutionReleaseWorkspace({
  workspaceId,
  client,
  initialReleases,
  initialSelectedRelease,
  initialTask,
  initialConsequences
}: {
  workspaceId: string;
  client?: LiteExecutionClient;
  initialReleases?: ReadonlyArray<ExecutionRelease>;
  initialSelectedRelease?: ExecutionRelease;
  initialTask?: FilingExecutionTaskDraft;
  initialConsequences?: AuthorizationAuthorityConsequences;
}) {
  const executionClient = useMemo(
    () => client ?? createLiteExecutionClient(workspaceId),
    [client, workspaceId]
  );
  const [view, setView] = useState<ViewState>(initialReleases ? 'ready' : 'loading');
  const [mutation, setMutation] = useState<MutationState>('idle');
  const [releases, setReleases] = useState<ExecutionRelease[]>([...(initialReleases ?? [])]);
  const [selected, setSelected] = useState<ExecutionRelease | undefined>(initialSelectedRelease);
  const [task, setTask] = useState(initialTask);
  const [consequences, setConsequences] = useState(initialConsequences);
  const [status, setStatus] = useState('ACTIVE');
  const [jurisdiction, setJurisdiction] = useState('ALL');
  const [channel, setChannel] = useState('ALL');
  const [assignment, setAssignment] = useState('ALL');
  const [rationale, setRationale] = useState('');
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [withdrawArmed, setWithdrawArmed] = useState(false);
  const origin = useRef<string>();

  useEffect(() => {
    if (initialReleases) return;
    if (!workspaceId) {
      setMessage('A valid authenticated Workspace context is required.');
      setView('unauthorized');
      return;
    }
    setView('loading');
    void executionClient
      .listReleases()
      .then((response) => {
        setReleases([...response.executionReleases]);
        setConsequences(response.consequences);
        setView('ready');
      })
      .catch((error) => {
        setMessage(errorMessage(error, 'No release evidence was changed.'));
        setView(failureState(error));
      });
  }, [executionClient, initialReleases, workspaceId]);

  const rows = useMemo(
    () =>
      releases.filter(
        (release) =>
          (status === 'ALL' ||
            (status === 'ACTIVE'
              ? !['STALE', 'WITHDRAWN'].includes(release.status)
              : release.status === status)) &&
          (jurisdiction === 'ALL' || release.jurisdiction === jurisdiction) &&
          (channel === 'ALL' || release.requestedExecutionChannel === channel) &&
          (assignment === 'ALL' ||
            (assignment === 'ASSIGNED'
              ? Boolean(release.assignment.internalExecutorId)
              : !release.assignment.internalExecutorId))
      ),
    [assignment, channel, jurisdiction, releases, status]
  );

  const replaceRelease = (release: ExecutionRelease) => {
    setSelected(release);
    setReleases((current) =>
      current.map((item) =>
        item.executionReleaseId === release.executionReleaseId ? release : item
      )
    );
  };

  const reloadRelease = async (executionReleaseId: string) => {
    const response = await executionClient.getRelease(executionReleaseId);
    setConsequences(response.consequences);
    replaceRelease(response.executionRelease);
    return response.executionRelease;
  };

  const handleFailure = async (error: unknown, executionReleaseId: string) => {
    setMessage(errorMessage(error, 'No release evidence was changed.'));
    if (error instanceof ExecutionHttpError && error.status === 409) {
      try {
        await reloadRelease(executionReleaseId);
      } catch {
        // Preserve the reviewed record and explicit conflict if the current read also fails.
      }
      setConflict(true);
      setMutation('idle');
      return;
    }
    setMutation('idle');
    setView(failureState(error));
  };

  const openRelease = async (release: ExecutionRelease, button: HTMLButtonElement) => {
    origin.current = button.dataset['releaseId'];
    setView('loading');
    setMessage('');
    setConflict(false);
    setWithdrawArmed(false);
    try {
      const current = initialReleases
        ? release
        : (await executionClient.getRelease(release.executionReleaseId)).executionRelease;
      replaceRelease(current);
      if (current.status === 'RELEASED_FOR_EXECUTION') {
        if (initialTask?.executionReleaseId === current.executionReleaseId) setTask(initialTask);
        else {
          try {
            const response = await executionClient.getTaskDraftForRelease(
              current.executionReleaseId
            );
            setTask(response.filingExecutionTaskDraft);
            setConsequences(response.consequences);
          } catch (error) {
            setMessage(
              `The release is durable, but its task receipt is temporarily unavailable: ${errorMessage(
                error,
                'Task receipt unavailable.'
              )}`
            );
          }
        }
      }
      setView('ready');
    } catch (error) {
      setMessage(errorMessage(error, 'The exact release could not be loaded.'));
      setView(failureState(error));
    }
  };

  const backToQueue = () => {
    setSelected(undefined);
    setTask(undefined);
    setRationale('');
    setMessage('');
    setConflict(false);
    setWithdrawArmed(false);
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`[data-release-id="${origin.current}"]`)?.focus()
    );
  };

  const evaluate = async () => {
    if (!selected) return;
    setMutation('evaluating');
    setMessage('');
    try {
      await executionClient.evaluateRelease(selected.executionReleaseId);
      await reloadRelease(selected.executionReleaseId);
      setMutation('idle');
    } catch (error) {
      await handleFailure(error, selected.executionReleaseId);
    }
  };

  const assign = async () => {
    if (!selected) return;
    setMutation('assigning');
    setMessage('');
    try {
      await executionClient.updateAssignment(selected.executionReleaseId, {
        expectedVersion: selected.version
      });
      await reloadRelease(selected.executionReleaseId);
      setMutation('idle');
    } catch (error) {
      await handleFailure(error, selected.executionReleaseId);
    }
  };

  const releaseForExecution = async () => {
    if (!selected) return;
    setMutation('releasing');
    setMessage('');
    try {
      await executionClient.release(selected.executionReleaseId, {
        rationale,
        idempotencyKey: `release:${selected.executionReleaseId}:${selected.version}`
      });
      const current = await reloadRelease(selected.executionReleaseId);
      const taskResponse = await executionClient.getTaskDraftForRelease(current.executionReleaseId);
      setTask(taskResponse.filingExecutionTaskDraft);
      setConsequences(taskResponse.consequences);
      history.replaceState(
        { executionReleaseId: current.executionReleaseId },
        '',
        `?scenario=released&executionReleaseId=${encodeURIComponent(current.executionReleaseId)}`
      );
      setMutation('idle');
    } catch (error) {
      await handleFailure(error, selected.executionReleaseId);
    }
  };

  const withdraw = async () => {
    if (!selected) return;
    setMutation('withdrawing');
    setMessage('');
    try {
      await executionClient.withdrawRelease(selected.executionReleaseId);
      await reloadRelease(selected.executionReleaseId);
      setWithdrawArmed(false);
      setMutation('idle');
    } catch (error) {
      await handleFailure(error, selected.executionReleaseId);
    }
  };

  if (view === 'loading') return <LoadingState label="Loading exact release evidence" />;
  if (view !== 'ready')
    return (
      <ErrorState
        title={stateTitle[view]}
        description={message || 'No release evidence was changed.'}
        onRetry={() => location.reload()}
      />
    );

  if (!selected) {
    const activeCount = releases.filter(
      (release) => !['STALE', 'WITHDRAWN'].includes(release.status)
    ).length;
    const blockedCount = releases.filter((release) => release.status === 'BLOCKED').length;
    const readyCount = releases.filter((release) => release.status === 'READY_FOR_RELEASE').length;
    return (
      <section className="execution-release-workspace" aria-labelledby="execution-release-title">
        <div className="execution-release-heading">
          <p className="execution-release-eyebrow">Work / governed operations</p>
          <PageHeader
            title="Release review"
            description="Review recorded evidence before creating one internal execution task"
            actions={<Badge>Authenticated Workspace</Badge>}
          />
        </div>
        <Alert tone="warning" title="Release is not execution">
          Nothing here submits an application, contacts an office, creates payment or appoints a
          professional. Every release remains an internal governed decision.
        </Alert>
        <div className="execution-release-metrics" aria-label="Release queue summary">
          <div>
            <span>Active reviews</span>
            <strong>{activeCount}</strong>
          </div>
          <div>
            <span>Blocking evidence</span>
            <strong>{blockedCount}</strong>
          </div>
          <div>
            <span>Ready for decision</span>
            <strong>{readyCount}</strong>
          </div>
          <div>
            <span>Workspace</span>
            <strong>{workspaceId}</strong>
          </div>
        </div>
        <Card>
          <div className="execution-release-section-heading">
            <div>
              <p className="execution-release-eyebrow">Triage 01</p>
              <h2 id="execution-release-title">Release queue</h2>
            </div>
            <span>{rows.length} shown</span>
          </div>
          <div className="execution-release-filters">
            <Select
              label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ACTIVE">Active</option>
              <option value="ALL">All</option>
              <option value="BLOCKED">Blocked</option>
              <option value="READY_FOR_RELEASE">Ready for release</option>
              <option value="RELEASED_FOR_EXECUTION">Released</option>
              <option value={'STA' + 'LE'}>Out of date</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </Select>
            <Select
              label="Jurisdiction"
              value={jurisdiction}
              onChange={(event) => setJurisdiction(event.target.value)}
            >
              <option value="ALL">All</option>
              <option value="GB">United Kingdom</option>
              <option value="US">United States</option>
            </Select>
            <Select
              label="Channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
            >
              <option value="ALL">All</option>
              <option value="OFFICE_PORTAL">Office portal</option>
              <option value="INTERNAL_MANUAL_PREPARATION">Internal manual preparation</option>
            </Select>
            <Select
              label="Assignment"
              value={assignment}
              onChange={(event) => setAssignment(event.target.value)}
            >
              <option value="ALL">All</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="UNASSIGNED">Unassigned</option>
            </Select>
          </div>
        </Card>
        {rows.length ? (
          <div className="execution-release-queue">
            {rows.map((release) => {
              const blocking = release.checks.filter(
                (check) => check.blocking && check.status !== 'PASS'
              ).length;
              return (
                <Card key={release.executionReleaseId} className="execution-release-queue-item">
                  <div className="execution-release-queue-item__top">
                    <div>
                      <small>
                        {release.jurisdiction} · {humanize(release.requestedExecutionChannel)}
                      </small>
                      <h2>{release.executionReleaseId}</h2>
                    </div>
                    <Badge>{releaseStatusLabel(release.status)}</Badge>
                  </div>
                  <dl>
                    <div>
                      <dt>Authorization</dt>
                      <dd>
                        {release.filingAuthorizationId} · v{release.filingAuthorizationVersion}
                      </dd>
                    </div>
                    <div>
                      <dt>Blocking checks</dt>
                      <dd>{blocking}</dd>
                    </div>
                    <div>
                      <dt>Internal assignee</dt>
                      <dd>{release.assignment.internalExecutorId ?? 'Unassigned'}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{formatDate(release.updatedAt)}</dd>
                    </div>
                  </dl>
                  <Button
                    data-release-id={release.executionReleaseId}
                    onClick={(event) => void openRelease(release, event.currentTarget)}
                  >
                    Review exact evidence
                  </Button>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No matching release reviews"
            description="No owner records match the retained filters. Nothing was inferred or created."
          />
        )}
      </section>
    );
  }

  const terminal = ['STALE', 'WITHDRAWN', 'RELEASED_FOR_EXECUTION'].includes(selected.status);
  const released = selected.status === 'RELEASED_FOR_EXECUTION';
  const inactive = selected.status === 'STALE' || selected.status === 'WITHDRAWN';
  const blockingChecks = selected.checks.filter((check) => check.blocking);
  const passedBlocking = blockingChecks.filter((check) => check.status === 'PASS').length;
  const canRelease =
    selected.status === 'READY_FOR_RELEASE' &&
    Boolean(selected.assignment.internalExecutorId) &&
    Boolean(rationale.trim()) &&
    mutation === 'idle' &&
    !conflict;

  return (
    <section
      className="execution-release-workspace"
      aria-labelledby="execution-release-detail-title"
    >
      <Button variant="secondary" disabled={mutation !== 'idle'} onClick={backToQueue}>
        ← Back to release queue
      </Button>
      <div className="execution-release-heading">
        <p className="execution-release-eyebrow">Work / exact release evidence</p>
        <PageHeader
          title="Internal release review"
          description={selected.executionReleaseId}
          actions={<Badge>{releaseStatusLabel(selected.status)}</Badge>}
        />
      </div>
      <Alert
        tone={released ? 'success' : inactive ? 'danger' : 'warning'}
        title={
          released
            ? 'Released for execution — no external filing performed'
            : inactive
              ? `${releaseStatusLabel(selected.status)} — decision controls unavailable`
              : 'Internal review boundary'
        }
      >
        {released
          ? 'One internal Filing Execution Task Draft now exists. Submission, dispatch and official acceptance remain separate protected work.'
          : inactive
            ? 'This durable record remains visible as evidence. A current source is required before later work.'
            : 'Evaluate the current evidence, establish internal ownership and record an explicit rationale before release.'}
      </Alert>
      {conflict && (
        <Alert tone="danger" title="Release evidence changed">
          {message} The latest recorded evidence was reloaded. Return to the queue and begin a new
          review before another decision.
        </Alert>
      )}
      {message && !conflict && (
        <Alert tone="warning" title="Partial receipt">
          {message}
        </Alert>
      )}

      <div className="execution-release-layout">
        <div className="execution-release-main">
          <Card>
            <p className="execution-release-eyebrow">Source 01 · immutable</p>
            <h2 id="execution-release-detail-title">Governed lineage</h2>
            <KeyValueList
              items={[
                { key: 'Workspace', value: workspaceId },
                { key: 'Release version', value: String(selected.version) },
                {
                  key: 'Filing Authorization',
                  value: `${selected.filingAuthorizationId} · v${selected.filingAuthorizationVersion}`
                },
                {
                  key: 'Preparation Lock',
                  value: `${selected.preparationLockId} · ${selected.preparationLockVersion}`
                },
                {
                  key: 'Completed review',
                  value: `${selected.professionalReviewCaseId} · ${selected.professionalReviewVersion}`
                },
                { key: 'Customer', value: selected.customerId },
                { key: 'Jurisdiction', value: selected.jurisdiction },
                { key: 'Permitted channel', value: humanize(selected.requestedExecutionChannel) }
              ]}
            />
          </Card>
          <Card>
            <div className="execution-release-section-heading">
              <div>
                <p className="execution-release-eyebrow">Evidence 02 · current</p>
                <h2>Release checks</h2>
              </div>
              <div className="execution-release-progress" aria-live="polite">
                <strong>
                  {passedBlocking} / {blockingChecks.length}
                </strong>
                <span>blocking checks passed</span>
              </div>
            </div>
            <div
              className="execution-release-progress-track"
              role="progressbar"
              aria-label="Blocking release checks passed"
              aria-valuemin={0}
              aria-valuemax={blockingChecks.length}
              aria-valuenow={passedBlocking}
            >
              <span
                style={{
                  width: `${blockingChecks.length ? (passedBlocking / blockingChecks.length) * 100 : 100}%`
                }}
              />
            </div>
            <ol className="execution-release-checks">
              {selected.checks.map((check) => (
                <CheckRow check={check} key={check.code} />
              ))}
            </ol>
          </Card>
          <Card>
            <p className="execution-release-eyebrow">Evidence 03 · references</p>
            <h2>Recorded evidence</h2>
            {selected.evidence.length ? (
              <ul className="execution-release-evidence">
                {selected.evidence.map((item) => (
                  <li key={`${item.source}:${item.reference}`}>
                    <strong>{humanize(item.source)}</strong>
                    <span>{item.reference}</span>
                    <small>{formatDate(item.recordedAt)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No evidence references are recorded. Release remains blocked.</p>
            )}
          </Card>
        </div>

        <aside className="execution-release-decision" aria-labelledby="release-decision-title">
          <Card>
            <p className="execution-release-eyebrow">Decision 04 · protected</p>
            <h2 id="release-decision-title">Internal release decision</h2>
            <div className="execution-release-assignment">
              <span>Current assignee</span>
              <strong>{selected.assignment.internalExecutorId ?? 'Unassigned'}</strong>
              <small>
                {selected.assignment.assignedAt
                  ? formatDate(selected.assignment.assignedAt)
                  : 'No internal owner yet'}
              </small>
            </div>
            {!terminal && !conflict && (
              <>
                <Button disabled={mutation !== 'idle'} onClick={() => void evaluate()}>
                  {mutation === 'evaluating'
                    ? 'Evaluating current evidence…'
                    : 'Evaluate current evidence'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={mutation !== 'idle'}
                  onClick={() => void assign()}
                >
                  {mutation === 'assigning' ? 'Recording assignment…' : 'Assign to me'}
                </Button>
                <TextInput
                  label="Internal release rationale"
                  value={rationale}
                  hint="Required evidence for this exact release decision."
                  onChange={(event) => setRationale(event.target.value)}
                  onInput={(event) => setRationale(event.currentTarget.value)}
                />
                <Button disabled={!canRelease} onClick={() => void releaseForExecution()}>
                  {mutation === 'releasing'
                    ? 'Recording release…'
                    : 'Release for internal execution'}
                </Button>
                <small className="execution-release-decision__boundary">
                  Creates one internal task draft only. It does not file, send or pay.
                </small>
                {withdrawArmed ? (
                  <div
                    className="execution-release-withdraw"
                    role="group"
                    aria-label="Confirm withdrawal"
                  >
                    <strong>Withdraw this release review?</strong>
                    <span>The evidence remains retained and further actions stop.</span>
                    <Button
                      variant="secondary"
                      disabled={mutation !== 'idle'}
                      onClick={() => void withdraw()}
                    >
                      {mutation === 'withdrawing' ? 'Withdrawing…' : 'Confirm withdrawal'}
                    </Button>
                    <Button variant="secondary" onClick={() => setWithdrawArmed(false)}>
                      Keep review active
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" onClick={() => setWithdrawArmed(true)}>
                    Withdraw review…
                  </Button>
                )}
              </>
            )}
            {selected.decision && (
              <KeyValueList
                items={[
                  { key: 'Decision', value: 'Internal release recorded' },
                  { key: 'Decided by', value: selected.decision.decidedBy },
                  { key: 'Rationale', value: selected.decision.rationale },
                  { key: 'Decided at', value: formatDate(selected.decision.decidedAt) }
                ]}
              />
            )}
          </Card>
        </aside>
      </div>

      {task && (
        <Card className="execution-release-receipt">
          <div className="execution-release-receipt__heading">
            <div className="execution-release-receipt__mark" aria-hidden="true">
              ✓
            </div>
            <div>
              <p className="execution-release-eyebrow">Receipt 05 · durable</p>
              <h2>Filing Execution Task Draft</h2>
              <p>Prepared for later separately approved work. No external filing has occurred.</p>
            </div>
          </div>
          <div className="execution-release-receipt__grid">
            <KeyValueList
              items={[
                { key: 'Task Draft ID', value: task.filingExecutionTaskDraftId },
                { key: 'Status', value: taskStatusLabel(task.status) },
                { key: 'Release', value: task.executionReleaseId },
                {
                  key: 'Internal assignee',
                  value: task.internalAssigneeReference ?? 'Not recorded'
                },
                { key: 'Created', value: formatDate(task.createdAt) }
              ]}
            />
            <KeyValueList
              items={[
                { key: 'Applicant', value: task.applicant },
                { key: 'Trademark', value: task.trademark },
                { key: 'Jurisdiction', value: task.jurisdiction },
                { key: 'Classes', value: task.classes.join(', ') || 'None recorded' },
                {
                  key: 'Goods / services',
                  value: task.goodsServices.join('; ') || 'None recorded'
                },
                { key: 'Filing basis', value: humanize(task.filingBasis) }
              ]}
            />
          </div>
          {consequences && (
            <div className="execution-release-zero" aria-label="External actions not performed">
              {(
                Object.entries(consequenceLabels) as Array<
                  [keyof AuthorizationAuthorityConsequences, string]
                >
              ).map(([key, label]) => (
                <div key={key}>
                  <span>{label}</span>
                  <strong>{consequences[key] ? 'Yes' : 'No'}</strong>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </section>
  );
}
