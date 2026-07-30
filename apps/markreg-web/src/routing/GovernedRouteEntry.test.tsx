import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GovernedRouteEntry } from './GovernedRouteEntry';

afterEach(cleanup);
describe('MarkReg governed direct entry', () => {
  it('loads the exact record and reports version mismatch without mutation', async () => {
    const getGovernedRecord = vi.fn().mockResolvedValue({
      quote: { quoteId: 'quote_exact', pricingRuleVersion: 'v2', status: 'READY' }
    });
    render(
      <GovernedRouteEntry
        search="?view=quote&quoteId=quote_exact&quoteVersion=v1"
        client={{ createIntake: vi.fn(), getGovernedRecord }}
      />
    );
    expect(await screen.findByText('Version mismatch')).toBeTruthy();
    expect(screen.getByText('quote_exact')).toBeTruthy();
    expect(getGovernedRecord).toHaveBeenCalledWith('quote', 'quote_exact');
  });
  it('focuses recovery and retries the same identity after downstream failure', async () => {
    const getGovernedRecord = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValue({
        matterDraft: { matterDraftId: 'matter-draft_exact', schemaVersion: 1, status: 'DRAFT' }
      });
    render(
      <GovernedRouteEntry
        search="?view=matter-draft&matterDraftId=matter-draft_exact&matterDraftVersion=1"
        client={{ createIntake: vi.fn(), getGovernedRecord }}
      />
    );
    const heading = await screen.findByRole('heading', {
      name: 'The governed record service is unavailable.'
    });
    expect(document.activeElement).toBe(heading);
    await userEvent.click(screen.getByRole('button', { name: 'Retry same identity and version' }));
    await waitFor(() => expect(getGovernedRecord).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('matter-draft_exact')).toBeTruthy();
  });
});
