import { formatStoredDate } from '@/app/lib/user-format-store';
import type { StatementLike } from './StatementsListView.utils';

// Receipts use upload time so newly uploaded items appear at the top.
const resolveReceiptDateValue = (statement: StatementLike): string =>
  statement.receivedAt || statement.createdAt || statement.parsedData?.date || '';

export const formatStatementDate = (statement: StatementLike): string => {
  const dateValue =
    statement.source === 'scan'
      ? resolveReceiptDateValue(statement)
      : statement.statementDateTo || statement.statementDateFrom || statement.createdAt || '';
  if (!dateValue) {
    return '—';
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return formatStoredDate(date);
};

/**
 * When the document came in. The list puts the latest first, so a statement
 * stays where it was uploaded once parsing gives it an older period.
 */
export const resolveStatementAddedTime = (statement: StatementLike): number => {
  const dateValue =
    statement.source === 'scan' ? resolveReceiptDateValue(statement) : statement.createdAt || '';
  const time = dateValue ? Date.parse(dateValue) : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
};

export const resolveStatementSortDate = (statement: StatementLike): number => {
  const dateValue =
    statement.source === 'scan'
      ? resolveReceiptDateValue(statement)
      : statement.statementDateTo || statement.statementDateFrom || statement.createdAt || '';
  const date = dateValue ? new Date(dateValue) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return 0;
  }
  return date.getTime();
};
