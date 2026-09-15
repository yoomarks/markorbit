import { useMemo, useState, type ChangeEvent } from 'react';
import { Alert, Button, Card, Select, TextInput } from '@markorbit/ui';
import {
  createTrademarkAssetMigrationClient,
  type HistoricalTrademarkAssetImportRelationshipKind,
  type HistoricalTrademarkAssetPreparationReceipt,
  type HistoricalTrademarkAssetTabularColumnMapping,
  type TrademarkAssetMigrationClient
} from '../../api/trademark-asset-migrations.js';
import { TrademarkAssetHttpError } from '../../api/trademark-assets.js';
import {
  decodeHistoricalTrademarkAssetFile,
  HistoricalTrademarkAssetFileDecodeError,
  selectHistoricalTrademarkAssetTable,
  type DecodedHistoricalTrademarkAssetWorkbook
} from './historical-file-decoder.js';
import './historical-import.css';

const semanticFields = [
  ['jurisdiction', 'Jurisdiction', true],
  ['markText', 'Mark text', true],
  ['applicationNumber', 'Application number', false],
  ['registrationNumber', 'Registration number', false],
  ['madridIrNumber', 'Madrid IR number', false],
  ['internalReference', 'Internal reference', false]
] as const;
type SemanticField = (typeof semanticFields)[number][0];
type MappingState = Record<SemanticField, string>;

const emptyMappings = (): MappingState => ({
  jurisdiction: '',
  markText: '',
  applicationNumber: '',
  registrationNumber: '',
  madridIrNumber: '',
  internalReference: ''
});

export interface HistoricalTrademarkAssetImportPanelProps {
  workspaceId: string;
  client?: TrademarkAssetMigrationClient;
  decoder?: typeof decodeHistoricalTrademarkAssetFile;
  now?: () => string;
  createOperationId?: () => string;
  onClose?: () => void;
}

function headerProblem(headers: readonly string[]): string | undefined {
  const normalized = headers.map((header) => header.trim());
  if (normalized.some((header) => !header))
    return 'The selected header row contains a blank header.';
  if (new Set(normalized).size !== normalized.length)
    return 'The selected header row contains duplicate headers after trimming.';
  return undefined;
}
function operationKey(fingerprint: string, createOperationId: () => string): string {
  return `historical-${fingerprint.slice(0, 16)}-${createOperationId()}`;
}

function mappedColumns(mappings: MappingState): HistoricalTrademarkAssetTabularColumnMapping {
  return {
    jurisdiction: mappings.jurisdiction,
    markText: mappings.markText,
    ...(mappings.applicationNumber ? { applicationNumber: mappings.applicationNumber } : {}),
    ...(mappings.registrationNumber ? { registrationNumber: mappings.registrationNumber } : {}),
    ...(mappings.madridIrNumber ? { madridIrNumber: mappings.madridIrNumber } : {}),
    ...(mappings.internalReference ? { internalReference: mappings.internalReference } : {})
  };
}

export function HistoricalTrademarkAssetImportPanel({
  workspaceId,
  client: suppliedClient,
  decoder = decodeHistoricalTrademarkAssetFile,
  now = () => new Date().toISOString(),
  createOperationId = () => crypto.randomUUID(),
  onClose
}: HistoricalTrademarkAssetImportPanelProps) {
  const client = useMemo(
    () => suppliedClient ?? createTrademarkAssetMigrationClient(workspaceId),
    [suppliedClient, workspaceId]
  );
  const [workbook, setWorkbook] = useState<Readonly<DecodedHistoricalTrademarkAssetWorkbook>>();
  const [selectedSheetName, setSelectedSheetName] = useState('');
  const [headerRowNumber, setHeaderRowNumber] = useState('');
  const [relationshipKind, setRelationshipKind] = useState<
    HistoricalTrademarkAssetImportRelationshipKind | ''
  >('');
  const [mappings, setMappings] = useState<MappingState>(emptyMappings);
  const [migrationKey, setMigrationKey] = useState('');
  const [observedAt, setObservedAt] = useState('');
  const [decodeState, setDecodeState] = useState<'idle' | 'decoding' | 'ready' | 'error'>('idle');
  const [decodeError, setDecodeError] = useState<string>();
  const [prepareState, setPrepareState] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [prepareError, setPrepareError] = useState<string>();
  const [receipt, setReceipt] = useState<Readonly<HistoricalTrademarkAssetPreparationReceipt>>();

  const selectedSheet = workbook?.sheets.find((sheet) => sheet.name === selectedSheetName);
  const headerRowIndex = /^\d+$/.test(headerRowNumber) ? Number(headerRowNumber) - 1 : undefined;
  const table = useMemo(() => {
    if (!workbook || !selectedSheet || headerRowIndex === undefined || headerRowIndex < 0) return;
    if (headerRowIndex >= selectedSheet.rows.length) return;
    return selectHistoricalTrademarkAssetTable(workbook, {
      sheetName: selectedSheet.name,
      headerRowIndex
    });
  }, [headerRowIndex, selectedSheet, workbook]);
  const invalidHeaders = table ? headerProblem(table.headers) : undefined;
  const identifierMapped =
    Boolean(mappings.applicationNumber) ||
    Boolean(mappings.registrationNumber) ||
    Boolean(mappings.madridIrNumber) ||
    Boolean(mappings.internalReference);
  const selectedMappings = Object.values(mappings).filter(Boolean);
  const mappingColumnsUnique = new Set(selectedMappings).size === selectedMappings.length;
  const readyToPrepare = Boolean(
    workbook &&
    table &&
    table.rows.length &&
    relationshipKind &&
    mappings.jurisdiction &&
    mappings.markText &&
    identifierMapped &&
    mappingColumnsUnique &&
    !invalidHeaders &&
    migrationKey &&
    observedAt &&
    prepareState !== 'submitting'
  );

  const clearPreparedResult = () => {
    setReceipt(undefined);
    setPrepareError(undefined);
    setPrepareState('idle');
  };

  const resetSelections = () => {
    setSelectedSheetName('');
    setHeaderRowNumber('');
    setRelationshipKind('');
    setMappings(emptyMappings());
    clearPreparedResult();
  };
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    setWorkbook(undefined);
    setDecodeError(undefined);
    setMigrationKey('');
    setObservedAt('');
    resetSelections();
    if (!file) {
      setDecodeState('idle');
      return;
    }
    setDecodeState('decoding');
    try {
      const decoded = await decoder({ fileName: file.name, bytes: await file.arrayBuffer() });
      setWorkbook(decoded);
      setObservedAt(now());
      setMigrationKey(operationKey(decoded.sourceFingerprintSha256, createOperationId));
      setDecodeState('ready');
    } catch (error) {
      setDecodeState('error');
      setDecodeError(
        error instanceof HistoricalTrademarkAssetFileDecodeError
          ? error.message
          : 'The local spreadsheet could not be decoded.'
      );
    }
  };
  const updateMapping = (field: SemanticField, value: string) => {
    setMappings((current) => ({ ...current, [field]: value }));
    clearPreparedResult();
  };

  const prepare = async () => {
    if (!readyToPrepare || !workbook || !table || !relationshipKind) return;
    setPrepareState('submitting');
    setPrepareError(undefined);
    setReceipt(undefined);
    try {
      const prepared = await client.prepareTabular({
        migrationKey,
        sourceFingerprintSha256: workbook.sourceFingerprintSha256,
        sourceArtifactId: workbook.fileName,
        sourceArtifactVersion: workbook.sourceFingerprintSha256,
        observedAt,
        relationshipKind,
        headers: table.headers,
        columns: mappedColumns(mappings),
        rows: table.rows
      });
      setReceipt(prepared);
      setPrepareState('idle');
    } catch (error) {
      setPrepareState('error');
      setPrepareError(
        error instanceof TrademarkAssetHttpError ? error.message : 'Preparation is unavailable.'
      );
    }
  };
  return (
    <Card className="historical-import" data-testid="historical-import-panel">
      <div className="historical-import__heading">
        <div>
          <p className="trademark-asset-workspace__eyebrow">Historical portfolio intake</p>
          <h2>Prepare a local spreadsheet for review</h2>
          <p>
            The raw file stays in this browser. Nothing is imported until a later, separate governed
            action.
          </p>
        </div>
        {onClose ? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>

      <label className="historical-import__file">
        <span>Local CSV or XLSX file</span>
        <input type="file" accept=".csv,.xlsx" onChange={(event) => void chooseFile(event)} />
      </label>
      {decodeState === 'decoding' ? <p role="status">Decoding locally…</p> : null}
      {decodeState === 'error' && decodeError ? (
        <Alert tone="danger" title="Local file could not be decoded">
          {decodeError}
        </Alert>
      ) : null}
      {workbook ? (
        <div className="historical-import__source-meta" aria-label="Local source metadata">
          <span>{workbook.fileName}</span>
          <span>{workbook.format}</span>
          <span>{workbook.sheets.length} worksheet(s)</span>
          <span>SHA-256 {workbook.sourceFingerprintSha256.slice(0, 16)}…</span>
        </div>
      ) : null}

      {workbook ? (
        <div className="historical-import__selection-grid">
          <Select
            label="Worksheet"
            value={selectedSheetName}
            onChange={(event) => {
              setSelectedSheetName(event.target.value);
              setHeaderRowNumber('');
              setMappings(emptyMappings());
              clearPreparedResult();
            }}
          >
            <option value="">Select worksheet</option>
            {workbook.sheets.map((sheet) => (
              <option key={sheet.name} value={sheet.name}>
                {sheet.name} · {sheet.rows.length} row(s)
              </option>
            ))}
          </Select>
          <TextInput
            label="Header row"
            type="number"
            min={1}
            max={selectedSheet?.rows.length}
            value={headerRowNumber}
            disabled={!selectedSheet}
            hint="Enter the 1-based row containing the exact source headers."
            onChange={(event) => {
              setHeaderRowNumber(event.target.value);
              setMappings(emptyMappings());
              clearPreparedResult();
            }}
          />
          <Select
            label="Workspace relationship"
            value={relationshipKind}
            onChange={(event) => {
              setRelationshipKind(
                event.target.value as HistoricalTrademarkAssetImportRelationshipKind | ''
              );
              clearPreparedResult();
            }}
          >
            <option value="">Select relationship</option>
            <option value="OWNED">Owned by this Workspace</option>
            <option value="MANAGED">Managed by this Workspace</option>
            <option value="REPRESENTED">Represented by this Workspace</option>
          </Select>
        </div>
      ) : null}

      {invalidHeaders ? (
        <Alert tone="warning" title="Choose a different header row or fix the source file">
          {invalidHeaders} Headers are preserved exactly and are never renamed automatically.
        </Alert>
      ) : null}

      {table && !invalidHeaders ? (
        <fieldset className="historical-import__mapping">
          <legend>Explicit source-column mapping</legend>
          <p>
            Map jurisdiction, mark text, and at least one exact identifier. No mapping is inferred.
          </p>
          <div className="historical-import__mapping-grid">
            {semanticFields.map(([field, label, required]) => (
              <Select
                key={field}
                label={`${label}${required ? ' · required' : ''}`}
                value={mappings[field]}
                onChange={(event) => updateMapping(field, event.target.value)}
              >
                <option value="">{required ? 'Select source column' : 'Not mapped'}</option>
                {table.headers.map((header, index) => {
                  const usedElsewhere = semanticFields.some(
                    ([otherField]) => otherField !== field && mappings[otherField] === header
                  );
                  return (
                    <option key={`${index}-${header}`} value={header} disabled={usedElsewhere}>
                      Column {index + 1}: {header}
                    </option>
                  );
                })}
              </Select>
            ))}
          </div>
          {!identifierMapped ? (
            <small role="status">Map at least one exact identifier before preparation.</small>
          ) : null}
          {!mappingColumnsUnique ? (
            <small role="alert">One source column cannot map to multiple semantic fields.</small>
          ) : null}
        </fieldset>
      ) : null}

      {table && !invalidHeaders ? (
        <div className="historical-import__preview">
          <h3>Source preview</h3>
          <p>
            Showing up to 5 source rows after the selected header. Values are not verified truth.
          </p>
          <div className="historical-import__table-wrap">
            <table>
              <thead>
                <tr>
                  {table.headers.map((header, index) => (
                    <th key={`${index}-${header}`} scope="col">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(0, 5).map((row) => (
                  <tr key={row.rowKey}>
                    {table.headers.map((_, index) => (
                      <td key={`${row.rowKey}-${index}`}>{row.cells[index] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small>{table.rows.length} data row(s) selected.</small>
        </div>
      ) : null}
      {workbook ? (
        <div className="historical-import__actions">
          <Button disabled={!readyToPrepare} onClick={() => void prepare()}>
            {prepareState === 'submitting' ? 'Preparing review…' : 'Prepare import review'}
          </Button>
          <small>
            Preparation creates no Trademark Asset or Matter and does not start migration preview or
            commit.
          </small>
        </div>
      ) : null}

      {prepareState === 'error' && prepareError ? (
        <Alert tone="danger" title="Preparation was not accepted">
          {prepareError} No local success state was created.
        </Alert>
      ) : null}

      {receipt ? (
        <section className="historical-import__receipt" aria-labelledby="historical-import-receipt">
          <div className="historical-import__receipt-heading">
            <div>
              <p className="trademark-asset-workspace__eyebrow">Owner preparation receipt</p>
              <h3 id="historical-import-receipt">Review the preparation result</h3>
            </div>
            <span>{receipt.total} source row(s)</span>
          </div>
          <dl className="historical-import__receipt-grid">
            <div>
              <dt>READY</dt>
              <dd>{receipt.ready}</dd>
            </div>
            <div>
              <dt>UNRESOLVED</dt>
              <dd>{receipt.unresolved}</dd>
            </div>
          </dl>
          {receipt.unresolvedRows.length ? (
            <div>
              <h4>Unresolved source rows</h4>
              <ul className="historical-import__unresolved">
                {receipt.unresolvedRows.slice(0, 20).map((row) => (
                  <li key={row.rowKey}>
                    <strong>{row.rowKey}</strong> · {row.reason}
                  </li>
                ))}
              </ul>
              {receipt.unresolvedRows.length > 20 ? (
                <small>
                  Showing the first 20 of {receipt.unresolvedRows.length} unresolved rows.
                </small>
              ) : null}
            </div>
          ) : null}
          <Alert tone="info" title="Preparation only">
            Lite reports source mapping readiness only. Official truth remains unverified, and no
            Asset or Matter was created automatically.
          </Alert>
        </section>
      ) : null}
    </Card>
  );
}
