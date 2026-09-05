import type { DailyOrbitItem } from '@markorbit/contracts/daily-workspace';
import { Badge, Button, Card, EmptyState } from '@markorbit/ui';
import type { DailyOrbitSnapshot } from '../../api/daily-workspace.js';
import type { TodayProductLoopSnapshot } from '../../api/product-loop.js';

function orbitTitle(
  item: Readonly<DailyOrbitItem>,
  today: Readonly<TodayProductLoopSnapshot> | undefined
): string {
  const recommendation = item.recommendation
    ? today?.items.find(
        (candidate) =>
          candidate.recommendation.todayRecommendationId === item.recommendation?.id &&
          candidate.recommendation.version === item.recommendation.version
      )?.recommendation
    : undefined;
  return recommendation?.title ?? `${item.source.kind} · ${item.source.sourceId}`;
}

function sourceLabel(item: Readonly<DailyOrbitItem>) {
  return `${item.source.owner}/${item.source.kind} · ${item.source.sourceId} · v${String(
    item.source.sourceVersion
  )}`;
}

function OrbitCard({
  item,
  title,
  saved,
  onSave,
  onDismiss
}: {
  item: Readonly<DailyOrbitItem>;
  title: string;
  saved: boolean;
  onSave: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card>
      <div className="daily-card-heading">
        <div>
          <p className="daily-kicker">{item.section.replaceAll('_', ' ')}</p>
          <h3>{title}</h3>
        </div>
        <span className="daily-score" aria-label={`Orbit score ${item.score.total}`}>
          {item.score.total}
        </span>
      </div>
      <p>{item.whyThisMatters}</p>
      <div className="daily-score-grid" aria-label="Explainable Orbit score">
        <span title={item.score.importance.reason}>Importance {item.score.importance.score}</span>
        <span title={item.score.personalRelevance.reason}>
          Relevance {item.score.personalRelevance.score}
        </span>
        <span title={item.score.timeSensitivity.reason}>
          Timing {item.score.timeSensitivity.score}
        </span>
        <span title={item.score.contentPotential.reason}>
          Content {item.score.contentPotential.score}
        </span>
      </div>
      <div className="daily-chip-row" aria-label="Orbit preference actions">
        <Button variant={saved ? 'secondary' : 'primary'} onClick={onSave} disabled={saved}>
          {saved ? 'Saved' : 'Save'}
        </Button>
        <Button variant="secondary" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <details className="daily-provenance">
        <summary>Source & ranking reasons</summary>
        <p>{sourceLabel(item)}</p>
        <p>{item.score.importance.reason}</p>
        <p>{item.score.personalRelevance.reason}</p>
        <p>{item.score.timeSensitivity.reason}</p>
        <p>{item.score.contentPotential.reason}</p>
        <code title={item.source.sourceFingerprintSha256}>
          {item.source.sourceFingerprintSha256.slice(0, 20)}…
        </code>
      </details>
    </Card>
  );
}

function OrbitSection({
  id,
  kicker,
  title,
  description,
  items,
  today,
  savedOrbitItemIds,
  ownerSavedOrbitItemIds,
  onPreference,
  empty
}: {
  id: 'daily-orbit' | 'worth-revisiting';
  kicker: string;
  title: string;
  description: string;
  items: ReadonlyArray<Readonly<DailyOrbitItem>>;
  today?: Readonly<TodayProductLoopSnapshot>;
  savedOrbitItemIds: ReadonlySet<string>;
  ownerSavedOrbitItemIds: readonly string[];
  onPreference: (kind: 'SAVED' | 'DISMISSED', item: Readonly<DailyOrbitItem>) => void;
  empty: React.ReactNode;
}) {
  const heading = `${id}-heading`;
  return (
    <section id={id} className="daily-section" aria-labelledby={heading}>
      <div className="daily-section-heading">
        <div>
          <p className="daily-kicker">{kicker}</p>
          <h2 id={heading}>{title}</h2>
          <p>{description}</p>
        </div>
        <Badge>{items.length}</Badge>
      </div>
      {items.length ? (
        <div className="daily-card-grid">
          {items.map((item) => (
            <OrbitCard
              key={item.dailyOrbitItemId}
              item={item}
              title={orbitTitle(item, today)}
              saved={
                savedOrbitItemIds.has(item.dailyOrbitItemId) ||
                ownerSavedOrbitItemIds.includes(item.dailyOrbitItemId)
              }
              onSave={() => onPreference('SAVED', item)}
              onDismiss={() => onPreference('DISMISSED', item)}
            />
          ))}
        </div>
      ) : (
        empty
      )}
    </section>
  );
}

export function TodaySeeSections({
  mainOrbit,
  revisiting,
  today,
  orbit,
  savedOrbitItemIds,
  onPreference
}: {
  mainOrbit: ReadonlyArray<Readonly<DailyOrbitItem>>;
  revisiting: ReadonlyArray<Readonly<DailyOrbitItem>>;
  today?: Readonly<TodayProductLoopSnapshot>;
  orbit?: Readonly<DailyOrbitSnapshot>;
  savedOrbitItemIds: ReadonlySet<string>;
  onPreference: (kind: 'SAVED' | 'DISMISSED', item: Readonly<DailyOrbitItem>) => void;
}) {
  const ownerSavedOrbitItemIds = orbit?.savedOrbitItemIds ?? [];
  return (
    <>
      <OrbitSection
        id="daily-orbit"
        kicker="SEE"
        title="Today's Orbit"
        description="Explainable priorities from governed Workspace sources."
        items={mainOrbit}
        {...(today ? { today } : {})}
        savedOrbitItemIds={savedOrbitItemIds}
        ownerSavedOrbitItemIds={ownerSavedOrbitItemIds}
        onPreference={onPreference}
        empty={
          <EmptyState
            title="Your Orbit is clear"
            description="No current Daily Signals are ranked for this Workspace yet."
          />
        }
      />
      <OrbitSection
        id="worth-revisiting"
        kicker="SEE"
        title="Worth Revisiting"
        description="Lower-urgency context that may still be useful today."
        items={revisiting}
        {...(today ? { today } : {})}
        savedOrbitItemIds={savedOrbitItemIds}
        ownerSavedOrbitItemIds={ownerSavedOrbitItemIds}
        onPreference={onPreference}
        empty={<p className="daily-muted-block">Nothing has been intentionally carried forward.</p>}
      />
    </>
  );
}
