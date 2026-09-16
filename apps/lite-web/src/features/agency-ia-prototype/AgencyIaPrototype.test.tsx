// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { AgencyIaPrototype } from './AgencyIaPrototype.js';

afterEach(cleanup);

describe('AgencyIaPrototype', () => {
  it('supports the morning triage link, follow-up, and draft boundary', async () => {
    const user = userEvent.setup();
    render(<AgencyIaPrototype />);
    expect(screen.getByRole('heading', { name: 'Needs your attention' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review in Inbox' }));
    expect(
      screen.getByRole('heading', { name: /USPTO status and specimen question/ })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Link' }));
    expect(screen.getByText('US Section 8 maintenance')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create follow-up' }));
    expect(screen.getByRole('status')).toHaveTextContent('Follow-up created');
    await user.click(screen.getByRole('button', { name: 'Prepare client update' }));
    expect(
      screen.getByText('This is a draft. Nothing has been sent to the client or outside counsel.')
    ).toBeInTheDocument();
  });

  it('keeps professional review and approval inside the case flow', async () => {
    const user = userEvent.setup();
    render(<AgencyIaPrototype initialSurface="cases" />);
    await user.click(screen.getByRole('button', { name: 'NORTHSTAR' }));
    expect(screen.getByRole('heading', { name: 'Review evidence of use' })).toBeInTheDocument();
    expect(screen.getByText('Ready to file')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve draft' }));
    expect(screen.getByText('Draft approved.').parentElement).toHaveTextContent(
      'It has not been filed'
    );
  });

  it('distinguishes official, workspace, and AI information', () => {
    render(<AgencyIaPrototype initialSurface="sources" />);
    const main = screen.getByRole('main');
    expect(within(main).getByText('Official record')).toBeInTheDocument();
    expect(within(main).getAllByText('Workspace information')).toHaveLength(2);
    expect(within(main).getByText('AI suggestion')).toBeInTheDocument();
  });

  it.each([
    ['loading', 'Loading workspace information'],
    ['empty', 'Nothing needs attention here'],
    ['unavailable', 'Some information is unavailable'],
    ['permission', 'You do not have access to this view'],
    ['error', 'This view could not be loaded']
  ] as const)('renders the %s state without inventing data', (state, label) => {
    render(<AgencyIaPrototype state={state} />);
    expect(screen.getAllByText(label, { exact: false }).length).toBeGreaterThan(0);
  });
});
