// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  lockClientForScenario,
  packageClientForScenario,
  previewLock,
  previewPackage,
  previewPackageId,
  previewWorkspaceId
} from '../../preparation-lock-preview/fixtures.js';
import { PreparationLockWorkspace } from './PreparationLockWorkspace.js';

afterEach(cleanup);

describe('PreparationLockWorkspace', () => {
  it('locks only the exact ready Package and revalidates the immutable receipt', async () => {
    const create = vi.fn().mockResolvedValue(previewLock);
    const validateCurrent = vi.fn().mockResolvedValue(previewLock);
    render(
      <PreparationLockWorkspace
        workspaceId={previewWorkspaceId}
        initialPackage={previewPackage}
        packageClient={packageClientForScenario('ready')}
        preparationClient={{ create, get: vi.fn(), validateCurrent }}
      />
    );

    const action = screen.getByRole('button', { name: 'Create Preparation Lock' });
    expect(action).toBeDisabled();
    await userEvent.click(
      screen.getByRole('checkbox', { name: /I confirm this exact Package is ready/ })
    );
    await userEvent.click(action);

    expect(create).toHaveBeenCalledWith({
      documentPackageId: previewPackage.documentPackageId,
      expectedDocumentPackageVersion: previewPackage.version,
      expectedCanonicalEvidenceHash: previewPackage.canonicalEvidenceHash
    });
    await waitFor(() =>
      expect(validateCurrent).toHaveBeenCalledWith(previewLock.preparationLockId)
    );
    expect(await screen.findByText('Locked for preparation — not submitted')).toBeVisible();
    expect(screen.getAllByText('No')).toHaveLength(6);
    expect(screen.getByText('Governed Filing Authorization review')).toBeVisible();
  });

  it('keeps stale source conflicts blocking and preserves the boundary copy', async () => {
    render(
      <PreparationLockWorkspace
        workspaceId={previewWorkspaceId}
        initialPackage={previewPackage}
        packageClient={packageClientForScenario('ready')}
        preparationClient={lockClientForScenario('conflict')}
      />
    );
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create Preparation Lock' }));
    expect(await screen.findByText('Preparation source changed')).toBeVisible();
    expect(screen.getByText(/exact Package version or evidence hash changed/)).toBeVisible();
  });

  it('loads the exact Package and has no detectable accessibility violations', async () => {
    const { container } = render(
      <PreparationLockWorkspace
        workspaceId={previewWorkspaceId}
        packageId={previewPackageId}
        packageClient={packageClientForScenario('ready')}
        preparationClient={lockClientForScenario('ready')}
      />
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Preparation Lock' })
    ).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });
});
