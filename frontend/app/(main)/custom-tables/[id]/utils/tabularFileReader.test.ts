import { describe, expect, it } from 'vitest';
import * as xlsx from 'xlsx';
import {
  pickDefaultSheet,
  type ReadableTabularFile,
  readTabularFile,
  readTabularWorkbook,
  TabularFileError,
} from './tabularFileReader';

function makeFile(name: string, data: ArrayBuffer | string): ReadableTabularFile {
  const buffer =
    typeof data === 'string' ? (new TextEncoder().encode(data).buffer as ArrayBuffer) : data;
  return { name, size: buffer.byteLength, arrayBuffer: async () => buffer };
}

function xlsxFile(rows: unknown[][], name = 'book.xlsx'): ReadableTabularFile {
  const sheet = xlsx.utils.aoa_to_sheet(rows);
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, sheet, 'Sheet1');
  const buffer = xlsx.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return makeFile(name, buffer);
}

describe('readTabularFile', () => {
  it('reads an xlsx sheet into a row matrix', async () => {
    const file = xlsxFile([
      ['Дата', 'Сумма'],
      ['2026-01-15', 1500.5],
      ['2026-02-01', 20],
    ]);

    const rows = await readTabularFile(file);

    expect(rows[0]).toEqual(['Дата', 'Сумма']);
    expect(rows).toHaveLength(3);
    // Значения приходят строками — так же, как при вставке из буфера.
    expect(typeof rows[1][1]).toBe('string');
  });

  it('reads a csv file', async () => {
    const file = makeFile('data.csv', 'a,b\n1,2\n');

    const rows = await readTabularFile(file);

    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('drops fully empty rows instead of importing blanks', async () => {
    const file = xlsxFile([
      ['a', 'b'],
      ['', ''],
      ['1', '2'],
    ]);

    const rows = await readTabularFile(file);

    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('rejects an unsupported extension', async () => {
    await expect(readTabularFile(makeFile('notes.pdf', 'x'))).rejects.toMatchObject({
      reason: 'unsupported',
    });
  });

  it('rejects a file with no usable rows', async () => {
    await expect(readTabularFile(xlsxFile([['', '']]))).rejects.toBeInstanceOf(TabularFileError);
  });

  it('exposes formulas, number formats and dates of every sheet', async () => {
    const sheet = xlsx.utils.aoa_to_sheet([
      ['Date', 'Amount', 'Share'],
      [new Date(2026, 8, 15), 1500.5, 0.12],
      ['Total', { t: 'n', f: 'SUM(B2:B2)', v: 1500.5 }, ''],
    ]);
    sheet.C2.z = '0%';
    const book = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(book, sheet, 'Data');
    xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([['x']]), 'Notes');
    const buffer = xlsx.write(book, { bookType: 'xlsx', type: 'array', cellDates: true }) as ArrayBuffer;

    const workbook = await readTabularWorkbook(makeFile('book.xlsx', buffer));

    expect(workbook.sheets.map(s => s.name)).toEqual(['Data', 'Notes']);
    expect(pickDefaultSheet(workbook)).toBe(0);
    const data = workbook.sheets[0].rows;
    expect(data[1][0]).toMatchObject({ text: '2026-09-15', kind: 'date' });
    expect(data[1][2]).toMatchObject({ kind: 'number', numFmt: '0%' });
    expect(data[2][1]).toMatchObject({ formula: 'SUM(B2:B2)' });
  });

  it('decodes a windows-1251 csv', async () => {
    const bytes = new Uint8Array([0xc4, 0xe0, 0xf2, 0xe0, 0x2c, 0x31, 0x0a]); // "Дата,1\n"
    const rows = await readTabularFile(makeFile('bank.csv', bytes.buffer as ArrayBuffer));
    expect(rows[0][0]).toBe('Дата');
  });
});
