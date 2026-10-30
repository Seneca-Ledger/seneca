import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';

/** "Account Number" / "Account No." heading a column of an account summary. */
const HEADING_FIRST = /^account$/i;
const HEADING_SECOND = /^(?:number|no\.?)$/i;
/** "012-890-1-033950-6", "XXXX1234": digits, maybe masked, maybe hyphenated. */
const ACCOUNT_SHAPE = /^[\dX*][\dX*-]{4,}\d$/;
/** The number sits within this many lines under its heading (a unit line can come between). */
const ROWS_BELOW = 3;

/**
 * The account number under an "Account Number" column heading, when the
 * statement prints no label beside it: an account summary lists "HKD Savings
 * Deposits  012-890-1-033950-6  74,224.81" with the headings above. The first
 * row of the column answers.
 */
export function findAccountNumberInColumn(rows: PdfTextRow[]): string | null {
  const ordered = [...rows].sort((a, b) => a.page - b.page || a.y - b.y);
  for (const [index, row] of ordered.entries()) {
    const items = [...row.items].sort((a, b) => a.x - b.x);
    const at = items.findIndex(
      (item, i) => HEADING_FIRST.test(item.text) && HEADING_SECOND.test(items[i + 1]?.text ?? ''),
    );
    if (at === -1) {
      continue;
    }
    const left = items[at].x;
    const right = items[at + 1].x + items[at + 1].width;
    for (const below of ordered.slice(index + 1, index + 1 + ROWS_BELOW)) {
      const cell = below.items.find(
        item =>
          below.page === row.page &&
          item.x < right &&
          item.x + item.width > left &&
          ACCOUNT_SHAPE.test(item.text) &&
          (item.text.match(/\d/g) ?? []).length >= 4,
      );
      if (cell) {
        return cell.text;
      }
    }
  }
  return null;
}
