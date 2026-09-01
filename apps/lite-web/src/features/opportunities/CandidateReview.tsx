import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  OpportunityCandidate,
  OpportunityCandidateId,
  OpportunityCandidateStatus,
  OpportunityQualificationDecision,
  OpportunityQualificationOutcome
} from '@markorbit/contracts/product-loop';
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
  StatusBadge
} from '@markorbit/ui';
import {
  createOpportunityCandidateClient,
  OpportunityCandidateHttpError,
  type OpportunityCandidateClient
} from '../../api/opportunity-candidates.js';

type LoadState = 'loading' | 'ready' | 'error';

const candidateTone = (status: OpportunityCandidateStatus) =>
  status === 'OPEN' ? 'info' : status === 'UNDER_REVIEW' ? 'warning' : 'pending';

const outcomeTone = (outcome: OpportunityQualificationOutcome) =>
  outcome === 'QUALIFIED_FOR_MARKREG' ? 'success' : outcome === 'REJECTED' ? 'danger' : 'pending';

function errorCopy(error: unknown, subject: 'list' | 'detail') {
  const status = error instanceof OpportunityCandidateHttpError ? error.status : 503;
  if (status === 401)
    return {
      title: 'Sign in required',
      description: 'Your authenticated Core session is required to review Candidates.'
    };
  if (status === 403)
    return {
      title: 'Candidate Review unavailable',
      description: 'You do not have permission to read Candidates in this Workspace.'
    };
  if (status === 404)
    return {
      title: 'Candidate not found',
      description: 'This Candidate is unavailable in the current Workspace.'
    };
  return {
    title: 'Candidate Review temporarily unavailable',
    description: `The ${subject} could not be loaded. This failure is not an empty Workspace and no fixture data was substituted.`
  };
}

function CandidateStatus({ status }: { status: OpportunityCandidateStatus }) {
  return (
    <span className="candidate-status">
      <StatusBadge status={candidateTone(status)} /> <strong>Candidate status: {status}</strong>
    </span>
  );
}

function QualificationDecision({
  candidate,
  decision
}: {
  candidate: Readonly<OpportunityCandidate>;
  decision: Readonly<OpportunityQualificationDecision> | null;
}) {
  if (!decision)
    return (
      <Card>
        <h2>Qualification Decision</h2>
        <p className="candidate-no-decision">No Qualification Decision recorded</p>
        <p>Absence of a decision is not rejection, failure, or a negative qualification.</p>
      </Card>
    );
  const historical = decision.candidate.version !== candidate.version;
  return (
    <Card>
      <h2>Qualification Decision</h2>
      <p>
        <StatusBadge status={outcomeTone(decision.outcome)} />{' '}
        <strong>Qualification outcome: {decision.outcome}</strong>
      </p>
      {decision.outcome === 'QUALIFIED_FOR_MARKREG' && (
        <Alert tone="success" title="Human qualification">
          Human qualification considers this Candidate suitable for MarkReg handoff.
        </Alert>
      )}
      {historical && (
        <Alert tone="warning" title="Historical Candidate version">
          Qualification covers Candidate v{decision.candidate.version}. Current Candidate is v
          {candidate.version}.
        </Alert>
      )}
      <h3>Qualification reviewed</h3>
      <KeyValueList
        items={[
          { key: 'Candidate ID', value: decision.candidate.id },
          { key: 'Candidate version', value: String(decision.candidate.version) },
          {
            key: 'Expected fingerprint',
            value: decision.expectedCandidateFingerprintSha256
          },
          {
            key: 'Decision ID / version',
            value: `${decision.opportunityQualificationDecisionId} / v${decision.version}`
          },
          { key: 'Decided by Principal', value: decision.decidedByPrincipalId },
          { key: 'Decided at', value: decision.decidedAt },
          {
            key: 'Formal Opportunity created',
            value: decision.formalOpportunityCreated ? 'Yes' : 'No'
          },
          { key: 'Customer contacted', value: decision.customerContacted ? 'Yes' : 'No' }
        ]}
      />
      <h3>Rationale</h3>
      <p className="lite-long">{decision.rationale}</p>
    </Card>
  );
}

function CandidateDetail({
  candidateId,
  client,
  onBack
}: {
  candidateId: OpportunityCandidateId;
  client: OpportunityCandidateClient;
  onBack: () => void;
}) {
  const [state, setState] = useState<LoadState>('loading');
  const [candidate, setCandidate] = useState<OpportunityCandidate>();
  const [decision, setDecision] = useState<OpportunityQualificationDecision | null>(null);
  const [error, setError] = useState<unknown>();
  const load = useCallback(() => {
    setState('loading');
    setError(undefined);
    void Promise.all([client.load(candidateId), client.loadQualification(candidateId)]).then(
      ([nextCandidate, nextDecision]) => {
        setCandidate(nextCandidate);
        setDecision(nextDecision);
        setState('ready');
      },
      (cause: unknown) => {
        setError(cause);
        setState('error');
      }
    );
  }, [candidateId, client]);
  useEffect(load, [load]);
  return (
    <>
      <Button variant="secondary" onClick={onBack}>
        ← Back to Candidate Review
      </Button>
      {state === 'loading' ? (
        <LoadingState label="Loading Candidate detail" />
      ) : state === 'error' ? (
        <ErrorState {...errorCopy(error, 'detail')} onRetry={load} />
      ) : candidate ? (
        <>
          <PageHeader
            title={candidate.title}
            description="Opportunity Center / Candidate Review / Candidate detail"
            actions={<Badge>Read-only owner truth</Badge>}
          />
          <Alert title="Candidate boundary">
            Candidate is not confirmed customer demand. Qualification is not customer instruction.
          </Alert>
          <div className="lite-detail-grid">
            <Card>
              <h2>Candidate</h2>
              <CandidateStatus status={candidate.status} />
              <p className="lite-long">{candidate.serviceNeedSummary}</p>
              <KeyValueList
                items={[
                  { key: 'Candidate ID', value: candidate.opportunityCandidateId },
                  { key: 'Version', value: String(candidate.version) },
                  { key: 'Fingerprint', value: candidate.opportunityCandidateFingerprintSha256 },
                  {
                    key: 'Customer reference',
                    value: candidate.customerId ?? 'No customer reference recorded'
                  },
                  {
                    key: 'Observed at',
                    value: candidate.sources[0]?.observedAt ?? 'No source observation recorded'
                  },
                  { key: 'Created at', value: candidate.createdAt },
                  { key: 'Updated at', value: candidate.updatedAt }
                ]}
              />
            </Card>
            <Card>
              <h2>Source Evidence / Provenance</h2>
              {candidate.sources.length ? (
                <ol className="candidate-sources">
                  {candidate.sources.map((source) => (
                    <li
                      key={`${source.owner}:${source.kind}:${source.sourceId}:${source.sourceVersion}`}
                    >
                      <strong>
                        {source.owner} · {source.kind}
                      </strong>
                      <KeyValueList
                        items={[
                          {
                            key: 'Source ID / version',
                            value: `${source.sourceId} / v${source.sourceVersion}`
                          },
                          { key: 'Source fingerprint', value: source.sourceFingerprintSha256 },
                          { key: 'Observed at', value: source.observedAt },
                          {
                            key: 'Correlation reference',
                            value: source.correlationId ?? 'Not recorded'
                          }
                        ]}
                      />
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No source references recorded.</p>
              )}
            </Card>
          </div>
          <QualificationDecision candidate={candidate} decision={decision} />
          <Alert tone="warning" title="Authority Note">
            Reading or reviewing this Candidate does not contact a customer; create a Formal
            Opportunity, Intake, Order, or Matter; authorize payment; or authorize filing.
          </Alert>
        </>
      ) : null}
    </>
  );
}

export function CandidateReview({
  workspaceId,
  initialSelected,
  client: suppliedClient
}: {
  workspaceId: string;
  initialSelected?: string;
  client?: OpportunityCandidateClient;
}) {
  const client = useMemo(
    () => suppliedClient ?? createOpportunityCandidateClient(workspaceId),
    [suppliedClient, workspaceId]
  );
  const [state, setState] = useState<LoadState>('loading');
  const [items, setItems] = useState<readonly OpportunityCandidate[]>([]);
  const [nextCursor, setNextCursor] = useState<OpportunityCandidateId | null>(null);
  const [error, setError] = useState<unknown>();
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<OpportunityCandidateId | undefined>(
    initialSelected as OpportunityCandidateId | undefined
  );
  const originId = useRef<OpportunityCandidateId>();
  const load = useCallback(() => {
    setState('loading');
    setError(undefined);
    void client.list({ limit: 25 }).then(
      (page) => {
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setState('ready');
      },
      (cause: unknown) => {
        setError(cause);
        setState('error');
      }
    );
  }, [client]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!selected && originId.current) {
      document
        .querySelector<HTMLButtonElement>(`[data-candidate-id="${originId.current}"]`)
        ?.focus();
      originId.current = undefined;
    }
  }, [selected]);
  if (selected)
    return (
      <CandidateDetail
        candidateId={selected}
        client={client}
        onBack={() => setSelected(undefined)}
      />
    );
  const loadMore = () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    void client.list({ cursor: nextCursor, limit: 25 }).then(
      (page) => {
        setItems((current) => {
          const known = new Set(current.map((candidate) => candidate.opportunityCandidateId));
          return [
            ...current,
            ...page.items.filter((candidate) => !known.has(candidate.opportunityCandidateId))
          ];
        });
        setNextCursor(page.nextCursor);
        setLoadingMore(false);
      },
      () => {
        setLoadMoreError(true);
        setLoadingMore(false);
      }
    );
  };
  return (
    <>
      <PageHeader
        title="Opportunity Center"
        description="Candidate Review · Workspace-backed evidence for human qualification"
        actions={<Badge>Live · read-only</Badge>}
      />
      <Alert title="Candidate Review boundary">
        Candidate is not confirmed customer demand. Candidate existence does not mean a customer was
        contacted. Open detail to inspect any exact human Qualification Decision.
      </Alert>
      {state === 'loading' ? (
        <LoadingState label="Loading Opportunity Candidates" />
      ) : state === 'error' ? (
        <ErrorState {...errorCopy(error, 'list')} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No Opportunity Candidates"
          description="This Workspace has no Candidate records. No demo or fixture Candidates were substituted."
        />
      ) : (
        <>
          <div className="lite-list" aria-live="polite">
            {items.map((candidate) => (
              <Card key={candidate.opportunityCandidateId}>
                <div className="lite-row">
                  <div>
                    <h2>{candidate.title}</h2>
                    <p className="lite-long">{candidate.serviceNeedSummary}</p>
                  </div>
                  <CandidateStatus status={candidate.status} />
                </div>
                <KeyValueList
                  items={[
                    {
                      key: 'Candidate ID / version',
                      value: `${candidate.opportunityCandidateId} / v${candidate.version}`
                    },
                    {
                      key: 'Customer reference',
                      value: candidate.customerId ?? 'No customer reference recorded'
                    },
                    {
                      key: 'Provenance',
                      value: candidate.sources.length
                        ? candidate.sources
                            .map((source) => `${source.owner} · ${source.kind}`)
                            .join('; ')
                        : 'No source references recorded'
                    },
                    { key: 'Qualification state', value: 'Open detail to review decision' }
                  ]}
                />
                <Button
                  data-candidate-id={candidate.opportunityCandidateId}
                  onClick={() => {
                    originId.current = candidate.opportunityCandidateId;
                    setSelected(candidate.opportunityCandidateId);
                  }}
                >
                  Review Candidate details
                </Button>
              </Card>
            ))}
          </div>
          {loadMoreError && (
            <Alert tone="danger" title="More Candidates could not be loaded">
              Already loaded Candidates remain available. Try loading the next Gateway cursor again.
            </Alert>
          )}
          {nextCursor && (
            <div className="lite-pagination">
              <span>More Candidates are available.</span>
              <Button onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading more…' : 'Load more Candidates'}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
