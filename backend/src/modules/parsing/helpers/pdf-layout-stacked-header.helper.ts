import type { PdfTextItem, PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { type LayoutColumn, readHeaderRow } from './pdf-layout-columns.helper';
import { rowHeight } from './pdf-layout-wrapped.helper';

/**
 * A header whose headings wrap onto a second line ("Money out of" over "your
 * account ($)", with "Date" and "Balance ($)" on the lower line only) reads as
 * a header only with both lines put together column by column.
 */

/** The two lines of one header sit closer than this many line heights. */
const STACKED_LINE_GAP = 1.6;
/** Words of one heading sit closer than this, in points; columns sit further apart. */
const HEADING_WORD_GAP = 8;

/** Both lines as one, each heading's words joined top line first. */
function stackLines(top: PdfTextRow, bottom: PdfTextRow): PdfTextRow {
  const words = [
    ...top.items.map(item => ({ item, line: 0 })),
    ...bottom.items.map(item => ({ item, line: 1 })),
  ].sort((a, b) => a.item.x - b.item.x);
  const cells: { words: typeof words; x1: number }[] = [];
  for (const word of words) {
    const cell = cells[cells.length - 1];
    if (cell && word.item.x <= cell.x1 + HEADING_WORD_GAP) {
      cell.words.push(word);
      cell.x1 = Math.max(cell.x1, word.item.x + word.item.width);
    } else {
      cells.push({ words: [word], x1: word.item.x + word.item.width });
    }
  }
  const items: PdfTextItem[] = cells.map(cell => {
    const x = cell.words[0].item.x;
    const text = [...cell.words]
      .sort((a, b) => a.line - b.line || a.item.x - b.item.x)
      .map(word => word.item.text)
      .join(' ');
    return { ...cell.words[0].item, text, x, width: cell.x1 - x };
  });
  return { ...top, text: items.map(item => item.text).join(' '), items };
}

/** Rows in page order, with every two-line header made one row. */
export function joinStackedHeaders(
  rows: PdfTextRow[],
  readHeader: (row: PdfTextRow) => LayoutColumn[] | null = readHeaderRow,
): PdfTextRow[] {
  const joined: PdfTextRow[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const [top, bottom] = [rows[index], rows[index + 1]];
    const close =
      bottom?.page === top.page && bottom.y - top.y <= STACKED_LINE_GAP * rowHeight(top);
    const stacked = close && !readHeader(top) ? stackLines(top, bottom) : null;
    const columns = stacked ? readHeader(stacked) : null;
    if (stacked && columns && columns.length > (readHeader(bottom)?.length ?? 0)) {
      joined.push(stacked);
      index += 1;
    } else {
      joined.push(top);
    }
  }
  return joined;
}
