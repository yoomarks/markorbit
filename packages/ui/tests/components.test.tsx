import { expect, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AppShell,
  Button,
  FixtureBanner,
  RecommendationCard,
  SideNavigation,
  StatusBadge,
  TextInput
} from '../src/index.js';
const recommendation = {
  optionCode: 'A',
  title: 'Essential',
  summary: 'Summary',
  rationale: 'Because',
  assumptions: ['Assumption'],
  limitations: ['Limitation']
};
it('does not invoke a disabled button', async () => {
  const fn = vi.fn();
  render(
    <Button disabled onClick={fn}>
      Save
    </Button>
  );
  await userEvent.click(screen.getByRole('button'));
  expect(fn).not.toHaveBeenCalled();
});
it('associates labels, errors, and descriptions', () => {
  render(<TextInput label="Email" error="Required" />);
  const input = screen.getByLabelText('Email');
  expect(input).toHaveAccessibleDescription('Error: Required');
  expect(input).toHaveAttribute('aria-invalid', 'true');
});
it('shows the exact prominent fixture warning', () => {
  render(<FixtureBanner />);
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Demonstration only — not legal advice or an official filing recommendation.'
  );
});
it('makes fixture-only recommendations explicit', () => {
  render(<RecommendationCard {...recommendation} fixtureOnly />);
  expect(screen.getByText('Fixture only')).toBeVisible();
});
it('expresses status with text and symbol', () => {
  render(<StatusBadge status="warning" />);
  expect(screen.getByText('⚠ Warning')).toBeVisible();
});
it('provides structured app navigation', () => {
  render(
    <AppShell
      brand="Lite"
      navigation={<SideNavigation items={[{ label: 'Today', href: '#today', active: true }]} />}
    >
      <h1>Today</h1>
    </AppShell>
  );
  expect(screen.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
});
it('supports keyboard activation and has no axe violations', async () => {
  const fn = vi.fn();
  const { container } = render(
    <>
      <Button onClick={fn}>Continue</Button>
      <TextInput label="Name" />
      <FixtureBanner />
    </>
  );
  await userEvent.tab();
  await userEvent.keyboard('{Enter}');
  expect(fn).toHaveBeenCalledTimes(1);
  expect(await axe(container)).toHaveNoViolations();
});
