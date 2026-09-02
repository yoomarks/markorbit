import { Alert, Button, Card, KeyValueList, LoadingState } from '@markorbit/ui';
import { useCallback, useEffect, useState } from 'react';
import {
  createMatterIntelligenceClient,
  type MatterIntelligenceClient,
  type MatterIntelligenceProjection,
  type MatterIntelligenceReadItem,
  type MatterIntelligenceReview
} from './api/matter-intelligence.js';

const defaultClient = createMatterIntelligenceClient();

type State =
  | { kind: 'LOADING' }
  | { kind: 'READY'; value: MatterIntelligenceProjection }
  | { kind: 'ERROR' };

const displayTimestamp = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

function reviewSummary(review: MatterIntelligenceReview) {
  return [
    `v${review.reviewVersion}`,
    review.outcome,
    review.reason,
    displayTimestamp(review.reviewedAt)
  ]
    .filter(Boolean)
    .join(' · ');
}

function ObservationCard({ item }: { item: MatterIntelligenceReadItem }) {
  const { observation, currentReview } = item;
  const priorReviews = item.reviewHistory.filter(
    (review) => review.matterIntelligenceReviewId !== currentReview?.matterIntelligenceReviewId
  );

  return (
    <Card>
      <h3>Historical duration observation</h3>
      {!item.matterSourceCurrent && (
        <Alert tone="warning" title="Historical source">
          This observation is pinned to an older Formal Matter version or snapshot. Keep it as
          historical evidence; do not treat it as current Matter truth.
        </Alert>
      )}
      <KeyValueList
        items={[
          { key: 'Observation', value: observation.matterIntelligenceObservationId },
          { key: 'Recorded', value: displayTimestamp(observation.recordedAt) },
          {
            key: 'Observed completed duration',
            value: `${observation.observedCompletedDurationDays} days`
          },
          { key: 'Historical band', value: observation.historicalBand },
          {
            key: 'Matter source',
            value: item.matterSourceCurrent
              ? `Current · version ${observation.formalMatter.version}`
              : `Historical · version ${observation.formalMatter.version}`
          },
          {
            key: 'Capability',
            value: `${observation.capability.id}@${observation.capability.version}`
          },
          { key: 'Method', value: `${observation.methodRef} · ${observation.methodVersionRef}` },
          { key: 'Dataset', value: observation.researchDatasetRef }
        ]}
      />

      <h4>Human review</h4>
      {currentReview ? (
        <>
          <KeyValueList
            items={[
              { key: 'Current review', value: reviewSummary(currentReview) },
              ...(currentReview.rationale
                ? [{ key: 'Reviewer rationale', value: currentReview.rationale }]
                : [])
            ]}
          />
          <p>
            Human review records how this analytical observation was evaluated inside MarkReg. It is
            not external certification or Official Truth.
          </p>
        </>
      ) : (
        <p>No Human Intelligence Review has been recorded for this observation.</p>
      )}

      {priorReviews.length > 0 && (
        <details>
          <summary>Prior review history</summary>
          <ol>
            {priorReviews.map((review) => (
              <li key={review.matterIntelligenceReviewId}>{reviewSummary(review)}</li>
            ))}
          </ol>
          {!item.reviewHistoryComplete && (
            <p>
              Showing {item.reviewHistory.length} of {item.reviewHistoryTotal} review versions
              within the bounded read limit.
            </p>
          )}
        </details>
      )}

      <details>
        <summary>Analytical provenance</summary>
        <KeyValueList
          items={[
            { key: 'Method package', value: observation.methodPackageRef },
            { key: 'Evaluation', value: observation.evaluationRef },
            { key: 'Capability request', value: observation.capabilityRequestId },
            { key: 'Capability return', value: observation.capabilityReturnId },
            { key: 'Session receipt', value: observation.sessionReceiptId },
            { key: 'Output SHA-256', value: observation.outputFingerprintSha256 },
            { key: 'Evidence SHA-256', value: observation.evidenceFingerprintSha256 }
          ]}
        />
        {observation.evidenceRefs.length > 0 ? (
          <ul>
            {observation.evidenceRefs.map((reference) => (
              <li key={reference}>{reference}</li>
            ))}
          </ul>
        ) : (
          <p>No bounded evidence references are present in this observation.</p>
        )}
      </details>
    </Card>
  );
}

export function MatterIntelligencePanel({
  formalMatterId,
  client = defaultClient
}: {
  formalMatterId: string;
  client?: MatterIntelligenceClient;
}) {
  const [state, setState] = useState<State>({ kind: 'LOADING' });
  const load = useCallback(async () => {
    setState({ kind: 'LOADING' });
    try {
      setState({ kind: 'READY', value: await client.get(formalMatterId) });
    } catch {
      setState({ kind: 'ERROR' });
    }
  }, [client, formalMatterId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'LOADING') return <LoadingState label="Loading Matter intelligence" />;
  if (state.kind === 'ERROR')
    return (
      <Alert tone="warning" title="Matter intelligence unavailable">
        The governed analytical read could not be loaded. The Matter is unchanged.{' '}
        <Button onClick={() => void load()}>Retry</Button>
      </Alert>
    );

  return (
    <>
      <Alert tone="info" title="Descriptive analytical evidence">
        Matter Intelligence describes bounded historical evidence. It is not a prediction, deadline,
        SLA, legal conclusion, lifecycle status, trademark-office status, or Official Truth. Reading
        it does not authorize filing, payment, provider contact, or any external action.
      </Alert>
      {state.value.total === 0 ? (
        <Card>
          <p>
            No governed Matter Intelligence observations are recorded for this Formal Matter. This
            is a successful empty read, not a service failure.
          </p>
        </Card>
      ) : (
        <>
          {state.value.items.map((item) => (
            <ObservationCard key={item.observation.matterIntelligenceObservationId} item={item} />
          ))}
          {state.value.total > state.value.items.length && (
            <p>
              Showing {state.value.items.length} of {state.value.total} observations from this
              bounded read.
            </p>
          )}
        </>
      )}
    </>
  );
}
