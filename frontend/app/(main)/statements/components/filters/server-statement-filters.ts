import {
  DEFAULT_STATEMENT_FILTERS,
  resetSingleStatementFilter,
  type StatementFilters,
} from './statement-filters';

export type StatementFilterScreen =
  | 'type'
  | 'status'
  | 'date'
  | 'from'
  | 'to'
  | 'keywords'
  | 'amount'
  | 'approved'
  | 'billable'
  | 'groupBy'
  | 'has'
  | 'limit'
  | 'currency'
  | 'exported'
  | 'paid';

const COLUMN_SCREEN_MAP: Record<string, StatementFilterScreen[]> = {
  receipt: ['type', 'status'],
  merchant: ['keywords'],
  from: ['from'],
  to: ['to'],
  amount: ['amount'],
  approved: ['approved'],
  billable: ['billable'],
  exported: ['exported'],
};

// Type and status lost their own chips on the page, so the drawer carries them
// whatever the visible columns are.
const ALWAYS_VISIBLE_SCREENS: StatementFilterScreen[] = [
  'type',
  'status',
  'date',
  'groupBy',
  'has',
  'keywords',
  'limit',
];

export const serializeStatementFiltersToQuery = (filters: StatementFilters) => {
  const params: Record<string, unknown> = {};

  if (filters.type) {
    params.type = filters.type;
  }
  if (filters.statuses.length > 0) {
    params.statuses = filters.statuses;
  }
  if (filters.date?.preset) {
    params.datePreset = filters.date.preset;
  }
  if (filters.date?.mode) {
    params.dateMode = filters.date.mode;
  }
  if (filters.date?.date) {
    params.dateFrom = filters.date.date;
  }
  if (filters.date?.dateTo) {
    params.dateTo = filters.date.dateTo;
  }
  if (filters.from.length > 0) {
    params.from = filters.from;
  }
  if (filters.to.length > 0) {
    params.to = filters.to;
  }
  if (filters.keywords.trim()) {
    params.keywords = filters.keywords.trim();
  }
  if (filters.amountMin !== null) {
    params.amountMin = filters.amountMin;
  }
  if (filters.amountMax !== null) {
    params.amountMax = filters.amountMax;
  }
  if (filters.limit !== null) {
    params.limit = filters.limit;
  }
  if (filters.approved !== null) {
    params.approved = filters.approved;
  }
  if (filters.billable !== null) {
    params.billable = filters.billable;
  }
  if (filters.groupBy) {
    params.groupBy = filters.groupBy;
  }
  if (filters.has.length > 0) {
    params.has = filters.has;
  }
  if (filters.currencies.length > 0) {
    params.currencies = filters.currencies;
  }
  if (filters.exported !== null) {
    params.exported = filters.exported;
  }
  if (filters.paid !== null) {
    params.paid = filters.paid;
  }

  return params;
};

export const resetHiddenStatementFilters = (
  filters: StatementFilters,
  allowedKeys: Array<keyof StatementFilters>,
) => {
  const allowed = new Set<keyof StatementFilters>(allowedKeys);
  let next = { ...filters };

  (Object.keys(DEFAULT_STATEMENT_FILTERS) as Array<keyof StatementFilters>).forEach(key => {
    if (!allowed.has(key)) {
      next = resetSingleStatementFilter(next, key);
    }
  });

  return next;
};

export const getVisibleFilterScreens = (visibleColumnIds: string[]) => {
  const screens = new Set<StatementFilterScreen>(ALWAYS_VISIBLE_SCREENS);

  visibleColumnIds.forEach(columnId => {
    (COLUMN_SCREEN_MAP[columnId] || []).forEach(screen => {
      screens.add(screen);
    });
  });

  return Array.from(screens).sort();
};
