// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { MatterWorkspaceHttpError } from '../../api/matters.js';
import { PrivateCaseEvidencePanel } from './MatterWorkspace.js';
import {
  privateEvidenceClient,
  privateEvidenceMatter,
  privateEvidenceRead,
  privateEvidenceReferences
} from './private-case-evidence-fixtures.js';

afterEach(cleanup);

describe('Matter Workspace private Case evidence', () => {
  it('shows accepted references and opens only the exact current Knowledge chunks', async () => {
    const { container } = render(
      <PrivateCaseEvidencePanel matter={privateEvidenceMatter} client={privateEvidenceClient()} />
    );
    expect(
      await screen.findByText(privateEvidenceReferences.items[0]!.readyPackageId)
    ).toBeTruthy();
    expect(screen.getByText(/no Global fallback/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open exact source' }));
    expect(await screen.findByText(privateEvidenceRead.chunks[0]!.text)).toBeTruthy();
    expect(screen.getByText(/Page numbers and text offsets are unavailable/i)).toBeTruthy();
    expect(screen.getByText(/does not create Official Truth/i)).toBeTruthy();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('distinguishes no accepted binding from absence of an office action', async () => {
    render(
      <PrivateCaseEvidencePanel
        matter={privateEvidenceMatter}
        client={privateEvidenceClient({
          listPrivateEvidence: () => Promise.resolve({ ...privateEvidenceReferences, items: [] })
        })}
      />
    );
    expect(await screen.findByText('No accepted private evidence is linked')).toBeTruthy();
    expect(screen.getByText(/does not mean no office action/i)).toBeTruthy();
  });

  it.each([
    [401, 'Sign in to read private evidence'],
    [403, 'Private evidence access denied'],
    [404, 'Private evidence not found'],
    [409, 'Private evidence is no longer current'],
    [503, 'Private evidence service unavailable']
  ])('renders the actionable %s list failure state', async (status, title) => {
    render(
      <PrivateCaseEvidencePanel
        matter={privateEvidenceMatter}
        client={privateEvidenceClient({
          listPrivateEvidence: () =>
            Promise.reject(
              new MatterWorkspaceHttpError(status, `PRIVATE_EVIDENCE_${status}`, 'Owner failure')
            )
        })}
      />
    );
    expect(await screen.findByText(title)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry private evidence' })).toBeTruthy();
  });

  it('keeps a loaded reference visible when the exact owner read becomes stale', async () => {
    render(
      <PrivateCaseEvidencePanel
        matter={privateEvidenceMatter}
        client={privateEvidenceClient({
          readPrivateEvidence: () =>
            Promise.reject(
              new MatterWorkspaceHttpError(
                409,
                'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE',
                'The binding no longer matches current evidence.'
              )
            )
        })}
      />
    );
    await screen.findByText(privateEvidenceReferences.items[0]!.readyPackageId);
    fireEvent.click(screen.getByRole('button', { name: 'Open exact source' }));
    expect(await screen.findByText('Private evidence is no longer current')).toBeTruthy();
    expect(screen.getByText(privateEvidenceReferences.items[0]!.readyPackageId)).toBeTruthy();
  });
});
