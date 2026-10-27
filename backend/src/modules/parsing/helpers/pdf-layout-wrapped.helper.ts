import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { LaidOutRow } from './pdf-layout-columns.helper';

/**
 * Lines this close, in line heights, belong to one table row: a cell's text
 * wrapped around the amounts printed at its middle, each line overlapping the
 * next ("ANZ INTERNET BANKING TRANSFER" / "07 FEB 1,266.66 12,819.24" /
 * "WAGES ..."). Separate rows sit a line height apart or more; a footer laid
 * over a row is only a fraction of a point off and stays apart too.
 */
const WRAPPED_GAP_MIN = 0.3;
const WRAPPED_GAP_MAX = 0.75;

export function rowHeight(row: PdfTextRow): number {
  return Math.max(...row.items.map(item => item.height), 1);
}

/** Rows in page order, grouped into the printed lines of one table row each. */
export function groupWrappedLines(rows: PdfTextRow[]): PdfTextRow[][] {
  const groups: PdfTextRow[][] = [];
  for (const row of rows) {
    const group = groups[groups.length - 1];
    const last = group?.[group.length - 1];
    const gap = last?.page === row.page ? (row.y - last.y) / rowHeight(last) : null;
    if (group && gap !== null && gap > WRAPPED_GAP_MIN && gap < WRAPPED_GAP_MAX) {
      group.push(row);
    } else {
      groups.push([row]);
    }
  }
  return groups;
}

/** The words of a row's lines together: text in line order, amounts from whichever line holds them. */
export function mergeLaidOut(lines: LaidOutRow[]): LaidOutRow {
  const merged: LaidOutRow = { text: {}, amounts: [] };
  for (const line of lines) {
    merged.amounts.push(...line.amounts);
    for (const [role, words] of Object.entries(line.text) as [
      keyof LaidOutRow['text'],
      string[],
    ][]) {
      merged.text[role] = [...(merged.text[role] ?? []), ...words];
    }
  }
  return merged;
}
