import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName } from '@/entities/statement.entity';
import { mentionedBank, statementLayout } from '@/modules/parsing/helpers/pdf-layout-fingerprint.helper';
import { readLayoutTable } from '@/modules/parsing/helpers/pdf-layout-table.helper';

/** A word is [text, x]; width is 5pt per character. */
type Word = [string, number];

const row = (y: number, words: Word[], page = 1): PdfTextRow => ({
  page,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page })),
});

/** A header whose money headings end at 340, 430 and 520, as the rows below print them. */
const header = (...headings: string[]) => {
  const [date, description, first, second, balance] = headings;
  return row(100, [
    [date, 40],
    [description, 110],
    [first, 340 - first.length * 5],
    [second, 430 - second.length * 5],
    [balance, 520 - balance.length * 5],
  ]);
};

const layoutOf = (rows: PdfTextRow[], text = 'Example Bank statement') =>
  statementLayout(readLayoutTable(rows).layout, text);

const statement = (head: PdfTextRow, store: string, amount: string) =>
  layoutOf([
    head,
    row(115, [['01/02/2025', 40], [store, 110], [amount, 340 - amount.length * 5], ['987.50', 490]]),
    // Every page repeats the header: it is one layout.
    { ...head, page: 2 },
  ]);

describe('pdf-layout-fingerprint.helper', () => {
  const usual = header('Date', 'Description', 'Withdrawal', 'Deposit', 'Balance');

  it('gives two statements of one layout the same fingerprint, whatever their rows', () => {
    const one = statement(usual, 'ACME', '12.50');
    const other = statement(usual, 'Example', '7.25');
    expect(one?.fingerprint).toMatch(/^[0-9a-f]{12}$/);
    expect(other?.fingerprint).toBe(one?.fingerprint);
    expect(one?.headings).toEqual([
      'date:date | description:description | debit:withdrawal | credit:deposit | balance:balance',
    ]);
  });

  it('changes when a heading is renamed or the money columns swap places', () => {
    const base = statement(usual, 'ACME', '12.50')?.fingerprint;
    const renamed = statement(header('Date', 'Details', 'Withdrawal', 'Deposit', 'Balance'), 'ACME', '12.50');
    const swapped = statement(header('Date', 'Description', 'Deposit', 'Withdrawal', 'Balance'), 'ACME', '12.50');
    expect(renamed?.fingerprint).not.toBe(base);
    expect(swapped?.fingerprint).not.toBe(base);
  });

  it('keeps the header words no heading knows, but no figure or date read with them', () => {
    const layout = layoutOf([
      row(100, [
        ['Tran', 20],
        ['Date', 40],
        ['Description', 110],
        ['Withdrawal', 290],
        ['Deposit', 395],
        ['Balance', 485],
        ['Branch', 540],
        ['31/01/2025', 580],
      ]),
    ]);
    expect(layout?.unknownWords).toEqual(['tran', 'branch']);
    expect(layout?.headings).toEqual([
      'date:date tran | description:description | debit:withdrawal | credit:deposit | balance:balance | other:branch',
    ]);
  });

  it('names a statement laid out in sections by its headings, and none without either', () => {
    const sections = layoutOf([row(100, [['Deposits', 40], ['and', 90], ['Other', 110], ['Additions', 140]])]);
    expect(sections?.headings).toEqual(['section:credit']);
    expect(layoutOf([row(100, [['Dear', 40], ['customer', 70]])])).toBeUndefined();
  });

  it('notes a bank with a parser of its own that the text names', () => {
    expect(mentionedBank('Website: www.bochk.com')).toBe(BankName.BANK_OF_CHINA);
    expect(mentionedBank('BankofScotlandplc.Registeredoffice')).toBe(BankName.BANK_OF_SCOTLAND);
    expect(mentionedBank('barclays bank uk plc. registered in england')).toBe(BankName.BARCLAYS);
    expect(mentionedBank('Example Bank, Main Street')).toBeUndefined();
    expect(statement(usual, 'ACME', '12.50')?.mentionedBank).toBeUndefined();
    expect(
      layoutOf([usual], 'Axis Bank Ltd statement')?.mentionedBank,
    ).toBe(BankName.AXIS);
  });
});
