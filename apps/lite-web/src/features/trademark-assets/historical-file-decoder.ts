import type { HistoricalTrademarkAssetTabularSourceRow } from '../../api/trademark-asset-migrations.js';

export type HistoricalTrademarkAssetFileFormat = 'CSV' | 'XLSX';

export type HistoricalTrademarkAssetFileDecodeErrorCode =
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'INVALID_FILE'
  | 'CRYPTO_UNAVAILABLE'
  | 'SHEET_NOT_FOUND'
  | 'HEADER_ROW_OUT_OF_RANGE';

export class HistoricalTrademarkAssetFileDecodeError extends Error {
  constructor(
    readonly code: HistoricalTrademarkAssetFileDecodeErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'HistoricalTrademarkAssetFileDecodeError';
  }
}

export interface DecodedHistoricalTrademarkAssetSheet {
  readonly name: string;
  readonly rows: ReadonlyArray<readonly string[]>;
}
export interface DecodedHistoricalTrademarkAssetWorkbook {
  readonly schemaVersion: 1;
  readonly fileName: string;
  readonly format: HistoricalTrademarkAssetFileFormat;
  readonly sourceFingerprintSha256: string;
  readonly sheets: ReadonlyArray<Readonly<DecodedHistoricalTrademarkAssetSheet>>;
}

export interface HistoricalTrademarkAssetTableSelection {
  readonly sheetName: string;
  readonly headerRowIndex: number;
}

export interface SelectedHistoricalTrademarkAssetTable {
  readonly sourceFingerprintSha256: string;
  readonly sheetName: string;
  readonly headerRowIndex: number;
  readonly headers: readonly string[];
  readonly rows: ReadonlyArray<Readonly<HistoricalTrademarkAssetTabularSourceRow>>;
}

export type HistoricalTrademarkAssetFileBytes = ArrayBuffer | Uint8Array;

function invalid(
  code: HistoricalTrademarkAssetFileDecodeErrorCode,
  message: string,
  options?: ErrorOptions
): never {
  throw new HistoricalTrademarkAssetFileDecodeError(code, message, options);
}
function cleanFileName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim())
    return invalid('INVALID_INPUT', 'fileName must be a non-empty string.');
  return value.trim();
}

function fileFormat(fileName: string): HistoricalTrademarkAssetFileFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.csv')) return 'CSV';
  if (lower.endsWith('.xlsx')) return 'XLSX';
  return invalid('UNSUPPORTED_FILE_TYPE', 'Only .csv and .xlsx files are supported.');
}

function copyBytes(value: HistoricalTrademarkAssetFileBytes): Uint8Array {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  return invalid('INVALID_INPUT', 'bytes must be an ArrayBuffer or Uint8Array.');
}

function isZipSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

function assertXlsxSignature(bytes: Uint8Array): void {
  if (!isZipSignature(bytes))
    invalid('INVALID_FILE', 'XLSX input must be an Office Open XML ZIP document.');
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle)
    return invalid('CRYPTO_UNAVAILABLE', 'Web Crypto SHA-256 is unavailable in this browser.');
  const payload = bytes.slice().buffer;
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', payload));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function stringCell(
  value: unknown,
  sheetName: string,
  rowIndex: number,
  columnIndex: number
): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return String(value);
  return invalid(
    'INVALID_FILE',
    `Sheet ${sheetName} contains a non-scalar cell at row ${rowIndex + 1}, column ${columnIndex + 1}.`
  );
}

function normalizeRows(value: unknown, sheetName: string): readonly (readonly string[])[] {
  if (!Array.isArray(value)) return invalid('INVALID_FILE', `Sheet ${sheetName} is not tabular.`);
  return value.map((rawRow, rowIndex) => {
    if (!Array.isArray(rawRow))
      return invalid('INVALID_FILE', `Sheet ${sheetName} row ${rowIndex + 1} is not tabular.`);
    return rawRow.map((cell, columnIndex) => stringCell(cell, sheetName, rowIndex, columnIndex));
  });
}
function parseCsvRows(bytes: Uint8Array): readonly (readonly string[])[] {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (cause) {
    return invalid('INVALID_FILE', 'CSV input must be valid UTF-8 text.', { cause });
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;

  const pushField = () => {
    row.push(field);
    field = '';
    afterQuote = false;
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (afterQuote) {
      if (character === ',') {
        pushField();
        continue;
      }
      if (character === '\r' || character === '\n') {
        pushRow();
        if (character === '\r' && text[index + 1] === '\n') index += 1;
        continue;
      }
      return invalid(
        'INVALID_FILE',
        `CSV contains unexpected character ${JSON.stringify(character)} after a closing quote.`
      );
    }

    if (character === ',') {
      pushField();
      continue;
    }
    if (character === '\r' || character === '\n') {
      pushRow();
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      continue;
    }
    if (character === '"') {
      if (field.length > 0)
        return invalid('INVALID_FILE', 'CSV quotes must begin at the start of a field.');
      quoted = true;
      continue;
    }
    field += character;
  }

  if (quoted) return invalid('INVALID_FILE', 'CSV contains an unterminated quoted field.');
  if (afterQuote || field.length > 0 || row.length > 0) pushRow();
  return rows;
}

export async function decodeHistoricalTrademarkAssetFile(
  input: Readonly<{
    fileName: string;
    bytes: HistoricalTrademarkAssetFileBytes;
  }>
): Promise<Readonly<DecodedHistoricalTrademarkAssetWorkbook>> {
  const fileName = cleanFileName(input.fileName);
  const format = fileFormat(fileName);
  const bytes = copyBytes(input.bytes);
  if (bytes.length === 0) return invalid('INVALID_FILE', 'Historical spreadsheet file is empty.');

  const sourceFingerprintSha256 = await sha256Hex(bytes);
  if (format === 'CSV') {
    if (isZipSignature(bytes))
      return invalid('INVALID_FILE', 'CSV input cannot be a ZIP-based spreadsheet container.');
    return {
      schemaVersion: 1,
      fileName,
      format,
      sourceFingerprintSha256,
      sheets: [{ name: 'CSV', rows: parseCsvRows(bytes) }]
    };
  }

  assertXlsxSignature(bytes);
  const xlsx = await import('xlsx');
  let workbook: ReturnType<typeof xlsx.read>;
  try {
    workbook = xlsx.read(bytes, {
      type: 'array',
      raw: true,
      cellFormula: false,
      cellHTML: false,
      cellText: true,
      cellDates: false
    });
  } catch (cause) {
    return invalid('INVALID_FILE', 'Historical spreadsheet could not be decoded.', { cause });
  }
  if (workbook.SheetNames.length === 0)
    return invalid('INVALID_FILE', 'Historical spreadsheet contains no worksheets.');

  const sheets = workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    if (!worksheet)
      return invalid('INVALID_FILE', `Worksheet ${name} is missing from the workbook.`);
    const rows = xlsx.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: true
    });
    return { name, rows: normalizeRows(rows, name) };
  });

  return {
    schemaVersion: 1,
    fileName,
    format,
    sourceFingerprintSha256,
    sheets
  };
}

export function selectHistoricalTrademarkAssetTable(
  workbook: Readonly<DecodedHistoricalTrademarkAssetWorkbook>,
  selection: Readonly<HistoricalTrademarkAssetTableSelection>
): Readonly<SelectedHistoricalTrademarkAssetTable> {
  if (typeof selection.sheetName !== 'string' || !selection.sheetName)
    return invalid('INVALID_INPUT', 'sheetName must be selected explicitly.');
  if (!Number.isSafeInteger(selection.headerRowIndex) || selection.headerRowIndex < 0)
    return invalid('INVALID_INPUT', 'headerRowIndex must be a non-negative integer.');

  const sheet = workbook.sheets.find((candidate) => candidate.name === selection.sheetName);
  if (!sheet)
    return invalid('SHEET_NOT_FOUND', `Worksheet ${selection.sheetName} was not decoded.`);
  if (selection.headerRowIndex >= sheet.rows.length)
    return invalid(
      'HEADER_ROW_OUT_OF_RANGE',
      `Header row ${selection.headerRowIndex} is outside worksheet ${selection.sheetName}.`
    );

  const headers = [...sheet.rows[selection.headerRowIndex]!];
  const rows = sheet.rows.slice(selection.headerRowIndex + 1).map((cells, offset) => {
    const sourceRowIndex = selection.headerRowIndex + offset + 1;
    return {
      rowKey: `sheet:${sheet.name}:row:${sourceRowIndex + 1}`,
      cells: [...cells]
    };
  });

  return {
    sourceFingerprintSha256: workbook.sourceFingerprintSha256,
    sheetName: sheet.name,
    headerRowIndex: selection.headerRowIndex,
    headers,
    rows
  };
}
