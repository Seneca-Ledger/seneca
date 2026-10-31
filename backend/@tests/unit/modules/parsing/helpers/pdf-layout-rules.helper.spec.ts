import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { failedChecks, pickByChecks, ROW_RULES } from '@/modules/parsing/helpers/pdf-layout-rules.helper';
import { readLayoutTransactions } from '@/modules/parsing/helpers/pdf-layout-table.helper';

/** A word is [text, x]; width is 5pt per character, height 8pt. */
type Word = [string, number];

const row = (y: number, words: Word[]): PdfTextRow => ({
  page: 1,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page: 1 })),
});

// Right edges: Withdrawal 340, Deposit 430, Balance 520.
const header = row(100, [
  ['Date', 40],
  ['Description', 110],
  ['Withdrawal', 290],
  ['Deposit', 395],
  ['Balance', 485],
]);

// The day's second payment sits far below the first, past a printed note:
// too far for the next line of the same day, so only the `money` rule reads it.
const spaced = [
  header,
  row(120, [['01/09/2026', 40], ['Opening', 110], ['balance', 150], ['1,000.00', 480]]),
  row(140, [['02/09/2026', 40], ['ACME', 110], ['Store', 135], ['12.50', 315], ['987.50', 490]]),
  row(180, [['ACME', 110], ['Cafe', 135], ['7.50', 320], ['980.00', 490]]),
  row(200, [['03/09/2026', 40], ['Salary', 110], ['100.00', 400], ['1,080.00', 480]]),
];

describe('pdf-layout-rules.helper', () => {
  it('reads the rows under each rule, the usual one first', () => {
    expect(ROW_RULES[0]).toBe('dated');
    const [dated, strict, money] = ROW_RULES.map(rows => readLayoutTransactions(spaced, { rows }));
    expect(dated.map(t => t.description)).toEqual(['ACME Store', 'Salary']);
    expect(strict.map(t => t.description)).toEqual(['ACME Store', 'Salary']);
    expect(money.map(t => [t.dateText, t.description, t.debit])).toEqual([
      ['02/09/2026', 'ACME Store', 12.5],
      ['02/09/2026', 'ACME Cafe', 7.5],
      ['03/09/2026', 'Salary', undefined],
    ]);
  });

  it('keeps the reading the running balance agrees with', () => {
    const readings = ROW_RULES.map(rows => readLayoutTransactions(spaced, { rows }));
    expect(failedChecks(readings[0], '')).toBe(1);
    expect(failedChecks(readings[2], '')).toBe(0);
    expect(pickByChecks(readings, '')).toBe(readings[2]);
  });

  it('keeps the usual reading on a tie, and a reading of rows over none', () => {
    const usual = readLayoutTransactions(spaced.slice(0, 3));
    const same = readLayoutTransactions(spaced.slice(0, 3), { rows: 'money' });
    expect(pickByChecks([usual, same], '')).toBe(usual);
    expect(pickByChecks([[], same], '')).toBe(same);
  });

  it('holds a reading to the money out the statement prints', () => {
    // No running balance on the rows: only the printed sum tells the readings apart.
    const unbalanced = [
      header,
      row(140, [['02/09/2026', 40], ['ACME', 110], ['Store', 135], ['12.50', 315]]),
      row(180, [['ACME', 110], ['Cafe', 135], ['7.50', 320]]),
    ];
    const [dated, , money] = ROW_RULES.map(rows => readLayoutTransactions(unbalanced, { rows }));
    const printed = 'Money out 20.00';
    expect(failedChecks(dated, printed)).toBe(1);
    expect(failedChecks(money, printed)).toBe(0);
  });
});
