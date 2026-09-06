// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProviderDiscoveryResultV1 } from '@markorbit/contracts/provider-discovery';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GovernedProviderHttpError,
  type GovernedProviderClient
} from '../../api/governed-provider.js';
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

afterEach(() => cleanup());

function mockClient() {
  const loadServicePackageSpy = vi
    .fn<GovernedProviderClient['loadServicePackage']>()
    .mockResolvedValue(governedServicePackageFixture);
  const discoverSpy = vi
    .fn<GovernedProviderClient['discover']>()
    .mockResolvedValue(governedDiscoveryFixture);
  const selectSpy = vi
    .fn<GovernedProviderClient['select']>()
    .mockResolvedValue(governedSelectionFixture);
  const prepareHandoffSpy = vi
    .fn<GovernedProviderClient['prepareHandoff']>()
    .mockResolvedValue(governedPreparationFixture);
  const authorizeHandoffSpy = vi
    .fn<GovernedProviderClient['authorizeHandoff']>()
    .mockResolvedValue(governedHandoffFixture);
  const validateHandoffSpy = vi
    .fn<GovernedProviderClient['validateHandoff']>()
    .mockResolvedValue(governedHandoffValidationFixture);
  const evaluateEligibilitySpy = vi
    .fn<GovernedProviderClient['evaluateEligibility']>()
    .mockResolvedValue(governedEligibilityFixture);
  const allocateGovernedSpy = vi
    .fn<GovernedProviderClient['allocateGoverned']>()
    .mockResolvedValue(governedAllocationFixture);
  const client: GovernedProviderClient = {
    loadServicePackage: (...args) => loadServicePackageSpy(...args),
    discover: (...args) => discoverSpy(...args),
    select: (...args) => selectSpy(...args),
    prepareHandoff: (...args) => prepareHandoffSpy(...args),
    authorizeHandoff: (...args) => authorizeHandoffSpy(...args),
    validateHandoff: (...args) => validateHandoffSpy(...args),
    evaluateEligibility: (...args) => evaluateEligibilitySpy(...args),
    allocateGoverned: (...args) => allocateGovernedSpy(...args)
  };
  return {
    client,
    loadServicePackageSpy,
    discoverSpy,
    selectSpy,
    prepareHandoffSpy,
    authorizeHandoffSpy,
    validateHandoffSpy,
    evaluateEligibilitySpy,
    allocateGovernedSpy
  };
}

describe('GovernedActionComposer', () => {
  it('keeps Candidate, Selection, Handoff and Allocation separate and human initiated', async () => {
    const user = userEvent.setup();
    const {
      client,
      selectSpy,
      prepareHandoffSpy,
      authorizeHandoffSpy,
      validateHandoffSpy,
      evaluateEligibilitySpy,
      allocateGovernedSpy
    } = mockClient();
    render(
      <GovernedActionComposer
        workspaceId={governedFixtureWorkspaceId}
        servicePackageId={governedServicePackageFixture.servicePackageId}
        client={client}
      />
    );

    expect(await screen.findByText('Northstar Trademark Services')).toBeVisible();
    expect(screen.getByText('Orbit Counsel Network')).toBeVisible();
    expect(screen.getByText(/No score, ranking, winner, appointment, or contact/)).toBeVisible();
    expect(selectSpy).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole('button', { name: 'Review this Candidate' })[0]!);
    expect(
      screen.getByRole('heading', { name: 'Choose Northstar Trademark Services' })
    ).toBeVisible();
    expect(selectSpy).not.toHaveBeenCalled();

    await user.type(
      screen.getByRole('textbox', { name: 'Why this Candidate fits the reviewed need' }),
      'Reviewed the current evidence and limitations for this bounded need.'
    );
    await user.click(screen.getByRole('button', { name: 'Record human Selection' }));

    expect(await screen.findByText(/Human Selection recorded/)).toBeVisible();
    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(prepareHandoffSpy).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole('heading', { name: 'Review exactly what will be disclosed' })
    ).toBeVisible();
    expect(screen.getByText(/Final execution Provider/)).toBeVisible();
    expect(screen.getByText('END_CLIENT_RELATIONSHIP_INFORMATION')).toBeVisible();
    expect(authorizeHandoffSpy).not.toHaveBeenCalled();

    const checkbox = screen.getByRole('checkbox');
    const handoffButton = screen.getByRole('button', { name: 'Authorize controlled Handoff' });
    expect(handoffButton).toBeDisabled();
    await user.click(checkbox);
    await user.click(handoffButton);

    expect(await screen.findByRole('heading', { name: 'Exact Handoff is current' })).toBeVisible();
    expect(authorizeHandoffSpy).toHaveBeenCalledTimes(1);
    expect(validateHandoffSpy).toHaveBeenCalledTimes(1);
    expect(evaluateEligibilitySpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Prepare governed Allocation review' }));
    expect(
      await screen.findByRole('heading', { name: 'Confirm internal provider routing' })
    ).toBeVisible();
    expect(evaluateEligibilitySpy).toHaveBeenCalledTimes(1);
    expect(allocateGovernedSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm governed Allocation' }));
    expect(await screen.findByText(/Entered governed collaboration/)).toBeVisible();
    expect(allocateGovernedSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Provider Acceptance remains separate/)).toBeVisible();
    expect(screen.queryByText(/Provider contacted successfully/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/appointment created/i)).not.toBeInTheDocument();
  }, 10_000);

  it('invalidates the reviewed Privacy Preview when Handoff currentness conflicts', async () => {
    const user = userEvent.setup();
    const { client, authorizeHandoffSpy } = mockClient();
    authorizeHandoffSpy.mockRejectedValueOnce(
      new GovernedProviderHttpError(409, 'STALE_HANDOFF', 'stale')
    );
    render(
      <GovernedActionComposer
        workspaceId={governedFixtureWorkspaceId}
        servicePackageId={governedServicePackageFixture.servicePackageId}
        client={client}
      />
    );

    await screen.findByText('Northstar Trademark Services');
    await user.click(screen.getAllByRole('button', { name: 'Review this Candidate' })[0]!);
    await user.type(
      screen.getByRole('textbox', { name: 'Why this Candidate fits the reviewed need' }),
      'Reviewed exact current evidence.'
    );
    await user.click(screen.getByRole('button', { name: 'Record human Selection' }));
    await screen.findByRole('heading', { name: 'Review exactly what will be disclosed' });
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Authorize controlled Handoff' }));

    expect(
      await screen.findByRole('heading', { name: 'Privacy Preview changed before authorization' })
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Exact Handoff is current' })
    ).not.toBeInTheDocument();
  });

  it('fails closed when owner Discovery authority is unavailable', async () => {
    const { client, discoverSpy, selectSpy } = mockClient();
    const unavailableDiscovery: ProviderDiscoveryResultV1 = {
      ...governedDiscoveryFixture,
      status: 'AUTHORITY_UNAVAILABLE',
      candidates: [],
      authorityState: 'UNAVAILABLE',
      publicMessage: 'Provider discovery is unavailable until current authority can be verified.'
    };
    discoverSpy.mockResolvedValueOnce(unavailableDiscovery);
    render(
      <GovernedActionComposer
        workspaceId={governedFixtureWorkspaceId}
        servicePackageId={governedServicePackageFixture.servicePackageId}
        client={client}
      />
    );

    expect(
      await screen.findByRole('heading', { name: 'Current authority cannot be verified' })
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Review this Candidate' })).not.toBeInTheDocument();
    await waitFor(() => expect(selectSpy).not.toHaveBeenCalled());
  });
});
