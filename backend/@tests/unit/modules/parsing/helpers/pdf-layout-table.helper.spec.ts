import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { readHeaderRow } from '@/modules/parsing/helpers/pdf-layout-columns.helper';
import { readLayoutTransactions } from '@/modules/parsing/helpers/pdf-layout-table.helper';
import {
  openingBalanceFromRows,
  splitByAccount,
  toParsedTransactions,
} from '@/modules/parsing/helpers/pdf-layout-transactions.helper';

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

  it('reads year-first dates, as Hong Kong statements print them', () => {
    // Right edges: Deposit 373, Withdrawal 464, Balance in Original Currency 599.
    const transactions = readLayoutTransactions([
      row(100, [
        ['Date', 61],
        ['Transaction', 109],
        ['Details', 151],
        ['Deposit', 338],
        ['Withdrawal', 414],
        ['Balance', 467],
        ['in', 504],
        ['Original', 516],
        ['Currency', 559],
      ]),
      row(115, [['2020/09/30', 61], ['Balance', 109], ['Brought', 147], ['Forward', 185], ['1,000.00', 559]]),
      row(128, [['2020/10/05', 61], ['ACME', 109], ['Store', 134], ['12.50', 439], ['987.50', 569]]),
      row(141, [['2020/10/20', 61], ['Salary', 109], ['100.00', 343], ['1,087.50', 559]]),
      row(154, [['2020/10/31', 61], ['Balance', 109], ['Carried', 147], ['Forward', 185], ['1,087.50', 559]]),
    ]);

    expect(transactions.map(({ dateText, debit, credit, balance }) => ({ dateText, debit, credit, balance }))).toEqual([
      { dateText: '2020/10/05', debit: 12.5, credit: undefined, balance: 987.5 },
      { dateText: '2020/10/20', debit: undefined, credit: 100, balance: 1087.5 },
    ]);
    const [shop] = toParsedTransactions(transactions, 'mdy', new Date(2020, 9, 31), 'HKD', false);
    expect(shop.transactionDate).toEqual(new Date(2020, 9, 5));
  });

  it('skips dated balance lines and keeps what the dated row itself says', () => {
    const transactions = readLayoutTransactions([
      header,
      row(120, [['01/02/2025', 40], ['Beginning', 110], ['Balance', 160], ['1,000.00', 480]]),
      row(140, [['01/02/2025', 40], ['Card', 110], ['Purchase', 135], ['12.50', 315], ['987.50', 490]]),
      row(149, [['ACME', 110], ['Store', 135]]),
      row(160, [['Example', 110], ['Town', 155]]),
      row(180, [['28/02/2025', 40], ['Ending', 110], ['Balance', 150], ['987.50', 490]]),
      row(189, [['Thank', 110], ['you', 140]]),
    ]);

    expect(transactions.map(({ firstLine, description }) => ({ firstLine, description }))).toEqual([
      { firstLine: 'Card Purchase', description: 'Card Purchase ACME Store Example Town' },
    ]);
    expect(openingBalanceFromRows(transactions)).toBe(1000);
  });

  it('reads a row whose text wraps around the amounts printed at its middle', () => {
    // Lines of one cell are 5pt apart, under the 8pt line height; rows are 15pt apart.
    const transactions = readLayoutTransactions([
      header,
      row(120, [['01/02/2025', 40], ['ACME', 110], ['Store', 135], ['12.50', 315], ['987.50', 490]]),
      row(135, [['Online', 110], ['Transfer', 145]]),
      row(140, [['02/02/2025', 40], ['100.00', 400], ['1,087.50', 480]]),
      row(145, [['Salary', 110], ['Example', 145]]),
      row(160, [['03/02/2025', 40], ['Card', 110], ['Payment', 135]]),
      row(170, [['ACME', 110], ['Store', 135], ['7.50', 320], ['1,080.00', 480]]),
      row(180, [['Effective', 110], ['03/02/2025', 160]]),
    ]);

    expect(transactions.map(({ description, debit, credit }) => ({ description, debit, credit }))).toEqual([
      { description: 'ACME Store', debit: 12.5, credit: undefined },
      { description: 'Online Transfer Salary Example', debit: undefined, credit: 100 },
      { description: 'Card Payment ACME Store Effective 03/02/2025', debit: 7.5, credit: undefined },
    ]);
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

  it("reads a line of text and money under a row as the same day's next payment", () => {
    // The date is printed once per day; the day's balance only on its last row.
    const transactions = readLayoutTransactions([
      header,
      row(120, [['01', 40], ['Sep', 52], ['Start', 110], ['balance', 140], ['1,000.00', 480]]),
      row(140, [['06', 40], ['Sep', 52], ['ACME', 110], ['Store', 135], ['57.77', 315]]),
      row(150, [['ACME', 110], ['Cafe', 135], ['28.27', 315], ['913.96', 490]]),
      row(160, [['Refund', 110], ['ACME', 145], ['10.00', 405], ['923.96', 490]]),
      row(170, [['On', 110], ['05', 125], ['Sep', 137]]),
      row(180, [['Total', 110], ['86.04', 315], ['10.00', 405]]),
    ]);

    expect(
      transactions.map(({ dateText, description, debit, credit, balance }) => ({
        dateText,
        description,
        debit,
        credit,
        balance,
      })),
    ).toEqual([
      { dateText: '06 Sep', description: 'ACME Store', debit: 57.77, credit: undefined, balance: undefined },
      { dateText: '06 Sep', description: 'ACME Cafe', debit: 28.27, credit: undefined, balance: 913.96 },
      { dateText: '06 Sep', description: 'Refund ACME On 05 Sep', debit: undefined, credit: 10, balance: 923.96 },
    ]);
  });

  it('opens no row at a date wrapped into the description with the balance printed again', () => {
    const transactions = readLayoutTransactions([
      header,
      row(140, [['08', 40], ['Sep', 52], ['ACME', 110], ['Store', 135], ['On', 160], ['38.18', 315], ['961.82', 490]]),
      row(150, [['07', 110], ['Sep', 122], ['961.82', 490]]),
      row(160, [['ACME', 110], ['Cafe', 135], ['32.90', 315], ['928.92', 490]]),
    ]);

    expect(transactions.map(({ dateText, description, debit }) => ({ dateText, description, debit }))).toEqual([
      { dateText: '08 Sep', description: 'ACME Store On', debit: 38.18 },
      { dateText: '08 Sep', description: 'ACME Cafe', debit: 32.9 },
    ]);
  });

  it('stops a description at a note that carries money', () => {
    const transactions = readLayoutTransactions([
      header,
      row(140, [['01/02/2025', 40], ['ACME', 110], ['12.50', 315]]),
      row(150, [['Account', 110], ['fee:', 150], ['3,00', 175], ['$', 196]]),
    ]);
    expect(transactions[0].description).toBe('ACME');
  });

  it('files each table under the account heading printed above it', () => {
    const transactions = readLayoutTransactions([
      row(80, [['EUR', 40], ['Current', 60], ['Account', 100], ['—', 140], ['000-0001', 150]]),
      header,
      row(140, [['01/02/2025', 40], ['ACME', 110], ['12.50', 315], ['987.50', 490]]),
      row(160, [['Total', 110], ['12.50', 315]]),
      row(200, [['USD', 40], ['Savings', 60], ['Account', 100], ['—', 140], ['000-0002', 150]]),
      header,
      row(240, [['02/02/2025', 40], ['Salary', 110], ['100.00', 400], ['1,100.00', 480]]),
      row(300, [['USD', 40], ['Savings', 60], ['Account', 100], ['—', 140], ['000-0002', 150]], 2),
      row(340, [['03/02/2025', 40], ['ACME', 110], ['10.00', 315], ['1,090.00', 480]], 2),
    ]);

    const groups = splitByAccount(transactions);
    expect(groups.map(group => [group[0].account, group.length])).toEqual([
      [{ accountNumber: '000-0001', currency: 'EUR' }, 1],
      [{ accountNumber: '000-0002', currency: 'USD' }, 2],
    ]);
  });

  it('reads "transfer to account <number>" under a row as its text, not a new account', () => {
    const transactions = readLayoutTransactions([
      header,
      row(140, [['01/02/2025', 40], ['Transfer', 110], ['12.50', 315]]),
      row(149, [['to', 110], ['account', 125], ['1234-5678', 165]]),
    ]);
    expect(transactions[0].description).toBe('Transfer to account 1234-5678');
    expect(splitByAccount(transactions)).toHaveLength(1);
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
