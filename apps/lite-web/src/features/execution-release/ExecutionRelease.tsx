import {
  Alert,
  Badge,
  Button,
  Card,
  KeyValueList,
  LoadingState,
  PageHeader,
  Select
} from '@markorbit/ui';
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
export function ExecutionReleaseView({
  state = 'RELEASE_BLOCKED',
  long = false
}: {
  state?: ReleaseViewState;
  long?: boolean;
}) {
  if (state === 'RELEASE_QUEUE_LOADING' || state === 'RELEASE_DETAIL_LOADING')
    return <LoadingState label="Loading Execution Release evidence" />;
  return (
    <section aria-labelledby="release-title">
      <PageHeader
        title="Execution Release"
        description="Work / Execution Release · internal governed release review"
        actions={<Badge>Fixture evidence</Badge>}
      />
      <Alert
        tone="warning"
        title={
          state === 'RELEASED_FOR_EXECUTION'
            ? 'Released for execution — no external filing performed'
            : 'Release ≠ Execution'
        }
      >
        No application is submitted, sent, paid, accepted, or professionally appointed here.
      </Alert>
      <nav aria-label="Work sections">
        <a href="#customers">Customers</a> · <a href="#professional-review">Professional Review</a>{' '}
        · <a href="#execution-release">Execution Release</a>
      </nav>
      <Card>
        <h2>Release queue filters</h2>
        <div className="lite-filters">
          <Select label="Status" value="ALL">
            <option>ALL</option>
            <option>BLOCKED</option>
            <option>READY_FOR_RELEASE</option>
          </Select>
          <Select label="Jurisdiction" value="GB">
            <option>GB</option>
          </Select>
          <Select label="Execution channel" value="OFFICE_PORTAL">
            <option>OFFICE_PORTAL</option>
          </Select>
          <Select label="Assignment" value="ALL">
            <option>ALL</option>
            <option>UNASSIGNED</option>
          </Select>
          <Select label="Currency" value="CURRENT">
            <option>CURRENT</option>
            <option>STALE</option>
          </Select>
        </div>
      </Card>
      <Card>
        <h2 id="release-title">execution-release_012</h2>
        <Badge>{state}</Badge>
        <KeyValueList
          items={[
            { key: 'Filing Authorization', value: 'filing-authorization_012 · AUTHORIZED' },
            { key: 'Customer', value: 'MarkOrbit Labs Ltd' },
            { key: 'Trademark', value: 'MARKORBIT' },
            { key: 'Jurisdiction / classes', value: 'GB · 9, 35, 42' },
            { key: 'Channel', value: 'OFFICE_PORTAL' },
            { key: 'Assignment', value: 'executor_012 (internal only)' },
            { key: 'Age', value: '2 hours · current' },
            {
              key: 'Immutable Preparation Snapshot',
              value: long
                ? 'A very long immutable goods/services description that wraps without horizontal overflow on narrow screens.'
                : 'Preparation Lock 2:3'
            },
            {
              key: 'Source lineage',
              value: 'Professional Review review-v1 → Preparation Lock 2:3 → Authorization v2'
            }
          ]}
        />
      </Card>
      <Card>
        <h2>Evidence-based release checks</h2>
        <ul>
          <li>
            <strong>PREPARATION_LOCK_CURRENT:</strong> PASS — authoritative locked snapshot.
          </li>
          <li>
            <strong>FILING_AUTHORIZATION_CURRENT:</strong> PASS — exact authorized version.
          </li>
          <li>
            <strong>COMMERCIAL_SCOPE_UNCHANGED:</strong>{' '}
            {state === 'RELEASE_BLOCKED'
              ? 'UNKNOWN — blocking evidence is required.'
              : 'PASS — current evidence recorded.'}
          </li>
        </ul>
        <label htmlFor="rationale">Internal release rationale</label>
        <textarea id="rationale" rows={3} defaultValue="All governed evidence has been reviewed." />
        <div>
          <Button disabled={state !== 'RELEASE_BLOCKED'}>Evaluate release</Button>{' '}
          <Button variant="secondary">Assign internal executor</Button>{' '}
          <Button disabled={state !== 'RELEASE_READY'}>Release for execution</Button>{' '}
          <Button variant="secondary">Withdraw release</Button>
        </div>
      </Card>
      {state === 'RELEASED_FOR_EXECUTION' && (
        <Card>
          <h2>Filing Execution Task Draft</h2>
          <KeyValueList
            items={[
              { key: 'Task Draft ID', value: 'filing-task-draft_012' },
              { key: 'Status', value: 'PREPARED' },
              { key: 'Filing created', value: 'false' },
              { key: 'Filing submitted', value: 'false' },
              { key: 'Official number received', value: 'false' },
              { key: 'Trademark office contacted', value: 'false' },
              { key: 'External document sent', value: 'false' }
            ]}
          />
        </Card>
      )}
    </section>
  );
}
