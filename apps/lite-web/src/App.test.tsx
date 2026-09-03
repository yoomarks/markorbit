// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiteApp } from './App.js';

vi.mock('./features/today/TodayWorkspace.js', () => ({
  TodayWorkspace: ({ workspaceId }: { workspaceId: string }) => <h1>Today {workspaceId}</h1>
}));
vi.mock('./features/matters/MatterWorkspace.js', () => ({
  MatterWorkspace: ({ workspaceId }: { workspaceId: string }) => <h1>Matters {workspaceId}</h1>
}));
vi.mock('./features/trademark-assets/TrademarkAssetPortfolio.js', () => ({
  TrademarkAssetPortfolio: ({ workspaceId }: { workspaceId: string }) => (
    <h1>Trademarks {workspaceId}</h1>
  )
}));
vi.mock('./features/capability/CapabilityCenter.js', () => ({
  CapabilityCenter: ({ workspaceId }: { workspaceId: string }) => <h1>Capability {workspaceId}</h1>
}));
vi.mock('./features/content-studio/ContentStudio.js', () => ({
  ContentStudio: ({ workspaceId }: { workspaceId: string }) => <h1>Content Studio {workspaceId}</h1>
}));
vi.mock('./features/professional-review/ProfessionalReview.js', () => ({
  ProfessionalReview: ({
    workspaceId,
    initialSelected
  }: {
    workspaceId: string;
    initialSelected?: string;
  }) => (
    <h1>
      Professional Review {workspaceId} {initialSelected}
    </h1>
  )
}));
vi.mock('./features/execution-release/ExecutionRelease.js', () => ({
  ExecutionReleaseView: ({
    initialFilingAuthorization
  }: {
    initialFilingAuthorization?: { id: string; version: number };
  }) => (
    <h1>
      Execution Release {initialFilingAuthorization?.id} {initialFilingAuthorization?.version}
    </h1>
  )
}));
vi.mock('./features/opportunities/CandidateReview.js', () => ({
  CandidateReview: ({ workspaceId }: { workspaceId: string }) => (
    <h1>Opportunity Center {workspaceId}</h1>
  )
}));

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

function location(url: string, event: 'hashchange' | 'popstate' = 'hashchange') {
  act(() => {
    window.history.pushState(null, '', url);
    window.dispatchEvent(new Event(event));
  });
}

describe('Lite shell navigation truth', () => {
  it('resolves every primary navigation click with exactly one active item', async () => {
    window.history.replaceState(null, '', '/?workspaceId=workspace-1#work');
    render(<LiteApp />);
    const user = userEvent.setup();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    for (const [label, heading, hash] of [
      ['Today', 'Today workspace-1', '#today'],
      ['Matters', 'Matters workspace-1', '#matters'],
      ['Content', 'Content Studio workspace-1', '#content'],
      ['Opportunities', 'Opportunity Center workspace-1', '#opportunities'],
      ['Trademarks', 'Trademarks workspace-1', '#trademarks'],
      ['Work', 'Work', '#work'],
      ['Capability', 'Capability workspace-1', '#capability'],
      ['Guide', 'Guide', '#guide']
    ] as const) {
      const link = within(nav).getByRole('link', { name: label });
      await user.click(link);
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeVisible();
      expect(window.location.hash).toBe(hash);
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    }
  });

  it('opens Content directly as an authenticated Workspace surface', () => {
    const surface = 'content';
    window.history.replaceState(null, '', `/?workspaceId=workspace-1#${surface}`);
    render(<LiteApp />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Content Studio workspace-1' })
    ).toBeVisible();
    expect(screen.getByText('Authenticated')).toBeVisible();
    expect(screen.getByText('Workspace · workspace-1')).toBeVisible();
    expect(screen.queryByText(/Demonstration only/)).not.toBeInTheDocument();
    expect(screen.queryByText('Not live data')).not.toBeInTheDocument();
  });

  it('keeps Guide as a bounded entry without fixture or live claims', () => {
    window.history.replaceState(null, '', '/?workspaceId=workspace-1#guide');
    render(<LiteApp />);
    expect(screen.getByRole('heading', { level: 1, name: 'Guide' })).toBeVisible();
    expect(screen.getByText('Not yet promoted')).toBeVisible();
    expect(screen.queryByText('Authenticated')).not.toBeInTheDocument();
  });

  it.each(['today', 'matters', 'trademarks', 'capability', 'work-professional-review'])(
    'preserves Workspace context on #%s, including query deep links',
    (hash) => {
      const query =
        '?workspaceId=workspace-1&todayRecommendationId=today_1&preparedActionId=prepared_1&contentPickId=pick_1&formalMatterId=matter_1&trademarkAssetId=asset_1&professionalReviewCaseId=review_1&professionalReviewCaseVersion=3';
      window.history.replaceState(null, '', `/${query}#${hash}`);
      render(<LiteApp />);
      expect(screen.getByText('Workspace · workspace-1')).toBeVisible();
      expect(screen.getByText('Authenticated')).toBeVisible();
      expect(screen.queryByText(/Demonstration only/)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('workspace-1');
      if (hash === 'work-professional-review')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('review_1');
      expect(window.location.search).toBe(query);
    }
  );

  it('makes Work a truthful overview instead of opening fixture Customers', () => {
    window.history.replaceState(null, '', '/?workspaceId=workspace-1#work');
    render(<LiteApp />);
    expect(screen.getByRole('heading', { level: 1, name: 'Work' })).toBeVisible();
    expect(screen.getByText('Mixed maturity')).toBeVisible();
    expect(screen.getByText('Work · workspace-1')).toBeVisible();
    expect(screen.getByText('Live governed')).toBeVisible();
    expect(screen.getByText('Hardening in progress')).toBeVisible();
    expect(screen.getByText('Fixture preview')).toBeVisible();
    expect(screen.queryByText(/Demonstration only/)).not.toBeInTheDocument();
    expect(screen.queryByText('Not live data')).not.toBeInTheDocument();
  });

  it('keeps Customers fixture-labelled in every fixture state even with a Workspace', () => {
    window.history.replaceState(null, '', '/?workspaceId=workspace-1');
    const { rerender } = render(<LiteApp initialSurface="customers" />);
    for (const state of ['ready', 'loading', 'empty', 'error', 'stale'] as const) {
      rerender(<LiteApp key={state} initialSurface="customers" initialState={state} />);
      expect(screen.getByText('Northstar IP · Fixture workspace')).toBeVisible();
      expect(screen.getByText('Not live data')).toBeVisible();
      expect(screen.getByText(/Demonstration only/)).toBeVisible();
      expect(screen.queryByText('Authenticated')).not.toBeInTheDocument();
    }
  });

  it('promotes Opportunities as an authenticated Workspace Candidate Review surface', () => {
    window.history.replaceState(null, '', '/?workspaceId=workspace-1#opportunities');
    render(<LiteApp />);
    expect(screen.getByRole('heading', { name: 'Opportunity Center workspace-1' })).toBeVisible();
    expect(screen.getByText('Workspace · workspace-1')).toBeVisible();
    expect(screen.getByText('Authenticated')).toBeVisible();
    expect(screen.queryByText('Not live data')).not.toBeInTheDocument();
    expect(screen.queryByText(/Demonstration only/)).not.toBeInTheDocument();
  });

  it('synchronizes Work subnavigation with URL and browser history', async () => {
    window.history.replaceState(null, '', '/?workspaceId=workspace-1#work');
    render(<LiteApp />);
    const user = userEvent.setup();
    for (const [label, hash, heading] of [
      ['Professional Review', '#work-professional-review', /Professional Review/],
      ['Execution Release', '#work-execution-release', /Execution Release/],
      ['Customers', '#work-customers', /Customers/],
      ['Overview', '#work', /^Work$/]
    ] as const) {
      const button = screen.getByRole('button', { name: label });
      await user.click(button);
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeVisible();
      expect(window.location.hash).toBe(hash);
      expect(window.location.search).toBe('?workspaceId=workspace-1');
      expect(button).toHaveAttribute('aria-current', 'page');
      expect(
        within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', {
          name: 'Work'
        })
      ).toHaveAttribute('aria-current', 'page');
    }
    location('/?workspaceId=workspace-2#work-professional-review', 'popstate');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Professional Review workspace-2'
    );
    expect(screen.getByText('Workspace · workspace-2')).toBeVisible();
  });

  it('keeps the live Professional Review action disabled on Work when no Workspace is selected', () => {
    window.history.replaceState(null, '', '/#work');
    render(<LiteApp />);
    expect(screen.getByRole('button', { name: 'Select a Workspace first' })).toBeDisabled();
    expect(screen.getByText('Work · Workspace not selected')).toBeVisible();
    expect(screen.getByText('Mixed maturity')).toBeVisible();
  });

  it('labels Execution Release as API-backed without claiming authenticated Workspace scope', () => {
    window.history.replaceState(null, '', '/?workspaceId=workspace-1#work-execution-release');
    render(<LiteApp initialFilingAuthorization={{ id: 'authorization_1', version: 2 }} />);
    expect(screen.getByText('API-backed')).toBeVisible();
    expect(screen.getByText('Work · Execution API')).toBeVisible();
    expect(screen.queryByText(/Demonstration only/)).not.toBeInTheDocument();
    expect(screen.queryByText('Authenticated')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('authorization_1 2');
  });

  it.each(['today', 'matters', 'content', 'trademarks', 'capability', 'opportunities'] as const)(
    'keeps the missing-Workspace state for %s',
    (surface) => {
      render(<LiteApp initialSurface={surface} />);
      expect(screen.getByText('Select a Workspace')).toBeVisible();
      expect(screen.getByText('Workspace required')).toBeVisible();
      expect(screen.queryByText(/Demonstration only/)).not.toBeInTheDocument();
    }
  );

  it.each(['popstate', 'hashchange'] as const)(
    'clears a URL-derived Workspace when %s removes it from the URL',
    (event) => {
      window.history.replaceState(null, '', '/?workspaceId=workspace-1#today');
      render(<LiteApp />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Today workspace-1');

      location('/#today', event);

      expect(screen.getByText('Workspace required')).toBeVisible();
      expect(screen.getByText('Select a Workspace')).toBeVisible();
      expect(screen.getByText('Workspace · not selected')).toBeVisible();
      expect(screen.queryByText(/workspace-1/)).not.toBeInTheDocument();
      expect(screen.queryByText('Authenticated')).not.toBeInTheDocument();
    }
  );

  it('retains a supplied Workspace in stories and updates it on prop changes', () => {
    const { rerender } = render(<LiteApp workspaceId="workspace-story" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Today workspace-story');
    rerender(<LiteApp workspaceId="workspace-next" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Today workspace-next');
  });
});
