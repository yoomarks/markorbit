import type {
  PreparedActionJourney,
  ProductLoopFeedbackOutcome,
  ProductLoopUseFeedback,
  PublishPackage,
  TodayRecommendation
} from '@markorbit/contracts/product-loop';
import { Alert, Badge, Button, Card, EmptyState } from '@markorbit/ui';
import type { TodayProductLoopSnapshot } from '../../api/product-loop.js';
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

function PreparedActionCard({
  workspaceId,
  recommendation,
  journey,
  busy,
  onPrepare,
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
  onPrepare: (recommendation: Readonly<TodayRecommendation>) => void;
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
