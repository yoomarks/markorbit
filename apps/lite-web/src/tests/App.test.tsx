import { axe } from 'jest-axe';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { LiteApp } from '../App.js';
import type { LiteWorkspaceRepository } from '../features/shared/fixture-repository.js';

async function ready(surface: 'customers' | 'opportunities' = 'customers') {
  const result = render(<LiteApp initialSurface={surface} />);
  await screen.findByRole('button', {
    name: surface === 'customers' ? /Aurora Foods/ : /EU portfolio/
  });
  return result;
}
it('searches customers and filters by country', async () => {
  await ready();
  await userEvent.type(screen.getByLabelText('Search'), 'Kumo');
  await userEvent.selectOptions(screen.getByLabelText('Country / region'), 'Japan');
  expect(screen.getByText('Kumo Bicycle Works')).toBeVisible();
  expect(screen.queryByText('Aurora Foods Ltd')).not.toBeInTheDocument();
});
it('combines opportunity search, country, and status filters', async () => {
  await ready('opportunities');
  await userEvent.type(screen.getByLabelText('Search'), 'Canada');
  await userEvent.selectOptions(screen.getByLabelText('Country / region'), 'Canada');
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'NEW');
  expect(screen.getByText('Canada expansion signal')).toBeVisible();
  expect(screen.queryByText('EU portfolio coverage review')).not.toBeInTheDocument();
});
it('shows a safe no-results empty state', async () => {
  await ready();
  await userEvent.type(screen.getByLabelText('Search'), 'does-not-exist');
  expect(screen.getByRole('heading', { name: 'No matching fixture records' })).toBeVisible();
});
it('opens customer detail and retains filters and focus on return', async () => {
  await ready();
  await userEvent.type(screen.getByLabelText('Search'), 'Aurora');
  const row = screen.getByRole('button', { name: /Aurora Foods/ });
  await userEvent.click(row);
  expect(screen.getByText('Customer activity')).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('Demonstration only');
  await userEvent.click(screen.getByRole('button', { name: /Back to customers/ }));
  expect(screen.getByLabelText('Search')).toHaveValue('Aurora');
  await waitFor(() => expect(screen.getByRole('button', { name: /Aurora Foods/ })).toHaveFocus());
});
it('retains all opportunity filters and never executes suggested action', async () => {
  await ready('opportunities');
  await userEvent.type(screen.getByLabelText('Search'), 'Canada');
  await userEvent.selectOptions(screen.getByLabelText('Country / region'), 'Canada');
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'NEW');
  await userEvent.click(screen.getByRole('button', { name: /Canada expansion/ }));
  expect(screen.getByText('Suggested next action')).toBeVisible();
  expect(screen.getByRole('button', { name: /Review and approve/ })).toBeDisabled();
  expect(screen.getByText(/No contact, order/)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: /Back to opportunities/ }));
  expect(screen.getByLabelText('Search')).toHaveValue('Canada');
  expect(screen.getByLabelText('Country / region')).toHaveValue('Canada');
  expect(screen.getByLabelText('Status')).toHaveValue('NEW');
});
it('does not leak filters when switching surfaces', async () => {
  await ready();
  await userEvent.type(screen.getByLabelText('Search'), 'Aurora');
  await userEvent.click(screen.getByRole('link', { name: 'Opportunities' }));
  expect(screen.getByLabelText('Search')).toHaveValue('');
  await userEvent.type(screen.getByLabelText('Search'), 'Canada');
  await userEvent.click(screen.getByRole('link', { name: 'Work' }));
  expect(screen.getByLabelText('Search')).toHaveValue('Aurora');
});
it.each([
  ['customers', 'missing-customer', 'Customer not found'],
  ['opportunities', 'missing-opportunity', 'Opportunity not found']
] as const)('handles an invalid %s ID safely', async (surface, id, heading) => {
  render(<LiteApp initialSurface={surface} initialItemId={id} />);
  expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
});
it('renders loading, stale, and recoverable repository errors through the app', async () => {
  const never: LiteWorkspaceRepository = {
    listCustomers: () => new Promise(() => undefined),
    listOpportunities: () => new Promise(() => undefined)
  };
  const { rerender } = render(<LiteApp repository={never} />);
  expect(screen.getByText('Loading fixture workspace…')).toBeVisible();
  rerender(<LiteApp fixtureState="stale" />);
  expect(screen.getByText(/Stale fixture snapshot/)).toBeVisible();
  const broken: LiteWorkspaceRepository = {
    listCustomers: () => Promise.reject(new Error('fixture failure')),
    listOpportunities: () => Promise.reject(new Error('fixture failure'))
  };
  rerender(<LiteApp repository={broken} />);
  expect(await screen.findByRole('heading', { name: 'Fixture records unavailable' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
});
it('shows textual statuses, supports keyboard navigation, and passes axe', async () => {
  const { container } = await ready('opportunities');
  expect(screen.getByText(/Status: REVIEWING/)).toBeVisible();
  await userEvent.tab();
  expect(document.activeElement).toBeInstanceOf(HTMLElement);
  expect(await axe(container)).toHaveNoViolations();
});
