import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Alert, Button, Card, Select, TextInput } from '@markorbit/ui';
import {
  createTrademarkAssetMigrationClient,
  type HistoricalTrademarkAssetImportRelationshipKind,
  type HistoricalTrademarkAssetPreparationReceipt,
  type HistoricalTrademarkAssetTabularColumnMapping,
  type TrademarkAssetMigrationClient,
  type TrademarkAssetMigrationPreview,
  type TrademarkAssetMigrationRunSnapshot,
  type ReviewableTrademarkAssetMigrationResult
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
  onCompleted?: () => void;
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

export function HistoricalTrademarkAssetImportPanel(props: HistoricalTrademarkAssetImportPanelProps) {
  return <HistoricalImportSession key={props.workspaceId} {...props} />;
}

function HistoricalImportSession({
  workspaceId,
  client: suppliedClient,
  decoder = decodeHistoricalTrademarkAssetFile,
  now = () => new Date().toISOString(),
  createOperationId = () => crypto.randomUUID(),
  onClose,
  onCompleted
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
  const revision = useRef(0);
  const preparing = useRef(false);
  useEffect(
    () => () => {
      revision.current += 1;
    },
    []
  );

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
    revision.current += 1;
    preparing.current = false;
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
    const currentRevision = revision.current;
    try {
      const decoded = await decoder({ fileName: file.name, bytes: await file.arrayBuffer() });
      if (revision.current !== currentRevision) return;
      setWorkbook(decoded);
      setObservedAt(now());
      setMigrationKey(operationKey(decoded.sourceFingerprintSha256, createOperationId));
      setDecodeState('ready');
    } catch (error) {
      if (revision.current !== currentRevision) return;
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
    if (!readyToPrepare || !workbook || !table || !relationshipKind || preparing.current) return;
    const currentRevision = ++revision.current;
    preparing.current = true;
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
      if (revision.current !== currentRevision) return;
      setReceipt(prepared);
      setPrepareState('idle');
    } catch (error) {
      if (revision.current !== currentRevision) return;
      setPrepareState('error');
      setPrepareError(
        error instanceof TrademarkAssetHttpError ? error.message : 'Preparation is unavailable.'
      );
    } finally {
      if (revision.current === currentRevision) preparing.current = false;
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
          <Alert tone="info" title="Preparation receipt">
            Lite reports source mapping readiness only. Official truth remains unverified, and no
            Asset or Matter was created automatically by preparation.
          </Alert>
          <HistoricalMigrationReview
            workspaceId={workspaceId}
            receipt={receipt}
            client={client}
            createOperationId={createOperationId}
            {...(onCompleted ? { onCompleted } : {})}
          />
        </section>
      ) : null}
    </Card>
  );
}

/** Interaction state only; the preparation receipt remains the admission-input owner. */
function HistoricalMigrationReview({
  workspaceId,
  receipt,
  client,
  createOperationId,
  onCompleted
}: {
  workspaceId: string;
  receipt: Readonly<HistoricalTrademarkAssetPreparationReceipt>;
  client: TrademarkAssetMigrationClient;
  createOperationId: () => string;
  onCompleted?: () => void;
}) {
  const input = useMemo(() => {
    if (!receipt.migrationInput || !receipt.readyRows.length) return;
    const { workspaceId: inputWorkspace, ...reviewed } = receipt.migrationInput;
    if (
      inputWorkspace !== workspaceId ||
      receipt.workspaceId !== workspaceId ||
      reviewed.migrationKey !== receipt.migrationKey ||
      reviewed.sourceFingerprintSha256 !== receipt.sourceFingerprintSha256 ||
      receipt.ready !== receipt.readyRows.length ||
      reviewed.rows.length !== receipt.ready ||
      reviewed.rows.some((row, index) => row.rowKey !== receipt.readyRows[index]?.rowKey)
    )
      return;
    return reviewed;
  }, [receipt, workspaceId]);
  const [reviewed, setReviewed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<Readonly<TrademarkAssetMigrationPreview>>();
  const [progress, setProgress] = useState<Readonly<TrademarkAssetMigrationRunSnapshot>>();
  const [completed, setCompleted] = useState<Readonly<ReviewableTrademarkAssetMigrationResult>>();
  const [attempted, setAttempted] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string>();
  const [progressError, setProgressError] = useState<string>();
  const [busy, setBusy] = useState<'' | 'preview' | 'commit' | 'progress'>('');
  const [page, setPage] = useState(0);
  const alive = useRef(true);
  const running = useRef(false);
  const previewKey = useRef<string>();
  const commitKey = useRef<string>();
  const notified = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!completed || notified.current) return;
    notified.current = true;
    onCompleted?.();
  }, [completed, onCompleted]);

  const message = (cause: unknown) =>
    cause instanceof Error ? cause.message : 'The import service is unavailable.';
  const assertRun = (
    value: Readonly<TrademarkAssetMigrationPreview | ReviewableTrademarkAssetMigrationResult>
  ) => {
    if (
      !input ||
      value.workspaceId !== workspaceId ||
      value.migrationKey !== input.migrationKey ||
      value.sourceFingerprintSha256 !== input.sourceFingerprintSha256 ||
      value.total !== input.rows.length ||
      value.schemaVersion !== 1 ||
      value.officialTruthVerifiedByLite !== false ||
      value.matterCreatedAutomatically !== false ||
      (preview && value.fingerprint !== preview.fingerprint)
    ) {
      throw new Error(
        'The returned migration does not match the reviewed input. No completion can be confirmed.'
      );
    }
  };
  const acceptCompletion = (value: Readonly<ReviewableTrademarkAssetMigrationResult>) => {
    assertRun(value);
    if (
      value.created + value.duplicates + value.rejected !== value.total ||
      value.items.length !== value.total
    ) {
      throw new Error(
        'The import result is incomplete. Check saved progress before taking another action.'
      );
    }
    setCompleted(value);
    setError(undefined);
  };
  const readProgress = async () => {
    if (!input) return;
    setProgressError(undefined);
    try {
      const value = await client.progress(input.migrationKey);
      if (!alive.current) return;
      assertRun(value);
      if (!['PREVIEWED', 'COMMITTING', 'INTERRUPTED', 'COMPLETED'].includes(value.status)) {
        throw new Error('The import service returned an unsupported progress state.');
      }
      setProgress(value);
      if (value.status === 'COMPLETED') acceptCompletion(value);
    } catch (cause) {
      if (!alive.current) return;
      setProgress(undefined);
      setProgressError(message(cause));
    }
  };
  const preparePreview = async () => {
    if (!input || !reviewed || running.current || preview) return;
    running.current = true;
    setBusy('preview');
    setError(undefined);
    setConfirmed(false);
    previewKey.current ??= `historical-preview:${createOperationId()}`;
    try {
      const value = await client.preview(input, previewKey.current);
      if (!alive.current) return;
      assertRun(value);
      if (
        value.rows.length !== input.rows.length ||
        value.chunks.length !== value.chunkCount ||
        value.rows.some(
          (row, index) => row.importIndex !== index || row.rowKey !== input.rows[index]?.rowKey
        )
      ) {
        throw new Error('The migration preview is incomplete. Review cannot continue.');
      }
      setPreview(value);
    } catch (cause) {
      if (alive.current) setError(message(cause));
    } finally {
      running.current = false;
      if (alive.current) setBusy('');
    }
  };
  const canCommit = Boolean(
    input &&
    preview &&
    reviewed &&
    confirmed &&
    !denied &&
    !completed &&
    !progressError &&
    (!attempted || progress?.status === 'PREVIEWED' || progress?.status === 'INTERRUPTED')
  );
  const commit = async () => {
    if (!input || !canCommit || running.current) return;
    running.current = true;
    setBusy('commit');
    setError(undefined);
    setProgress(undefined);
    setAttempted(true);
    setConfirmed(false);
    commitKey.current ??= `historical-commit:${createOperationId()}`;
    try {
      const value = await client.commit(input.migrationKey, input, commitKey.current);
      if (!alive.current) return;
      acceptCompletion(value);
    } catch (cause) {
      if (!alive.current) return;
      setError(message(cause));
      if (
        cause instanceof TrademarkAssetHttpError &&
        (cause.status === 401 || cause.status === 403)
      )
        setDenied(true);
      // A lost response may hide an already-completed write. Read; never auto-retry the write.
      await readProgress();
    } finally {
      running.current = false;
      if (alive.current) setBusy('');
    }
  };
  const refreshProgress = async () => {
    if (running.current) return;
    running.current = true;
    setBusy('progress');
    setConfirmed(false);
    try {
      await readProgress();
    } finally {
      running.current = false;
      if (alive.current) setBusy('');
    }
  };
  const first = page * 20;
  const results = completed ?? progress;
  return (
    <section className="historical-import__review" aria-label="Reviewed migration">
      <h4>READY rows for your review</h4>
      <p>
        Review the prepared identifiers and relationships. These are source facts, not verified
        registry information.
      </p>
      {receipt.readyRows.length ? (
        <>
          <div
            className="historical-import__table-wrap"
            role="region"
            aria-label="Ready rows"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Source row</th>
                  <th scope="col">Jurisdiction</th>
                  <th scope="col">Trademark</th>
                  <th scope="col">Identifiers</th>
                  <th scope="col">Relationship</th>
                </tr>
              </thead>
              <tbody>
                {receipt.readyRows.slice(first, first + 20).map((row) => (
                  <tr key={row.rowKey}>
                    <th scope="row">{row.rowKey}</th>
                    <td>{row.item.identity.jurisdiction}</td>
                    <td>{row.item.identity.markText ?? 'Not supplied'}</td>
                    <td>
                      {row.item.externalIdentifiers
                        ?.map((id) => `${id.kind}: ${id.value}`)
                        .join(' · ') || 'Not supplied'}
                    </td>
                    <td>
                      {row.item.workspaceRelationships
                        .map((relationship) => relationship.kind)
                        .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="historical-import__actions">
            <span>
              Rows {first + 1}–{Math.min(first + 20, receipt.readyRows.length)} of{' '}
              {receipt.readyRows.length}
            </span>
            {receipt.readyRows.length > 20 ? (
              <>
                <Button
                  variant="secondary"
                  disabled={page === 0}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous ready rows
                </Button>
                <Button
                  variant="secondary"
                  disabled={first + 20 >= receipt.readyRows.length}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next ready rows
                </Button>
              </>
            ) : null}
          </div>
        </>
      ) : (
        <p>No READY rows are available to review.</p>
      )}
      {!input ? (
        <Alert tone="warning" title="Import review unavailable">
          A matching reviewed migration input and READY rows are required. Correct the source or
          prepare the review again.
        </Alert>
      ) : null}
      <label className="historical-import__confirmation">
        <input
          type="checkbox"
          checked={reviewed}
          disabled={!input || Boolean(busy) || Boolean(preview)}
          onChange={(event) => setReviewed(event.target.checked)}
        />
        <span>I have reviewed the READY rows and their Workspace relationships.</span>
      </label>
      {!preview ? (
        <Button
          disabled={!input || !reviewed || Boolean(busy)}
          onClick={() => void preparePreview()}
        >
          {busy === 'preview' ? 'Preparing migration preview…' : 'Preview reviewed migration'}
        </Button>
      ) : null}
      {error ? (
        <Alert
          tone="danger"
          title={denied ? 'Import permission required' : 'Import action could not be confirmed'}
        >
          {error}
        </Alert>
      ) : null}
      {preview ? (
        <section className="historical-import__review" aria-label="Migration preview">
          <h4>Migration preview</h4>
          <p>
            Preview created no Trademark Asset or Matter. Only the reviewed READY rows below will be
            submitted; unresolved rows are excluded.
          </p>
          <dl className="historical-import__metadata">
            <div>
              <dt>Migration key</dt>
              <dd>{preview.migrationKey}</dd>
            </div>
            <div>
              <dt>Source fingerprint</dt>
              <dd>{preview.sourceFingerprintSha256 ?? 'Not supplied'}</dd>
            </div>
            <div>
              <dt>Reviewed input fingerprint</dt>
              <dd>{preview.fingerprint}</dd>
            </div>
            <div>
              <dt>Total reviewed rows</dt>
              <dd>{preview.total}</dd>
            </div>
            <div>
              <dt>Chunk count</dt>
              <dd>{preview.chunkCount}</dd>
            </div>
          </dl>
          <details>
            <summary>Inspect exact chunk boundaries</summary>
            <p>Indexes are zero-based; the end index is exclusive.</p>
            <ol>
              {preview.chunks.map((chunk) => (
                <li key={chunk.chunkIndex}>
                  Chunk {chunk.chunkIndex}: [{chunk.startIndex}, {chunk.endExclusive}) ·{' '}
                  {chunk.rowKeys.length} row(s)
                </li>
              ))}
            </ol>
          </details>
          {!completed ? (
            <>
              <label className="historical-import__confirmation">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={
                    Boolean(busy) ||
                    denied ||
                    Boolean(progressError) ||
                    (attempted &&
                      progress?.status !== 'PREVIEWED' &&
                      progress?.status !== 'INTERRUPTED')
                  }
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  I confirm importing these reviewed rows into this Workspace. No Matter or filing
                  will be created.
                </span>
              </label>
              <Button disabled={!canCommit || Boolean(busy)} onClick={() => void commit()}>
                {busy === 'commit'
                  ? 'Submitting reviewed import…'
                  : progress?.status === 'INTERRUPTED'
                    ? 'Resume interrupted import'
                    : 'Commit reviewed import'}
              </Button>
            </>
          ) : null}
        </section>
      ) : null}
      {busy ? (
        <p role="status">
          {busy === 'preview'
            ? 'Requesting preview; nothing is imported.'
            : busy === 'commit'
              ? 'Import requested. Waiting for the saved result.'
              : 'Reading saved migration progress…'}
        </p>
      ) : null}
      {progressError ? (
        <Alert tone="warning" title="Import progress unavailable">
          {progressError} The outcome is unknown. Check progress before attempting another write.
        </Alert>
      ) : null}
      {attempted && !completed ? (
        <Button
          variant="secondary"
          disabled={Boolean(busy)}
          onClick={() => void refreshProgress()}
        >
          Check saved progress
        </Button>
      ) : null}
      {results ? (
        <section className="historical-import__review" aria-label="Saved migration result">
          <h4>{completed ? 'Import completed' : 'Saved migration progress'}</h4>
          <p role="status">{completed ? 'COMPLETED' : progress?.status}</p>
          <dl className="historical-import__metadata">
            <div>
              <dt>Created</dt>
              <dd>{results.created}</dd>
            </div>
            <div>
              <dt>Duplicates</dt>
              <dd>{results.duplicates}</dd>
            </div>
            <div>
              <dt>Rejected</dt>
              <dd>{results.rejected}</dd>
            </div>
            {progress ? (
              <>
                <div>
                  <dt>Next chunk index</dt>
                  <dd>{progress.nextChunkIndex}</dd>
                </div>
                <div>
                  <dt>Saved at</dt>
                  <dd>{progress.updatedAt}</dd>
                </div>
              </>
            ) : null}
          </dl>
          {progress?.status === 'COMMITTING' && !completed ? (
            <p>
              The saved run is still COMMITTING. Check progress; this screen will not start another
              import automatically.
            </p>
          ) : null}
          {progress?.status === 'INTERRUPTED' && !completed ? (
            <p>
              The run was interrupted. Review the saved counts and confirm again to resume the same
              reviewed input.
            </p>
          ) : null}
          <p>These are saved Workspace import results, not verified official trademark status.</p>
        </section>
      ) : null}
      <small>
        Changing the source or mapping clears this review, not a submitted server operation. This
        browser does not persist review drafts.
      </small>
    </section>
  );
}
