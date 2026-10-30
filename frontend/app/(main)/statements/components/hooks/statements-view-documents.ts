import { isReceiptDerivedStatement } from '../StatementsListView.utils';
import { resolveStatementAddedTime, resolveStatementSortDate } from '../statement-dates';
import type { StatementsStatement as Statement } from './statementsViewTypes';

interface DocumentStatementsParams {
  statements: Statement[];
  search: string;
  receiptStatements: Statement[];
}

const SEARCH_AMOUNT_PATTERN = /^\d[\d ]*(?:[.,](\d{1,2}))?$/;

/**
 * Same reading as the server's search: "12" finds 12.49, "12.5" finds 12.57,
 * "12.50" only 12.50, and "1 200,50" is 1200.50.
 */
function matchesSearchAmount(amount: number | string | null | undefined, q: string): boolean {
  const match = SEARCH_AMOUNT_PATTERN.exec(q);
  const value = Math.abs(Number(amount));
  if (!match || amount === null || amount === undefined || !Number.isFinite(value)) {
    return false;
  }
  const scale = match[1]?.length ?? 0;
  const [whole, cents] = value.toFixed(2).split('.');
  const truncated = scale > 0 ? `${whole}.${cents.slice(0, scale)}` : whole;
  return Number(truncated) === Number(q.replace(/ /g, '').replace(',', '.'));
}

// Receipts come from their own paged endpoint, so the search reaches them here,
// on the fields a receipt row has.
function matchesSearch(s: Statement, q: string): boolean {
  return (
    s.fileName.toLowerCase().includes(q) ||
    (s.subject ?? '').toLowerCase().includes(q) ||
    (s.sender ?? '').toLowerCase().includes(q) ||
    (s.parsedData?.vendor ?? '').toLowerCase().includes(q) ||
    (s.category?.name ?? '').toLowerCase().includes(q) ||
    matchesSearchAmount(s.totalDebit, q)
  );
}

/**
 * Every document: uploaded statements plus receipts. A scan's own statement is
 * left out, its receipt row stands for it.
 */
export function buildDocumentStatements({
  statements,
  search,
  receiptStatements,
}: DocumentStatementsParams): Statement[] {
  const baseStatements = statements.filter(s => !isReceiptDerivedStatement(s));
  const q = search.trim().toLowerCase();
  const receiptFiltered =
    q.length > 0 ? receiptStatements.filter(s => matchesSearch(s, q)) : receiptStatements;

  return [...receiptFiltered, ...baseStatements].sort(
    (a, b) => resolveStatementAddedTime(b) - resolveStatementAddedTime(a),
  );
}

export function sortStatements(statements: Statement[], direction: 'asc' | 'desc'): Statement[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...statements].sort((l, r) => {
    const diff = resolveStatementAddedTime(l) - resolveStatementAddedTime(r);
    if (diff !== 0) {
      return diff * factor;
    }
    // Added together (the accounts of one file): the later period counts as the newer one,
    // so the order does not hang on the ids, which are random.
    const period = resolveStatementSortDate(l) - resolveStatementSortDate(r);
    if (period !== 0) {
      return period * factor;
    }
    return l.id.localeCompare(r.id) * factor;
  });
}
