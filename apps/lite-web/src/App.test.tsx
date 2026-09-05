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
vi.mock('./features/guide/GuideWorkspace.js', () => ({
  GuideWorkspace: ({ workspaceId }: { workspaceId: string }) => <h1>Guide {workspaceId}</h1>
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

describe('Lite Workspace Shell V2 navigation truth', () => {
  it('keeps exactly five action-oriented primary destinations', async () => {
    window.history.replaceState(null, '', '/?workspaceId=workspace-1#work');
    render(<LiteApp />);
    const user = userEvent.setup();
    const nav = screen.getByRole('navigation', { name: 'Primary' });

    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Today',
      'Matters',
      'Create',
      'Portfolio',
      'Work'
    ]);

    for (const [label, heading, hash] of [
      ['Today', 'Today workspace-1', '#today'],
      ['Matters', 'Matters workspace-1', '#matters'],
      ['Create', 'Content Studio workspace-1', '#content'],
      ['Portfolio', 'Trademarks workspace-1', '#trademarks'],
      ['Work', 'Work', '#work']
    ] as const) {
      const link = within(nav).getByRole('link', { name: label });
      await user.click(link);
      expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeVisible();
      expect(window.location.hash).toBe(hash);
      expect(window.location.search).toBe('?workspaceId=workspace-1');
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    }
  });

  it('opens Content directly as the Create destination', () => {
    window.history.replaceState(null, '', '/?workspaceId=workspace-1#content');
    render(<LiteApp />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Content Studio workspace-1' })
    ).toBeVisible();
    expect(screen.getByText('Authenticated')).toBeVisible();
    expect(screen.getByText('Workspace · workspace-1')).toBeVisible();
    expect(
      within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', {
        name: 'Create'
      })
    ).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['opportunities', 'Opportunity Center workspace-1'],
    ['capability', 'Capability workspace-1'],
    ['guide', 'Guide workspace-1']
  ] as const)('preserves legacy #%s as an authenticated Work tool deep link', (hash, heading) => {
    window.history.replaceState(null, '', `/?workspaceId=workspace-1#${hash}`);
    render(<LiteApp />);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    expect(screen.getByText('Authenticated')).toBeVisible();
    expect(screen.getByText('Work · workspace-1')).toBeVisible();
    expect(
      within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', {
        name: 'Work'
      })
    ).toHaveAttribute('aria-current', 'page');
  });

  it.each(['today', 'matters', 'trademarks', 'work-professional-review'])(
    'preserves Workspace context on #%s, including query deep links',
    (hash) => {
      const query =
        '?workspaceId=workspace-1&todayRecommendationId=today_1&preparedActionId=prepared_1&contentPickId=pick_1&formalMatterId=matter_1&trademarkAssetId=asset_1&professionalReviewCaseId=review_1&professionalReviewCaseVersion=3';
      window.history.replaceState(null, '', `/${query}#${hash}`);
      render(<LiteApp />);
      expect(screen.getByText(hash.startsWith('work-') ? 'Work · workspace-1' : 'Workspace · workspace-1')).toBeVisible();
      expect(screen.getByText('Authenticated')).toBeVisible();
      expect(screen.queryByText(/Demonstration only/)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('workspace-1');
      if (hash === 'work-professional-review')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('review_1');
      expect(window.location.search).toBe(query);
    }
  );

  it('makes Work the discoverable home for specialist tools without promoting Customers to live truth', () => {
    window.history.replaceState(null, '', '/?workspaceId=workspace-1#work');
    render(<LiteApp />);
    expect(screen.getByRole('heading', { level: 1, name: 'Work' })).toBeVisible();
    expect(screen.getByText('Mixed maturity')).toBeVisible();
    expect(screen.getByText('Work · workspace-1')).toBeVisible();
    expect(screen.getByText('Live governed')).toBeVisible();
    expect(screen.getByText('Authenticated governed')).toBeVisible();
    expect(screen.getByText('Live · human review')).toBeVisible();
    expect(screen.getByText('Private')).toBeVisible();
    expect(screen.getByText('Asset-scoped advisory')).toBeVisible();
    expect(screen.getByText('Fixture preview')).toBeVisible();
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

  it('synchronizes governed Work subnavigation with URL and browser history', async () => {
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
    expect(screen.getByText('Work · workspace-2')).toBeVisible();
  });

  it('keeps authenticated Work actions disabled when no Workspace is selected', () => {
    window.history.replaceState(null, '', '/#work');
    render(<LiteApp />);
    expect(screen.getAllByRole('button', { name: 'Select a Workspace first' }).length).toBeGreaterThan(1);
    expect(screen.getByText('Work · Workspace not selected')).toBeVisible();
    expect(screen.getByText('Mixed maturity')).toBeVisible();
  });

  it('labels Execution Release as authenticated Workspace-governed work', () => {
    window.history.replaceState(null, '', '/?workspaceId=workspace-1#work-execution-release');
    render(<LiteApp initialFilingAuthorization={{ id: 'authorization_1', version: 2 }} />);
    expect(screen.getByText('Authenticated')).toBeVisible();
    expect(screen.getByText('Work · workspace-1')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('authorization_1 2');
  });

  it('keeps Execution Release Workspace-required when no Workspace is selected', () => {
    window.history.replaceState(null, '', '/#work-execution-release');
    render(<LiteApp initialFilingAuthorization={{ id: 'authorization_1', version: 2 }} />);
    expect(screen.getByText('Workspace required')).toBeVisible();
    expect(screen.getByText('Work · Workspace not selected')).toBeVisible();
    expect(screen.queryByText('Authenticated')).not.toBeInTheDocument();
  });

  it.each([
    'today',
    'matters',
    'content',
    'trademarks',
    'capability',
    'opportunities',
    'guide'
  ] as const)('keeps the missing-Workspace state for %s', (surface) => {
    render(<LiteApp initialSurface={surface} />);
    expect(screen.getByText('Select a Workspace')).toBeVisible();
    expect(screen.getByText('Workspace required')).toBeVisible();
    expect(screen.queryByText(/Demonstration only/)).not.toBeInTheDocument();
  });

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
