// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { SourcesHistoryDisclosure } from './SourcesHistoryDisclosure.js';
import { sourcesHistoryFixtures } from './fixtures.js';

const diagnostics = [
  { key: 'Exact version', value: '7' },
  { key: 'Fingerprint', value: 'sha256:fixture' }
] as const;

afterEach(cleanup);

describe('SourcesHistoryDisclosure', () => {
  it('separates source evidence from AI interpretation without leaking diagnostics', () => {
    render(
      <SourcesHistoryDisclosure {...sourcesHistoryFixtures.normal} diagnostics={diagnostics} />
    );

    expect(screen.getByRole('heading', { name: 'Recorded information' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'What this may mean' })).toBeVisible();
    expect(screen.getByText('Interpretation, not source')).toBeVisible();
    expect(screen.getByText('Exact version')).not.toBeVisible();
    expect(screen.getByText('Fingerprint')).not.toBeVisible();
  });

  it('keeps partial information distinct from an empty history', () => {
    render(
      <SourcesHistoryDisclosure {...sourcesHistoryFixtures.partial} diagnostics={diagnostics} />
    );

    expect(screen.getByText('Some source information is unavailable')).toBeVisible();
    expect(screen.getByText('Client instruction')).toBeVisible();
    expect(screen.queryByText(/empty history/i)).not.toBeInTheDocument();
  });

  it('makes source conflicts explicit without choosing a result', () => {
    render(
      <SourcesHistoryDisclosure {...sourcesHistoryFixtures.conflicting} diagnostics={diagnostics} />
    );

    expect(screen.getByText('Sources disagree')).toBeVisible();
    expect(screen.getByText(/no date was selected automatically/i)).toBeVisible();
  });

  it('describes unavailable history without presenting an empty state', () => {
    render(
      <SourcesHistoryDisclosure {...sourcesHistoryFixtures.unavailable} diagnostics={diagnostics} />
    );

    expect(screen.getByText('Source information is unavailable')).toBeVisible();
    expect(screen.getByText(/This is not an empty history/i)).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Recorded information' })).not.toBeInTheDocument();
  });

  it('has no automated accessibility violations in normal and unavailable states', async () => {
    const normal = render(
      <SourcesHistoryDisclosure {...sourcesHistoryFixtures.normal} diagnostics={diagnostics} />
    );
    expect((await axe(normal.container)).violations).toEqual([]);
    normal.unmount();

    const unavailable = render(
      <SourcesHistoryDisclosure {...sourcesHistoryFixtures.unavailable} diagnostics={diagnostics} />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Source information is unavailable');
    expect((await axe(unavailable.container)).violations).toEqual([]);
  });

  it('preserves disclosure focus and does not create a keyboard trap', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SourcesHistoryDisclosure {...sourcesHistoryFixtures.normal} diagnostics={diagnostics} />
        <button type="button">After pattern</button>
      </>
    );

    const advanced = screen.getByText('Advanced');
    expect(advanced.closest('details')).not.toHaveAttribute('open');

    advanced.focus();
    expect(advanced).toHaveFocus();
    await user.click(advanced);

    expect(screen.getByRole('heading', { name: 'Diagnostics' })).toBeVisible();
    expect(screen.getByText('Exact version')).toBeVisible();
    expect(screen.getByText(/not required to complete ordinary work/i)).toBeVisible();
    expect(advanced).toHaveFocus();
    expect((await axe(document.body)).violations).toEqual([]);

    await user.click(advanced);
    expect(advanced.closest('details')).not.toHaveAttribute('open');
    expect(advanced).toHaveFocus();
    await user.tab();
    expect(advanced).not.toHaveFocus();
  });

  it('detects a deliberately inaccessible regression fixture', async () => {
    const { container } = render(<button type="button" />);
    const results = await axe(container);
    expect(results.violations.map(({ id }) => id)).toContain('button-name');
  });
});
