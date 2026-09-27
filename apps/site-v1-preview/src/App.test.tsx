import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App.js';
import { seedWorkspace } from './domain.js';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('Site V1 interactive preview', () => {
  it('keeps a draft private until explicit demo publication', async () => {
    const user = userEvent.setup();
    render(<App initialPath="/admin/atlas/editor" />);
    const heading = screen.getByLabelText('Heading');
    await user.clear(heading);
    await user.type(heading, 'A newly governed brand headline');
    expect(screen.getByText('Draft has unpublished changes')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Published v1' }));
    expect(screen.queryByText('A newly governed brand headline')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Draft$/u }));
    expect(screen.getByText('A newly governed brand headline')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Review & publish' }));
    await user.click(screen.getByRole('button', { name: 'Publish demo v2' }));
    expect(screen.getByText('Demo published as version 2')).toBeVisible();
  });

  it('creates one attributable lead and reads it back in the same Workspace', async () => {
    const user = userEvent.setup();
    render(
      <App initialPath="/site/atlas/contact/source/content-filing-map/service/svc-global-strategy" />
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Your name'), 'Maya Chen');
    await user.type(screen.getByLabelText('Organization'), 'Orbit Labs');
    await user.type(screen.getByLabelText('Work email'), 'maya@example.com');
    await user.type(
      screen.getByLabelText('What are you trying to decide?'),
      'We need a filing sequence for three markets.'
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Submit demo inquiry' }));
    expect(screen.getByText('DEMO-LEAD-0001')).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Find this lead in Site Admin' }));
    expect(screen.getByRole('heading', { name: 'Maya Chen · Orbit Labs' })).toBeVisible();
    expect(screen.getByText('content-filing-map')).toBeVisible();
    expect(screen.getByText('site_atlas_demo / atlas')).toBeVisible();
  });

  it('does not leak a lead into the second Workspace', () => {
    const atlas = seedWorkspace('atlas');
    atlas.leads.push({
      id: 'DEMO-LEAD-0001',
      workspaceId: 'atlas',
      siteId: atlas.siteId,
      createdAt: new Date().toISOString(),
      name: 'Atlas lead',
      email: 'atlas@example.com',
      company: 'Atlas',
      market: 'US',
      serviceId: 'svc-us-filing',
      message: 'Atlas-only demo lead',
      sourcePath: '/contact',
      status: 'NEW'
    });
    localStorage.setItem('markorbit:site-v1-preview:atlas', JSON.stringify(atlas));
    render(<App initialPath="/admin/foundry/leads" />);
    expect(screen.getByRole('heading', { name: 'No demo leads yet' })).toBeVisible();
  });

  it('shows field-level validation and retains user input', async () => {
    const user = userEvent.setup();
    render(<App initialPath="/site/atlas/contact" />);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Error: Enter your name.')).toBeVisible();
    expect(screen.getByText('Error: Enter a valid email address.')).toBeVisible();
    await user.type(screen.getByLabelText('Your name'), 'Maya');
    expect(screen.getByLabelText('Your name')).toHaveValue('Maya');
  });

  it('renders read-only permission state with disabled mutations', () => {
    const state = seedWorkspace('atlas');
    state.role = 'VIEWER';
    localStorage.setItem('markorbit:site-v1-preview:atlas', JSON.stringify(state));
    render(<App initialPath="/admin/atlas/settings" />);
    expect(screen.getByText(/View-only access/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reset this demo Workspace' })).toBeDisabled();
    expect(screen.getByLabelText('Locale')).toBeDisabled();
  });
});
