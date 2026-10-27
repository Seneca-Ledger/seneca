import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { readHeaderRow } from '@/modules/parsing/helpers/pdf-layout-columns.helper';
import {
  openingBalanceFromRows,
  readLayoutTransactions,
  toParsedTransactions,
} from '@/modules/parsing/helpers/pdf-layout-table.helper';

/** A word is [text, x]; width is 5pt per character, height 8pt. */
type Word = [string, number];

const row = (y: number, words: Word[], page = 1, top = y): PdfTextRow => ({
  page,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y: top, width: text.length * 5, height: 8, page })),
});

// Right edges: Withdrawal 340, Deposit 430, Balance 520.
const header = row(100, [
  ['Date', 40],
  ['Description', 110],
  ['Withdrawal', 290],
  ['Deposit', 395],
  ['Balance', 485],
]);

describe('pdf-layout-table.helper', () => {
  it('keeps two headings apart even when only a few points separate them', () => {
    const columns = readHeaderRow(
      row(100, [
        ['Détails', 40],
        ['Chèques', 270],
        ['et', 310],
        ['débits', 322],
        ['Dépôts', 358],
        ['et', 392],
        ['crédits', 404],
        ['($)', 441],
        ['Solde', 520],
      ]),
    );
    expect(columns?.map(column => column.role)).toEqual(['description', 'debit', 'credit', 'balance']);
    expect(columns?.[2].x1).toBe(456);
  });

  it('does not take a summary line for a header', () => {
    expect(readHeaderRow(row(50, [['Previous', 40], ['Balance', 90], ['1,000.00', 300]]))).toBeNull();
  });

  it('reads multi-line descriptions and the side of each amount', () => {
    const transactions = readLayoutTransactions([
      header,
      row(120, [['Balance', 110], ['Brought', 150], ['Forward', 190], ['1,000.00', 480]]),
      row(140, [['01/02/2025', 40], ['ACME', 110], ['Store', 135], ['12.50', 315], ['987.50', 490]]),
      row(149, [['Wireless', 110], ['Buds', 155]]),
      row(170, [['15/02/2025', 40], ['Salary', 110], ['100.00', 400], ['1,087.50', 480]]),
      row(190, [['Balance', 110], ['Carried', 150], ['Forward', 190], ['12.50', 315], ['1,087.50', 480]]),
      row(199, [['Thank', 110], ['you', 140]]),
    ]);

    expect(transactions.map(({ description, debit, credit, balance }) => ({ description, debit, credit, balance }))).toEqual([
      { description: 'ACME Store Wireless Buds', debit: 12.5, credit: undefined, balance: 987.5 },
      { description: 'Salary', debit: undefined, credit: 100, balance: 1087.5 },
    ]);
    expect(openingBalanceFromRows(transactions)).toBe(1000);
  });

  it('keeps zero-amount lines as description, as card statements print them', () => {
    const transactions = readLayoutTransactions([
      header,
      row(140, [['09/01', 40], ['ACME', 110], ['Store', 135], ['12.50', 315]]),
      row(149, [['REF:', 110], ['000001', 135], ['0.00', 320]]),
    ]);
    expect(transactions[0].description).toBe('ACME Store REF: 000001');
  });

  it('separates a footer laid over the last row and does not take it as text', () => {
    const lastRow = row(700, [['28/02/2025', 40], ['ACME', 110], ['Store', 135], ['12.50', 315]], 1, 700.7);
    const footer = row(700, [['No', 38], ['rights', 60], ['reserved', 150]]);
    const transactions = readLayoutTransactions([
      header,
      { ...lastRow, items: [...lastRow.items, ...footer.items] },
      row(709, [['Example', 40], ['Bank', 80], ['Scheme', 115]]),
    ]);
    expect(transactions.map(t => t.description)).toEqual(['ACME Store']);
  });

  it('stops a description at a note that carries money', () => {
    const transactions = readLayoutTransactions([
      header,
      row(140, [['01/02/2025', 40], ['ACME', 110], ['12.50', 315]]),
      row(150, [['Account', 110], ['fee:', 150], ['3,00', 175], ['$', 196]]),
    ]);
    expect(transactions[0].description).toBe('ACME');
  });

  it('turns a card charge into a debit and a payment into a credit', () => {
    const transactions = readLayoutTransactions([
      row(100, [['Date', 40], ['Description', 110], ['Amount', 400]]),
      row(140, [['09/13', 40], ['ACME', 110], ['12.50', 405]]),
      row(160, [['09/14', 40], ['Payment', 110], ['-5.00', 405]]),
    ]);
    const parsed = toParsedTransactions(transactions, 'mdy', new Date(2025, 8, 30), 'USD', true);
    expect(parsed.map(({ debit, credit }) => ({ debit, credit }))).toEqual([
      { debit: 12.5, credit: undefined },
      { debit: undefined, credit: 5 },
    ]);
    expect(parsed[0].transactionDate.getMonth()).toBe(8);
  });
});
