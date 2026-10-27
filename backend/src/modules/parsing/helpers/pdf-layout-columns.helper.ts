import type { PdfTextItem, PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { isAmountPart, parseStatementAmount } from './statement-amount.helper';
import { foldText } from './statement-date.helper';

export type ColumnRole =
  | 'date'
  | 'otherDate'
  | 'description'
  | 'counterparty'
  | 'debit'
  | 'credit'
  | 'amount'
  | 'balance';

export interface LayoutColumn {
  role: ColumnRole;
  x0: number;
  x1: number;
}

const TEXT_ROLES: ColumnRole[] = ['date', 'otherDate', 'description', 'counterparty'];
const MONEY_ROLES: ColumnRole[] = ['debit', 'credit', 'amount', 'balance'];

/**
 * Column headings by role, folded (lower case, no accents). Matched longest
 * phrase first, so "interest date" is not read as "date" and "chèques et
 * débits" stays one heading even when the next one starts 6pt later.
 */
const HEADINGS: Record<ColumnRole, string[]> = {
  date: [
    'date',
    'post date',
    'posting date',
    'booking date',
    'transaction date',
    'datum',
    'boekdatum',
    'fecha',
  ],
  otherDate: [
    'trans date',
    'interest date',
    'value date',
    'rentedatum',
    'valutadatum',
    'date valeur',
    'valuta',
  ],
  description: [
    'description',
    'details',
    'transaction details',
    'transaction description',
    'merchant name or transaction description',
    'omschrijving',
    'particulars',
    'narrative',
    'libelle',
    'concepto',
    'descripcion',
    'buchungstext',
    'verwendungszweck',
  ],
  counterparty: ['counterparty', 'tegenpartij', 'tegenrekening', 'payee', 'beneficiary'],
  debit: [
    'withdrawal',
    'withdrawals',
    'debit',
    'debits',
    'cheques et debits',
    'paid out',
    'money out',
    'cargos',
    'retiros',
    'af',
  ],
  credit: [
    'deposit',
    'deposits',
    'credit',
    'credits',
    'depots et credits',
    'paid in',
    'money in',
    'abonos',
    'depositos',
    'bij',
  ],
  amount: ['amount', '$ amount', 'bedrag', 'montant', 'importe', 'betrag', 'transaction amount'],
  balance: ['balance', 'running balance', 'solde', 'saldo', 'kontostand'],
};

const PHRASES = new Map<string, ColumnRole>(
  (Object.entries(HEADINGS) as [ColumnRole, string[]][]).flatMap(([role, phrases]) =>
    phrases.map(phrase => [phrase, role] as [string, ColumnRole]),
  ),
);
const LONGEST_PHRASE = Math.max(...Array.from(PHRASES.keys(), phrase => phrase.split(' ').length));

/** Gap under which a stray word ("(-)", "($)") belongs to the heading beside it. */
const ATTACH_GAP = 8;

function headingWord(item: PdfTextItem): string {
  return foldText(item.text).replace(/[:]/g, '');
}

/** The longest heading that starts at `index`, and how many words it spans. */
function matchHeading(items: PdfTextItem[], index: number) {
  for (let length = Math.min(LONGEST_PHRASE, items.length - index); length > 0; length -= 1) {
    const phrase = items
      .slice(index, index + length)
      .map(headingWord)
      .join(' ');
    const role = PHRASES.get(phrase);
    if (role) {
      return { role, length };
    }
  }
  return null;
}

/**
 * Reads a row as a table header. Returns its columns left to right, or null
 * when the row does not look like one: it needs a money column and a date or
 * description column, and at least three headings in all.
 */
export function readHeaderRow(row: PdfTextRow): LayoutColumn[] | null {
  const items = [...row.items].sort((a, b) => a.x - b.x);
  const columns: LayoutColumn[] = [];
  let pendingX0: number | null = null;

  for (let index = 0; index < items.length; ) {
    const heading = matchHeading(items, index);
    if (heading) {
      const last = items[index + heading.length - 1];
      columns.push({
        role: heading.role,
        x0: pendingX0 ?? items[index].x,
        x1: last.x + last.width,
      });
      pendingX0 = null;
      index += heading.length;
      continue;
    }

    pendingX0 = attachStrayWord(
      items[index],
      columns[columns.length - 1],
      items[index + 1],
      pendingX0,
    );
    index += 1;
  }

  const roles = new Set(columns.map(column => column.role));
  const hasMoney = roles.has('debit') || roles.has('credit') || roles.has('amount');
  const hasText = roles.has('date') || roles.has('description');
  return columns.length >= 3 && hasMoney && hasText ? columns : null;
}

/**
 * A word that is no heading ("(-)", "($)", "Merchant") joins the heading it
 * touches: the one before it is widened in place, or the left edge is carried
 * to the heading after it. Returns the left edge still being carried.
 */
function attachStrayWord(
  item: PdfTextItem,
  previous: LayoutColumn | undefined,
  next: PdfTextItem | undefined,
  pendingX0: number | null,
): number | null {
  if (previous && pendingX0 === null && item.x - previous.x1 <= ATTACH_GAP) {
    previous.x1 = item.x + item.width;
    return null;
  }
  const touchesNext = next !== undefined && next.x - (item.x + item.width) <= ATTACH_GAP;
  return touchesNext ? (pendingX0 ?? item.x) : null;
}

export interface AmountCell {
  role: ColumnRole;
  value: number;
}

export interface LaidOutRow {
  /** Words by text column, in reading order. */
  text: Partial<Record<ColumnRole, string[]>>;
  amounts: AmountCell[];
}

/** Money is right-aligned under its heading, so the right edges line up. */
const MONEY_EDGE_TOLERANCE = 30;
/** Words of one printed amount ("1", "200,45", "$") sit closer than this. */
const AMOUNT_WORD_GAP = 7;

function moneyColumnFor(x1: number, columns: LayoutColumn[]): LayoutColumn | null {
  const candidates = columns
    .filter(column => MONEY_ROLES.includes(column.role))
    .map(column => ({ column, distance: Math.abs(column.x1 - x1) }))
    .sort((a, b) => a.distance - b.distance);
  const best = candidates[0];
  return best && best.distance <= MONEY_EDGE_TOLERANCE ? best.column : null;
}

function textColumnFor(x: number, columns: LayoutColumn[]): ColumnRole {
  const text = columns.filter(column => TEXT_ROLES.includes(column.role));
  const owner = [...text].reverse().find(column => column.x0 <= x + 4) ?? text[0];
  return owner?.role ?? 'description';
}

/**
 * Splits a row's words into columns. Neighbouring words that together read as
 * an amount ("10 750,00 $") are one money cell when their right edge sits
 * under a money heading; everything else goes to the text column it starts in.
 */
export function layOutRow(items: PdfTextItem[], columns: LayoutColumn[]): LaidOutRow {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const result: LaidOutRow = { text: {}, amounts: [] };

  for (let index = 0; index < sorted.length; ) {
    const cell = moneyCellAt(sorted, index, columns);
    if (cell) {
      result.amounts.push(cell.amount);
      index = cell.end;
      continue;
    }
    const role = textColumnFor(sorted[index].x, columns);
    result.text[role] = [...(result.text[role] ?? []), sorted[index].text];
    index += 1;
  }

  return result;
}

/** The amount whose words start at `start`, if it sits under a money heading. */
function moneyCellAt(sorted: PdfTextItem[], start: number, columns: LayoutColumn[]) {
  let end = start;
  while (
    end < sorted.length &&
    isAmountPart(sorted[end].text) &&
    (end === start ||
      sorted[end].x - (sorted[end - 1].x + sorted[end - 1].width) <= AMOUNT_WORD_GAP)
  ) {
    end += 1;
  }
  if (end === start) {
    return null;
  }
  const run = sorted.slice(start, end);
  const value = parseStatementAmount(run.map(item => item.text).join(' '));
  const last = run[run.length - 1];
  const column = value !== null ? moneyColumnFor(last.x + last.width, columns) : null;
  return column && value !== null ? { amount: { role: column.role, value }, end } : null;
}
