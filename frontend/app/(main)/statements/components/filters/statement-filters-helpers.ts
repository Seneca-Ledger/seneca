/**
 * Internal helpers for applyStatementsFilters.
 * Split out to stay within the 250-line / 40-line-per-function limits.
 */
import type {
  StatementFilterDate,
  StatementFilterDateMode,
  StatementFilterDatePreset,
  StatementFilterItem,
  StatementFilters,
} from './statement-filters';

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

export const parseNumber = (value?: number | string | null): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
};

export const isGmailReceipt = (s: StatementFilterItem): boolean => s.source === 'gmail';

export const isStoreReceipt = (s: StatementFilterItem): boolean => {
  if (s.source !== 'scan') {
    return false;
  }
  return s.receiptSource !== 'gmail';
};

export const resolveStatementAmount = (s: StatementFilterItem): number => {
  const debit = parseNumber(s.totalDebit);
  const credit = parseNumber(s.totalCredit);
  const resolved = debit && debit > 0 ? debit : credit && credit > 0 ? credit : 0;
  return resolved ?? 0;
};

const resolveReceiptDateValue = (s: StatementFilterItem): string =>
  s.parsedData?.date || s.receivedAt || s.createdAt || '';

export const resolveStatementDateValue = (s: StatementFilterItem): string => {
  if (s.source === 'gmail' || s.source === 'scan') {
    return resolveReceiptDateValue(s);
  }
  return s.statementDateTo || s.statementDateFrom || s.createdAt || '';
};

export const toDateOnly = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const ds = `${year}-${month}-${day}`;
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const getMetadataCurrency = (s: StatementFilterItem): string | undefined => {
  const meta = s.parsingDetails?.metadataExtracted;
  return meta?.currency ?? meta?.headerDisplay?.currencyDisplay ?? undefined;
};

export const resolveStatementCurrency = (s: StatementFilterItem): string =>
  (s.currency || getMetadataCurrency(s) || '').toString();

export const compareGroupValues = (a: unknown, b: unknown): number => {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b));
};

export const resolveGroupSortValue = (s: StatementFilterItem, groupBy: string): number | string => {
  const groupMap: Record<string, () => number | string> = {
    date: () => toDateOnly(resolveStatementDateValue(s))?.getTime() ?? 0,
    status: () => (s.status || '').toLowerCase(),
    type: () => (s.fileType || '').toLowerCase(),
    bank: () => (s.bankName || '').toLowerCase(),
    user: () => (s.user?.name || s.user?.email || '').toLowerCase(),
    amount: () => resolveStatementAmount(s),
  };
  return groupMap[groupBy]?.() ?? 0;
};

// ---------------------------------------------------------------------------
// Keyword / token matching
// ---------------------------------------------------------------------------

export const matchesKeywords = (s: StatementFilterItem, rawQuery: string): boolean => {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return true;
  }
  const candidates = [
    s.fileName,
    s.subject,
    s.sender,
    s.parsedData?.vendor,
    s.bankName,
    s.status,
    s.user?.name,
    s.user?.email,
  ]
    .filter(Boolean)
    .map(v => v?.toString().toLowerCase() || '');
  return candidates.some(v => v.includes(query));
};

export const matchesToken = (token: string, s: StatementFilterItem): boolean => {
  if (token.startsWith('user:')) {
    return s.user?.id === token.replace('user:', '');
  }
  if (token.startsWith('bank:')) {
    return (s.bankName || '').toLowerCase() === token.replace('bank:', '').toLowerCase();
  }
  return false;
};

const hasErrors = (s: StatementFilterItem): boolean =>
  s.status === 'error' || Boolean(s.errorMessage);
const hasProcessingDetails = (s: StatementFilterItem): boolean => {
  const entries = s.parsingDetails?.logEntries;
  return Boolean(entries && entries.length > 0);
};
const hasDateRange = (s: StatementFilterItem): boolean =>
  Boolean(s.statementDateFrom || s.statementDateTo);
const hasCurrencyField = (s: StatementFilterItem): boolean =>
  Boolean(s.currency || getMetadataCurrency(s));

const HAS_CHECKERS: Record<string, (s: StatementFilterItem) => boolean> = {
  errors: hasErrors,
  processingDetails: hasProcessingDetails,
  transactions: s => (s.totalTransactions || 0) > 0,
  dateRange: hasDateRange,
  currency: hasCurrencyField,
};

export const matchesHasToken = (token: string, s: StatementFilterItem): boolean =>
  HAS_CHECKERS[token]?.(s) ?? false;

// ---------------------------------------------------------------------------
// Date filter helpers
// ---------------------------------------------------------------------------

export const getPresetRange = (
  preset: StatementFilterDatePreset,
  now: Date,
): { start: Date; end: Date } => {
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'thisMonth') {
    return {
      start: new Date(current.getFullYear(), current.getMonth(), 1),
      end: new Date(current.getFullYear(), current.getMonth() + 1, 0),
    };
  }
  if (preset === 'lastMonth') {
    return {
      start: new Date(current.getFullYear(), current.getMonth() - 1, 1),
      end: new Date(current.getFullYear(), current.getMonth(), 0),
    };
  }
  return { start: new Date(current.getFullYear(), 0, 1), end: current };
};

const matchesOnMode = (d: Date, filterDate: Date, filterDateTo: Date | null): boolean => {
  if (filterDateTo) {
    const startTime = Math.min(filterDate.getTime(), filterDateTo.getTime());
    const endTime = Math.max(filterDate.getTime(), filterDateTo.getTime());
    return d.getTime() >= startTime && d.getTime() <= endTime;
  }
  return d.getTime() === filterDate.getTime();
};

type ModeFilterParams = {
  mode: StatementFilterDateMode;
  filterDate: Date;
  filterDateTo: Date | null;
};

export const applyModeFilter = <T extends StatementFilterItem>(
  result: T[],
  params: ModeFilterParams,
): T[] =>
  result.filter(s => {
    const d = toDateOnly(resolveStatementDateValue(s));
    if (!d) {
      return false;
    }
    if (params.mode === 'on') {
      return matchesOnMode(d, params.filterDate, params.filterDateTo);
    }
    if (params.mode === 'after') {
      return d.getTime() > params.filterDate.getTime();
    }
    const beforeDate = params.filterDateTo || params.filterDate;
    return d.getTime() < beforeDate.getTime();
  });

export const applyDateFilter = <T extends StatementFilterItem>(
  result: T[],
  dateFilter: StatementFilterDate,
  now: Date,
): T[] => {
  if (dateFilter.preset) {
    const { start, end } = getPresetRange(dateFilter.preset, now);
    return result.filter(s => {
      const d = toDateOnly(resolveStatementDateValue(s));
      return d !== null && d >= start && d <= end;
    });
  }
  if (dateFilter.mode && dateFilter.date) {
    const filterDate = toDateOnly(dateFilter.date);
    if (!filterDate) {
      return result;
    }
    const filterDateTo = toDateOnly(dateFilter.dateTo ?? null);
    return applyModeFilter(result, { mode: dateFilter.mode, filterDate, filterDateTo });
  }
  return result;
};

// ---------------------------------------------------------------------------
// Grouped filter steps
// ---------------------------------------------------------------------------

const APPROVED_STATUSES = new Set(['validated', 'completed', 'parsed']);
const NOT_APPROVED_STATUSES = new Set(['uploaded', 'processing', 'error']);

export const applyApprovedFilter = <T extends StatementFilterItem>(
  result: T[],
  approved: boolean,
): T[] =>
  result.filter(s => {
    const status = (s.status || '').toLowerCase();
    if (!status) {
      return false;
    }
    return approved ? APPROVED_STATUSES.has(status) : NOT_APPROVED_STATUSES.has(status);
  });

export const applyTypeFilter = <T extends StatementFilterItem>(
  result: T[],
  typeValue: string,
): T[] =>
  result.filter(s => {
    if (typeValue === 'gmail') {
      return isGmailReceipt(s);
    }
    if (typeValue === 'receipt') {
      return isStoreReceipt(s);
    }
    return (s.fileType || '').toLowerCase() === typeValue;
  });

export const applyTokenFilters = <T extends StatementFilterItem>(
  result: T[],
  filters: StatementFilters,
): T[] => {
  let out = result;
  if (filters.from.length > 0) {
    out = out.filter(s => filters.from.some(t => matchesToken(t, s)));
  }
  if (filters.to.length > 0) {
    out = out.filter(s => filters.to.some(t => matchesToken(t, s)));
  }
  if (filters.currencies.length > 0) {
    const normalized = filters.currencies.map(v => v.toLowerCase());
    out = out.filter(s => normalized.includes(resolveStatementCurrency(s).toLowerCase()));
  }
  return out;
};

export const applyBooleanFilters = <T extends StatementFilterItem>(
  result: T[],
  filters: StatementFilters,
): T[] => {
  let out = result;
  if (filters.exported !== null) {
    out = out.filter(s => (filters.exported ? Boolean(s.exported) : !s.exported));
  }
  if (filters.paid !== null) {
    out = out.filter(s => (filters.paid ? Boolean(s.paid) : !s.paid));
  }
  return out;
};

export const applyBillableFilter = <T extends StatementFilterItem>(
  result: T[],
  billable: boolean,
): T[] =>
  result.filter(s => {
    const amount = resolveStatementAmount(s);
    return billable ? amount > 0 : amount <= 0;
  });

export const applyGroupAndLimit = <T extends StatementFilterItem>(
  result: T[],
  filters: StatementFilters,
): T[] => {
  let out = result;
  if (filters.groupBy) {
    out = [...out].sort((a, b) =>
      compareGroupValues(
        resolveGroupSortValue(a, filters.groupBy || ''),
        resolveGroupSortValue(b, filters.groupBy || ''),
      ),
    );
  }
  if (filters.limit !== null && Number.isFinite(filters.limit)) {
    out = out.slice(0, Math.max(0, filters.limit));
  }
  return out;
};

export const applyTextAndAmountFilters = <T extends StatementFilterItem>(
  result: T[],
  filters: StatementFilters,
): T[] => {
  let out = result;
  if (filters.has.length > 0) {
    out = out.filter(s => filters.has.every(t => matchesHasToken(t, s)));
  }
  if (filters.keywords.trim()) {
    out = out.filter(s => matchesKeywords(s, filters.keywords));
  }
  if (filters.amountMin !== null || filters.amountMax !== null) {
    out = out.filter(s => {
      const amount = resolveStatementAmount(s);
      if (filters.amountMin !== null && amount < filters.amountMin) {
        return false;
      }
      if (filters.amountMax !== null && amount > filters.amountMax) {
        return false;
      }
      return true;
    });
  }
  return out;
};
