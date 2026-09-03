import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppShell,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FixtureBanner,
  KeyValueList,
  LoadingState,
  PageHeader,
  Select,
  SideNavigation,
  TextInput,
  TopBar
} from '@markorbit/ui';
import { customerFixtures } from './features/customers/fixture-repository.js';
import type { CustomerDetail } from './features/customers/view-models.js';
import type { FixtureState, RelatedRecord } from './features/shared/view-models.js';
import './lite.css';
import { ProfessionalReview } from './features/professional-review/ProfessionalReview.js';
import { ExecutionReleaseView } from './features/execution-release/ExecutionRelease.js';
import { WorkHub } from './features/work/WorkHub.js';
import { MatterWorkspace } from './features/matters/MatterWorkspace.js';
import { TodayWorkspace } from './features/today/TodayWorkspace.js';
import { CapabilityCenter } from './features/capability/CapabilityCenter.js';
import { TrademarkAssetPortfolio } from './features/trademark-assets/TrademarkAssetPortfolio.js';
import { ContentStudio } from './features/content-studio/ContentStudio.js';
import type { ContentStudioClient } from './api/content-studio.js';
import { CandidateReview } from './features/opportunities/CandidateReview.js';

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
  | 'today'
  | 'matters'
  | 'content'
  | 'guide'
  | 'trademarks'
  | 'capability'
  | 'work'
  | 'customers'
  | 'opportunities'
  | 'professional-review'
  | 'execution-release';
const surfacesByHash: Readonly<Record<string, Surface>> = {
  '#today': 'today',
  '#matters': 'matters',
  '#content': 'content',
  '#opportunities': 'opportunities',
  '#trademarks': 'trademarks',
  '#work': 'work',
  '#work-customers': 'customers',
  '#work-professional-review': 'professional-review',
  '#work-execution-release': 'execution-release',
  '#capability': 'capability',
  '#guide': 'guide'
};
export interface LiteAppProps {
  initialSurface?: Surface;
  initialState?: FixtureState;
  initialCustomerId?: string;
  initialOpportunityId?: string;
  initialReviewCaseId?: string;
  initialFilingAuthorization?: { id: string; version: number };
  workspaceId?: string;
  contentStudioClient?: ContentStudioClient;
  initialContentOpportunityId?: string;
}
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
export function LiteApp({
  initialSurface = 'today',
  initialState = 'ready',
  initialCustomerId,
  initialOpportunityId,
  initialReviewCaseId,
  initialFilingAuthorization,
  workspaceId,
  contentStudioClient,
  initialContentOpportunityId
}: LiteAppProps) {
  const [surface, setSurface] = useState<Surface>(
    () => surfacesByHash[window.location.hash] ?? initialSurface
  );
  const [state, setState] = useState<FixtureState>(initialState);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(
    () => workspaceId ?? new URLSearchParams(window.location.search).get('workspaceId') ?? ''
  );
  useEffect(() => {
    const followHash = () => {
      setActiveWorkspaceId(
        new URLSearchParams(window.location.search).get('workspaceId') ?? workspaceId ?? ''
      );
      const nextSurface = surfacesByHash[window.location.hash];
      if (nextSurface) setSurface(nextSurface);
    };
    followHash();
    window.addEventListener('hashchange', followHash);
    window.addEventListener('popstate', followHash);
    return () => {
      window.removeEventListener('hashchange', followHash);
      window.removeEventListener('popstate', followHash);
    };
  }, [workspaceId]);
  const isWork =
    surface === 'work' ||
    surface === 'customers' ||
    surface === 'professional-review' ||
    surface === 'execution-release';
  const isFixture = surface === 'customers';
  const isEntry = surface === 'guide';
  const isWorkHub = surface === 'work';
  return (
    <AppShell
      brand="MarkOrbit Lite"
      navigation={
        <SideNavigation
          items={nav.map((label) => ({
            label,
            href: label === 'Work' ? '#work' : `#${label.toLowerCase()}`,
            active: isWork ? label === 'Work' : label.toLowerCase() === surface
          }))}
        />
      }
      topBar={
        <TopBar
          context={
            isFixture
              ? 'Northstar IP · Fixture workspace'
              : surface === 'execution-release'
                ? 'Work · Execution API'
                : isWorkHub
                  ? `Work · ${activeWorkspaceId || 'Workspace not selected'}`
                  : `Workspace · ${activeWorkspaceId || 'not selected'}`
          }
          actions={
            <Badge>
              {isFixture
                ? 'Not live data'
                : isEntry
                  ? 'Not yet promoted'
                  : surface === 'execution-release'
                    ? 'API-backed'
                    : isWorkHub
                      ? 'Mixed maturity'
                      : activeWorkspaceId
                        ? 'Authenticated'
                        : 'Workspace required'}
            </Badge>
          }
        />
      }
    >
      <div className="lite-workspace">
        {isFixture && <FixtureBanner />}
        {isWork && (
          <nav className="lite-subnav" aria-label="Workspace view">
            <Button
              variant={surface === 'work' ? 'primary' : 'secondary'}
              aria-current={surface === 'work' ? 'page' : undefined}
              onClick={() => {
                window.location.hash = 'work';
              }}
            >
              Overview
            </Button>
            <Button
              variant={surface === 'professional-review' ? 'primary' : 'secondary'}
              aria-current={surface === 'professional-review' ? 'page' : undefined}
              onClick={() => {
                window.location.hash = 'work-professional-review';
              }}
            >
              Professional Review
            </Button>
            <Button
              variant={surface === 'execution-release' ? 'primary' : 'secondary'}
              aria-current={surface === 'execution-release' ? 'page' : undefined}
              onClick={() => {
                window.location.hash = 'work-execution-release';
              }}
            >
              Execution Release
            </Button>
            <Button
              variant={surface === 'customers' ? 'primary' : 'secondary'}
              aria-current={surface === 'customers' ? 'page' : undefined}
              onClick={() => {
                window.location.hash = 'work-customers';
              }}
            >
              Customers
            </Button>
          </nav>
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
          activeWorkspaceId ? (
            <TodayWorkspace workspaceId={activeWorkspaceId} />
          ) : (
            <ErrorState
              title="Select a Workspace"
              description="A valid Workspace context is required to load durable Today Recommendations."
            />
          )
        ) : surface === 'trademarks' ? (
          activeWorkspaceId ? (
            <TrademarkAssetPortfolio workspaceId={activeWorkspaceId} />
          ) : (
            <ErrorState
              title="Select a Workspace"
              description="A valid Workspace context is required to load durable Trademark Assets."
            />
          )
        ) : surface === 'capability' ? (
          activeWorkspaceId ? (
            <CapabilityCenter workspaceId={activeWorkspaceId} />
          ) : (
            <ErrorState
              title="Select a Workspace"
              description="A valid Workspace context is required to load your private Capability Center."
            />
          )
        ) : surface === 'content' ? (
          activeWorkspaceId ? (
            <ContentStudio
              workspaceId={activeWorkspaceId}
              {...(contentStudioClient ? { client: contentStudioClient } : {})}
              {...((initialContentOpportunityId ??
              new URLSearchParams(window.location.search).get('contentOpportunityId'))
                ? {
                    initialContentOpportunityId:
                      initialContentOpportunityId ??
                      new URLSearchParams(window.location.search).get('contentOpportunityId')!
                  }
                : {})}
            />
          ) : (
            <ErrorState
              title="Select a Workspace"
              description="A valid Workspace context is required to load durable Content Studio work."
            />
          )
        ) : isEntry ? (
          <>
            <PageHeader
              title="Guide"
              description="An official Lite product pillar with a bounded entry surface."
            />
            <EmptyState
              title={'AI Guide is not yet promoted'}
              description={
                'A first-class AI Guide is not available here. Opening this page does not start an AI conversation, create a recommendation, or authorize an action.'
              }
              action={<a href="#today">Open Today</a>}
            />
          </>
        ) : surface === 'work' ? (
          <WorkHub workspaceId={activeWorkspaceId} />
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
            workspaceId={activeWorkspaceId}
            {...(initialReviewCaseId ||
            new URLSearchParams(window.location.search).get('professionalReviewCaseId')
              ? {
                  initialSelected:
                    initialReviewCaseId ??
                    new URLSearchParams(window.location.search).get('professionalReviewCaseId')!
                }
              : {})}
          />
        ) : surface === 'execution-release' ? (
          <ExecutionReleaseView
            {...(initialFilingAuthorization ? { initialFilingAuthorization } : {})}
          />
        ) : surface === 'opportunities' ? (
          activeWorkspaceId ? (
            <CandidateReview
              key={`${activeWorkspaceId}:${initialOpportunityId ?? ''}`}
              workspaceId={activeWorkspaceId}
              {...(initialOpportunityId ? { initialSelected: initialOpportunityId } : {})}
            />
          ) : (
            <ErrorState
              title="Select a Workspace"
              description="A valid Workspace context is required to load Opportunity Candidates."
            />
          )
        ) : (
          <ErrorState
            title="Unknown Lite surface"
            description="This Lite surface is unavailable."
          />
        )}
      </div>
    </AppShell>
  );
}
