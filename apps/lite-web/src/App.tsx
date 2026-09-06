import { useEffect, useState } from 'react';
import {
  AppShell,
  Badge,
  Button,
  ErrorState,
  FixtureBanner,
  SideNavigation,
  TopBar
} from '@markorbit/ui';
import './lite.css';
import type { FixtureState } from './features/shared/view-models.js';
import { CustomersPreview } from './features/customers/CustomersPreview.js';
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
import { GovernedActionComposer } from './features/opportunities/GovernedActionComposer.js';
import { GuideWorkspace } from './features/guide/GuideWorkspace.js';
import {
  LITE_PRIMARY_NAV,
  isLiteFixtureSurface,
  litePrimaryForSurface,
  liteSurfaceFromHash,
  type LiteSurface
} from './routing/workspace-shell.js';
import {
  buildLiteHref,
  liteWorkspaceIdFromLocation,
  updateLiteLocation
} from './routing/workspace-navigation.js';

export interface LiteAppProps {
  initialSurface?: LiteSurface;
  initialState?: FixtureState;
  initialCustomerId?: string;
  initialOpportunityId?: string;
  initialServicePackageId?: string;
  initialReviewCaseId?: string;
  initialFilingAuthorization?: { id: string; version: number };
  workspaceId?: string;
  contentStudioClient?: ContentStudioClient;
  initialContentOpportunityId?: string;
}

const workSubnavigationSurfaces: readonly LiteSurface[] = [
  'work',
  'professional-review',
  'execution-release',
  'customers'
];

const opportunitySubnavigationSurfaces: readonly LiteSurface[] = [
  'opportunities',
  'opportunities-provider'
];

function workspaceRequired(description: string) {
  return <ErrorState title="Select a Workspace" description={description} />;
}

function WorkSubnavigation({
  surface,
  workspaceId
}: {
  surface: LiteSurface;
  workspaceId: string;
}) {
  if (!workSubnavigationSurfaces.includes(surface)) return null;
  const items = [
    { label: 'Overview', surface: 'work' },
    { label: 'Professional Review', surface: 'professional-review' },
    { label: 'Execution Release', surface: 'execution-release' },
    { label: 'Customers', surface: 'customers' }
  ] as const;
  return (
    <nav className="lite-subnav" aria-label="Workspace view">
      {items.map((item) => (
        <Button
          key={item.surface}
          variant={surface === item.surface ? 'primary' : 'secondary'}
          aria-current={surface === item.surface ? 'page' : undefined}
          onClick={() =>
            updateLiteLocation({
              surface: item.surface,
              workspaceId: workspaceId || undefined
            })
          }
        >
          {item.label}
        </Button>
      ))}
    </nav>
  );
}

function OpportunitySubnavigation({
  surface,
  workspaceId,
  servicePackageId
}: {
  surface: LiteSurface;
  workspaceId: string;
  servicePackageId?: string;
}) {
  if (!opportunitySubnavigationSurfaces.includes(surface)) return null;
  const items = [
    { label: 'Candidate Review', surface: 'opportunities' },
    { label: 'Provider Progression', surface: 'opportunities-provider' }
  ] as const;
  return (
    <nav className="lite-subnav" aria-label="Opportunity view">
      {items.map((item) => (
        <Button
          key={item.surface}
          variant={surface === item.surface ? 'primary' : 'secondary'}
          aria-current={surface === item.surface ? 'page' : undefined}
          onClick={() =>
            updateLiteLocation(
              {
                surface: item.surface,
                workspaceId: workspaceId || undefined,
                ...(servicePackageId ? { params: { servicePackageId } } : {})
              },
              { preserveSearch: true }
            )
          }
        >
          {item.label}
        </Button>
      ))}
    </nav>
  );
}

export function LiteApp({
  initialSurface = 'today',
  initialState = 'ready',
  initialCustomerId,
  initialOpportunityId,
  initialServicePackageId,
  initialReviewCaseId,
  initialFilingAuthorization,
  workspaceId,
  contentStudioClient,
  initialContentOpportunityId
}: LiteAppProps) {
  const [surface, setSurface] = useState<LiteSurface>(
    () => liteSurfaceFromHash(window.location.hash) ?? initialSurface
  );
  const [state, setState] = useState<FixtureState>(initialState);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() =>
    liteWorkspaceIdFromLocation(window.location, workspaceId ?? '')
  );

  useEffect(() => {
    const followLocation = () => {
      setActiveWorkspaceId(liteWorkspaceIdFromLocation(window.location, workspaceId ?? ''));
      const nextSurface = liteSurfaceFromHash(window.location.hash);
      if (nextSurface) setSurface(nextSurface);
    };
    followLocation();
    window.addEventListener('hashchange', followLocation);
    window.addEventListener('popstate', followLocation);
    return () => {
      window.removeEventListener('hashchange', followLocation);
      window.removeEventListener('popstate', followLocation);
    };
  }, [workspaceId]);

  const primary = litePrimaryForSurface(surface);
  const isFixture = isLiteFixtureSurface(surface);
  const isWorkHub = surface === 'work';
  const workContext = primary === 'work';
  const currentQuery = new URLSearchParams(window.location.search);
  const contentOpportunityId =
    initialContentOpportunityId ?? currentQuery.get('contentOpportunityId') ?? undefined;
  const professionalReviewCaseId =
    initialReviewCaseId ?? currentQuery.get('professionalReviewCaseId') ?? undefined;
  const servicePackageId =
    initialServicePackageId ?? currentQuery.get('servicePackageId') ?? undefined;

  return (
    <AppShell
      brand="MarkOrbit Lite"
      navigation={
        <SideNavigation
          items={LITE_PRIMARY_NAV.map((item) => ({
            label: item.label,
            href: buildLiteHref({
              surface: item.surface,
              workspaceId: activeWorkspaceId || undefined
            }),
            active: primary === item.id
          }))}
        />
      }
      topBar={
        <TopBar
          context={
            isFixture
              ? 'Northstar IP · Fixture workspace'
              : workContext
                ? `Work · ${activeWorkspaceId || 'Workspace not selected'}`
                : `Workspace · ${activeWorkspaceId || 'not selected'}`
          }
          actions={
            <Badge>
              {isFixture
                ? 'Not live data'
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
        <WorkSubnavigation surface={surface} workspaceId={activeWorkspaceId} />
        <OpportunitySubnavigation
          surface={surface}
          workspaceId={activeWorkspaceId}
          {...(servicePackageId ? { servicePackageId } : {})}
        />

        {surface === 'today' ? (
          activeWorkspaceId ? (
            <TodayWorkspace workspaceId={activeWorkspaceId} />
          ) : (
            workspaceRequired(
              'A valid Workspace context is required to load durable Today Recommendations.'
            )
          )
        ) : surface === 'matters' ? (
          activeWorkspaceId ? (
            <MatterWorkspace workspaceId={activeWorkspaceId} />
          ) : (
            workspaceRequired('A valid Workspace context is required to load durable Matters.')
          )
        ) : surface === 'content' ? (
          activeWorkspaceId ? (
            <ContentStudio
              workspaceId={activeWorkspaceId}
              {...(contentStudioClient ? { client: contentStudioClient } : {})}
              {...(contentOpportunityId
                ? { initialContentOpportunityId: contentOpportunityId }
                : {})}
            />
          ) : (
            workspaceRequired(
              'A valid Workspace context is required to load durable Content Studio work.'
            )
          )
        ) : surface === 'trademarks' ? (
          activeWorkspaceId ? (
            <TrademarkAssetPortfolio workspaceId={activeWorkspaceId} />
          ) : (
            workspaceRequired(
              'A valid Workspace context is required to load durable Trademark Assets.'
            )
          )
        ) : surface === 'work' ? (
          <WorkHub workspaceId={activeWorkspaceId} />
        ) : surface === 'professional-review' ? (
          <ProfessionalReview
            state={state}
            workspaceId={activeWorkspaceId}
            {...(professionalReviewCaseId ? { initialSelected: professionalReviewCaseId } : {})}
          />
        ) : surface === 'execution-release' ? (
          <ExecutionReleaseView
            workspaceId={activeWorkspaceId}
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
            workspaceRequired(
              'A valid Workspace context is required to load Opportunity Candidates.'
            )
          )
        ) : surface === 'opportunities-provider' ? (
          activeWorkspaceId ? (
            servicePackageId ? (
              <GovernedActionComposer
                key={`${activeWorkspaceId}:${servicePackageId}`}
                workspaceId={activeWorkspaceId}
                servicePackageId={servicePackageId}
              />
            ) : (
              <ErrorState
                title="Open from a Service Package"
                description="Provider Progression requires one existing bounded Service Package context. Workspace, actor, authority, and fingerprints are not entered manually here."
              />
            )
          ) : (
            workspaceRequired(
              'A valid Workspace context is required for governed Provider progression.'
            )
          )
        ) : surface === 'capability' ? (
          activeWorkspaceId ? (
            <CapabilityCenter workspaceId={activeWorkspaceId} />
          ) : (
            workspaceRequired(
              'A valid Workspace context is required to load your private Capability Center.'
            )
          )
        ) : surface === 'guide' ? (
          activeWorkspaceId ? (
            <GuideWorkspace workspaceId={activeWorkspaceId} />
          ) : (
            workspaceRequired(
              'A valid Workspace context is required to load the asset-scoped AI Guide.'
            )
          )
        ) : surface === 'customers' ? (
          <CustomersPreview
            key={initialCustomerId}
            state={state}
            setState={setState}
            initialSelected={initialCustomerId}
          />
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
