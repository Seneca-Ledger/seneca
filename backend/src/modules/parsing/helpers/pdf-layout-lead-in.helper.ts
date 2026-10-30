import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { findStatementAmounts } from './statement-amount.helper';

/**
 * A row's text can start above its date: the cell's text runs over two or
 * three lines, with the date, the amounts and the balance beside the last one
 * ("UPI/P2A/3608.../MAMTA KUM/Paytm" over "30-08-2023 Pay/Payment 800.00").
 * Those lines start where the dated line's text starts, and the gap above the
 * first of them, which parts it from the row before, is wider than the gap
 * from the last of them to the dated line. Continuation lines under a row are
 * the other way round, and stay with the row above.
 */

/** A lead-in line's first word lines up with the dated line's text within this many points. */
const TEXT_ALIGNMENT = 4;
/**
 * A statement prints its text above the date when, typically, the last such
 * line sits this much closer to the dated line than the first one sits to the
 * row before (Axis: 9pt against 13pt). Evenly spaced lines read the other way.
 */
const LEAD_IN_RATIO = 0.8;

const lineText = (row: PdfTextRow) => row.items.map(item => item.text).join(' ');
const firstX = (row: PdfTextRow) => Math.min(...row.items.map(item => item.x));

/** Where the dated line's text starts: its first word right of the date. */
function textStart(dated: PdfTextRow, dateWords: number): number | null {
  const items = [...dated.items].sort((a, b) => a.x - b.x);
  return items[dateWords]?.x ?? null;
}

/**
 * Groups of printed lines (one table row each), with the lead-in lines of
 * every dated row moved into its group. `dateWordsOf` answers how many leading
 * words of a line make its date (0 for none); `isHeading` tells headers and
 * headings, which never lead in.
 */
export function attachLeadInLines(
  groups: PdfTextRow[][],
  dateWordsOf: (row: PdfTextRow) => number,
  isHeading: (row: PdfTextRow) => boolean,
): PdfTextRow[][] {
  const result = groups.map(group => [...group]);
  const isLeadInCandidate = (group: PdfTextRow[], under: PdfTextRow, textX: number) => {
    const [line] = group;
    return (
      group.length === 1 &&
      line.page === under.page &&
      dateWordsOf(line) === 0 &&
      !isHeading(line) &&
      findStatementAmounts(lineText(line)).length === 0 &&
      Math.abs(firstX(line) - textX) <= TEXT_ALIGNMENT
    );
  };
  const runs: { first: number; dated: number; inside: number; apart: number }[] = [];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const below = result[index];
    const dated = below.find(row => dateWordsOf(row) > 0);
    const start = dated ? textStart(dated, dateWordsOf(dated)) : null;
    if (!dated || start === null) {
      continue;
    }
    // The undated text lines right above, aligned with the row's text.
    let first = index;
    while (first > 0 && isLeadInCandidate(result[first - 1], below[0], start)) {
      first -= 1;
    }
    if (first === index) {
      continue;
    }
    const top = result[first][0];
    const above = result[first - 1]?.at(-1);
    const after = result[index + 1]?.[0];
    // Nothing above on this page: the gap after the row tells rows apart instead.
    const apart =
      above?.page === top.page
        ? top.y - above.y
        : after?.page === below[0].page
          ? after.y - below[below.length - 1].y
          : null;
    if (apart !== null) {
      runs.push({ first, dated: index, inside: below[0].y - result[index - 1][0].y, apart });
    }
    index = first;
  }
  // The layout is the statement's, not a line's: lines are spaced evenly
  // enough that one row's continuation can sit a shade closer to the next row.
  const ratios = runs.map(run => run.inside / run.apart).sort((a, b) => a - b);
  if (ratios.length === 0 || ratios[Math.floor(ratios.length / 2)] >= LEAD_IN_RATIO) {
    return result;
  }
  for (const run of runs.filter(candidate => candidate.inside < candidate.apart)) {
    const lines = result.slice(run.first, run.dated).map(([line]) => line);
    result.splice(run.first, run.dated - run.first + 1, [
      ...lines,
      ...result[run.first + lines.length],
    ]);
  }
  return result;
}
