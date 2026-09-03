// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomerLifecycleClient, CustomerLifecycleSurface } from './api/lifecycle.js';
import { LifecyclePanel } from './LifecyclePanel.js';

const formalMatterId = 'formal-matter_workspace-one';
const lifecycle: CustomerLifecycleSurface = {
  lifecycle: {
    lifecycleViewId: 'lifecycle-view_workspace-one',
    formalMatter: { id: formalMatterId, version: 5 },
    version: 2,
    state: 'APPLICATION_PENDING',
    customerSafeLabel: 'Application pending review',
    customerSafeSummary: 'The governed Matter lifecycle is awaiting the next reviewed event.',
    officialStatusVerified: false,
    updatedAt: '2026-09-01T02:15:00.000Z'
  },
  timeline: [],
  recommendedAction: null,
  noAction: true
};

const client = (value: CustomerLifecycleSurface = lifecycle): CustomerLifecycleClient => ({
  get: vi.fn(() => Promise.resolve(value)),
  acknowledge: vi.fn(() => Promise.resolve()),
  dismiss: vi.fn(() => Promise.resolve())
});

afterEach(cleanup);

describe('LifecyclePanel landmark identity', () => {
  it('uses the enclosing Formal Matter lifecycle landmark when embedded and avoids duplicate warning copy', async () => {
    render(
      <section aria-labelledby="matter-lifecycle-heading">
        <h2 id="matter-lifecycle-heading">Needs attention</h2>
        <LifecyclePanel formalMatterId={formalMatterId} embedded client={client()} />
      </section>
    );

    expect(await screen.findByText('Application pending review')).toBeTruthy();
    expect(document.querySelectorAll('#matter-lifecycle-heading')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Needs attention' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Matter lifecycle' })).toBeNull();
    expect(screen.queryByText(/not trademark-office status or proof of filing/i)).toBeNull();
    expect(screen.getByText(/not official-office status/i)).toBeTruthy();
  });

  it('keeps its own labelled lifecycle landmark and non-official warning when rendered standalone', async () => {
    render(<LifecyclePanel formalMatterId={formalMatterId} client={client()} />);

    expect(await screen.findByText('Application pending review')).toBeTruthy();
    expect(document.querySelectorAll('#matter-lifecycle-heading')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Matter lifecycle' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Matter lifecycle' })).toBeTruthy();
    expect(screen.getByText(/not trademark-office status or proof of filing/i)).toBeTruthy();
  });

  it('renders the exact current recommended action before lifecycle history', async () => {
    const withAction: CustomerLifecycleSurface = {
      ...lifecycle,
      timeline: [
        {
          lifecycleEventId: 'lifecycle-event_workspace-one',
          formalMatter: { id: formalMatterId, version: 5 },
          version: 1,
          state: 'APPLICATION_PENDING',
          eventCode: 'REVIEW_RECEIVED',
          customerSafeLabel: 'Review received',
          customerSafeSummary: 'A reviewed lifecycle event was recorded.',
          occurredAt: '2026-09-01T02:12:00.000Z',
          officialStatusVerified: false
        }
      ],
      recommendedAction: {
        recommendedActionId: 'recommended-action_workspace-one',
        formalMatter: { id: formalMatterId, version: 5 },
        version: 3,
        title: 'Review the latest evidence',
        explanation: 'New reviewed evidence is available for this Matter.',
        timingBasis: 'Review before deciding whether to continue.',
        status: 'OPEN',
        executionAuthorized: false,
        updatedAt: '2026-09-01T02:16:00.000Z'
      },
      noAction: false
    };
    const { container } = render(
      <LifecyclePanel formalMatterId={formalMatterId} embedded client={client(withAction)} />
    );

    expect(await screen.findByText('Review the latest evidence')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    expect(
      screen.getByText(/Recommended Action is governed product guidance, not authorization/i)
    ).toBeTruthy();
    const textContent = container.textContent ?? '';
    expect(textContent.indexOf('Review the latest evidence')).toBeLessThan(
      textContent.indexOf('Lifecycle history (1)')
    );
    expect(screen.getByText('Lifecycle history (1)').closest('details')?.open).toBe(false);
  });
});
