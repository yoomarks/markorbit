import fs from 'node:fs';

const appPath = 'apps/markreg-web/src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');

const legacyImport = "import { ConnectedDocumentsInstructionsWorkspace } from './DocumentsInstructionsWorkspace.js';";
const durableImport = "import { DurableDocumentsPreparationWorkspace } from './DurableDocumentsPreparationWorkspace.js';";
if (!app.includes(legacyImport)) throw new Error('legacy workspace import anchor missing');
app = app.replace(legacyImport, durableImport);

const legacyEntry = 'return <ConnectedDocumentsInstructionsWorkspace client={client} review={completedReview} />;';
const durableEntry = `return (\n        <DurableDocumentsPreparationWorkspace\n          review={completedReview}\n          filingClient={client}\n        />\n      );`;
if (!app.includes(legacyEntry)) throw new Error('legacy completed-review entry anchor missing');
app = app.replace(legacyEntry, durableEntry);

const completedBlockAnchor = `if (completedReview?.status === 'REVIEWED_READY_FOR_NEXT_STEP') {`;
const anchorIndex = app.indexOf(completedBlockAnchor);
if (anchorIndex < 0) throw new Error('completed-review block anchor missing');
const blockEnd = app.indexOf("  if (!started)", anchorIndex);
if (blockEnd < 0) throw new Error('completed-review block end missing');
const completedBlock = app.slice(anchorIndex, blockEnd);
if (completedBlock.includes('<ConnectedDocumentsInstructionsWorkspace'))
  throw new Error('legacy workspace still reachable from completed-review block');
if (!completedBlock.includes('<DurableDocumentsPreparationWorkspace'))
  throw new Error('durable workspace not wired into completed-review block');

fs.writeFileSync(appPath, app);

const testPath = 'apps/markreg-web/src/App.completed-review.test.tsx';
const test = `import type { ProfessionalReviewCase } from '@markorbit/contracts';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarkregClient } from './api/markreg.js';
import { MarkregApp } from './App.js';

const completedReview = {
  reviewCaseId: 'professional-review_exact',
  status: 'REVIEWED_READY_FOR_NEXT_STEP',
  version: 4,
  completedAt: '2026-09-04T08:00:00.000Z',
  source: {
    customerId: 'customer_exact',
    matterDraftVersion: 'matter-draft-v4'
  },
  decision: {
    decision: 'READY_FOR_NEXT_STEP',
    decidedAt: '2026-09-04T08:00:00.000Z'
  }
} as unknown as ProfessionalReviewCase;

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, '', '/?professionalReviewCaseId=professional-review_exact');
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('completed Professional Review production entry', () => {
  it('opens the durable Documents / Preparation consumer instead of the legacy fixture consumer', async () => {
    const getProfessionalReview = vi.fn().mockResolvedValue({ reviewCase: completedReview });
    const createDocumentPackage = vi.fn();
    const client = {
      getProfessionalReview,
      createDocumentPackage
    } as unknown as MarkregClient;

    render(<MarkregApp client={client} />);

    expect(await screen.findByText('Professional Review complete')).toBeTruthy();
    expect(getProfessionalReview).toHaveBeenCalledWith('professional-review_exact');

    await userEvent.click(screen.getByRole('button', { name: 'Open Documents and Instructions' }));

    expect(
      await screen.findByRole('button', { name: 'Create durable Document Package' })
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create Document Package' })).toBeNull();
    expect(createDocumentPackage).not.toHaveBeenCalled();
    expect(screen.getByText(/pinned to that exact review version and decision fingerprint/i)).toBeTruthy();
  });
});
`;
fs.writeFileSync(testPath, test);

console.log('TASK 729 production durable entry patch applied');