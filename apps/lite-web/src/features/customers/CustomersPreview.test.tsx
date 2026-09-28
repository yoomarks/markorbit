// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CustomersPreview } from './CustomersPreview.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('Customers list and detail navigation', () => {
  it('preserves filters and display preference when returning from a dedicated detail view', async () => {
    const user = userEvent.setup();
    render(<CustomersPreview state="ready" setState={() => undefined} />);

    await user.type(screen.getByLabelText('Search customers'), 'Northwind');
    await user.click(screen.getByRole('button', { name: 'Cards' }));
    await user.click(screen.getByRole('button', { name: 'View customer preview' }));

    expect(screen.getByRole('heading', { level: 1, name: /Northwind/i })).toBeVisible();
    expect(new URLSearchParams(window.location.search).get('customerId')).toBe('cus-northwind');

    await user.click(screen.getByRole('button', { name: '← Back to customers' }));
    expect(screen.getByLabelText('Search customers')).toHaveValue('Northwind');
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('lite-customers-view')).toBe('cards');
    expect(new URLSearchParams(window.location.search).get('customerId')).toBeNull();
  });
});
