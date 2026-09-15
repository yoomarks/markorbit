import { afterEach, describe, expect, it, vi } from 'vitest';
import * as xlsx from 'xlsx';
import {
  decodeHistoricalTrademarkAssetFile,
  HistoricalTrademarkAssetFileDecodeError,
  selectHistoricalTrademarkAssetTable
} from './historical-file-decoder.js';

const encoder = new TextEncoder();

function csvBytes(value: string): Uint8Array {
  return encoder.encode(value);
}

function xlsxBytes(): Uint8Array {
  const workbook = xlsx.utils.book_new();
  const assets = xlsx.utils.aoa_to_sheet([
    ['Historical portfolio export'],
    ['Jurisdiction', 'Mark', 'Application No.'],
    ['US', 'ALPHA', 123]
  ]);
  assets['C3'] = { t: 'n', v: 123, z: '000000' };
  xlsx.utils.book_append_sheet(workbook, assets, 'Assets');
  xlsx.utils.book_append_sheet(
    workbook,
    xlsx.utils.aoa_to_sheet([
      ['Jurisdiction', 'Mark', 'Registration No.'],
      ['CN', '贝塔', '456789']
    ]),
    'Archive'
  );
  const output: unknown = xlsx.write(workbook, { type: 'array', bookType: 'xlsx' });
  if (!(output instanceof ArrayBuffer))
    throw new Error('XLSX test fixture was not an ArrayBuffer.');
  return new Uint8Array(output);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('historical Trademark Asset file decoder', () => {
  it('decodes quoted CSV locally while preserving text identifiers and embedded newlines', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const bytes = csvBytes(
      'Jurisdiction,Mark,"Application No."\r\nUS,"ALPHA, INC.","000123"\r\nJP,"LINE\nBREAK",2024-001\r\n'
    );

    const first = await decodeHistoricalTrademarkAssetFile({ fileName: 'legacy.csv', bytes });
    const second = await decodeHistoricalTrademarkAssetFile({ fileName: 'legacy.csv', bytes });

    expect(first.format).toBe('CSV');
    expect(first.sourceFingerprintSha256).toBe(
      '2e2d0e32f4f50ae1ca6f02a2538dcb9a884398b1c61c22f4b3002e05efb47253'
    );
    expect(second.sourceFingerprintSha256).toBe(first.sourceFingerprintSha256);
    expect(first.sheets).toHaveLength(1);
    expect(first.sheets[0]?.rows).toEqual([
      ['Jurisdiction', 'Mark', 'Application No.'],
      ['US', 'ALPHA, INC.', '000123'],
      ['JP', 'LINE\nBREAK', '2024-001']
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('decodes multi-sheet XLSX and requires explicit sheet plus header-row selection', async () => {
    const decoded = await decodeHistoricalTrademarkAssetFile({
      fileName: 'legacy.xlsx',
      bytes: xlsxBytes()
    });

    expect(decoded.format).toBe('XLSX');
    expect(decoded.sheets.map((sheet) => sheet.name)).toEqual(['Assets', 'Archive']);
    expect(decoded.sheets[0]?.rows[2]).toEqual(['US', 'ALPHA', '000123']);

    const selected = selectHistoricalTrademarkAssetTable(decoded, {
      sheetName: 'Assets',
      headerRowIndex: 1
    });
    expect(selected.headers).toEqual(['Jurisdiction', 'Mark', 'Application No.']);
    expect(selected.rows).toEqual([
      { rowKey: 'sheet:Assets:row:3', cells: ['US', 'ALPHA', '000123'] }
    ]);

    const archive = selectHistoricalTrademarkAssetTable(decoded, {
      sheetName: 'Archive',
      headerRowIndex: 0
    });
    expect(archive.rows[0]).toEqual({
      rowKey: 'sheet:Archive:row:2',
      cells: ['CN', '贝塔', '456789']
    });
  });
  it('preserves blank and duplicate headers for the existing owner mapper to resolve', async () => {
    const decoded = await decodeHistoricalTrademarkAssetFile({
      fileName: 'duplicates.csv',
      bytes: csvBytes('Jurisdiction,,Mark,Mark\nUS,legacy,ALPHA,ALT\n')
    });
    const selected = selectHistoricalTrademarkAssetTable(decoded, {
      sheetName: decoded.sheets[0]!.name,
      headerRowIndex: 0
    });

    expect(selected.headers).toEqual(['Jurisdiction', '', 'Mark', 'Mark']);
    expect(selected.rows).toEqual([
      { rowKey: `sheet:${decoded.sheets[0]!.name}:row:2`, cells: ['US', 'legacy', 'ALPHA', 'ALT'] }
    ]);
  });

  it('fails closed for unsupported extensions and malformed XLSX bytes', async () => {
    await expect(
      decodeHistoricalTrademarkAssetFile({ fileName: 'legacy.xls', bytes: csvBytes('a,b\n1,2') })
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });

    await expect(
      decodeHistoricalTrademarkAssetFile({
        fileName: 'legacy.xlsx',
        bytes: csvBytes('not-an-xlsx')
      })
    ).rejects.toMatchObject({ code: 'INVALID_FILE' });
  });
  it('treats CSV strictly as UTF-8 CSV instead of auto-detecting HTML or ZIP containers', async () => {
    const html = '<table><tr><td>A</td><td>B</td></tr></table>';
    const decoded = await decodeHistoricalTrademarkAssetFile({
      fileName: 'legacy.csv',
      bytes: csvBytes(html)
    });
    expect(decoded.sheets).toEqual([{ name: 'CSV', rows: [[html]] }]);

    await expect(
      decodeHistoricalTrademarkAssetFile({ fileName: 'renamed.csv', bytes: xlsxBytes() })
    ).rejects.toMatchObject({ code: 'INVALID_FILE' });
    await expect(
      decodeHistoricalTrademarkAssetFile({
        fileName: 'broken.csv',
        bytes: csvBytes('A,B\n1,"unterminated')
      })
    ).rejects.toMatchObject({ code: 'INVALID_FILE' });
  });

  it('fails closed when an explicit sheet or header-row selection is invalid', async () => {
    const decoded = await decodeHistoricalTrademarkAssetFile({
      fileName: 'legacy.csv',
      bytes: csvBytes('Jurisdiction,Mark\nUS,ALPHA\n')
    });

    expect(() =>
      selectHistoricalTrademarkAssetTable(decoded, { sheetName: 'Missing', headerRowIndex: 0 })
    ).toThrowError(HistoricalTrademarkAssetFileDecodeError);
    expect(() =>
      selectHistoricalTrademarkAssetTable(decoded, {
        sheetName: decoded.sheets[0]!.name,
        headerRowIndex: 99
      })
    ).toThrowError('Header row 99 is outside worksheet');
    expect(() =>
      selectHistoricalTrademarkAssetTable(decoded, {
        sheetName: decoded.sheets[0]!.name,
        headerRowIndex: -1
      })
    ).toThrowError('headerRowIndex must be a non-negative integer.');
  });
});
