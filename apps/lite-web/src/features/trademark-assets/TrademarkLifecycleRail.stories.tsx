import type { Meta, StoryObj } from '@storybook/react';
import { TrademarkLifecycleRail } from './TrademarkLifecycleRail.js';
import {
  conflictFixture,
  euOppositionFixture,
  noActionFixture,
  overdueFixture,
  philippinesLimitedFixture,
  portfolioLifecycleFixtures,
  staleFixture,
  usMaintenanceFixture
} from './trademark-lifecycle-rail-fixtures.js';

const meta = {
  title: 'Lite/Trademark Asset/Lifecycle Rail',
  component: TrademarkLifecycleRail,
  parameters: { layout: 'fullscreen' },
  args: {
    fixture: usMaintenanceFixture,
    surfaceState: 'READY'
  }
} satisfies Meta<typeof TrademarkLifecycleRail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const USRegisteredMaintenanceAction: Story = {};

export const EUOppositionWithPrediction: Story = {
  args: { fixture: euOppositionFixture, surfaceState: 'READY' }
};

export const PhilippinesLimitedManualCoverage: Story = {
  args: { fixture: philippinesLimitedFixture, surfaceState: 'LIMITED_MANUAL' }
};

export const CurrentNoAction: Story = {
  args: { fixture: noActionFixture, surfaceState: 'READY' }
};

export const PartialHistoryFutureUnavailable: Story = {
  args: { fixture: euOppositionFixture, surfaceState: 'PARTIAL' }
};

export const StaleLifecycleSource: Story = {
  args: { fixture: staleFixture, surfaceState: 'STALE' }
};

export const ConflictingCurrentStage: Story = {
  args: { fixture: conflictFixture, surfaceState: 'CONFLICTING' }
};

export const DependencyUnavailableWithLastKnownRail: Story = {
  args: { fixture: euOppositionFixture, surfaceState: 'DEPENDENCY_UNAVAILABLE' }
};

export const ImportedUnsupportedJurisdiction: Story = {
  args: { fixture: philippinesLimitedFixture, surfaceState: 'NOT_COVERED' }
};

export const NoLifecycleProjection: Story = {
  args: { fixture: usMaintenanceFixture, surfaceState: 'NO_PROJECTION' }
};

export const Loading: Story = {
  args: { fixture: usMaintenanceFixture, surfaceState: 'LOADING' }
};

export const Forbidden: Story = {
  args: { fixture: usMaintenanceFixture, surfaceState: 'FORBIDDEN' }
};

export const NotFound: Story = {
  args: { fixture: usMaintenanceFixture, surfaceState: 'NOT_FOUND' }
};

export const RecoverableError: Story = {
  args: { fixture: usMaintenanceFixture, surfaceState: 'RECOVERABLE_ERROR' }
};

export const OverdueAction: Story = {
  args: { fixture: overdueFixture, surfaceState: 'OVERDUE' }
};

export const Mobile390USMaintenance: Story = {
  args: { fixture: usMaintenanceFixture, surfaceState: 'READY' },
  parameters: {
    viewport: {
      defaultViewport: 'mobile390',
      viewports: {
        mobile390: { name: '390px mobile', styles: { width: '390px', height: '844px' } }
      }
    }
  }
};

export const Mobile390EUOpposition: Story = {
  args: { fixture: euOppositionFixture, surfaceState: 'PARTIAL' },
  parameters: {
    viewport: {
      defaultViewport: 'mobile390',
      viewports: {
        mobile390: { name: '390px mobile', styles: { width: '390px', height: '844px' } }
      }
    }
  }
};

export const PortfolioCompactMixedStates: Story = {
  args: {
    fixture: usMaintenanceFixture,
    mode: 'PORTFOLIO',
    portfolioFixtures: portfolioLifecycleFixtures
  }
};
