import { useEffect, useMemo, useRef, useState } from 'react';
import type { MarkOrbitId, ProfessionalReviewCase } from '@markorbit/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  KeyValueList,
  LoadingState,
  PageHeader,
  Select,
  TextInput
} from '@markorbit/ui';
import type { FixtureState } from '../shared/view-models.js';
import {
  createProfessionalReviewClient,
  type ProfessionalReviewClient
} from '../../api/professional-review.js';

const reviewerId = 'reviewer_milestone' as MarkOrbitId;
export function ProfessionalReview({
  state,
  initialSelected,
  client,
  workspaceId = ''
}: {
  state: FixtureState;
  initialSelected?: string;
  client?: ProfessionalReviewClient;
  workspaceId?: string;
}) {
  const resolvedClient = useMemo(
    () => client ?? createProfessionalReviewClient(workspaceId),
    [client, workspaceId]
  );
  const [cases, setCases] = useState<ProfessionalReviewCase[]>([]);
  const [selected, setSelected] = useState<string | undefined>(initialSelected);
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const origin = useRef<string>();
  const priorWorkspace = useRef(workspaceId);
  const load = async () => {
    try {
      setCases((await resolvedClient.list()).reviewCases);
      setLoading(false);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Review queue unavailable.');
      setLoading(false);
    }
  };
  useEffect(() => {
    if (priorWorkspace.current !== workspaceId) {
      priorWorkspace.current = workspaceId;
      const query = new URLSearchParams(location.search);
      query.delete('professionalReviewCaseId');
      query.delete('professionalReviewCaseVersion');
      history.replaceState(null, '', `${location.pathname}?${query}${location.hash}`);
      setSelected(undefined);
      setCases([]);
    }
    void load();
  }, [resolvedClient, workspaceId]);
  const rows = useMemo(
    () => cases.filter((value) => status === 'ALL' || value.status === status),
    [cases, status]
  );
  const current = cases.find((value) => value.reviewCaseId === selected);
  const save = (value: ProfessionalReviewCase) =>
    setCases((items) =>
      items.map((item) => (item.reviewCaseId === value.reviewCaseId ? value : item))
    );
  if (loading || state === 'loading')
    return <LoadingState label="Loading professional review queue" />;
  if (error || state === 'error')
    return (
      <Alert tone="danger" title="Review queue unavailable">
        {error}
      </Alert>
    );
  if (current)
    return (
      <ReviewDetail
        value={current}
        client={resolvedClient}
        workspaceId={workspaceId}
        save={save}
        onBack={() => {
          setSelected(undefined);
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLButtonElement>(`[data-review-id="${origin.current}"]`)
              ?.focus()
          );
        }}
      />
    );
  return (
    <section aria-labelledby="review-queue-heading">
      <PageHeader
        title="Professional Review"
        description="Work / Professional Review · governed internal review queue"
        actions={<Badge>{rows.length} cases</Badge>}
      />
      <Alert tone="warning" title="Authority boundary">
        Matter Draft readiness ≠ professional approval. Queue assignment ≠ professional appointment.
      </Alert>
      <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option>ALL</option>
        <option>QUEUED</option>
        <option>IN_REVIEW</option>
        <option>REVIEWED_READY_FOR_NEXT_STEP</option>
      </Select>
      {rows.length ? (
        <div className="lite-list">
          {rows.map((value) => (
            <Card key={value.reviewCaseId}>
              <h2>{value.source.preparation.trademark}</h2>
              <Badge>{value.status}</Badge>
              <KeyValueList
                items={[
                  { key: 'Review case ID', value: value.reviewCaseId },
                  { key: 'Matter Draft ID', value: value.source.matterDraftId },
                  { key: 'Source Matter Draft version', value: value.source.matterDraftVersion }
                ]}
              />
              <Button
                data-review-id={value.reviewCaseId}
                onClick={() => {
                  origin.current = value.reviewCaseId;
                  setSelected(value.reviewCaseId);
                }}
              >
                Open professional review
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No professional review cases"
          description="No review case matches these filters."
        />
      )}
    </section>
  );
}

function ReviewDetail({
  value,
  client,
  save,
  onBack,
  workspaceId
}: {
  value: ProfessionalReviewCase;
  client: ProfessionalReviewClient;
  save: (value: ProfessionalReviewCase) => void;
  onBack: () => void;
  workspaceId: string;
}) {
  const [rationale, setRationale] = useState('');
  const [professionalFinding, setProfessionalFinding] = useState('');
  const blocking = value.checklist.some(
    (item) => item.blocking && !['PASS', 'NOT_APPLICABLE'].includes(item.status)
  );
  const claimed = value.assignment.status === 'CLAIMED';
  const complete = value.status === 'REVIEWED_READY_FOR_NEXT_STEP';
  return (
    <section>
      <Button variant="secondary" onClick={onBack}>
        ← Back to review queue
      </Button>
      <PageHeader
        title={value.source.preparation.trademark ?? value.reviewCaseId}
        description={`Professional Review Case ${value.reviewCaseId}`}
        actions={<Badge>{value.status}</Badge>}
      />
      <Card>
        <h2>Exact Matter Draft snapshot</h2>
        <KeyValueList
          items={[
            { key: 'Matter Draft ID', value: value.source.matterDraftId },
            { key: 'Matter Draft version', value: value.source.matterDraftVersion },
            { key: 'Review version', value: String(value.version ?? 1) },
            { key: 'Customer Confirmation', value: value.source.confirmationId },
            { key: 'Customer', value: value.source.customerId }
          ]}
        />
      </Card>
      <Card>
        <h2>Professional-review checklist</h2>
        {value.checklist.map((item) => (
          <p key={item.code}>
            <strong>{item.code}</strong>: {item.status} — {item.explanation}
            {item.reviewerNote ? ` — ${item.reviewerNote}` : ''}
          </p>
        ))}
        {blocking && (
          <p role="status">
            Blocking FAIL or UNKNOWN items prevent completion. UNKNOWN never counts as PASS.
          </p>
        )}
        {value.decision && <p>Review decision version: {value.decision.decidedAt}</p>}
      </Card>
      {!claimed && (
        <Button
          onClick={() =>
            void client
              .claim(value.reviewCaseId, reviewerId, value.version ?? 1)
              .then(({ reviewCase }) => save(reviewCase))
          }
        >
          Claim review
        </Button>
      )}
      {claimed && blocking && (
        <>
          <TextInput
            label="Professional finding"
            value={professionalFinding}
            onChange={(event) => setProfessionalFinding(event.target.value)}
          />
          <Button
            disabled={!professionalFinding.trim()}
            onClick={() =>
              void client
                .checklist(
                  value.reviewCaseId,
                  reviewerId,
                  value.checklist.map((item) => ({
                    code: item.code,
                    status: 'PASS',
                    explanation: 'Exact source evidence reviewed.',
                    reviewerNote: professionalFinding.trim()
                  })),
                  value.version ?? 1
                )
                .then(({ reviewCase }) => save(reviewCase))
            }
          >
            Save Review Draft
          </Button>
        </>
      )}
      {claimed && !blocking && !complete && (
        <>
          <TextInput
            label="Review decision rationale"
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
          />
          <Button
            disabled={!rationale.trim()}
            onClick={() =>
              void client
                .complete(value.reviewCaseId, reviewerId, rationale, value.version ?? 1)
                .then(({ reviewCase }) => save(reviewCase))
            }
          >
            Mark reviewed and ready for next step
          </Button>
        </>
      )}
      {complete && (
        <>
          <Alert title="Ready for next step — no action executed">
            orderCreated: false · paymentCreated: false · formalMatterCreated: false ·
            providerAppointed: false · filingCreated: false · customerMessageSent: false
          </Alert>
          <a
            href={`/?documentPackageReviewCaseId=${encodeURIComponent(value.reviewCaseId)}&workspaceId=${encodeURIComponent(workspaceId)}`}
          >
            Start or resume Document Package
          </a>
        </>
      )}
    </section>
  );
}
