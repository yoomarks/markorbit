import { useEffect, useMemo, useRef, useState } from 'react';
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
import { customerFixtures } from './fixture-repository.js';
import type { CustomerDetail } from './view-models.js';
import type { FixtureState, RelatedRecord } from '../shared/view-models.js';

function StateGate({
  state,
  subject,
  children,
  onReady
}: {
  state: FixtureState;
  subject: string;
  children: React.ReactNode;
  onReady: () => void;
}) {
  if (state === 'loading') return <LoadingState label={`Loading fixture ${subject}`} />;
  if (state === 'error')
    return (
      <ErrorState
        title={`Fixture ${subject} unavailable`}
        description="The fixture provider returned a recoverable error. No saved filters or formal records were changed."
        onRetry={onReady}
      />
    );
  return (
    <>
      {state === 'stale' && (
        <Alert tone="warning" title="Stale fixture data">
          Last refreshed 24 July 2026 · 14:20 UTC. Review the source before relying on this
          snapshot; protected actions remain unavailable.
        </Alert>
      )}
      {children}
    </>
  );
}

function RelatedList({ title, records }: { title: string; records: RelatedRecord[] }) {
  return (
    <Card>
      <h2>{title}</h2>
      {records.length ? (
        <ul className="lite-related">
          {records.map((record) => (
            <li key={record.id}>
              <strong>{record.title}</strong>
              <span>
                {record.id} · {record.status}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No related fixture records.</p>
      )}
    </Card>
  );
}

function CustomerDetailView({
  customer,
  onBack
}: {
  customer: CustomerDetail;
  onBack: () => void;
}) {
  return (
    <>
      <Button variant="secondary" onClick={onBack}>
        ← Back to customers
      </Button>
      <PageHeader
        title={customer.displayName}
        description="Work / Customers / Customer detail"
        actions={<Badge>Fixture only</Badge>}
      />
      <Alert tone="warning" title="Identity boundary">
        Customer Record ≠ Verified Legal Identity. Confirm identity, authority and instruction
        outside this fixture before protected action.
      </Alert>
      <div className="lite-detail-grid">
        <Card>
          <h2>Customer overview</h2>
          <KeyValueList
            items={[
              { key: 'Country / region', value: customer.region },
              { key: 'Contact', value: customer.contact },
              { key: 'Status', value: customer.status },
              { key: 'Last activity', value: customer.lastActivity }
            ]}
          />
          <p className="lite-long">{customer.notes}</p>
        </Card>
        <Card>
          <h2>Customer activity</h2>
          {customer.activity.length ? (
            <ol className="lite-timeline">
              {customer.activity.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <time>{item.occurredAt}</time>
                  <p>{item.detail}</p>
                  <small>{item.source}</small>
                </li>
              ))}
            </ol>
          ) : (
            <p>No customer activity in this fixture.</p>
          )}
        </Card>
      </div>
      <div className="lite-grid">
        <RelatedList title="Related intakes" records={customer.relatedIntakes} />
        <RelatedList title="Related recommendations" records={customer.relatedRecommendations} />
        <RelatedList title="Related opportunities" records={customer.relatedOpportunities} />
      </div>
    </>
  );
}

export function CustomersPreview({
  state,
  setState,
  initialSelected
}: {
  state: FixtureState;
  setState: (state: FixtureState) => void;
  initialSelected?: string | undefined;
}) {
  const initialQuery = new URLSearchParams(window.location.search);
  const [search, setSearch] = useState(initialQuery.get('customerSearch') ?? '');
  const [status, setStatus] = useState(initialQuery.get('customerStatus') ?? 'ALL');
  const [region, setRegion] = useState(initialQuery.get('customerRegion') ?? 'ALL');
  const [selected, setSelected] = useState<string | undefined>(
    initialSelected ?? initialQuery.get('customerId') ?? undefined
  );
  const [view, setView] = useState<'rows' | 'cards'>(() =>
    localStorage.getItem('lite-customers-view') === 'cards' ? 'cards' : 'rows'
  );
  const originId = useRef<string>();
  const originScroll = useRef(0);

  const updateQuery = (
    changes: Partial<
      Record<'customerSearch' | 'customerStatus' | 'customerRegion' | 'customerId', string>
    >,
    mode: 'push' | 'replace' = 'replace'
  ) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== 'ALL') url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', url);
  };

  useEffect(() => {
    if (!selected && originId.current) {
      document
        .querySelector<HTMLButtonElement>(`[data-customer-id="${originId.current}"]`)
        ?.focus();
      originId.current = undefined;
      if (!navigator.userAgent.includes('jsdom'))
        requestAnimationFrame(() => window.scrollTo({ top: originScroll.current }));
    }
  }, [selected]);

  useEffect(() => {
    const followHistory = () => {
      const query = new URLSearchParams(window.location.search);
      setSearch(query.get('customerSearch') ?? '');
      setStatus(query.get('customerStatus') ?? 'ALL');
      setRegion(query.get('customerRegion') ?? 'ALL');
      setSelected(query.get('customerId') ?? undefined);
    };
    window.addEventListener('popstate', followHistory);
    return () => window.removeEventListener('popstate', followHistory);
  }, []);

  const rows = useMemo(
    () =>
      state === 'empty'
        ? []
        : customerFixtures.filter(
            (customer) =>
              `${customer.displayName} ${customer.contact}`
                .toLowerCase()
                .includes(search.toLowerCase()) &&
              (status === 'ALL' || customer.status === status) &&
              (region === 'ALL' || customer.region.includes(region))
          ),
    [search, status, region, state]
  );
  const customer = customerFixtures.find((item) => item.id === selected);
  if (customer)
    return (
      <CustomerDetailView
        customer={customer}
        onBack={() => {
          setSelected(undefined);
          updateQuery({ customerId: '' }, 'push');
        }}
      />
    );

  return (
    <StateGate state={state} subject="customers" onReady={() => setState('ready')}>
      <PageHeader
        title="Customers"
        description="Work / Customers · fixture relationship context"
        actions={<Badge>Fixture state: {state}</Badge>}
      />
      <Alert title="Relationship boundary">
        These customer records preserve a product concept only. They are fixture data and do not
        establish verified legal identity, customer instruction or live relationship truth.
      </Alert>
      <div className="lite-filters" role="search">
        <TextInput
          label="Search customers"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            updateQuery({ customerSearch: event.target.value });
          }}
        />
        <Select
          label="Customer status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            updateQuery({ customerStatus: event.target.value });
          }}
        >
          <option value="ALL">All statuses</option>
          <option>Active</option>
          <option>Needs review</option>
        </Select>
        <Select
          label="Country / region"
          value={region}
          onChange={(event) => {
            setRegion(event.target.value);
            updateQuery({ customerRegion: event.target.value });
          }}
        >
          <option value="ALL">All countries / regions</option>
          <option value="US">United States</option>
          <option value="EU">European Union</option>
        </Select>
      </div>
      <div className="lite-view-controls" aria-label="Customer display">
        <span>{rows.length} matching fixture customers</span>
        <div role="group" aria-label="View">
          <Button
            variant={view === 'rows' ? 'primary' : 'secondary'}
            aria-pressed={view === 'rows'}
            onClick={() => {
              setView('rows');
              localStorage.setItem('lite-customers-view', 'rows');
            }}
          >
            Compact rows
          </Button>
          <Button
            variant={view === 'cards' ? 'primary' : 'secondary'}
            aria-pressed={view === 'cards'}
            onClick={() => {
              setView('cards');
              localStorage.setItem('lite-customers-view', 'cards');
            }}
          >
            Cards
          </Button>
        </div>
      </div>
      {rows.length ? (
        <div
          className={`lite-list lite-customer-list lite-customer-list--${view}`}
          aria-live="polite"
        >
          {rows.map((item) => (
            <Card key={item.id}>
              <div className="lite-row">
                <div>
                  <h2>{item.displayName}</h2>
                  <p>
                    {item.region} · Last activity {item.lastActivity}
                  </p>
                </div>
                <Badge>{item.status}</Badge>
              </div>
              <p>{item.opportunityCount} related fixture opportunities</p>
              <Button
                data-customer-id={item.id}
                onClick={() => {
                  originId.current = item.id;
                  originScroll.current = window.scrollY;
                  setSelected(item.id);
                  updateQuery({ customerId: item.id }, 'push');
                }}
              >
                View customer preview
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No fixture customers found"
          description="No customer matches this fixture state or the current filters."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setStatus('ALL');
                setRegion('ALL');
                updateQuery({ customerSearch: '', customerStatus: '', customerRegion: '' });
              }}
            >
              Clear filters
            </Button>
          }
        />
      )}
    </StateGate>
  );
}
