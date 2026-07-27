/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import React from 'react';
import { axe } from '../../../../packages/ui/node_modules/jest-axe';
import { render, screen } from '../../../../packages/ui/node_modules/@testing-library/react';
import userEvent from '../../../../packages/ui/node_modules/@testing-library/user-event';
import { expect, it } from 'vitest';
import { LiteApp } from '../App.js';
it('searches and filters fixture customers', async () => {
  render(<LiteApp />);
  await userEvent.type(screen.getByLabelText('Search'), 'Kumo');
  expect(screen.getByText('Kumo Bicycle Works')).toBeVisible();
  expect(screen.queryByText('Aurora Foods Ltd')).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Country / region'), 'Japan');
  expect(screen.getByText('Kumo Bicycle Works')).toBeVisible();
});
it('opens customer detail and retains filters on return', async () => {
  render(<LiteApp />);
  await userEvent.type(screen.getByLabelText('Search'), 'Aurora');
  await userEvent.click(screen.getByRole('button', { name: /Aurora Foods/ }));
  expect(screen.getByText('Customer activity')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: /Back to customers/ }));
  expect(screen.getByLabelText('Search')).toHaveValue('Aurora');
});
it('filters and opens opportunity detail without executing the suggestion', async () => {
  render(<LiteApp initialSurface="opportunities" />);
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'NEW');
  await userEvent.click(screen.getByRole('button', { name: /Canada expansion/ }));
  expect(screen.getByText('Suggested next action')).toBeVisible();
  expect(screen.getByRole('button', { name: /Review and approve/ })).toBeDisabled();
  expect(screen.getByText(/No contact, order/)).toBeVisible();
});
it('keeps status textual, exposes fixture warning, supports keyboard, and passes axe', async () => {
  const { container } = render(<LiteApp initialSurface="opportunities" />);
  expect(screen.getByRole('alert', { name: '' })).toHaveTextContent('Demonstration only');
  expect(screen.getByText(/Status: REVIEWING/)).toBeVisible();
  await userEvent.tab();
  expect(document.activeElement).toBeInstanceOf(HTMLElement);
  expect(await axe(container)).toHaveNoViolations();
});
