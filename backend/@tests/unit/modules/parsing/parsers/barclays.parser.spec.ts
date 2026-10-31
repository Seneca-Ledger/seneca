import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import { BankOfScotlandParser } from '@/modules/parsing/parsers/bank-of-scotland.parser';
import {
  BarclaysParser,
  barclaysPayee,
  isBarclaysStatement,
} from '@/modules/parsing/parsers/barclays.parser';

const STATEMENT = [
  'Example Bank Customer',
  'Sort code 00-00-00  BIC BUKBGB22  IBAN GB00 BUKB 0000 0000 0000 01',
  '01 -30 Sep 2022',
  'Barclays Bank UK PLC. Registered in England',
].join('\n');

const row = (text: string, y: number): PdfTextRow => ({
  text,
  y,
  page: 1,
  items: text.split(/\s{2,}/).map((t, i) => ({ text: t, x: i * 100, width: 50 })),
});

class Probe extends BarclaysParser {
  read(rows: PdfTextRow[], reading?: Parameters<BarclaysParser['readTransactions']>[1]) {
    return this.readTransactions(rows, reading);
  }
  range(text: string) {
    return this.extractDateRange(text);
  }
}

describe('BarclaysParser', () => {
  it('knows its statement by the registered name and the bank code', () => {
    expect(isBarclaysStatement(STATEMENT)).toBe(true);
    expect(isBarclaysStatement('Barclays Bank PLC\nGB00 BUKB 0000 0000 0000 01')).toBe(true);
    expect(isBarclaysStatement('Barclays Bank UK PLC. Registered in England')).toBe(false);
    expect(isBarclaysStatement('BIC BUKBGB22')).toBe(false);
    expect(isBarclaysStatement('20 Jun FASTER PAYMENT BARCLAYS BANK PLC 100.00')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new BarclaysParser();
    const claims = (bank: BankName, type = FileType.PDF, text = STATEMENT) =>
      parser.canParse(bank, type, 'x.pdf', text);
    await expect(claims(BankName.BARCLAYS)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.AXIS)).resolves.toBe(false);
    await expect(claims(BankName.BARCLAYS, FileType.CSV)).resolves.toBe(false);
  });

  it('is not claimed by Bank of Scotland, and does not claim its statement', async () => {
    const bos = 'IBAN GB00 BOFS 0000 0000 0000 01\nwww.bankofscotland.co.uk\nBank of Scotland plc';
    await expect(
      new BankOfScotlandParser().canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT),
    ).resolves.toBe(false);
    await expect(
      new BarclaysParser().canParse(BankName.OTHER, FileType.PDF, 'x.pdf', bos),
    ).resolves.toBe(false);
  });

  describe('payee', () => {
    it.each([
      ['Card Payment to ACME Store Ltd On', 'ACME Store Ltd', 'Card Payment to ACME Store Ltd'],
      ['Card Payment to ACME Store Ltd On 07 Sep', 'ACME Store Ltd', 'Card Payment to ACME Store Ltd'],
      ['Card Payment to ACME STATION', 'ACME STATION', 'Card Payment to ACME STATION'],
      ['Bill Payment to Example Co On', 'Example Co', 'Bill Payment to Example Co'],
      ['Received from Example Co Ref: 1234', 'Example Co', 'Received from Example Co Ref: 1234'],
      ['Received from Example Co', 'Example Co', 'Received from Example Co'],
      ['Card Payment to', '', 'Card Payment to'],
      ['Monthly Account Fee On', '', 'Monthly Account Fee'],
    ])('%s', (description, counterparty, kept) => {
      expect(barclaysPayee(description)).toEqual({ counterparty, description: kept });
    });
  });

  it('reads the period printed as a day range, else falls back to the base', () => {
    const probe = new Probe();
    expect(probe.range('x\n01 -30 Sep 2022\ny')).toEqual({
      from: new Date(Date.UTC(2022, 8, 1)),
      to: new Date(Date.UTC(2022, 8, 30)),
    });
    expect(probe.range('01.09.2022 - 30.09.2022').from).not.toBeNull();
    expect(probe.range('nothing here')).toEqual({ from: null, to: null });
  });

  it('drops "Continued" and keeps it dropped when a reading is passed in', () => {
    const rows = [
      row('Date  Description  Money out  Money in  Balance', 10),
      row('02 Sep  Card Payment to ACME Store Ltd On  12.50  100.00', 20),
      row('Continued', 30),
      row('03 Sep  Received from Example Co Ref: 1234  50.00  150.00', 40),
    ];
    const probe = new Probe();
    for (const reading of [undefined, { headings: undefined }]) {
      const out = probe.read(rows, reading);
      expect(out.map(r => r.description).join('|')).not.toMatch(/Continued/);
      expect(out[0].counterparty).toBe('ACME Store Ltd');
    }
  });
});
