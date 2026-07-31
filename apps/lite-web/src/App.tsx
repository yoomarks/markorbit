import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppShell,
  Badge,
  Button,
  Card,
  DataList,
  EmptyState,
  ErrorState,
  FixtureBanner,
  KeyValueList,
  LoadingState,
  PageHeader,
  Select,
  SideNavigation,
  StatusBadge,
  TextInput,
  TopBar
} from '@markorbit/ui';
import { customerFixtures } from './features/customers/fixture-repository.js';
import type { CustomerDetail } from './features/customers/view-models.js';
import { opportunityFixtures } from './features/opportunities/fixture-repository.js';
import type { OpportunityDetail, OpportunityStatus } from './features/opportunities/view-models.js';
import type { FixtureState, RelatedRecord } from './features/shared/view-models.js';
import './lite.css';
import { ProfessionalReview } from './features/professional-review/ProfessionalReview.js';
import { ExecutionReleaseView } from './features/execution-release/ExecutionRelease.js';
import { MatterWorkspace } from './features/matters/MatterWorkspace.js';

const nav = [
  'Today',
  'Matters',
  'Content',
  'Opportunities',
  'Trademarks',
  'Work',
  'Capability',
  'Guide'
] as const;
type Surface =
  'today' | 'matters' | 'customers' | 'opportunities' | 'professional-review' | 'execution-release';
export interface LiteAppProps {
  initialSurface?: Surface;
  initialState?: FixtureState;
  initialCustomerId?: string;
  initialOpportunityId?: string;
  initialReviewCaseId?: string;
  initialFilingAuthorization?: { id: string; version: number };
  workspaceId?: string;
}
const statusTone = (status: OpportunityStatus) =>
  status === 'QUALIFIED'
    ? 'success'
    : status === 'DISMISSED'
      ? 'danger'
      : status === 'NEW'
        ? 'info'
        : status === 'DEFERRED'
          ? 'pending'
          : 'warning';

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
        Customer Record ≠ Verified Legal Identity. Confirm identity, authority, and instruction
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
function Customers({
  state,
  setState,
  initialSelected
}: {
  state: FixtureState;
  setState: (state: FixtureState) => void;
  initialSelected?: string | undefined;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [region, setRegion] = useState('ALL');
  const [selected, setSelected] = useState<string | undefined>(initialSelected);
  const originId = useRef<string>();
  useEffect(() => {
    if (!selected && originId.current) {
      document
        .querySelector<HTMLButtonElement>(`[data-customer-id="${originId.current}"]`)
        ?.focus();
      originId.current = undefined;
    }
  }, [selected]);
  const rows = useMemo(
    () =>
      state === 'empty'
        ? []
        : customerFixtures.filter(
            (c) =>
              `${c.displayName} ${c.contact}`.toLowerCase().includes(search.toLowerCase()) &&
              (status === 'ALL' || c.status === status) &&
              (region === 'ALL' || c.region.includes(region))
          ),
    [search, status, region, state]
  );
  const customer = customerFixtures.find((item) => item.id === selected);
  if (customer)
    return <CustomerDetailView customer={customer} onBack={() => setSelected(undefined)} />;
  return (
    <StateGate state={state} subject="customers" onReady={() => setState('ready')}>
      <PageHeader
        title="Customers"
        description="Work / Customers · relationship context for practitioner review"
        actions={<Badge>Fixture state: {state}</Badge>}
      />
      <Alert title="Relationship boundary">
        These customer records preserve workplace context, but are fixture data and do not establish
        verified legal identity.
      </Alert>
      <div className="lite-filters" role="search">
        <TextInput
          label="Search customers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select label="Customer status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option>Active</option>
          <option>Needs review</option>
        </Select>
        <Select label="Country / region" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="ALL">All countries / regions</option>
          <option value="US">United States</option>
          <option value="EU">European Union</option>
        </Select>
      </div>
      {rows.length ? (
        <div className="lite-list" aria-live="polite">
          {rows.map((c) => (
            <Card key={c.id}>
              <div className="lite-row">
                <div>
                  <h2>{c.displayName}</h2>
                  <p>
                    {c.region} · Last activity {c.lastActivity}
                  </p>
                </div>
                <Badge>{c.status}</Badge>
              </div>
              <p>{c.opportunityCount} related opportunities</p>
              <Button
                data-customer-id={c.id}
                onClick={() => {
                  originId.current = c.id;
                  setSelected(c.id);
                }}
              >
                View customer details
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
function OpportunityDetailView({
  opportunity,
  onBack
}: {
  opportunity: OpportunityDetail;
  onBack: () => void;
}) {
  const [reviewed, setReviewed] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={onBack}>
        ← Back to opportunities
      </Button>
      <PageHeader
        title={opportunity.title}
        description="Opportunity detail · fixture observation"
        actions={<Badge>Fixture only</Badge>}
      />
      <Alert tone="warning" title="Decision boundary">
        Opportunity ≠ Confirmed Demand. Suggested Action ≠ Customer Instruction. Recommendation ≠
        Appointment.
      </Alert>
      <div className="lite-detail-grid">
        <Card>
          <h2>Opportunity overview</h2>
          <KeyValueList
            items={[
              { key: 'Source', value: opportunity.source },
              { key: 'Customer', value: opportunity.customerName },
              { key: 'Country / region', value: opportunity.region },
              { key: 'Trademark', value: opportunity.trademark },
              {
                key: 'Status',
                value: (
                  <>
                    <StatusBadge status={statusTone(opportunity.status)} />{' '}
                    <span>{opportunity.status}</span>
                  </>
                )
              }
            ]}
          />
          <p className="lite-long">{opportunity.sourceDetail}</p>
        </Card>
        <Card>
          <h2>Confidence / evidence</h2>
          <p>
            <strong>{opportunity.evidence.confidence} confidence</strong> —{' '}
            {opportunity.evidence.basis}
          </p>
          <p>Observed {opportunity.evidence.observedAt}</p>
          <h3>Limitations</h3>
          <ul>
            {opportunity.evidence.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <h2>Suggested next action</h2>
        <p className="lite-long">{opportunity.suggestedNextAction}</p>
        <Button variant="secondary" aria-pressed={reviewed} onClick={() => setReviewed(true)}>
          {reviewed ? 'Suggestion marked as reviewed' : 'Mark suggestion as reviewed'}
        </Button>
        <p role="status">
          {reviewed
            ? 'Review acknowledgement saved in component memory only. No contact, order, appointment, filing, or external action occurred.'
            : 'Reviewing this suggestion will not execute it.'}
        </p>
      </Card>
      <RelatedList
        title="Related intake or matter preview"
        records={opportunity.relatedPreview ? [opportunity.relatedPreview] : []}
      />
    </>
  );
}
function Opportunities({
  state,
  setState,
  initialSelected
}: {
  state: FixtureState;
  setState: (state: FixtureState) => void;
  initialSelected?: string | undefined;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [region, setRegion] = useState('ALL');
  const [selected, setSelected] = useState<string | undefined>(initialSelected);
  const originId = useRef<string>();
  useEffect(() => {
    if (!selected && originId.current) {
      document
        .querySelector<HTMLButtonElement>(`[data-opportunity-id="${originId.current}"]`)
        ?.focus();
      originId.current = undefined;
    }
  }, [selected]);
  const rows = useMemo(
    () =>
      state === 'empty'
        ? []
        : opportunityFixtures.filter(
            (o) =>
              `${o.title} ${o.customerName} ${o.trademark}`
                .toLowerCase()
                .includes(search.toLowerCase()) &&
              (status === 'ALL' || o.status === status) &&
              (region === 'ALL' || o.region.includes(region))
          ),
    [search, status, region, state]
  );
  const opportunity = opportunityFixtures.find((item) => item.id === selected);
  if (opportunity)
    return (
      <OpportunityDetailView opportunity={opportunity} onBack={() => setSelected(undefined)} />
    );
  return (
    <StateGate state={state} subject="opportunities" onReady={() => setState('ready')}>
      <PageHeader
        title="Opportunities"
        description="Evidence-aware observations for professional review—not confirmed demand"
        actions={<Badge>Fixture state: {state}</Badge>}
      />
      <Alert title="Opportunity boundary">
        Nothing here initiates contact, bulk outreach, an order, an appointment, or a protected
        external action.
      </Alert>
      <div className="lite-filters" role="search">
        <TextInput
          label="Search opportunities"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          label="Opportunity status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="ALL">All statuses</option>
          {(['NEW', 'REVIEWING', 'QUALIFIED', 'DEFERRED', 'DISMISSED'] as OpportunityStatus[]).map(
            (value) => (
              <option key={value}>{value}</option>
            )
          )}
        </Select>
        <Select label="Country / region" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="ALL">All countries / regions</option>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
          <option value="EU">European Union</option>
        </Select>
      </div>
      {rows.length ? (
        <div className="lite-list" aria-live="polite">
          {rows.map((o) => (
            <Card key={o.id}>
              <div className="lite-row">
                <div>
                  <h2>{o.title}</h2>
                  <p>
                    {o.customerName} · {o.region}
                  </p>
                </div>
                <span>
                  <StatusBadge status={statusTone(o.status)} /> <strong>{o.status}</strong>
                </span>
              </div>
              <p>
                <strong>{o.trademark}</strong> · {o.confidence} confidence
              </p>
              <Button
                data-opportunity-id={o.id}
                onClick={() => {
                  originId.current = o.id;
                  setSelected(o.id);
                }}
              >
                View opportunity details
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No fixture opportunities found"
          description="No opportunity matches this fixture state or the current filters."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setStatus('ALL');
                setRegion('ALL');
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
export function LiteApp({
  initialSurface = 'today',
  initialState = 'ready',
  initialCustomerId,
  initialOpportunityId,
  initialReviewCaseId,
  initialFilingAuthorization,
  workspaceId = new URLSearchParams(window.location.search).get('workspaceId') ?? ''
}: LiteAppProps) {
  const [surface, setSurface] = useState<Surface>(initialSurface);
  const [state, setState] = useState<FixtureState>(initialState);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(workspaceId);
  useEffect(() => {
    const followHash = () => {
      setActiveWorkspaceId(new URLSearchParams(window.location.search).get('workspaceId') ?? '');
      if (window.location.hash === '#work-customers') setSurface('customers');
      else if (window.location.hash === '#work-professional-review')
        setSurface('professional-review');
      else if (window.location.hash === '#work-execution-release') setSurface('execution-release');
      else if (window.location.hash === '#opportunities') setSurface('opportunities');
      else if (window.location.hash === '#today') setSurface('today');
      else if (window.location.hash === '#matters') setSurface('matters');
    };
    followHash();
    window.addEventListener('hashchange', followHash);
    window.addEventListener('popstate', followHash);
    return () => {
      window.removeEventListener('hashchange', followHash);
      window.removeEventListener('popstate', followHash);
    };
  }, []);
  return (
    <AppShell
      brand="MarkOrbit Lite"
      navigation={
        <SideNavigation
          items={nav.map((label) => ({
            label,
            href: label === 'Work' ? '#work-customers' : `#${label.toLowerCase()}`,
            active:
              surface === 'customers' ||
              surface === 'professional-review' ||
              surface === 'execution-release'
                ? label === 'Work'
                : surface === 'opportunities'
                  ? label === 'Opportunities'
                  : surface === 'matters'
                    ? label === 'Matters'
                    : label === 'Today'
          }))}
        />
      }
      topBar={
        <TopBar
          context={
            surface === 'matters'
              ? `Workspace · ${activeWorkspaceId || 'not selected'}`
              : 'Northstar IP · Fixture workspace'
          }
          actions={<Badge>{surface === 'matters' ? 'Authenticated' : 'Not live data'}</Badge>}
        />
      }
    >
      <div className="lite-workspace">
        {surface !== 'matters' && <FixtureBanner />}
        {(surface === 'customers' ||
          surface === 'professional-review' ||
          surface === 'execution-release') && (
          <div className="lite-subnav" aria-label="Workspace view">
            <Button
              variant={surface === 'customers' ? 'primary' : 'secondary'}
              onClick={() => setSurface('customers')}
            >
              Customers
            </Button>
            <Button
              variant={surface === 'professional-review' ? 'primary' : 'secondary'}
              onClick={() => setSurface('professional-review')}
            >
              Professional Review
            </Button>
            <Button
              variant={surface === 'execution-release' ? 'primary' : 'secondary'}
              onClick={() => setSurface('execution-release')}
            >
              Execution Release
            </Button>
          </div>
        )}
        {surface === 'matters' ? (
          activeWorkspaceId ? (
            <MatterWorkspace workspaceId={activeWorkspaceId} />
          ) : (
            <ErrorState
              title="Select a Workspace"
              description="A valid Workspace context is required to load durable Matters."
            />
          )
        ) : surface === 'today' ? (
          <>
            <PageHeader
              title="Today"
              description="A calm view of the work that needs professional attention."
            />
            <div className="mo-grid">
              <Card>
                <h2>Pending attention</h2>
                <DataList
                  items={[
                    { label: 'Client intake review', value: '4', status: 'Due today' },
                    { label: 'Draft publish packages', value: '2', status: 'Awaiting approval' }
                  ]}
                />
              </Card>
              <Card>
                <h2>Opportunities</h2>
                <DataList items={[{ label: 'Evidence observations', value: '3' }]} />
              </Card>
              <Card>
                <h2>Work</h2>
                <DataList items={[{ label: 'Customers needing review', value: '1' }]} />
              </Card>
            </div>
          </>
        ) : surface === 'customers' ? (
          <Customers
            key={initialCustomerId}
            state={state}
            setState={setState}
            initialSelected={initialCustomerId}
          />
        ) : surface === 'professional-review' ? (
          <ProfessionalReview
            state={state}
            {...(initialReviewCaseId ? { initialSelected: initialReviewCaseId } : {})}
          />
        ) : surface === 'execution-release' ? (
          <ExecutionReleaseView
            {...(initialFilingAuthorization ? { initialFilingAuthorization } : {})}
          />
        ) : (
          <Opportunities
            key={initialOpportunityId}
            state={state}
            setState={setState}
            initialSelected={initialOpportunityId}
          />
        )}
      </div>
    </AppShell>
  );
}
