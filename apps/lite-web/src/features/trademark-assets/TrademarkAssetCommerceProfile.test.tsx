// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrademarkAssetCommerceProfile } from '@markorbit/contracts/trademark-asset-commerce';
import { TrademarkAssetHttpError } from '../../api/trademark-assets.js';
import { TrademarkAssetCommerceProfileSection } from './TrademarkAssetCommerceProfile.js';

const profile: TrademarkAssetCommerceProfile = {
  schemaVersion: 1,
  commerceProfileId: 'trademark-asset-commerce_test',
  workspaceId: '11111111-1111-4111-8111-111111111111',
  trademarkAssetId: 'trademark-asset_test',
  trademarkAssetVersion: 3,
  version: 1,
  saleIntent: 'FOR_SALE',
  askingPrice: { amountMinor: 250000, currency: 'USD' },
  negotiable: true,
  saleTerritories: ['US', 'CA'],
  sellerRole: 'OWNER',
  headline: 'A durable server headline',
  sellingPoints: ['Established use', 'Clear presentation'],
  aiTags: ['consumer'],
  showcaseTemplateReference: 'showcase_clean',
  mediaAssetReferences: ['media_logo'],
  marketplaceListingCreatedByLite: false,
  sourceTrademarkFactsMutatedByLite: false,
  createdAt: '2026-08-31T00:00:00.000Z',
  updatedAt: '2026-08-31T01:00:00.000Z'
};

afterEach(cleanup);

describe('TrademarkAssetCommerceProfileSection', () => {
  it('shows a truthful no-profile state without implying sale status', () => {
    render(<TrademarkAssetCommerceProfileSection assetVersion={3} readOnly={false} />);

    expect(screen.getByText('No sell-side profile has been set up.')).toBeInTheDocument();
    expect(
      screen.getByText(/does not determine whether the trademark is or is not for sale/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set up sale context' })).toBeInTheDocument();
    expect(screen.queryByText('Listed')).not.toBeInTheDocument();
    expect(screen.queryByText('Published')).not.toBeInTheDocument();
  });

  it('renders every persisted Commerce Profile field as non-binding sell-side context', () => {
    render(
      <TrademarkAssetCommerceProfileSection assetVersion={3} profile={profile} readOnly={false} />
    );

    expect(screen.getByText('Prepared for sale')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('USD 250000 minor units')).toBeInTheDocument();
    expect(screen.getByText('US · CA')).toBeInTheDocument();
    expect(screen.getByText('A durable server headline')).toBeInTheDocument();
    expect(screen.getByText('Established use · Clear presentation')).toBeInTheDocument();
    expect(screen.getByText('consumer')).toBeInTheDocument();
    expect(screen.getByText('showcase_clean')).toBeInTheDocument();
    expect(screen.getByText('media_logo')).toBeInTheDocument();
    expect(screen.getByText(/not an offer or valuation/i)).toBeInTheDocument();
  });

  it('creates a first profile without inventing an existing profile version', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(profile);
    render(
      <TrademarkAssetCommerceProfileSection assetVersion={3} readOnly={false} onSave={onSave} />
    );

    await user.click(screen.getByRole('button', { name: 'Set up sale context' }));
    await user.click(screen.getByRole('button', { name: 'Save sale context' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      expectedTrademarkAssetVersion: 3,
      saleIntent: 'NOT_FOR_SALE',
      sellerRole: 'OWNER'
    });
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('expectedCommerceProfileVersion');
  });

  it('saves explicitly and replaces the view with server-returned durable truth', async () => {
    const user = userEvent.setup();
    const saved = {
      ...profile,
      version: 2,
      headline: 'Normalized by the server',
      updatedAt: '2026-08-31T02:00:00.000Z'
    };
    const onSave = vi.fn().mockResolvedValue(saved);
    render(
      <TrademarkAssetCommerceProfileSection
        assetVersion={3}
        profile={profile}
        readOnly={false}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Edit sale context' }));
    await user.clear(screen.getByRole('textbox', { name: 'Headline' }));
    await user.type(screen.getByRole('textbox', { name: 'Headline' }), 'Browser draft');
    await user.click(screen.getByRole('button', { name: 'Save sale context' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedTrademarkAssetVersion: 3,
        expectedCommerceProfileVersion: 1,
        headline: 'Browser draft'
      })
    );
    expect(await screen.findByText('Normalized by the server')).toBeInTheDocument();
    expect(screen.getByText(/saved from server-returned state/i)).toBeInTheDocument();
    expect(screen.getByText(/Saved version 2/)).toBeInTheDocument();
  });

  it('keeps the draft and requires reload after a 409 conflict', async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    const onSave = vi
      .fn()
      .mockRejectedValue(
        new TrademarkAssetHttpError(409, 'VERSION_CONFLICT', 'Commerce Profile changed.')
      );
    render(
      <TrademarkAssetCommerceProfileSection
        assetVersion={3}
        profile={profile}
        readOnly={false}
        onSave={onSave}
        onReload={onReload}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Edit sale context' }));
    await user.clear(screen.getByRole('textbox', { name: 'Headline' }));
    await user.type(screen.getByRole('textbox', { name: 'Headline' }), 'Keep this draft');
    await user.click(screen.getByRole('button', { name: 'Save sale context' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/has not overwritten/i);
    expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Keep this draft');
    await user.click(screen.getByRole('button', { name: 'Reload current profile' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it.each([
    [403, 'PERMISSION_DENIED', /do not have permission/i],
    [503, 'DOWNSTREAM_UNAVAILABLE', /persistence is unavailable/i]
  ])('preserves the draft for a %s save failure', async (status, code, message) => {
    const user = userEvent.setup();
    const onSave = vi
      .fn()
      .mockRejectedValue(new TrademarkAssetHttpError(status, code, 'Save did not complete.'));
    render(
      <TrademarkAssetCommerceProfileSection
        assetVersion={3}
        profile={profile}
        readOnly={false}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Edit sale context' }));
    await user.clear(screen.getByRole('textbox', { name: 'Headline' }));
    await user.type(screen.getByRole('textbox', { name: 'Headline' }), 'Unsaved draft');
    await user.click(screen.getByRole('button', { name: 'Save sale context' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('textbox', { name: 'Headline' })).toHaveValue('Unsaved draft');
  });

  it('makes a Marketplace-added Asset visibly read-only without mutation controls', () => {
    render(
      <TrademarkAssetCommerceProfileSection assetVersion={3} profile={profile} readOnly={true} />
    );

    expect(screen.getByRole('note')).toHaveTextContent(/cannot be changed here/i);
    expect(screen.getByText(/remain owned by Marketplace/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sale context/i })).not.toBeInTheDocument();
  });
});
