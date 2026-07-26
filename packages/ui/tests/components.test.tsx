import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import {
  AppShell,
  Button,
  FixtureBanner,
  RecommendationCard,
  StatusBadge,
  TextInput,
  TopBar
} from '../src/index.js';
import { describe, expect, it, vi } from 'vitest';
describe('UI accessibility contracts', () => {
  it('prevents disabled button behavior', () => {
    const action = vi.fn();
    render(
      <Button disabled onClick={action}>
        Save
      </Button>
    );
    screen.getByRole('button').click();
    expect(action).not.toHaveBeenCalled();
  });
  it('associates a form label and announced error', () => {
    render(<TextInput label="Email" error="Email is required" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Email is required');
  });
  it('marks fixture recommendations', () => {
    render(
      <RecommendationCard
        optionCode="A"
        title="Essential"
        summary="Summary"
        rationale="Rationale"
        assumptions={[]}
        limitations={[]}
        fixtureOnly
      />
    );
    expect(screen.getByText('Fixture only')).toBeVisible();
  });
  it('always renders the explicit fixture warning', () => {
    render(<FixtureBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Demonstration only — not legal advice or an official filing recommendation.'
    );
  });
  it('expresses status with text and a symbol', () => {
    render(<StatusBadge tone="danger">Failed</StatusBadge>);
    expect(screen.getByText('Failed')).toBeVisible();
    expect(screen.getByText('×')).toHaveAttribute('aria-hidden', 'true');
  });
  it('provides named navigation in an application shell', () => {
    render(
      <AppShell
        productName="Product"
        navigationLabel="Primary"
        navigation={[{ label: 'Today', href: '#today', current: true }]}
        topBar={<TopBar context="Context" />}
      >
        Content
      </AppShell>
    );
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  });
  it('has no serious automated accessibility violations', async () => {
    const { container } = render(
      <>
        <TextInput label="Brand" />
        <StatusBadge tone="warning">Pending</StatusBadge>
        <FixtureBanner />
      </>
    );
    expect(
      await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    ).toHaveNoViolations();
  });
});
