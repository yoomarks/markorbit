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

const client = (): CustomerLifecycleClient => ({
  get: vi.fn(() => Promise.resolve(lifecycle)),
  acknowledge: vi.fn(() => Promise.resolve()),
  dismiss: vi.fn(() => Promise.resolve())
});

afterEach(cleanup);

describe('LifecyclePanel landmark identity', () => {
  it('uses the enclosing Formal Matter lifecycle landmark when embedded', async () => {
    render(
      <section aria-labelledby="matter-lifecycle-heading">
        <h2 id="matter-lifecycle-heading">Governed lifecycle</h2>
        <LifecyclePanel formalMatterId={formalMatterId} embedded client={client()} />
      </section>
    );

    expect(await screen.findByText('Application pending review')).toBeTruthy();
    expect(document.querySelectorAll('#matter-lifecycle-heading')).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Governed lifecycle' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Matter lifecycle' })).toBeNull();
    expect(screen.getByText(/not trademark-office status or proof of filing/i)).toBeTruthy();
  });

  it('keeps its own labelled lifecycle landmark when rendered standalone', async () => {
    render(<LifecyclePanel formalMatterId={formalMatterId} client={client()} />);

    expect(await screen.findByText('Application pending review')).toBeTruthy();
    expect(document.querySelectorAll('#matter-lifecycle-heading')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Matter lifecycle' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Matter lifecycle' })).toBeTruthy();
  });
});
