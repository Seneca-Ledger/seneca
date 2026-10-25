import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { normalizeDate, normalizeNumber } from '../../src/common/utils/number-normalizer.util';
import { BankName, FileType } from '../../src/entities/statement.entity';
import { DocxParser } from '../../src/modules/parsing/parsers/docx.parser';
import { ExcelParser } from '../../src/modules/parsing/parsers/excel.parser';

describe('normalizeNumber', () => {
  it('treats commas as thousands separators', () => {
    expect(normalizeNumber('2,000')).toBe(2000);
    expect(normalizeNumber('1,000,000')).toBe(1000000);
    expect(normalizeNumber('$15,050.80')).toBe(15050.8);
    expect(normalizeNumber('£1,265.34')).toBe(1265.34);
  });

  it('keeps comma as decimal separator when not a thousands pattern', () => {
    expect(normalizeNumber('123,45')).toBe(123.45);
    expect(normalizeNumber('1 234,56')).toBe(1234.56);
  });

  it('handles negatives and plain numbers', () => {
    expect(normalizeNumber('-356.04')).toBe(-356.04);
    expect(normalizeNumber(42)).toBe(42);
  });
});

describe('normalizeDate', () => {
  it('rejects garbage years from stray numeric strings', () => {
    expect(normalizeDate('45424')).toBeNull();
    expect(normalizeDate('499')).toBeNull();
  });

  it('swaps month/day for US-style MM/DD/YYYY', () => {
    const date = normalizeDate('09/15/2016');
    expect(date?.getFullYear()).toBe(2016);
    expect(date?.getMonth()).toBe(8);
    expect(date?.getDate()).toBe(15);
    const swapped = normalizeDate('15/09/2016');
    expect(swapped?.getMonth()).toBe(8);
    expect(swapped?.getDate()).toBe(15);
  });

  it('never returns an Invalid Date', () => {
    for (const input of ['13/13/2020', '00/00/0000', 'garbage']) {
      const result = normalizeDate(input);
      if (result) {
        expect(Number.isNaN(result.getTime())).toBe(false);
      }
    }
  });
});

describe('ExcelParser header scan', () => {
  it('finds the transaction header below title rows and converts serial dates', async () => {
    // Build a workbook shaped like real statement templates: title rows,
    // then a header row, then rows with Excel serial dates.
    const xlsx = await import('xlsx');
    const rows = [
      ['My Company', '', '', ''],
      ['STATEMENT OF ACCOUNT', '', '', ''],
      ['', '', '', ''],
      ['DATE', 'DESCRIPTION', 'CHARGES', 'CREDITS'],
      [45424, 'The Phone Company', 500, ''],
      [45425, 'Woodgrove Bank', '', 250],
    ];
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), 'Statement');
    const filePath = path.join(os.tmpdir(), `parser-test-${process.pid}.xlsx`);
    xlsx.writeFile(wb, filePath);

    try {
      const parsed = await new ExcelParser().parse(filePath);
      expect(parsed.transactions).toHaveLength(2);
      expect(parsed.transactions[0].debit).toBe(500);
      expect(parsed.transactions[0].paymentPurpose).toBe('The Phone Company');
      expect(parsed.transactions[0].transactionDate.getUTCFullYear()).toBe(2024);
      expect(parsed.transactions[1].credit).toBe(250);
    } finally {
      fs.unlinkSync(filePath);
    }
  });
});

describe('DocxParser', () => {
  function buildDocx(bodyXml: string): string {
    const zip = new AdmZip();
    zip.addFile(
      'word/document.xml',
      Buffer.from(
        `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`,
      ),
    );
    const filePath = path.join(os.tmpdir(), `parser-test-${process.pid}.docx`);
    zip.writeZip(filePath);
    return filePath;
  }

  function table(rows: string[][]): string {
    return `<w:tbl>${rows
      .map(
        cells =>
          `<w:tr>${cells.map(c => `<w:tc><w:p><w:r><w:t>${c}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`,
      )
      .join('')}</w:tbl>`;
  }

  it('extracts transactions from statement tables with section-aware direction', async () => {
    const body =
      `<w:p><w:r><w:t>Statement Period: 09/01/2016 - 09/30/2016</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>DEPOSITS AND ADDITIONS</w:t></w:r></w:p>` +
      table([
        ['DATE', 'DESCRIPTION', 'AMOUNT'],
        ['09/15', 'ATM Check Deposit', '$125.00'],
        ['Total Deposits and Additions', '', '$125.00'],
      ]) +
      `<w:p><w:r><w:t>ELECTRONIC WITHDRAWALS</w:t></w:r></w:p>` +
      table([
        ['DATE', 'DESCRIPTION', 'AMOUNT'],
        ['09/30', 'Qwest Telephone', '$249.96'],
        ['Total Electronic Withdrawals', '', '$249.96'],
      ]) +
      `<w:p><w:r><w:t>DAILY ENDING BALANCE</w:t></w:r></w:p>` +
      table([
        ['DATE', 'AMOUNT'],
        ['09/15', '$15,180.80'],
      ]);
    const filePath = buildDocx(body);

    try {
      const parser = new DocxParser();
      expect(await parser.canParse(BankName.OTHER, FileType.DOCX, filePath)).toBe(true);
      const parsed = await parser.parse(filePath);
      expect(parsed.transactions).toHaveLength(2);
      const [deposit, withdrawal] = parsed.transactions;
      expect(deposit.credit).toBe(125);
      expect(deposit.transactionDate.getFullYear()).toBe(2016);
      expect(withdrawal.debit).toBe(249.96);
      expect(withdrawal.paymentPurpose).toBe('Qwest Telephone');
    } finally {
      fs.unlinkSync(filePath);
    }
  });
});
