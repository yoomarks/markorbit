// @vitest-environment jsdom
import type { FormalMatterListResponse } from '@markorbit/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormalMatterListClient } from './api/formal-matter.js';
import type { OrderClient } from './api/order.js';
import { MarkregWorkspaceHome } from './WorkspaceHome.js';

const orderClient = {
  list: vi.fn(() => Promise.resolve({ items: [], page: 1, pageSize: 10, total: 0 }))
} as unknown as OrderClient;
const matterClient: FormalMatterListClient = {
  list: vi.fn(() =>
    Promise.resolve({ items: [], page: 1, pageSize: 10, total: 0 } as FormalMatterListResponse)
  )
};

describe('MarkReg production planning entry', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('markorbit-workspace-id', '018f0000-0000-7000-8000-000000000699');
  });

  it('opens durable Production Intake rather than the fixture Recommendation consultation', async () => {
    const user = userEvent.setup();
    render(<MarkregWorkspaceHome client={orderClient} matterClient={matterClient} />);

    expect(
      await screen.findByText(
        /Planning a new filing now begins with a durable customer-supplied Production Intake/
      )
    ).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: 'Plan a new filing' })[0]!);

    expect(
      await screen.findByRole('heading', { name: 'Plan a new trademark filing' })
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start Production Intake' })).toBeTruthy();
    expect(screen.queryByText(/fixture-only planning options/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start consultation' })).toBeNull();
  });
});
