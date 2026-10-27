import { type StatementAmountView, statementAmountFor } from './amount-view';
import type {
  StatementFilterDate,
  StatementFilterDateMode,
  StatementFilterDatePreset,
  StatementFilterItem,
} from './statement-filters';

export const APPROVED_STATUSES = new Set(['validated', 'completed', 'parsed']);
export const NOT_APPROVED_STATUSES = new Set(['uploaded', 'processing', 'error']);

export const parseNumber = (value?: number | string | null): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
};

export const isStoreReceipt = (statement: StatementFilterItem): boolean =>
  statement.source === 'scan';

export const resolveStatementAmount = (
  statement: StatementFilterItem,
  view: StatementAmountView | null = null,
): number => statementAmountFor(statement, view);

const isReceiptDateSource = (source?: string | null): boolean => source === 'scan';

const resolveReceiptDate = (s: StatementFilterItem): string =>
  s.parsedData?.date || s.receivedAt || s.createdAt || '';

export const resolveStatementDateValue = (statement: StatementFilterItem): string => {
  if (isReceiptDateSource(statement.source)) {
    return resolveReceiptDate(statement);
  }
  return statement.statementDateTo || statement.statementDateFrom || statement.createdAt || '';
};

const toDateOnlyString = (value?: string | null): string | null => {
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
  return `${year}-${month}-${day}`;
};

export const toDateOnly = (value?: string | null): Date | null => {
  const dateString = toDateOnlyString(value);
  if (!dateString) {
    return null;
  }
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

type DateRange = { start: Date; end: Date };

const getThisMonthRange = (current: Date): DateRange => ({
  start: new Date(current.getFullYear(), current.getMonth(), 1),
  end: new Date(current.getFullYear(), current.getMonth() + 1, 0),
});

const getLastMonthRange = (current: Date): DateRange => ({
  start: new Date(current.getFullYear(), current.getMonth() - 1, 1),
  end: new Date(current.getFullYear(), current.getMonth(), 0),
});

export const getPresetRange = (preset: StatementFilterDatePreset, now: Date): DateRange => {
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const presetHandlers: Record<string, () => DateRange> = {
    thisMonth: () => getThisMonthRange(current),
    lastMonth: () => getLastMonthRange(current),
    yearToDate: () => ({ start: new Date(current.getFullYear(), 0, 1), end: current }),
  };
  return (presetHandlers[preset] ?? presetHandlers.yearToDate)();
};

export const matchesKeywords = (statement: StatementFilterItem, rawQuery: string): boolean => {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return true;
  }
  const candidates = [
    statement.fileName,
    statement.subject,
    statement.sender,
    statement.parsedData?.vendor,
    statement.bankName,
    statement.status,
    statement.user?.name,
    statement.user?.email,
  ]
    .filter(Boolean)
    .map(value => value?.toString().toLowerCase() || '');
  return candidates.some(value => value.includes(query));
};

export const matchesToken = (token: string, statement: StatementFilterItem): boolean => {
  if (token.startsWith('user:')) {
    return statement.user?.id === token.replace('user:', '');
  }
  if (token.startsWith('bank:')) {
    const bankName = token.replace('bank:', '');
    return (statement.bankName || '').toLowerCase() === bankName.toLowerCase();
  }
  return false;
};

const hasErrors = (s: StatementFilterItem): boolean =>
  s.status === 'error' || Boolean(s.errorMessage);

const hasProcessingDetails = (s: StatementFilterItem): boolean =>
  Boolean(s.parsingDetails?.logEntries?.length);

const getMetaCurrency = (s: StatementFilterItem): string | undefined | null =>
  s.parsingDetails?.metadataExtracted?.currency;

const getMetaCurrencyDisplay = (s: StatementFilterItem): string | undefined | null =>
  s.parsingDetails?.metadataExtracted?.headerDisplay?.currencyDisplay;

const hasCurrency = (s: StatementFilterItem): boolean =>
  Boolean(s.currency || getMetaCurrency(s) || getMetaCurrencyDisplay(s));

const HAS_CHECKERS: Record<string, (s: StatementFilterItem) => boolean> = {
  errors: hasErrors,
  processingDetails: hasProcessingDetails,
  transactions: s => (s.totalTransactions || 0) > 0,
  dateRange: s => Boolean(s.statementDateFrom || s.statementDateTo),
  currency: hasCurrency,
};

export const matchesHas = (token: string, statement: StatementFilterItem): boolean =>
  HAS_CHECKERS[token]?.(statement) ?? false;

export const resolveStatementCurrency = (statement: StatementFilterItem): string =>
  (
    statement.currency ||
    getMetaCurrency(statement) ||
    getMetaCurrencyDisplay(statement) ||
    ''
  ).toString();

type GroupSortValue = string | number;

const GROUP_SORT_RESOLVERS: Record<
  string,
  (s: StatementFilterItem, view: StatementAmountView | null) => GroupSortValue
> = {
  date: s => toDateOnly(resolveStatementDateValue(s))?.getTime() ?? 0,
  status: s => (s.status || '').toLowerCase(),
  type: s => (s.fileType || '').toLowerCase(),
  bank: s => (s.bankName || '').toLowerCase(),
  user: s => (s.user?.name || s.user?.email || '').toLowerCase(),
  amount: (s, view) => resolveStatementAmount(s, view),
};

export const resolveGroupSortValue = (
  statement: StatementFilterItem,
  groupBy: string,
  view: StatementAmountView | null = null,
): GroupSortValue => GROUP_SORT_RESOLVERS[groupBy]?.(statement, view) ?? 0;

export const compareGroupValues = (a: unknown, b: unknown): number => {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b));
};

type DateModeInput = {
  dateValue: Date;
  mode: StatementFilterDateMode;
  filterDate: Date;
  filterDateTo: Date | null;
};

const matchesDateMode = ({ dateValue, mode, filterDate, filterDateTo }: DateModeInput): boolean => {
  if (mode === 'on') {
    if (filterDateTo) {
      const startTime = Math.min(filterDate.getTime(), filterDateTo.getTime());
      const endTime = Math.max(filterDate.getTime(), filterDateTo.getTime());
      return dateValue.getTime() >= startTime && dateValue.getTime() <= endTime;
    }
    return dateValue.getTime() === filterDate.getTime();
  }
  if (mode === 'after') {
    return dateValue.getTime() > filterDate.getTime();
  }
  const beforeDate = filterDateTo || filterDate;
  return dateValue.getTime() < beforeDate.getTime();
};

export const applyTypeFilter = <T extends StatementFilterItem>(result: T[], type: string): T[] => {
  const typeValue = type.toLowerCase();
  const typeCheckers: Record<string, (s: T) => boolean> = {
    receipt: isStoreReceipt,
  };
  const checker = typeCheckers[typeValue];
  if (checker) {
    return result.filter(checker);
  }
  return result.filter(s => (s.fileType || '').toLowerCase() === typeValue);
};

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

export const applyDatePresetFilter = <T extends StatementFilterItem>(
  result: T[],
  preset: StatementFilterDatePreset,
  now: Date,
): T[] => {
  const { start, end } = getPresetRange(preset, now);
  return result.filter(s => {
    const dateValue = toDateOnly(resolveStatementDateValue(s));
    if (!dateValue) {
      return false;
    }
    return dateValue >= start && dateValue <= end;
  });
};

export const applyDateModeFilter = <T extends StatementFilterItem>(
  result: T[],
  dateFilter: StatementFilterDate,
): T[] => {
  if (!(dateFilter.mode && dateFilter.date)) {
    return result;
  }
  const filterDate = toDateOnly(dateFilter.date);
  if (!filterDate) {
    return result;
  }
  const filterDateTo = toDateOnly(dateFilter.dateTo);
  return result.filter(s => {
    const dateValue = toDateOnly(resolveStatementDateValue(s));
    if (!dateValue) {
      return false;
    }
    return matchesDateMode({
      dateValue,
      mode: dateFilter.mode as StatementFilterDateMode,
      filterDate,
      filterDateTo,
    });
  });
};

export const applyAmountRangeFilter = <T extends StatementFilterItem>(
  result: T[],
  amountMin: number | null,
  amountMax: number | null,
  view: StatementAmountView | null = null,
): T[] =>
  result.filter(s => {
    const amount = resolveStatementAmount(s, view);
    if (amountMin !== null && amount < amountMin) {
      return false;
    }
    if (amountMax !== null && amount > amountMax) {
      return false;
    }
    return true;
  });
