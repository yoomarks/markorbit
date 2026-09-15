import type { Meta, StoryObj } from '@storybook/react';
import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  HistoricalTrademarkAssetPreparationReceipt,
  ReviewableTrademarkAssetMigrationResult,
  TrademarkAssetMigrationClient,
  TrademarkAssetMigrationPreview
} from '../../api/trademark-asset-migrations.js';
import { TrademarkAssetHttpError } from '../../api/trademark-assets.js';
import type { DecodedHistoricalTrademarkAssetWorkbook } from './historical-file-decoder.js';
import { HistoricalTrademarkAssetImportPanel } from './HistoricalTrademarkAssetImportPanel.js';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const fingerprint = 'a'.repeat(64);
const at = '2026-09-15T04:00:00.000Z';
const workbook: DecodedHistoricalTrademarkAssetWorkbook = {
  schemaVersion: 1,
  fileName: 'fixture-portfolio.csv',
  format: 'CSV',
  sourceFingerprintSha256: fingerprint,
  sheets: [{ name: 'CSV', rows: [['Country', 'Mark', 'Application'], ['US', 'ALPHA', '00123'], ['US', '', '']] }]
};
const row: HistoricalTrademarkAssetPreparationReceipt['readyRows'][number] = {
  rowKey: 'sheet:CSV:row:2',
  sourceIndex: 0,
  item: {
    identity: { jurisdiction: 'US', markText: 'ALPHA' },
    externalIdentifiers: [{ kind: 'APPLICATION_NUMBER', jurisdiction: 'US', value: '00123', officialTruthVerifiedByLite: false }],
    workspaceRelationships: [{ kind: 'MANAGED', sourceAssetEditableByWorkspace: true }],
    sourceReferences: [{ owner: 'WORKSPACE_USER', kind: 'WORKSPACE_ADMISSION', sourceId: 'fixture-portfolio.csv', sourceVersion: fingerprint, observedAt: at, freshness: 'UNKNOWN' }]
  }
};
const receipt: HistoricalTrademarkAssetPreparationReceipt = {
  schemaVersion: 1,
  workspaceId,
  migrationKey: 'historical-fixture-reviewed',
  sourceFingerprintSha256: fingerprint,
  manifestFingerprintSha256: 'b'.repeat(64),
  total: 2,
  ready: 1,
  unresolved: 1,
  readyRows: [row],
  unresolvedRows: [{ rowKey: 'sheet:CSV:row:3', sourceIndex: 1, reason: 'Mark and identifier are missing.' }],
  migrationInput: { workspaceId, migrationKey: 'historical-fixture-reviewed', sourceFingerprintSha256: fingerprint, rows: [{ rowKey: row.rowKey, item: row.item }] },
  officialTruthVerifiedByLite: false,
  assetsCreatedAutomatically: false,
  matterCreatedAutomatically: false
};
const preview: TrademarkAssetMigrationPreview = {
  schemaVersion: 1,
  workspaceId,
  migrationKey: receipt.migrationKey,
  sourceFingerprintSha256: fingerprint,
  fingerprint: 'c'.repeat(64),
  total: 1,
  chunkCount: 1,
  chunks: [{ chunkIndex: 0, startIndex: 0, endExclusive: 1, rowKeys: [row.rowKey] }],
  rows: [{ rowKey: row.rowKey, importIndex: 0 }],
  officialTruthVerifiedByLite: false,
  matterCreatedAutomatically: false
};
const result: ReviewableTrademarkAssetMigrationResult = {
  schemaVersion: 1,
  workspaceId,
  migrationKey: receipt.migrationKey,
  sourceFingerprintSha256: fingerprint,
  fingerprint: preview.fingerprint,
  total: 1,
  created: 1,
  duplicates: 0,
  rejected: 0,
  chunkCount: 1,
  items: [{ rowKey: row.rowKey, importIndex: 0, status: 'CREATED' }],
  officialTruthVerifiedByLite: false,
  matterCreatedAutomatically: false
};
type Scenario = 'review' | 'preview' | 'permission' | 'interrupted' | 'completed' | 'empty' | 'committing' | 'unavailable';

function fixtureClient(scenario: Scenario): TrademarkAssetMigrationClient {
  return {
    prepareTabular: async () => {
      if (scenario !== 'empty') return receipt;
      const { migrationInput, ...empty } = receipt;
      return { ...empty, ready: 0, unresolved: 2, readyRows: [], unresolvedRows: [
        { rowKey: migrationInput!.rows[0]!.rowKey, sourceIndex: 0, reason: 'Fixture source needs correction.' },
        ...receipt.unresolvedRows
      ] };
    },
    preview: async () => preview,
    commit: async () => {
      if (scenario === 'committing') return new Promise(() => undefined);
      if (scenario === 'permission') throw new TrademarkAssetHttpError(403, 'PERMISSION_DENIED', 'matter:manage permission is required.', false);
      if (scenario === 'interrupted' || scenario === 'unavailable') throw new TrademarkAssetHttpError(503, 'OWNER_INTERRUPTED', 'The import response was interrupted.', true);
      return result;
    },
    progress: async () => {
      if (scenario === 'unavailable') throw new Error('Saved progress is temporarily unavailable.');
      return {
        ...result,
        status: scenario === 'permission' ? 'PREVIEWED' : 'INTERRUPTED',
        created: 0,
        items: [],
        nextChunkIndex: 0,
        rowKeys: [row.rowKey],
        updatedAt: at
      };
    }
  };
}

const meta = {
  title: 'Lite/Agency/Historical migration review',
  component: HistoricalTrademarkAssetImportPanel,
  args: {
    workspaceId,
    client: fixtureClient('review'),
    decoder: async () => workbook,
    now: () => at,
    createOperationId: () => 'fixture-operation'
  },
  parameters: { layout: 'padded' },
  decorators: [(Story) => (
    <div style={{ maxWidth: 1120, margin: '0 auto' }}>
      <p>Demonstration fixture only. No live requests or real imports occur in these stories.</p>
      <Story />
    </div>
  )]
} satisfies Meta<typeof HistoricalTrademarkAssetImportPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

function reviewStory(scenario: Scenario): Story {
  return {
    args: { client: fixtureClient(scenario) },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      const user = userEvent.setup({ document: canvasElement.ownerDocument });
      const file = new File(['Country,Mark,Application\nUS,ALPHA,00123'], 'fixture-portfolio.csv', { type: 'text/csv' });
      await user.upload(canvas.getByLabelText('Local CSV or XLSX file'), file);
      await canvas.findByText('fixture-portfolio.csv');
      await user.selectOptions(canvas.getByLabelText('Worksheet'), 'CSV');
      await user.type(canvas.getByLabelText('Header row'), '1');
      await user.selectOptions(canvas.getByLabelText('Workspace relationship'), 'MANAGED');
      await user.selectOptions(canvas.getByLabelText('Jurisdiction · required'), 'Country');
      await user.selectOptions(canvas.getByLabelText('Mark text · required'), 'Mark');
      await user.selectOptions(canvas.getByLabelText('Application number'), 'Application');
      await user.click(canvas.getByRole('button', { name: 'Prepare import review' }));
      await canvas.findByRole('heading', { name: 'Review the preparation result' });
      if (scenario === 'review' || scenario === 'empty') return;
      await user.click(canvas.getByRole('checkbox', { name: /I have reviewed the READY rows/ }));
      await user.click(canvas.getByRole('button', { name: 'Preview reviewed migration' }));
      await canvas.findByRole('heading', { name: 'Migration preview', exact: true });
      if (scenario === 'preview') return;
      await user.click(canvas.getByRole('checkbox', { name: /I confirm importing these reviewed rows/ }));
      await user.click(canvas.getByRole('button', { name: 'Commit reviewed import' }));
      if (scenario === 'completed') await canvas.findByRole('heading', { name: 'Import completed' });
      else if (scenario === 'interrupted') await canvas.findByText('INTERRUPTED', { selector: 'p' });
      else if (scenario === 'permission') await canvas.findByText('Import permission required');
      else if (scenario === 'unavailable') await canvas.findByText('Import progress unavailable');
      else await canvas.findByRole('button', { name: 'Submitting reviewed import…' });
    }
  };
}

export const ReadyAndUnresolved = reviewStory('review');
export const NoReadyRows = reviewStory('empty');
export const PreviewNeedsSeparateConfirmation = reviewStory('preview');
export const CommitPending = reviewStory('committing');
export const PermissionDenied = reviewStory('permission');
export const InterruptedNeedsExplicitResume = reviewStory('interrupted');
export const ProgressUnavailable = reviewStory('unavailable');
export const Completed = reviewStory('completed');
