export type StatementFilterDatePreset = 'thisMonth' | 'lastMonth' | 'yearToDate';
export type StatementFilterDateMode = 'on' | 'after' | 'before';

export type StatementFilterDate = {
  preset?: StatementFilterDatePreset;
  mode?: StatementFilterDateMode;
  date?: string;
  dateTo?: string;
};

export type StatementFilters = {
  type: string | null;
  statuses: string[];
  date: StatementFilterDate | null;
  from: string[];
  to: string[];
  keywords: string;
  amountMin: number | null;
  amountMax: number | null;
  limit: number | null;
  approved: boolean | null;
  billable: boolean | null;
  groupBy: string | null;
  has: string[];
  currencies: string[];
  exported: boolean | null;
  paid: boolean | null;
};

export type StatementFilterUser = {
  id: string;
  name?: string | null;
  email?: string | null;
};

export type StatementFilterItem = {
  id: string;
  source?: 'statement' | 'scan';
  receiptSource?: string | null;
  fileName: string;
  subject?: string | null;
  sender?: string | null;
  status?: string | null;
  fileType?: string | null;
  createdAt?: string | null;
  statementDateFrom?: string | null;
  statementDateTo?: string | null;
  bankName?: string | null;
  totalDebit?: number | string | null;
  totalCredit?: number | string | null;
  currency?: string | null;
  exported?: boolean | null;
  paid?: boolean | null;
  parsingDetails?: StatementParsingDetails | null;
  user?: StatementFilterUser | null;
  errorMessage?: string | null;
  totalTransactions?: number | null;
  receivedAt?: string | null;
  parsedData?: {
    vendor?: string | null;
    date?: string | null;
  } | null;
};

import type { StatementParsingDetails } from '@/app/lib/contracts';
import {
  applyAmountRangeFilter,
  applyApprovedFilter,
  applyDateModeFilter,
  applyDatePresetFilter,
  applyTypeFilter,
  compareGroupValues,
  matchesHas,
  matchesKeywords,
  matchesToken,
  resolveGroupSortValue,
  resolveStatementAmount,
  resolveStatementCurrency,
} from './statement-filter-internals';

export const DEFAULT_STATEMENT_FILTERS: StatementFilters = {
  type: null,
  statuses: [],
  date: null,
  from: [],
  to: [],
  keywords: '',
  amountMin: null,
  amountMax: null,
  limit: null,
  approved: null,
  billable: null,
  groupBy: null,
  has: [],
  currencies: [],
  exported: null,
  paid: null,
};

const cloneFilterValue = <K extends keyof StatementFilters>(
  value: StatementFilters[K],
): StatementFilters[K] => {
  if (Array.isArray(value)) {
    return [...value] as StatementFilters[K];
  }
  if (value && typeof value === 'object') {
    return { ...value } as StatementFilters[K];
  }
  return value;
};

export const resetSingleStatementFilter = <K extends keyof StatementFilters>(
  filters: StatementFilters,
  key: K,
): StatementFilters => ({
  ...filters,
  [key]: cloneFilterValue(DEFAULT_STATEMENT_FILTERS[key]),
});

export const STATEMENT_FILTERS_STORAGE_KEY = 'seneca-statement-filters';

export const loadStatementFilters = (): StatementFilters => {
  if (typeof window === 'undefined') {
    return DEFAULT_STATEMENT_FILTERS;
  }
  const raw = localStorage.getItem(STATEMENT_FILTERS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_STATEMENT_FILTERS;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StatementFilters>;
    return { ...DEFAULT_STATEMENT_FILTERS, ...parsed };
  } catch {
    return DEFAULT_STATEMENT_FILTERS;
  }
};

export const saveStatementFilters = (filters: StatementFilters): void => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(STATEMENT_FILTERS_STORAGE_KEY, JSON.stringify(filters));
};

const applyBasicFilters = <T extends StatementFilterItem>(
  result: T[],
  filters: StatementFilters,
  now: Date,
): T[] => {
  let items = result;
  if (filters.type) {
    items = applyTypeFilter(items, filters.type);
  }
  if (filters.statuses.length > 0) {
    const norm = filters.statuses.map(v => v.toLowerCase());
    items = items.filter(s => norm.includes((s.status || '').toLowerCase()));
  }
  if (filters.approved !== null) {
    items = applyApprovedFilter(items, filters.approved);
  }
  if (filters.billable !== null) {
    items = items.filter(s => {
      const amount = resolveStatementAmount(s);
      return filters.billable ? amount > 0 : amount <= 0;
    });
  }
  if (filters.date?.preset) {
    items = applyDatePresetFilter(items, filters.date.preset, now);
  } else if (filters.date) {
    items = applyDateModeFilter(items, filters.date);
  }
  return items;
};

const applyAdvancedFilters = <T extends StatementFilterItem>(
  result: T[],
  filters: StatementFilters,
): T[] => {
  let items = result;
  if (filters.from.length > 0) {
    items = items.filter(s => filters.from.some(token => matchesToken(token, s)));
  }
  if (filters.to.length > 0) {
    items = items.filter(s => filters.to.some(token => matchesToken(token, s)));
  }
  if (filters.currencies.length > 0) {
    const norm = filters.currencies.map(v => v.toLowerCase());
    items = items.filter(s => norm.includes(resolveStatementCurrency(s).toLowerCase()));
  }
  if (filters.exported !== null) {
    items = items.filter(s => (filters.exported ? Boolean(s.exported) : !s.exported));
  }
  if (filters.paid !== null) {
    items = items.filter(s => (filters.paid ? Boolean(s.paid) : !s.paid));
  }
  if (filters.has.length > 0) {
    items = items.filter(s => filters.has.every(token => matchesHas(token, s)));
  }
  if (filters.keywords.trim()) {
    items = items.filter(s => matchesKeywords(s, filters.keywords));
  }
  if (filters.amountMin !== null || filters.amountMax !== null) {
    items = applyAmountRangeFilter(items, filters.amountMin, filters.amountMax);
  }
  return items;
};

export const applyStatementsFilters = <T extends StatementFilterItem>(
  statements: T[],
  filters: StatementFilters,
  now: Date = new Date(),
): T[] => {
  let result = applyBasicFilters([...statements], filters, now);
  result = applyAdvancedFilters(result, filters);
  if (filters.groupBy) {
    result = [...result].sort((a, b) =>
      compareGroupValues(
        resolveGroupSortValue(a, filters.groupBy || ''),
        resolveGroupSortValue(b, filters.groupBy || ''),
      ),
    );
  }
  if (filters.limit !== null && Number.isFinite(filters.limit)) {
    result = result.slice(0, Math.max(0, filters.limit));
  }
  return result;
};
