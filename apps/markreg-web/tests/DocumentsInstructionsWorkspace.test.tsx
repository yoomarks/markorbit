import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DocumentsInstructionsWorkspace } from '../src/DocumentsInstructionsWorkspace.js';

describe('Documents and Instructions workspace', () => {
  it('distinguishes document states and exposes named semantic regions', () => {
    render(<DocumentsInstructionsWorkspace state="NEEDS_DOCUMENTS" />);
    expect(screen.getByRole('heading', { name: 'Document requirements' })).toBeVisible();
    expect(screen.getByText(/Required · Missing/)).toBeVisible();
    expect(screen.getByText(/binary storage not enabled/)).toBeVisible();
  });
  it('leaves every acknowledgement unselected and disables locking', async () => {
    const user = userEvent.setup();
    render(<DocumentsInstructionsWorkspace state="READY_TO_LOCK" />);
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(6);
    boxes.forEach((box) => expect(box).not.toBeChecked());
    expect(screen.getByRole('button', { name: 'Lock package for preparation' })).toBeDisabled();
    for (const box of boxes) await user.click(box);
    expect(screen.getByRole('button', { name: 'Lock package for preparation' })).toBeEnabled();
  });
  it('shows immutable receipt and explicit false authority consequences', () => {
    render(<DocumentsInstructionsWorkspace state="LOCKED_FOR_PREPARATION" />);
    expect(
      screen.getByRole('region', { name: 'Locked for preparation — not submitted' })
    ).toBeVisible();
    expect(screen.getByText('Filing submitted:', { exact: false })).toHaveTextContent('false');
    expect(screen.getByText('Trademark office contacted:', { exact: false })).toHaveTextContent(
      'false'
    );
  });
});
