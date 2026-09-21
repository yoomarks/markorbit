import { useEffect, useState } from 'react';
import { relationshipModels, type RelationshipModel } from '@markorbit/contracts';
import type {
  PreparedActionJourney,
  ProductLoopFeedbackOutcome,
  ProductLoopUseFeedback,
  PublishPackage,
  TodayRecommendation
} from '@markorbit/contracts/product-loop';
import { Alert, Badge, Button, Card, EmptyState } from '@markorbit/ui';
import {
  TodayHttpError,
  type OpportunityReviewEvidence,
  type TodayProductLoopSnapshot
} from '../../api/product-loop.js';
import { buildLiteHref } from '../../routing/workspace-navigation.js';
import type { TodayBusyState } from './today-types.js';

function kindLabel(kind: TodayRecommendation['kind']) {
  if (kind === 'CONTENT_PREPARATION') return 'Create';
  if (kind === 'OPPORTUNITY_REVIEW') return 'Review';
  if (kind === 'MARKREG_HANDOFF') return 'Move to MarkReg';
  return 'Follow up';
}

function actionStatus(journey: PreparedActionJourney) {
  if (journey.handoffState === 'HANDOFF_COMPLETED') return 'Completed';
  if (journey.handoffState === 'HANDOFF_PENDING') return 'Handoff pending';
  return 'Confirmation required';
}

const relationshipModelLabels: Readonly<Record<RelationshipModel, string>> = {
  DIRECT: 'Direct',
  CO_DELIVERY: 'Co-delivery',
  WHITE_LABEL: 'White label',
  REFERRAL: 'Referral',
  PLATFORM_ASSISTED: 'Platform assisted'
};

function opportunityErrorTitle(error: TodayHttpError) {
  if (error.status === 401) return 'Sign in required for Opportunity evidence';
  if (error.status === 403) return 'Opportunity evidence access denied';
  if (error.status === 404) return 'Opportunity evidence is no longer available';
  if (error.status === 503) return 'Opportunity evidence is temporarily unavailable';
  if (error.code === 'QUALIFICATION_ABSENT') return 'Qualification Decision is missing';
  if (error.code === 'CANDIDATE_NOT_QUALIFIED') return 'Candidate is not qualified for MarkReg';
  if (error.code === 'STALE_OPPORTUNITY_EVIDENCE')
    return 'Opportunity evidence changed after qualification';
  if (
    error.code === 'OPPORTUNITY_CANDIDATE_SOURCE_REQUIRED' ||
    error.code === 'OPPORTUNITY_CANDIDATE_SOURCE_INVALID'
  )
    return 'Recommendation Candidate source is unavailable';
  return 'Opportunity evidence cannot be prepared';
}

function OpportunityReviewCard({
  recommendation,
  busy,
  loadEvidence,
  onPrepare
}: {
  recommendation: Readonly<TodayRecommendation>;
  busy: TodayBusyState;
  loadEvidence: (
    recommendation: Readonly<TodayRecommendation>
  ) => Promise<OpportunityReviewEvidence>;
  onPrepare: (
    recommendation: Readonly<TodayRecommendation>,
    relationshipModel: RelationshipModel
  ) => void;
}) {
  const [evidence, setEvidence] = useState<OpportunityReviewEvidence>();
  const [error, setError] = useState<TodayHttpError>();
  const [relationshipModel, setRelationshipModel] = useState<RelationshipModel | ''>('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setEvidence(undefined);
    setError(undefined);
    loadEvidence(recommendation)
      .then((value) => {
        if (active) setEvidence(value);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof TodayHttpError
            ? cause
            : new TodayHttpError(
                503,
                'OPPORTUNITY_EVIDENCE_UNAVAILABLE',
                'Opportunity evidence could not be loaded.'
              )
        );
      });
    return () => {
      active = false;
    };
  }, [attempt, loadEvidence, recommendation]);

  const helperId = `relationship-model-help-${recommendation.todayRecommendationId}`;

  return (
    <Card>
      <div className="daily-card-heading">
        <div>
          <p className="daily-kicker">{kindLabel(recommendation.kind)}</p>
          <h3>{recommendation.title}</h3>
        </div>
        <Badge>{recommendation.status}</Badge>
      </div>
      <p>{recommendation.explanation}</p>

      {!evidence && !error ? (
        <div className="today-opportunity-loading" role="status" aria-live="polite">
          Loading exact Candidate and Qualification evidence…
        </div>
      ) : null}

      {error ? (
        <Alert
          tone={error.status === 401 || error.status === 403 ? 'warning' : 'info'}
          title={opportunityErrorTitle(error)}
        >
          <p>{error.message}</p>
          {error.status === 503 ? (
            <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
              Retry evidence
            </Button>
          ) : null}
        </Alert>
      ) : null}

      {evidence ? (
        <>
          <div className="today-opportunity-evidence" aria-label="Qualified Candidate evidence">
            <div>
              <span>Current Candidate</span>
              <strong>{evidence.candidate.title}</strong>
              <small>
                {evidence.candidate.status} · current version {evidence.candidate.version}
              </small>
            </div>
            <div>
              <span>Human Qualification</span>
              <strong>{evidence.qualification.outcome}</strong>
              <small>{evidence.qualification.rationale}</small>
            </div>
            <div>
              <span>Reviewed Candidate</span>
              <strong>
                {evidence.source.sourceId} · version {String(evidence.source.sourceVersion)}
              </strong>
              <code>{evidence.source.sourceFingerprintSha256}</code>
            </div>
            <div>
              <span>Evidence observed</span>
              <strong>{new Date(evidence.source.observedAt).toLocaleString()}</strong>
              <small>
                Qualification is human review evidence, not customer instruction or a Customer
                Relationship.
              </small>
            </div>
          </div>

          <fieldset className="today-relationship-fieldset" aria-describedby={helperId}>
            <legend>How would you work on this opportunity?</legend>
            <div className="today-relationship-options">
              {relationshipModels.map((model) => (
                <label key={model}>
                  <input
                    type="radio"
                    name={`relationship-model-${recommendation.todayRecommendationId}`}
                    value={model}
                    checked={relationshipModel === model}
                    onChange={() => setRelationshipModel(model)}
                  />
                  <span>{relationshipModelLabels[model]}</span>
                </label>
              ))}
            </div>
            <p id={helperId} className="daily-muted-block">
              {relationshipModel
                ? 'This selection is part of the proposed Formal Opportunity. It does not prove a current Customer Relationship.'
                : 'Select one relationship model before preparing. MarkOrbit will not infer one from Seed or Candidate data.'}
            </p>
          </fieldset>

          <Alert tone="info" title="Prepare is not execution">
            Preparing creates one reviewable Prepared Action from this exact qualified Candidate.
            The Formal Opportunity is created only after a separate explicit confirmation.
          </Alert>
          <Button
            onClick={() => {
              if (relationshipModel) onPrepare(recommendation, relationshipModel);
            }}
            disabled={busy !== '' || !relationshipModel}
          >
            {busy === 'prepare' ? 'Preparing…' : 'Prepare Formal Opportunity action'}
          </Button>
        </>
      ) : null}
    </Card>
  );
}

function PreparedActionCard({
  workspaceId,
  recommendation,
  journey,
  busy,
  loadOpportunityReview,
  onPrepare,
  onPrepareOpportunity,
  onConfirm
}: {
  workspaceId: string;
  recommendation: Readonly<TodayRecommendation>;
  journey?: Readonly<PreparedActionJourney>;
  busy: TodayBusyState;
  onPrepare: () => void;
  onConfirm: () => void;
}) {
  if (!journey) {
    return (
      <Card>
        <div className="daily-card-heading">
          <div>
            <p className="daily-kicker">{kindLabel(recommendation.kind)}</p>
            <h3>{recommendation.title}</h3>
          </div>
          <Badge>{recommendation.status}</Badge>
        </div>
        <p>{recommendation.explanation}</p>
        {recommendation.kind === 'CONTENT_PREPARATION' ? (
          <>
            <Alert title="What Prepare will do">
              Create one Lite-owned Content Opportunity from this exact Recommendation. It will not
              publish externally, contact a customer, create an Order or Matter, or submit a filing.
            </Alert>
            <Button onClick={onPrepare} disabled={busy !== ''}>
              {busy === 'prepare' ? 'Preparing…' : 'Prepare content action'}
            </Button>
          </>
        ) : (
          <Alert tone="info" title="Structured owner context required">
            Lite will not infer customer intent, qualification evidence or a formal instruction from
            display text.
          </Alert>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <div className="daily-card-heading">
        <div>
          <p className="daily-kicker">Prepared Action</p>
          <h3>{recommendation.title}</h3>
        </div>
        <Badge>{actionStatus(journey)}</Badge>
      </div>
      <p>{journey.preparedAction.summary}</p>
      <div className="today-confirmation-effect" role="note" aria-label="Confirmation effect">
        <strong>Confirmation effect</strong>
        <p>{journey.preparedAction.confirmationEffect}</p>
      </div>
      {journey.handoffState === 'AWAITING_CONFIRMATION' ? (
        <>
          <Alert tone="warning" title="Your confirmation is required">
            Review the effect above. Confirmation records your authenticated Core Principal and then
            attempts only the bounded owner handoff.
          </Alert>
          <Button onClick={onConfirm} disabled={busy !== ''}>
            {busy === 'confirm' ? 'Confirming…' : 'Confirm and hand off'}
          </Button>
        </>
      ) : journey.handoffState === 'HANDOFF_PENDING' ? (
        <>
          <Alert tone="warning" title="Confirmed · handoff pending">
            Confirmation is durable. Retrying reuses the existing confirmation and idempotency
            boundary.
          </Alert>
          <Button onClick={onConfirm} disabled={busy !== ''}>
            {busy === 'confirm' ? 'Retrying…' : 'Retry owner handoff'}
          </Button>
        </>
      ) : (
        <Alert tone="success" title="Owner handoff completed">
          <p>
            {journey.handoffResult?.owner} owns record{' '}
            <strong>{journey.handoffResult?.ownerRecord.id}</strong> · version{' '}
            {String(journey.handoffResult?.ownerRecord.version)}.
          </p>
          <p>
            No automatic publication, customer outreach, Order, Matter, payment, provider
            appointment, filing or Official Truth was created by this handoff.
          </p>
          {journey.handoffResult?.owner === 'LITE' &&
          journey.handoffResult.ownerRecord.id.startsWith('content-opportunity_') ? (
            <a
              href={buildLiteHref({
                surface: 'content',
                workspaceId,
                params: { contentOpportunityId: journey.handoffResult.ownerRecord.id }
              })}
            >
              Open durable work in Content Studio
            </a>
          ) : null}
        </Alert>
      )}
    </Card>
  );
}

function FeedbackSummary({
  pending,
  recent,
  busyPackageId,
  onRecord
}: {
  pending: ReadonlyArray<Readonly<PublishPackage>>;
  recent: ReadonlyArray<Readonly<ProductLoopUseFeedback>>;
  busyPackageId: string;
  onRecord: (publishPackage: Readonly<PublishPackage>, outcome: ProductLoopFeedbackOutcome) => void;
}) {
  if (!pending.length && !recent.length) return null;
  return (
    <Card>
      <div className="daily-card-heading">
        <div>
          <p className="daily-kicker">FEEDBACK</p>
          <h3>What happened after preparation?</h3>
        </div>
        <Badge>{pending.length + recent.length}</Badge>
      </div>
      <Alert tone="info" title="Reporting is not publication">
        These controls only record what a user says already happened outside MarkOrbit. They do not
        publish or independently verify the result.
      </Alert>
      {pending.map((publishPackage) => (
        <div className="daily-feedback-row" key={publishPackage.publishPackageId}>
          <div>
            <strong>{publishPackage.title}</strong>
            <span>{publishPackage.publishPackageId}</span>
          </div>
          <div className="daily-feedback-actions">
            {(
              [
                ['Published', 'USER_REPORTED_PUBLISHED'],
                ['Used', 'USER_REPORTED_USED'],
                ['Not used', 'NOT_USED']
              ] as const
            ).map(([label, outcome]) => (
              <Button
                key={outcome}
                variant="secondary"
                disabled={Boolean(busyPackageId)}
                onClick={() => onRecord(publishPackage, outcome)}
              >
                {busyPackageId === publishPackage.publishPackageId ? 'Saving…' : label}
              </Button>
            ))}
          </div>
        </div>
      ))}
      {recent.length ? (
        <details className="daily-provenance">
          <summary>Recent user-reported outcomes ({recent.length})</summary>
          <ul className="daily-reference-list">
            {recent.map((item) => (
              <li key={item.productLoopFeedbackId}>
                {item.outcome.replaceAll('_', ' ')} · {item.publishPackage.id}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

export function TodayMoveSection({
  workspaceId,
  today,
  selectionRecommendationId,
  selectedJourney,
  busy,
  feedbackBusyPackageId,
  onPrepare,
  onConfirm,
  onRecordFeedback
}: {
  workspaceId: string;
  today: Readonly<TodayProductLoopSnapshot> | undefined;
  selectionRecommendationId: string;
  selectedJourney?: Readonly<PreparedActionJourney>;
  busy: TodayBusyState;
  feedbackBusyPackageId: string;
  loadOpportunityReview: (
    recommendation: Readonly<TodayRecommendation>
  ) => Promise<OpportunityReviewEvidence>;
  onPrepare: (recommendation: Readonly<TodayRecommendation>) => void;
  onPrepareOpportunity: (
    recommendation: Readonly<TodayRecommendation>,
    relationshipModel: RelationshipModel
  ) => void;
  onConfirm: (journey: Readonly<PreparedActionJourney>) => void;
  onRecordFeedback: (
    publishPackage: Readonly<PublishPackage>,
    outcome: ProductLoopFeedbackOutcome
  ) => void;
}) {
  return (
    <section id="today-actions" className="daily-section" aria-labelledby="today-actions-heading">
      <div className="daily-section-heading">
        <div>
          <p className="daily-kicker">MOVE</p>
          <h2 id="today-actions-heading">Today Actions</h2>
          <p>Review the exact effect, then explicitly confirm the owner handoff.</p>
        </div>
        <Badge>{today?.items.length ?? 0}</Badge>
      </div>
      {today?.items.length ? (
        <div className="daily-action-stack">
          {today.items.map(({ recommendation, preparedActions }) => {
            const journey =
              recommendation.todayRecommendationId === selectionRecommendationId
                ? selectedJourney
                : preparedActions[0];
            if (!journey && recommendation.kind === 'OPPORTUNITY_REVIEW')
              return (
                <OpportunityReviewCard
                  key={recommendation.todayRecommendationId}
                  recommendation={recommendation}
                  busy={busy}
                  loadEvidence={loadOpportunityReview}
                  onPrepare={onPrepareOpportunity}
                />
              );
            return (
              <PreparedActionCard
                key={recommendation.todayRecommendationId}
                workspaceId={workspaceId}
                recommendation={recommendation}
                {...(journey ? { journey } : {})}
                busy={busy}
                onPrepare={() => onPrepare(recommendation)}
                onConfirm={() => {
                  if (journey) onConfirm(journey);
                }}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No Today Actions"
          description="There are no open durable Today Recommendations in this Workspace."
        />
      )}
      {today ? (
        <FeedbackSummary
          pending={today.feedbackPendingPackages}
          recent={today.recentFeedback}
          busyPackageId={feedbackBusyPackageId}
          onRecord={onRecordFeedback}
        />
      ) : null}
    </section>
  );
}
