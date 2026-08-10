import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LifecyclePanel } from '../src/LifecyclePanel.js';
import type { CustomerLifecycleClient, CustomerLifecycleSurface } from '../src/api/lifecycle.js';

const surface: CustomerLifecycleSurface = {
  lifecycle: {
    lifecycleViewId: 'lifecycle-view_wp06',
    formalMatter: { id: 'formal-matter_wp06', version: 1 },
    version: 2,
    state: 'CUSTOMER_ACTION_NEEDED',
    customerSafeLabel: 'Action required',
    customerSafeSummary: 'Please review the requested information.',
    officialStatusVerified: false,
    updatedAt: '2026-08-10T03:00:00.000Z'
  },
  timeline: [
    {
      lifecycleEventId: 'lifecycle-event_wp06',
      formalMatter: { id: 'formal-matter_wp06', version: 1 },
      version: 1,
      state: 'CUSTOMER_ACTION_NEEDED',
      eventCode: 'CUSTOMER_INPUT_REQUIRED',
      customerSafeLabel: 'Action required',
      customerSafeSummary: 'Please review the requested information.',
      occurredAt: '2026-08-10T02:59:00.000Z',
      officialStatusVerified: false
    }
  ],
  recommendedAction: {
    recommendedActionId: 'recommended-action_wp06',
    formalMatter: { id: 'formal-matter_wp06', version: 1 },
    version: 3,
    title: 'Review required action',
    explanation: 'Please review the requested information.',
    timingBasis: 'No deadline inferred.',
    status: 'OPEN',
    executionAuthorized: false,
    updatedAt: '2026-08-10T03:00:00.000Z'
  },
  noAction: false
};

function client(value: CustomerLifecycleSurface = surface) {
  return {
    get: vi.fn().mockResolvedValue(value),
    acknowledge: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn().mockResolvedValue(undefined)
  } satisfies CustomerLifecycleClient;
}

describe('M5-WP-06 customer lifecycle panel', () => {
  it('shows only customer-safe lifecycle, bounded timeline and explicit authority language', async () => {
    const api = client();
    render(<LifecyclePanel formalMatterId="formal-matter_wp06" client={api} />);
    expect(await screen.findAllByText('Action required')).toHaveLength(2);
    expect(screen.getByText('Review required action')).toBeVisible();
    expect(screen.getByText(/not trademark-office status or proof of filing/i)).toBeVisible();
    expect(screen.getByText(/does not execute, file or pay/i)).toBeVisible();
    expect(document.body.textContent).not.toContain('admissionFingerprintSha256');
    expect(document.body.textContent).not.toContain('Provider Return');
  });

  it('renders an explicit no-action state', async () => {
    const api = client({ ...surface, recommendedAction: null, noAction: true });
    render(<LifecyclePanel formalMatterId="formal-matter_wp06" client={api} />);
    expect(await screen.findByText('No customer action is currently recommended.')).toBeVisible();
  });

  it('acknowledges the exact recommendation version and reloads without executing it', async () => {
    const user = userEvent.setup();
    const after = {
      ...surface,
      recommendedAction: {
        ...surface.recommendedAction!,
        status: 'ACKNOWLEDGED' as const,
        version: 4
      }
    };
    const api = client();
    api.get.mockResolvedValueOnce(surface).mockResolvedValueOnce(after);
    render(<LifecyclePanel formalMatterId="formal-matter_wp06" client={api} />);
    await user.click(await screen.findByRole('button', { name: 'Acknowledge' }));
    await waitFor(() => expect(api.acknowledge).toHaveBeenCalledWith('recommended-action_wp06', 3));
    expect(await screen.findByText('Status: ACKNOWLEDGED')).toBeVisible();
  });

  it('disables customer mutation when the governed Formal Matter route is stale/read-only', async () => {
    const api = client();
    render(<LifecyclePanel formalMatterId="formal-matter_wp06" client={api} disabled />);
    expect(await screen.findByRole('button', { name: 'Acknowledge' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDisabled();
  });
});
