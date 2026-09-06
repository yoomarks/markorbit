import type { Meta, StoryObj } from '@storybook/react';
import type { GovernedProviderClient } from '../../api/governed-provider.js';
import { GovernedProviderHttpError } from '../../api/governed-provider.js';
import { GovernedActionComposer } from './GovernedActionComposer.js';
import {
  governedAllocationFixture,
  governedDiscoveryFixture,
  governedEligibilityFixture,
  governedFixtureWorkspaceId,
  governedHandoffFixture,
  governedHandoffValidationFixture,
  governedPreparationFixture,
  governedSelectionFixture,
  governedServicePackageFixture
} from './governed-action-fixtures.js';

const fixtureClient = (): GovernedProviderClient => ({
  loadServicePackage: () => Promise.resolve(governedServicePackageFixture),
  discover: () => Promise.resolve(governedDiscoveryFixture),
  select: () => Promise.resolve(governedSelectionFixture),
  prepareHandoff: () => Promise.resolve(governedPreparationFixture),
  authorizeHandoff: () => Promise.resolve(governedHandoffFixture),
  validateHandoff: () => Promise.resolve(governedHandoffValidationFixture),
  evaluateEligibility: () => Promise.resolve(governedEligibilityFixture),
  allocateGoverned: () => Promise.resolve(governedAllocationFixture)
});

const pendingClient: GovernedProviderClient = {
  ...fixtureClient(),
  loadServicePackage: () => new Promise(() => undefined)
};

const unavailableClient: GovernedProviderClient = {
  ...fixtureClient(),
  discover: () =>
    Promise.reject(
      new GovernedProviderHttpError(
        503,
        'AUTHORITY_UNAVAILABLE',
        'Current authority unavailable.',
        true
      )
    )
};

const emptyClient: GovernedProviderClient = {
  ...fixtureClient(),
  discover: () =>
    Promise.resolve({
      ...governedDiscoveryFixture,
      status: 'NO_AUTHORIZED_CANDIDATES',
      candidates: [],
      publicMessage: 'No Provider is currently authorized for this bounded Discovery request.'
    } as never)
};

export default {
  title: 'Products/Lite/Opportunity Center/Governed Provider Progression',
  component: GovernedActionComposer,
  args: {
    workspaceId: governedFixtureWorkspaceId,
    servicePackageId: governedServicePackageFixture.servicePackageId,
    client: fixtureClient()
  },
  parameters: { layout: 'fullscreen', a11y: { disable: false } }
} satisfies Meta<typeof GovernedActionComposer>;

type Story = StoryObj<typeof GovernedActionComposer>;

export const Loading: Story = { args: { client: pendingClient } };
export const CandidateComparison: Story = {};
export const KnownEmpty: Story = { args: { client: emptyClient } };
export const AuthorityUnavailable: Story = { args: { client: unavailableClient } };
export const Mobile390: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
