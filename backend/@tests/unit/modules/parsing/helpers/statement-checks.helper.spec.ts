import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import {
  type LayoutTransaction,
  readLayoutTable,
} from '@/modules/parsing/helpers/pdf-layout-table.helper';
import {
  checkBalanceChain,
  checkDatesInPeriod,
  checkPrintedBalances,
  checkPrintedTotals,
  checkSectionTotals,
} from '@/modules/parsing/helpers/statement-checks.helper';
import { findStatementTotals } from '@/modules/parsing/helpers/statement-metadata.helper';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';

const tx = (dateText: string, amounts: Partial<LayoutTransaction>): LayoutTransaction => ({
  date: { day: 1, month: 1 },
  dateText,
  description: 'ACME Store',
  firstLine: 'ACME Store',
  counterparty: '',
  ...amounts,
});

const parsed = (day: number, amounts: Partial<ParsedTransaction>): ParsedTransaction => ({
  transactionDate: new Date(2025, 0, day),
  counterpartyName: 'ACME Store',
  paymentPurpose: 'ACME Store',
  ...amounts,
});

describe('statement-checks.helper', () => {
  describe('checkBalanceChain', () => {
    it('follows the running balance, over rows that print none', () => {
      const rows = [
        tx('02/01', { credit: 100, balance: 1100 }),
        tx('03/01', { debit: 12.5 }),
        tx('03/01', { debit: 7.5, balance: 1080 }),
      ];
      expect(checkBalanceChain(rows)).toEqual({ code: 'balance_chain', passed: true });
    });

    it('accepts a statement listing its newest row first, and a card owing more after a charge', () => {
    const owed = [tx('02/01', { debit: 50, balance: 550 }), tx('03/01', { credit: 25, balance: 525 })];
    expect(checkBalanceChain(owed, true)?.passed).toBe(true);
    // An account's balance does not rise with money out.
    expect(checkBalanceChain(owed)?.passed).toBe(false);
      const newestFirst = [tx('03/01', { debit: 20, balance: 1080 }), tx('02/01', { credit: 100, balance: 1100 })];
      const card = [tx('02/01', { amount: 50, balance: 550 }), tx('03/01', { amount: 25, balance: 575 })];
      expect(checkBalanceChain(newestFirst)?.passed).toBe(true);
      expect(checkBalanceChain([...card, tx('04/01', { amount: 25, balance: 625 })], true)?.passed).toBe(false);
      expect(checkBalanceChain(card, true)?.passed).toBe(true);
    });

    it('names the first row the balance does not follow', () => {
      const rows = [
        tx('02/01', { credit: 100, balance: 1100 }),
        tx('03/01', { debit: 20, balance: 1080 }),
        // Debit and credit read into each other's column: the sign is wrong.
        tx('04/01', { credit: 30, balance: 1050 }),
      ];
      expect(checkBalanceChain(rows)).toEqual({
        code: 'balance_chain',
        passed: false,
        detail: { row: 3, date: '04/01', expected: 1110, actual: 1050 },
      });
    });

    it('catches a balance that moves with no row to move it', () => {
      const rows = [tx('02/01', { credit: 0, balance: 1100 }), tx('03/01', { debit: 0, balance: 1000 })];
      expect(checkBalanceChain(rows)?.passed).toBe(false);
    });

    it('checks each account on its own, and does not apply without two balances', () => {
      const usd = { accountNumber: '000-1', currency: 'USD' };
      const hkd = { accountNumber: '000-2', currency: 'HKD' };
      const rows = [
        tx('02/01', { credit: 100, balance: 1100, account: usd }),
        tx('02/01', { credit: 5, balance: 55, account: hkd }),
        tx('03/01', { debit: 20, balance: 1080, account: usd }),
      ];
      expect(checkBalanceChain(rows)?.passed).toBe(true);
      expect(checkBalanceChain([tx('02/01', { credit: 100, balance: 1100 })])).toBeNull();
      expect(checkBalanceChain([tx('02/01', { credit: 100 }), tx('03/01', { debit: 1 })])).toBeNull();
    });
  });

  describe('printed totals', () => {
    const text = [
      'Balance on 20 Jun 2025 £1,000.00 Debit card fee 8 £2.80',
      'Money in £300.00 Total fees 8 £2.80',
      'Money out £50.25 The fees paid are highlighted',
    ].join('\n');

    it('reads money in and money out, the first figure after each label', () => {
      expect(findStatementTotals(text, 'dmy')).toEqual({ credits: 300, debits: 50.25 });
      expect(findStatementTotals('Deposits\nTotal withdrawals 2,040.00', 'mdy')).toEqual({
        credits: null,
        debits: 2040,
      });
      // "money input" is no label.
      expect(findStatementTotals('Money input 12.00', 'dmy')).toEqual({ credits: null, debits: null });
    });

    it('holds the rows to them, and says which side is off', () => {
      const totals = { credits: 300, debits: 50.25 };
      const rows = [parsed(2, { credit: 300 }), parsed(3, { debit: 50 }), parsed(4, { debit: 0.25 })];
      expect(checkPrintedTotals(totals, rows)).toEqual({ code: 'printed_totals', passed: true });
      expect(checkPrintedTotals(totals, rows.slice(0, 2))).toEqual({
        code: 'printed_totals',
        passed: false,
        detail: { side: 'debits', expected: 50.25, actual: 50 },
      });
      expect(checkPrintedTotals({ credits: null, debits: null }, rows)).toBeNull();
    });
  });

  describe('section totals', () => {
    /** A word is [text, x]; width is 5pt per character. */
    const row = (y: number, words: [string, number][], page = 1): PdfTextRow => ({
      page,
      y,
      text: words.map(([text]) => text).join(' '),
      items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page })),
    });
    const withdrawals = (page: number, y: number) =>
      row(y, [['Withdrawals', 40], ['and', 100], ['Other', 120], ['Deductions', 150]], page);

    it('adds up a section continued on the next page against its totals line', () => {
      const { sections } = readLayoutTable([
        withdrawals(1, 100),
        row(115, [['02/18', 40], ['ACME', 80], ['Store', 110], ['12.50', 400]]),
        withdrawals(2, 100),
        row(115, [['02/25', 40], ['Example', 80], ['Utility', 125], ['7.50', 405]], 2),
        row(130, [['Total', 80], ['withdrawals', 110], ['20.00', 400]], 2),
      ]);
      expect(sections).toEqual([{ sign: 'debit', printed: 20, read: 20 }]);
      expect(checkSectionTotals(sections)).toEqual({ code: 'section_totals', passed: true });
    });

    it('takes no total from a summary that names a section with nothing under it', () => {
      const { sections } = readLayoutTable([
        row(100, [['Deposits', 40]]),
        row(110, [['Date', 40], ['Description', 110], ['Amount', 300], ['Balance', 385]]),
        row(125, [['Savings', 110], ['account', 155], ['15,450.75', 375]]),
      ]);
      expect(sections).toEqual([]);
    });

    it('fails a section whose rows add up to less than its total', () => {
      expect(checkSectionTotals([{ sign: 'credit', printed: 100, read: 90 }])).toEqual({
        code: 'section_totals',
        passed: false,
        detail: { side: 'credits', expected: 100, actual: 90 },
      });
      expect(checkSectionTotals([])).toBeNull();
    });
  });

  it('catches a bank that swaps its money columns', () => {
    const row = (y: number, words: [string, number][]): PdfTextRow => ({
      page: 1,
      y,
      text: words.map(([text]) => text).join(' '),
      items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page: 1 })),
    });
    // Right edges: first money column 340, second 430, Balance 520.
    const table = (first: string, second: string) =>
      readLayoutTable([
        row(100, [['Date', 40], ['Description', 110], [first, 340 - first.length * 5], [second, 430 - second.length * 5], ['Balance', 485]]),
        row(115, [['01/02/2025', 40], ['ACME', 110], ['Store', 135], ['12.50', 315], ['987.50', 490]]),
        row(130, [['15/02/2025', 40], ['Salary', 110], ['100.00', 400], ['1,087.50', 480]]),
        row(145, [['16/02/2025', 40], ['Example', 110], ['Utility', 150], ['7.50', 320], ['1,080.00', 480]]),
      ]).transactions;
    // The printed layout: money out first. Read as it is, the balances follow.
    expect(checkBalanceChain(table('Withdrawal', 'Deposit'))?.passed).toBe(true);
    // The same figures under swapped headings: every row's side is wrong.
    expect(checkBalanceChain(table('Deposit', 'Withdrawal'))).toMatchObject({
      passed: false,
      detail: { row: 2, date: '15/02/2025' },
    });
  });

  it('compares labelled balances with those of the rows, by size', () => {
    expect(checkPrintedBalances({ start: 1000, end: -250 }, { start: 1000, end: 250 })?.passed).toBe(true);
    expect(checkPrintedBalances({ start: 1000, end: 900 }, { start: 1000, end: 950 })).toEqual({
      code: 'printed_balances',
      passed: false,
      detail: { side: 'end', expected: 900, actual: 950 },
    });
    expect(checkPrintedBalances({ start: null, end: 900 }, { start: 1000, end: null })).toBeNull();
  });

  it('finds a row dated well outside the period', () => {
    const period = { from: new Date(2025, 0, 1), to: new Date(2025, 0, 31) };
    // A card purchase dated a few days before the period still belongs to it.
    expect(checkDatesInPeriod([parsed(-3, {}), parsed(31, {})], period)?.passed).toBe(true);
    expect(checkDatesInPeriod([parsed(2, {}), parsed(400, {})], period)).toEqual({
      code: 'dates_in_period',
      passed: false,
      detail: { row: 2, date: '2026-02-04' },
    });
    expect(checkDatesInPeriod([parsed(2, {})], null)).toBeNull();
  });
});
