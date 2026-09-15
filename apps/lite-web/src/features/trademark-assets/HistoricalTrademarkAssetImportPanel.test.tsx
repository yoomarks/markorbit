// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  HistoricalTrademarkAssetPreparationReceipt,
  TrademarkAssetMigrationClient
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
