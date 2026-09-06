import { Badge, Card } from '@markorbit/ui';
import type { DailyOrbitSnapshot } from '../../api/daily-workspace.js';
import type { TodayProductLoopSnapshot } from '../../api/product-loop.js';
import type { TodaySelection } from './today-types.js';
import './today-command.css';

function needsAttentionCount(today: Readonly<TodayProductLoopSnapshot> | undefined): number {
  if (!today) return 0;
  return today.items.filter(({ recommendation, preparedActions }) => {
    const journey = preparedActions[0];
    if (journey?.handoffState === 'AWAITING_CONFIRMATION') return true;
    if (journey?.handoffState === 'HANDOFF_PENDING') return true;
    return !journey && recommendation.kind === 'CONTENT_PREPARATION';
  }).length;
}

function continueState(selection: Readonly<TodaySelection>): {
  label: string;
  detail: string;
  href: string;
} {
  if (selection.preparedActionId)
    return {
      label: 'Prepared action selected',
      detail: 'Continue from the exact Prepared Action currently carried in this Today deep link.',
      href: '#today-actions'
    };
  if (selection.contentPickId)
    return {
      label: 'Content work selected',
      detail: 'Continue from the exact Content Pick currently carried in this Today deep link.',
      href: '#quick-create'
    };
  if (selection.recommendationId)
    return {
      label: 'Recommendation selected',
      detail: 'Continue from the exact Recommendation currently carried in this Today deep link.',
      href: '#today-actions'
    };
  return {
    label: 'No pinned work',
    detail: 'Nothing is being inferred from browser history. Choose current owner work below.',
    href: '#daily-orbit'
  };
}

export function TodayCommandCenter({
  today,
  orbit,
  explicitSelection
}: {
  today: Readonly<TodayProductLoopSnapshot> | undefined;
  orbit: Readonly<DailyOrbitSnapshot> | undefined;
  explicitSelection: Readonly<TodaySelection>;
}) {
  const attention = needsAttentionCount(today);
  const continuation = continueState(explicitSelection);
  return (
    <section className="today-command" aria-labelledby="today-command-heading">
      <div className="daily-section-heading">
        <div>
          <p className="daily-kicker">START HERE</p>
          <h2 id="today-command-heading">Today at a glance</h2>
          <p>Act first, understand state second, open exact evidence when you need it.</p>
        </div>
      </div>
      <div className="today-command__grid">
        <Card>
          <p className="daily-kicker">NEEDS ATTENTION</p>
          <div className="today-command__metric">
            <strong>{attention}</strong>
            <Badge>{attention ? 'Action available' : 'Clear'}</Badge>
          </div>
          <p>
            {attention
              ? 'Current durable Today state contains bounded actions that can be prepared, confirmed or retried.'
              : 'No currently loaded Today action requires confirmation or preparation.'}
          </p>
          <a href="#today-actions">Review Today Actions</a>
        </Card>
        <Card>
          <p className="daily-kicker">CONTINUE</p>
          <h3>{continuation.label}</h3>
          <p>{continuation.detail}</p>
          <a href={continuation.href}>Continue in context</a>
        </Card>
        <Card>
          <p className="daily-kicker">WHAT CHANGED?</p>
          <h3>{orbit?.items.length ?? 0} current ranked signals</h3>
          <p>
            The current owner contract does not produce a since-last-visit delta. Lite shows current
            ranked source truth below and does not infer that a signal is new or changed.
          </p>
          <a href="#daily-orbit">See current signals</a>
        </Card>
      </div>
    </section>
  );
}
