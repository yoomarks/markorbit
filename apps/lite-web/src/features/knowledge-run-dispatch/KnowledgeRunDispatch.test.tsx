// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KnowledgeOperatorRunHttpError,
  type KnowledgeOperatorRunClient
} from '../../api/knowledge-operator-runs.js';
import { KnowledgeRunDispatch } from './KnowledgeRunDispatch.js';

afterEach(() => cleanup());

describe('Knowledge Run Dispatch', () => {
  it('requires deliberate exact inputs and renders the durable receipt', async () => {
    const dispatch = vi.fn<KnowledgeOperatorRunClient['dispatch']>(() =>
      Promise.resolve({
        replayed: false,
        record: {
          run: { id: 'run_1' },
          job: { id: 'job_1' },
          execution: { id: 'execution_1' }
        }
      })
    );
    render(<KnowledgeRunDispatch workspaceId="workspace-1" client={{ dispatch }} />);
    const user = userEvent.setup();
    const button = screen.getByRole('button', { name: 'Dispatch governed run' });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText('Plan ID'), '  pln_1  ');
    await user.type(screen.getByLabelText('Idempotency key'), '  stable-run-1  ');
    expect(button).toBeEnabled();
    await user.click(button);

    expect(dispatch).toHaveBeenCalledWith({ planId: 'pln_1', idempotencyKey: 'stable-run-1' });
    expect(await screen.findByText('Run dispatched')).toBeVisible();
    expect(screen.getByText('run_1')).toBeVisible();
    expect(screen.getByText('job_1')).toBeVisible();
    expect(screen.getByText('execution_1')).toBeVisible();
  });

  it('shows permission failure without inventing a receipt', async () => {
    const client: KnowledgeOperatorRunClient = {
      dispatch: () =>
        Promise.reject(
          new KnowledgeOperatorRunHttpError(
            403,
            'PERMISSION_DENIED',
            'execution:manage permission is required.'
          )
        )
    };
    render(<KnowledgeRunDispatch workspaceId="workspace-1" client={client} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Plan ID'), 'pln_1');
    await user.type(screen.getByLabelText('Idempotency key'), 'stable-run-1');
    await user.click(screen.getByRole('button', { name: 'Dispatch governed run' }));

    expect(await screen.findByText('Run was not dispatched')).toBeVisible();
    expect(screen.getByText(/403 PERMISSION_DENIED/)).toBeVisible();
    expect(screen.queryByText('Run dispatched')).not.toBeInTheDocument();
  });
});
