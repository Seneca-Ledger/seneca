import type React from 'react';
import { type StatementColumnId, statementColumnWidthStyle } from './columns/statement-columns';
/** Pure cell helpers of the documents list rows. */
export const EMPTY_CELL = '—';
export const NUMERIC_COLUMN_IDS = new Set<StatementColumnId>(['amount', 'exchangeRate']);

export const normalizeExchangeRateCurrency = (
  ...currencies: Array<string | null | undefined>
): string | null => {
  const normalized = firstNonEmpty(...currencies)?.toUpperCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'NIS' || normalized === '\u20aa') {
    return 'ILS';
  }
  return normalized;
};

export const columnCellStyle = (columnId: StatementColumnId): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
  justifyContent:
    columnId === 'receipt'
      ? 'center'
      : columnId === 'action' || columnId === 'amount'
        ? 'flex-end'
        : undefined,
  // The action cell stacks its button over the label sizer (see renderActionCell).
  ...(columnId === 'action'
    ? { flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }
    : {}),
  ...statementColumnWidthStyle(columnId),
});

export const textCellStyle = (columnId: StatementColumnId, muted = false): React.CSSProperties => ({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: '100%',
  textAlign: NUMERIC_COLUMN_IDS.has(columnId) ? 'right' : 'left',
  color: muted ? 'var(--muted-foreground)' : 'var(--foreground)',
});

export const firstNonEmpty = (...values: Array<unknown>): string | null => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
};

export const formatBoolean = (value: boolean | null, yes: string, no: string): string => {
  if (value === null) return EMPTY_CELL;
  return value ? yes : no;
};
