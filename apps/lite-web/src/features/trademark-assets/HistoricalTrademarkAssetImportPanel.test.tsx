// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  HistoricalTrademarkAssetPreparationReceipt,
  ReviewableTrademarkAssetMigrationResult,
  TrademarkAssetMigrationClient,
  TrademarkAssetMigrationPreview,
  TrademarkAssetMigrationRunSnapshot
} from '../../api/trademark-asset-migrations.js';
import { TrademarkAssetHttpError } from '../../api/trademark-assets.js';
import {
  HistoricalTrademarkAssetFileDecodeError,
  type DecodedHistoricalTrademarkAssetWorkbook
} from './historical-file-decoder.js';
import { HistoricalTrademarkAssetImportPanel } from './HistoricalTrademarkAssetImportPanel.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const fingerprint = 'a'.repeat(64);
const observedAt = '2026-09-15T04:00:00.000Z';

const workbook: DecodedHistoricalTrademarkAssetWorkbook = {
  schemaVersion: 1,
  fileName: 'legacy.csv',
  format: 'CSV',
  sourceFingerprintSha256: fingerprint,
  sheets: [
    {
      name: 'CSV',
      rows: [
        ['Jurisdiction', 'Mark', 'Application', 'Registration'],
        ['US', 'ALPHA', '000123', ''],
        ['CN', 'BETA', '', '456789']
      ]
    }
  ]
};

const receipt: HistoricalTrademarkAssetPreparationReceipt = {
  schemaVersion: 1,
  workspaceId,
  migrationKey: 'historical-test-operation',
  sourceFingerprintSha256: fingerprint,
  manifestFingerprintSha256: 'b'.repeat(64),
  total: 2,
  ready: 1,
  unresolved: 1,
  readyRows: [],
  unresolvedRows: [
    { rowKey: 'sheet:CSV:row:3', sourceIndex: 1, reason: 'registration number is missing' }
  ],
  officialTruthVerifiedByLite: false,
  assetsCreatedAutomatically: false,
  matterCreatedAutomatically: false
};
function migrationHarness(
  prepareTabular: TrademarkAssetMigrationClient['prepareTabular'] = vi
    .fn()
    .mockResolvedValue(receipt)
) {
  const preview = vi.fn();
  const progress = vi.fn();
  const commit = vi.fn();
  const client: TrademarkAssetMigrationClient = { prepareTabular, preview, progress, commit };
  return { client, prepareTabular, preview, progress, commit };
}

function decoderReturning(value: DecodedHistoricalTrademarkAssetWorkbook) {
  return vi.fn().mockResolvedValue(value);
}

function uploadSource(): void {
  const input = screen.getByLabelText('Local CSV or XLSX file');
  const file = {
    name: 'legacy.csv',
    arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)
  };
  fireEvent.change(input, { target: { files: [file] } });
}

async function selectBasicMapping(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.selectOptions(screen.getByLabelText('Worksheet'), 'CSV');
  await user.clear(screen.getByLabelText('Header row'));
  await user.type(screen.getByLabelText('Header row'), '1');
  await user.selectOptions(screen.getByLabelText('Workspace relationship'), 'MANAGED');
  await user.selectOptions(screen.getByLabelText('Jurisdiction · required'), 'Jurisdiction');
  await user.selectOptions(screen.getByLabelText('Mark text · required'), 'Mark');
  await user.selectOptions(screen.getByLabelText('Application number'), 'Application');
}

afterEach(() => cleanup());

describe('HistoricalTrademarkAssetImportPanel', () => {
  it('prepares exactly once from explicit selections without preview or commit', async () => {
    const prepareTabular = vi.fn().mockResolvedValue(receipt);
    const { client, preview, commit } = migrationHarness(prepareTabular);
    const user = userEvent.setup();
    render(
      <HistoricalTrademarkAssetImportPanel
        workspaceId={workspaceId}
        client={client}
        decoder={decoderReturning(workbook)}
        now={() => observedAt}
        createOperationId={() => 'operation'}
      />
    );

    uploadSource();
    await screen.findByText('legacy.csv');
    expect(screen.queryByLabelText('Jurisdiction · required')).not.toBeInTheDocument();
    await selectBasicMapping(user);
    const prepareButton = screen.getByRole('button', { name: 'Prepare import review' });
    expect(prepareButton).toBeEnabled();
    await user.click(prepareButton);

    await waitFor(() => expect(prepareTabular).toHaveBeenCalledTimes(1));
    expect(prepareTabular).toHaveBeenCalledWith({
      migrationKey: `historical-${fingerprint.slice(0, 16)}-operation`,
      sourceFingerprintSha256: fingerprint,
      sourceArtifactId: 'legacy.csv',
      sourceArtifactVersion: fingerprint,
      observedAt,
      relationshipKind: 'MANAGED',
      headers: ['Jurisdiction', 'Mark', 'Application', 'Registration'],
      columns: {
        jurisdiction: 'Jurisdiction',
        markText: 'Mark',
        applicationNumber: 'Application'
      },
      rows: [
        { rowKey: 'sheet:CSV:row:2', cells: ['US', 'ALPHA', '000123', ''] },
        { rowKey: 'sheet:CSV:row:3', cells: ['CN', 'BETA', '', '456789'] }
      ]
    });
    expect(preview).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', { name: 'Review the preparation result' })
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.tagName === 'LI'
          ? element.textContent?.includes('registration number is missing')
          : false
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText('1', { selector: 'dd' })).toHaveLength(2);
  });

  it('requires explicit worksheet selection for multi-sheet workbooks', async () => {
    const multiSheet: DecodedHistoricalTrademarkAssetWorkbook = {
      ...workbook,
      fileName: 'portfolio.xlsx',
      format: 'XLSX',
      sheets: [
        { name: 'Old', rows: [['Wrong'], ['ignore']] },
        {
          name: 'Current',
          rows: [
            ['Jurisdiction', 'Mark', 'Application'],
            ['US', 'OMEGA', '009900']
          ]
        }
      ]
    };
    const { client, prepareTabular, preview, commit } = migrationHarness();
    const user = userEvent.setup();
    render(
      <HistoricalTrademarkAssetImportPanel
        workspaceId={workspaceId}
        client={client}
        decoder={decoderReturning(multiSheet)}
      />
    );
    uploadSource();
    await screen.findByText('portfolio.xlsx');
    expect(screen.getByLabelText('Header row')).toBeDisabled();
    expect(screen.queryByRole('heading', { name: 'Source preview' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Worksheet'), 'Current');
    expect(screen.getByLabelText('Header row')).toBeEnabled();
    await user.type(screen.getByLabelText('Header row'), '1');

    expect(await screen.findByRole('heading', { name: 'Source preview' })).toBeInTheDocument();
    expect(screen.getByText('OMEGA')).toBeInTheDocument();
    expect(screen.queryByText('ignore')).not.toBeInTheDocument();
    expect(prepareTabular).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it('keeps prepare disabled until required mappings are explicit', async () => {
    const { client, prepareTabular } = migrationHarness();
    const user = userEvent.setup();
    render(
      <HistoricalTrademarkAssetImportPanel
        workspaceId={workspaceId}
        client={client}
        decoder={decoderReturning(workbook)}
      />
    );
    uploadSource();
    await screen.findByText('legacy.csv');
    await user.selectOptions(screen.getByLabelText('Worksheet'), 'CSV');
    await user.type(screen.getByLabelText('Header row'), '1');
    await user.selectOptions(screen.getByLabelText('Workspace relationship'), 'OWNED');
    await user.selectOptions(screen.getByLabelText('Jurisdiction · required'), 'Jurisdiction');
    await user.selectOptions(screen.getByLabelText('Mark text · required'), 'Mark');

    const prepareButton = screen.getByRole('button', { name: 'Prepare import review' });
    expect(prepareButton).toBeDisabled();
    expect(screen.getByText(/Map at least one exact identifier/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Registration number'), 'Registration');
    expect(prepareButton).toBeEnabled();
    expect(prepareTabular).not.toHaveBeenCalled();
  });

  it('rejects duplicate and blank source headers without silently repairing them', async () => {
    const badHeaders: DecodedHistoricalTrademarkAssetWorkbook = {
      ...workbook,
      sheets: [
        {
          name: 'CSV',
          rows: [
            ['Jurisdiction', 'Jurisdiction', 'Application'],
            ['Jurisdiction', '', 'Application'],
            ['US', 'ALPHA', '123']
          ]
        }
      ]
    };
    const { client, prepareTabular } = migrationHarness();
    const user = userEvent.setup();
    render(
      <HistoricalTrademarkAssetImportPanel
        workspaceId={workspaceId}
        client={client}
        decoder={decoderReturning(badHeaders)}
      />
    );

    uploadSource();
    await screen.findByText('legacy.csv');
    await user.selectOptions(screen.getByLabelText('Worksheet'), 'CSV');
    await user.type(screen.getByLabelText('Header row'), '1');
    expect(screen.getByText(/contains duplicate headers/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Jurisdiction · required')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Header row'));
    await user.type(screen.getByLabelText('Header row'), '2');
    expect(screen.getByText(/contains a blank header/i)).toBeInTheDocument();
    expect(prepareTabular).not.toHaveBeenCalled();
  });
  it('shows local decoder failure without creating a network success path', async () => {
    const { client, prepareTabular, preview, commit } = migrationHarness();
    const decoder = vi
      .fn()
      .mockRejectedValue(
        new HistoricalTrademarkAssetFileDecodeError('INVALID_FILE', 'Malformed workbook.')
      );
    render(
      <HistoricalTrademarkAssetImportPanel
        workspaceId={workspaceId}
        client={client}
        decoder={decoder}
      />
    );

    uploadSource();

    expect(await screen.findByRole('alert')).toHaveTextContent('Malformed workbook.');
    expect(prepareTabular).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it('fails closed when owner preparation is unavailable', async () => {
    const prepareTabular = vi
      .fn()
      .mockRejectedValue(
        new TrademarkAssetHttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'Owner unavailable.', true)
      );
    const { client, preview, commit } = migrationHarness(prepareTabular);
    const user = userEvent.setup();
    render(
      <HistoricalTrademarkAssetImportPanel
        workspaceId={workspaceId}
        client={client}
        decoder={decoderReturning(workbook)}
        now={() => observedAt}
        createOperationId={() => 'operation'}
      />
    );

    uploadSource();
    await screen.findByText('legacy.csv');
    await selectBasicMapping(user);
    await user.click(screen.getByRole('button', { name: 'Prepare import review' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Owner unavailable.');
    expect(
      screen.queryByRole('heading', { name: 'Review the preparation result' })
    ).not.toBeInTheDocument();
    expect(prepareTabular).toHaveBeenCalledTimes(1);
    expect(preview).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });
});

const readyRow: HistoricalTrademarkAssetPreparationReceipt['readyRows'][number] = {
  rowKey: 'sheet:CSV:row:2',
  sourceIndex: 0,
  item: {
    identity: { jurisdiction: 'US', markText: 'ALPHA' },
    externalIdentifiers: [
      {
        kind: 'APPLICATION_NUMBER',
        jurisdiction: 'US',
        value: '000123',
        officialTruthVerifiedByLite: false
      }
    ],
    workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: true }],
    sourceReferences: [
      {
        owner: 'WORKSPACE_USER',
        kind: 'WORKSPACE_ADMISSION',
        sourceId: 'legacy.csv',
        sourceVersion: fingerprint,
        sourceFingerprintSha256: fingerprint,
        observedAt,
        freshness: 'UNKNOWN'
      }
    ]
  }
};
const reviewedReceipt: HistoricalTrademarkAssetPreparationReceipt = {
  ...receipt,
  readyRows: [readyRow],
  migrationInput: {
    workspaceId,
    migrationKey: receipt.migrationKey,
    sourceFingerprintSha256: fingerprint,
    rows: [{ rowKey: readyRow.rowKey, item: readyRow.item }]
  }
};
const previewReceipt: TrademarkAssetMigrationPreview = {
  schemaVersion: 1,
  workspaceId,
  migrationKey: receipt.migrationKey,
  sourceFingerprintSha256: fingerprint,
  fingerprint: 'c'.repeat(64),
  total: 1,
  chunkCount: 1,
  chunks: [{ chunkIndex: 0, startIndex: 0, endExclusive: 1, rowKeys: [readyRow.rowKey] }],
  rows: [{ rowKey: readyRow.rowKey, importIndex: 0 }],
  officialTruthVerifiedByLite: false,
  matterCreatedAutomatically: false
};
const completedResult: ReviewableTrademarkAssetMigrationResult = {
  schemaVersion: 1,
  workspaceId,
  migrationKey: receipt.migrationKey,
  sourceFingerprintSha256: fingerprint,
  fingerprint: previewReceipt.fingerprint,
  total: 1,
  chunkCount: 1,
  created: 1,
  duplicates: 0,
  rejected: 0,
  items: [{ rowKey: readyRow.rowKey, importIndex: 0, status: 'CREATED' }],
  officialTruthVerifiedByLite: false,
  matterCreatedAutomatically: false
};
function snapshot(
  status: TrademarkAssetMigrationRunSnapshot['status']
): TrademarkAssetMigrationRunSnapshot {
  return {
    ...completedResult,
    status,
    created: status === 'COMPLETED' ? 1 : 0,
    items: status === 'COMPLETED' ? completedResult.items : [],
    nextChunkIndex: status === 'COMPLETED' ? 1 : 0,
    rowKeys: [readyRow.rowKey],
    updatedAt: observedAt
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function reviewHarness(
  prepareTabular: TrademarkAssetMigrationClient['prepareTabular'] = vi
    .fn()
    .mockResolvedValue(reviewedReceipt)
) {
  const harness = migrationHarness(prepareTabular);
  harness.preview.mockResolvedValue(previewReceipt);
  harness.commit.mockResolvedValue(completedResult);
  const user = userEvent.setup();
  const onCompleted = vi.fn();
  const props = {
    workspaceId,
    client: harness.client,
    decoder: decoderReturning(workbook),
    onCompleted,
    createOperationId: () => 'review-operation'
  };
  const view = render(<HistoricalTrademarkAssetImportPanel {...props} />);
  uploadSource();
  await screen.findByText('legacy.csv');
  await selectBasicMapping(user);
  await user.click(screen.getByRole('button', { name: 'Prepare import review' }));
  return { ...harness, ...view, user, onCompleted, props };
}
async function requestPreview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('checkbox', { name: /I have reviewed the READY rows/ }));
  await user.click(screen.getByRole('button', { name: 'Preview reviewed migration' }));
  await screen.findByRole('heading', { name: 'Migration preview', exact: true });
}
async function confirmCommit(
  user: ReturnType<typeof userEvent.setup>,
  name = 'Commit reviewed import'
) {
  await user.click(
    screen.getByRole('checkbox', { name: /I confirm importing these reviewed rows/ })
  );
  await user.click(screen.getByRole('button', { name }));
}

describe('C9-I reviewed historical migration', () => {
  it('requires two independent acknowledgements and strips only server-owned workspaceId', async () => {
    const { user, preview, commit, onCompleted, rerender, props } = await reviewHarness();
    expect(preview).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Preview reviewed migration' })).toBeDisabled();
    expect(
      within(screen.getByRole('region', { name: 'Ready rows' })).getByText(
        'APPLICATION_NUMBER: 000123'
      )
    ).toBeInTheDocument();
    await requestPreview(user);
    const expected = {
      migrationKey: reviewedReceipt.migrationKey,
      sourceFingerprintSha256: fingerprint,
      rows: reviewedReceipt.migrationInput!.rows
    };
    expect(preview).toHaveBeenCalledExactlyOnceWith(
      expected,
      'historical-preview:review-operation'
    );
    expect(preview.mock.calls[0]![0].rows).toBe(reviewedReceipt.migrationInput!.rows);
    expect(preview.mock.calls[0]![0]).not.toHaveProperty('workspaceId');
    expect(commit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Commit reviewed import' })).toBeDisabled();
    expect(screen.getByText(previewReceipt.fingerprint)).toBeInTheDocument();
    await confirmCommit(user);
    await screen.findByRole('heading', { name: 'Import completed' });
    expect(commit).toHaveBeenCalledExactlyOnceWith(
      receipt.migrationKey,
      expected,
      'historical-commit:review-operation'
    );
    expect(onCompleted).toHaveBeenCalledTimes(1);
    rerender(<HistoricalTrademarkAssetImportPanel {...props} onClose={() => undefined} />);
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: 'Commit reviewed import' })
    ).not.toBeInTheDocument();
  });

  it('reads interrupted progress and resumes only on a new explicit confirmation', async () => {
    const { user, commit, progress, onCompleted } = await reviewHarness();
    commit.mockRejectedValueOnce(
      new TrademarkAssetHttpError(503, 'OWNER_INTERRUPTED', 'Interrupted.', true)
    );
    progress.mockResolvedValue(snapshot('INTERRUPTED'));
    await requestPreview(user);
    await confirmCommit(user);
    await screen.findByText('INTERRUPTED', { selector: 'p' });
    expect(progress).toHaveBeenCalledExactlyOnceWith(receipt.migrationKey);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(onCompleted).not.toHaveBeenCalled();
    expect(screen.getByText(observedAt)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume interrupted import' })).toBeDisabled();
    await confirmCommit(user, 'Resume interrupted import');
    await screen.findByRole('heading', { name: 'Import completed' });
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls[1]).toEqual(commit.mock.calls[0]);
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('recognizes a completed write after a lost response without retrying it', async () => {
    const { user, commit, progress, onCompleted } = await reviewHarness();
    commit.mockRejectedValue(new Error('Response lost.'));
    progress.mockResolvedValue(snapshot('COMPLETED'));
    await requestPreview(user);
    await confirmCommit(user);
    await screen.findByRole('heading', { name: 'Import completed' });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('keeps unavailable progress unknown and offers only an explicit progress read', async () => {
    const { user, commit, progress, onCompleted } = await reviewHarness();
    commit.mockRejectedValue(new Error('Response lost.'));
    progress.mockRejectedValueOnce(new Error('Progress service unavailable.'));
    await requestPreview(user);
    await confirmCommit(user);
    await screen.findByText('Import progress unavailable');
    expect(
      screen.queryByRole('region', { name: 'Saved migration result' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commit reviewed import' })).toBeDisabled();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(onCompleted).not.toHaveBeenCalled();
    progress.mockResolvedValue(snapshot('COMPLETED'));
    await user.click(screen.getByRole('button', { name: 'Check saved progress' }));
    await screen.findByRole('heading', { name: 'Import completed' });
    expect(progress).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('does not allow another write while owner progress remains COMMITTING', async () => {
    const { user, commit, progress } = await reviewHarness();
    commit.mockRejectedValue(new Error('Response lost.'));
    progress.mockResolvedValue(snapshot('COMMITTING'));
    await requestPreview(user);
    await confirmCommit(user);
    await screen.findByText('COMMITTING', { selector: 'p' });
    expect(screen.getByRole('checkbox', { name: /I confirm importing/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Commit reviewed import' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Resume interrupted import' })
    ).not.toBeInTheDocument();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledTimes(1);
  });

  it('preserves the permission gate even if a PREVIEWED progress record is readable', async () => {
    const { user, commit, progress, onCompleted } = await reviewHarness();
    commit.mockRejectedValue(
      new TrademarkAssetHttpError(403, 'PERMISSION_DENIED', 'matter:manage required.', false)
    );
    progress.mockResolvedValue(snapshot('PREVIEWED'));
    await requestPreview(user);
    await confirmCommit(user);
    await screen.findByText('Import permission required');
    await screen.findByText('PREVIEWED', { selector: 'p' });
    expect(screen.getByRole('checkbox', { name: /I confirm importing/ })).toBeDisabled();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('rejects a preview returned for a different migration', async () => {
    const { user, preview, commit } = await reviewHarness();
    preview.mockResolvedValue({ ...previewReceipt, migrationKey: 'foreign-run' });
    await user.click(screen.getByRole('checkbox', { name: /I have reviewed/ }));
    await user.click(screen.getByRole('button', { name: 'Preview reviewed migration' }));
    await screen.findByText(/returned migration does not match/);
    expect(
      screen.queryByRole('button', { name: 'Commit reviewed import' })
    ).not.toBeInTheDocument();
    expect(commit).not.toHaveBeenCalled();
  });

  it('does not enable preview when the receipt has no reviewed migration input', async () => {
    const { preview, commit } = await reviewHarness(vi.fn().mockResolvedValue(receipt));
    expect(screen.getByRole('checkbox', { name: /I have reviewed/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Preview reviewed migration' })).toBeDisabled();
    expect(preview).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it.each(['Worksheet', 'Header row', 'Application number', 'Workspace relationship', 'file'])(
    'invalidates both approvals and preview after changing %s',
    async (field) => {
      const { user, preview, commit } = await reviewHarness();
      await requestPreview(user);
      await user.click(screen.getByRole('checkbox', { name: /I confirm importing/ }));
      if (field === 'file') uploadSource();
      else
        fireEvent.change(screen.getByLabelText(field), {
          target: { value: field === 'Workspace relationship' ? 'OWNED' : '' }
        });
      expect(
        screen.queryByRole('heading', { name: 'Migration preview', exact: true })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('checkbox', { name: /I confirm importing/ })
      ).not.toBeInTheDocument();
      expect(preview).toHaveBeenCalledTimes(1);
      expect(commit).not.toHaveBeenCalled();
    }
  );

  it('ignores a preparation response after the source selection changes', async () => {
    const pending = deferred<HistoricalTrademarkAssetPreparationReceipt>();
    const { user, preview } = await reviewHarness(vi.fn().mockReturnValue(pending.promise));
    await user.selectOptions(screen.getByLabelText('Workspace relationship'), 'OWNED');
    await act(async () => {
      pending.resolve(reviewedReceipt);
      await pending.promise;
    });
    expect(
      screen.queryByRole('heading', { name: 'Review the preparation result' })
    ).not.toBeInTheDocument();
    expect(preview).not.toHaveBeenCalled();
  });

  it('ignores an in-flight preview after mapping changes', async () => {
    const { user, preview, commit } = await reviewHarness();
    const pending = deferred<TrademarkAssetMigrationPreview>();
    preview.mockReturnValue(pending.promise);
    await user.click(screen.getByRole('checkbox', { name: /I have reviewed/ }));
    await user.click(screen.getByRole('button', { name: 'Preview reviewed migration' }));
    await user.selectOptions(screen.getByLabelText('Workspace relationship'), 'OWNED');
    await act(async () => {
      pending.resolve(previewReceipt);
      await pending.promise;
    });
    expect(
      screen.queryByRole('heading', { name: 'Migration preview', exact: true })
    ).not.toBeInTheDocument();
    expect(commit).not.toHaveBeenCalled();
  });

  it('does not apply a late commit result to a different Workspace', async () => {
    const { user, commit, onCompleted, rerender, props } = await reviewHarness();
    const pending = deferred<ReviewableTrademarkAssetMigrationResult>();
    commit.mockReturnValue(pending.promise);
    await requestPreview(user);
    await confirmCommit(user);
    rerender(
      <HistoricalTrademarkAssetImportPanel
        {...props}
        workspaceId="22222222-2222-4222-8222-222222222222"
      />
    );
    await act(async () => {
      pending.resolve(completedResult);
      await pending.promise;
    });
    expect(screen.queryByRole('heading', { name: 'Import completed' })).not.toBeInTheDocument();
    expect(screen.queryByText('legacy.csv')).not.toBeInTheDocument();
    expect(onCompleted).not.toHaveBeenCalled();
  });
});
