import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CsvParser } from '@/modules/parsing/parsers/csv.parser';

describe('CsvParser', () => {
  let dir: string;
  const parser = new CsvParser();

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-parser-'));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const parse = (name: string, lines: string[]) => {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    return parser.parse(filePath);
  };

  const day = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()];

  it('reads every date in a file with one day/month order', async () => {
    // 01/13 can only be month-first, so 01/05 in the same export is January 5th.
    const result = await parse('chase.csv', [
      'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
      '01/05/2026,01/06/2026,STARBUCKS,Food & Drink,Sale,-5.40,',
      '01/13/2026,01/14/2026,AMAZON,Shopping,Sale,-20.00,',
    ]);

    expect(result.transactions.map(t => day(t.transactionDate))).toEqual([
      [2026, 1, 5],
      [2026, 1, 13],
    ]);
  });

  it("falls back to the preset's order when every date reads both ways", async () => {
    const result = await parse('chase-ambiguous.csv', [
      'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
      '01/02/2026,01/03/2026,SHELL,Gas,Sale,-30.00,',
    ]);

    expect(day(result.transactions[0].transactionDate)).toEqual([2026, 1, 2]);
  });

  it('keeps day-first as the default for ambiguous files without a hint', async () => {
    const result = await parse('generic-ambiguous.csv', [
      'Date,Counterparty,Debit,Credit,Description',
      '01/02/2026,Shop,10.00,,Groceries',
    ]);

    expect(day(result.transactions[0].transactionDate)).toEqual([2026, 2, 1]);
  });

  it('skips account details printed above the transaction table', async () => {
    const result = await parse('preamble.csv', [
      '﻿Account statement',
      'Account;DE00 1234 5678',
      'Period;01.01.2026 - 31.01.2026',
      '',
      'Date;Counterparty;Debit;Credit;Description',
      '05.01.2026;REWE;12,34;;Groceries',
      '13.01.2026;Employer;;2500,00;Salary',
    ]);

    expect(result.transactions).toEqual([
      expect.objectContaining({ counterpartyName: 'REWE', debit: 12.34 }),
      expect.objectContaining({ counterpartyName: 'Employer', credit: 2500 }),
    ]);
  });

  it('finds a known bank layout below a preamble', async () => {
    const result = await parse('sparkasse.csv', [
      'Kontoumsaetze;Girokonto',
      '',
      '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Beguenstigter/Zahlungspflichtiger";"Betrag";"Waehrung"',
      '"DE11";"05.01.26";"05.01.26";"LASTSCHRIFT";"Strom Januar";"Stadtwerke";"-61,50";"EUR"',
    ]);

    expect(result.metadata.institution).toBe('Sparkasse / DKB (CAMT-CSV)');
    expect(result.transactions).toEqual([
      expect.objectContaining({ counterpartyName: 'Stadtwerke', debit: 61.5, currency: 'EUR' }),
    ]);
    expect(day(result.transactions[0].transactionDate)).toEqual([2026, 1, 5]);
  });

  it('takes the statement period from the rows instead of today', async () => {
    const result = await parse('period.csv', [
      'Date,Counterparty,Debit,Credit,Description',
      '20.03.2024,B,5.00,,x',
      '15.03.2024,A,10.00,,x',
    ]);

    expect(day(result.metadata.dateFrom)).toEqual([2024, 3, 15]);
    expect(day(result.metadata.dateTo)).toEqual([2024, 3, 20]);
  });

  it('does not drop a first row whose text merely contains "date"', async () => {
    const result = await parse('update.csv', [
      'Date,Counterparty,Debit,Credit,Description',
      '15.03.2024,App Store,9.99,,Subscription update',
    ]);

    expect(result.transactions).toHaveLength(1);
  });
});
