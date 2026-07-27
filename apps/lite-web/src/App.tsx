import { useMemo, useState } from 'react';
import {
  Alert,
  AppShell,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FixtureBanner,
  LoadingState,
  PageHeader,
  Select,
  TopBar
} from '@markorbit/ui';
import { customers, opportunities } from './features/shared/fixture-repository.js';
import type { FixtureState } from './features/shared/view-models.js';
import type { OpportunityStatus } from './features/opportunities/view-models.js';
import './lite.css';

const nav = ['Today', 'Content', 'Opportunities', 'Trademarks', 'Work', 'Capability', 'Guide'];
type Surface = 'customers' | 'opportunities';
export interface LiteAppProps {
  initialSurface?: Surface;
  initialItemId?: string;
  fixtureState?: FixtureState;
  longText?: boolean;
}
export function LiteApp({
  initialSurface = 'customers',
  initialItemId,
  fixtureState = 'ready',
  longText = false
}: LiteAppProps) {
  const [surface, setSurface] = useState<Surface>(initialSurface),
    [itemId, setItemId] = useState(initialItemId),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState<OpportunityStatus | 'ALL'>('ALL'),
    [country, setCountry] = useState('ALL');
  const list = surface === 'customers' ? customers : opportunities;
  const filtered = useMemo(
    () =>
      list.filter(
        (item) =>
          `${'name' in item ? item.name : item.title} ${item.countryRegion}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (country === 'ALL' || item.countryRegion === country) &&
          (surface === 'customers' ||
            status === 'ALL' ||
            ('status' in item && item.status === status))
      ),
    [list, query, country, status, surface]
  );
  const active =
    surface === 'customers'
      ? customers.find((x) => x.id === itemId)
      : opportunities.find((x) => x.id === itemId);
  const go = (next: Surface) => {
    setSurface(next);
    setItemId(undefined);
  };
  return (
    <AppShell
      brand="MarkOrbit Lite"
      navigation={
        <nav className="mo-side-nav" aria-label="Primary">
          <ul>
            {nav.map((label) => (
              <li key={label}>
                <a
                  href={`#${label.toLowerCase()}`}
                  aria-current={
                    label === (surface === 'customers' ? 'Work' : 'Opportunities')
                      ? 'page'
                      : undefined
                  }
                  onClick={(e) => {
                    if (label === 'Work' || label === 'Opportunities') {
                      e.preventDefault();
                      go(label === 'Work' ? 'customers' : 'opportunities');
                    }
                  }}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      }
      topBar={
        <TopBar
          context="Northstar IP · Fixture review workspace"
          actions={<Badge>Fixture workspace</Badge>}
        />
      }
    >
      <FixtureBanner />
      {surface === 'customers' && (
        <div className="lite-subnav">
          <strong>Work → Customers</strong>
        </div>
      )}
      {active ? (
        <Detail item={active} back={() => setItemId(undefined)} longText={longText} />
      ) : (
        <>
          <PageHeader
            title={surface === 'customers' ? 'Customers' : 'Opportunities'}
            description={
              surface === 'customers'
                ? 'Review customer context and related professional work.'
                : 'Review possible demand signals and governed next steps.'
            }
          />
          <Safety />
          <div className="lite-filters" role="search">
            <label>
              Search
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <Select
              label="Country / region"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="ALL">All countries / regions</option>
              {[...new Set(list.map((x) => x.countryRegion))].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
            {surface === 'opportunities' && (
              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="ALL">All statuses</option>
                {['NEW', 'REVIEWING', 'QUALIFIED', 'DEFERRED', 'DISMISSED'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
            )}
          </div>
          <State state={fixtureState} retry={() => undefined}>
            {filtered.length ? (
              <div className="lite-list">
                {filtered.map((item) => (
                  <button className="lite-row" key={item.id} onClick={() => setItemId(item.id)}>
                    <span>
                      <strong>{'name' in item ? item.name : item.title}</strong>
                      <small>
                        {item.countryRegion}
                        {'customer' in item ? ` · ${item.customer}` : ''}
                      </small>
                    </span>
                    <span>
                      {'status' in item
                        ? `Status: ${item.status}`
                        : `Last activity: ${item.activityAt}`}{' '}
                      →
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No matching fixture records"
                description="Clear or change the filters to review other demonstration records."
                action={
                  <Button
                    onClick={() => {
                      setQuery('');
                      setCountry('ALL');
                      setStatus('ALL');
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            )}
          </State>
        </>
      )}
    </AppShell>
  );
}
function State({
  state,
  children,
  retry
}: {
  state: FixtureState;
  children: React.ReactNode;
  retry: () => void;
}) {
  if (state === 'loading') return <LoadingState label="Loading fixture workspace" />;
  if (state === 'empty')
    return (
      <EmptyState
        title="No fixture records"
        description="There are no demonstration records in this state."
      />
    );
  if (state === 'error')
    return (
      <ErrorState
        title="Fixture records unavailable"
        description="The demonstration repository could not be read. Your filters are retained."
        onRetry={retry}
      />
    );
  return (
    <>
      {state === 'stale' && (
        <Alert tone="warning" title="Stale fixture snapshot">
          Last captured 20 July 2026, 09:00 UTC. Review only; protected actions remain unavailable.
        </Alert>
      )}
      {children}
    </>
  );
}
function Safety() {
  return (
    <Alert title="Interpretation boundaries">
      Opportunity ≠ Confirmed Demand · Suggested Action ≠ Customer Instruction · Recommendation ≠
      Appointment · Customer Record ≠ Verified Legal Identity.
    </Alert>
  );
}
function Detail({
  item,
  back,
  longText
}: {
  item: (typeof customers)[number] | (typeof opportunities)[number];
  back: () => void;
  longText: boolean;
}) {
  const isCustomer = 'contact' in item;
  return (
    <>
      <Button variant="secondary" onClick={back}>
        ← Back to {isCustomer ? 'customers' : 'opportunities'}
      </Button>
      <PageHeader
        title={isCustomer ? item.name : item.title}
        description="Fixture detail · not verified or live"
      />
      <Safety />
      {'contact' in item ? (
        <div className="lite-detail">
          <Card>
            <h2>Customer record</h2>
            <dl>
              <dt>Country / region</dt>
              <dd>{item.countryRegion}</dd>
              <dt>Contact context</dt>
              <dd>{item.contact}</dd>
            </dl>
          </Card>
          <Card>
            <h2>Customer activity</h2>
            {item.activity.length ? (
              item.activity.map((x) => (
                <article key={x.id}>
                  <strong>{x.title}</strong>
                  <small>{x.occurredAt}</small>
                  <p>{x.detail}</p>
                </article>
              ))
            ) : (
              <p>No fixture activity.</p>
            )}
          </Card>
          <Related title="Related intakes" values={item.relatedIntakes} />
          <Related title="Related recommendations" values={item.relatedRecommendations} />
          <Related title="Related opportunities" values={item.relatedOpportunities} />
        </div>
      ) : (
        <div className="lite-detail">
          <Card>
            <h2>Opportunity review</h2>
            <dl>
              <dt>Status</dt>
              <dd>◉ {item.status}</dd>
              <dt>Source</dt>
              <dd>{item.source}</dd>
              <dt>Customer</dt>
              <dd>{item.customer}</dd>
              <dt>Country / region</dt>
              <dd>{item.countryRegion}</dd>
              <dt>Trademark</dt>
              <dd>{item.trademark}</dd>
            </dl>
          </Card>
          <Card>
            <h2>Suggested next action</h2>
            <p>{longText ? `${item.suggestedNextAction} `.repeat(8) : item.suggestedNextAction}</p>
            <p>
              <strong>Suggestion only.</strong> No contact, order, appointment, or protected action
              has been performed.
            </p>
            <Button disabled>Review and approve before external action</Button>
          </Card>
          <Card>
            <h2>Confidence / evidence</h2>
            <p>{item.confidence}</p>
            {item.evidence.map((x) => (
              <article key={x.source}>
                <strong>{x.source}</strong>
                <small>{x.observedAt}</small>
                <p>{x.summary}</p>
              </article>
            ))}
          </Card>
          <Card>
            <h2>Related intake or matter preview</h2>
            <p>{item.relatedPreview}</p>
          </Card>
        </div>
      )}
    </>
  );
}
function Related({ title, values }: { title: string; values: string[] }) {
  return (
    <Card>
      <h2>{title}</h2>
      {values.length ? (
        <ul>
          {values.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : (
        <p>None in this fixture.</p>
      )}
    </Card>
  );
}
