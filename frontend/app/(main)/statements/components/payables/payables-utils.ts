import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import type {
  Payable,
  PayableDirection,
  PayableSource,
  PayableStatus,
  PayablesSummary,
} from '@/app/lib/payables-api';
import { formatStoredDate } from '@/app/lib/user-format-store';

export type PayablesSortOption = 'dueDateAsc' | 'dueDateDesc' | 'amountDesc' | 'vendorAsc';

export interface PayablesFiltersState {
  search: string;
  status: PayableStatus | 'all';
  source: PayableSource | 'all';
  dueDateFrom: string;
  dueDateTo: string;
  sort: PayablesSortOption;
}

export const DEFAULT_PAYABLES_FILTERS: PayablesFiltersState = {
  search: '',
  status: 'all',
  source: 'all',
  dueDateFrom: '',
  dueDateTo: '',
  sort: 'dueDateAsc',
};

export const resolveLocale = (locale?: string): string => {
  if (locale === 'ru') {
    return 'ru-RU';
  }
  if (locale === 'kk') {
    return 'kk-KZ';
  }
  return 'en-US';
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const parsePayableDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const toNumber = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatMoney = (
  value: number | string | null | undefined,
  currency = FALLBACK_CURRENCY,
  locale = 'en',
): string =>
  new Intl.NumberFormat(resolveLocale(locale), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));

export const formatPayableDate = (value?: string | null, locale = 'en'): string => {
  const date = parsePayableDate(value);
  if (!date) {
    return '—';
  }
  return formatStoredDate(date, resolveLocale(locale));
};

/** What is still owed on a bill: its amount less the payments recorded against it. */
export const outstandingOf = (payable: Pick<Payable, 'amount' | 'paidAmount'>): number =>
  Math.round((toNumber(payable.amount) - toNumber(payable.paidAmount)) * 100) / 100;

export const isPayableOverdue = (payable: Pick<Payable, 'status' | 'dueDate'>): boolean => {
  if (!payable.dueDate) {
    return false;
  }
  if (payable.status === 'paid' || payable.status === 'archived') {
    return false;
  }

  const dueDate = parsePayableDate(payable.dueDate);
  if (!dueDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
};

export const getPayableStatusVariant = (
  status: PayableStatus,
  overdue: boolean,
): 'destructive' | 'success' | 'info' | 'outline' | 'warning' => {
  if (overdue || status === 'overdue') {
    return 'destructive' as const;
  }
  if (status === 'paid') {
    return 'success' as const;
  }
  if (status === 'partially_paid') {
    return 'info' as const;
  }
  if (status === 'scheduled') {
    return 'info' as const;
  }
  if (status === 'archived') {
    return 'outline' as const;
  }
  return 'warning' as const;
};

type PayablesListParams = {
  direction?: PayableDirection;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  source?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  sort: PayablesSortOption;
};

const resolveOptional = (value: string, empty: string): string | undefined =>
  value === empty ? undefined : value || undefined;

export const buildPayablesListParams = (
  filters: PayablesFiltersState,
  pagination?: { page?: number; limit?: number; direction?: PayableDirection },
): PayablesListParams => ({
  direction: pagination?.direction,
  page: pagination?.page,
  limit: pagination?.limit,
  search: filters.search || undefined,
  status: resolveOptional(filters.status, 'all'),
  source: resolveOptional(filters.source, 'all'),
  dueDateFrom: filters.dueDateFrom || undefined,
  dueDateTo: filters.dueDateTo || undefined,
  sort: filters.sort,
});

const compareByAmount = (left: Payable, right: Payable): number =>
  toNumber(right.amount) - toNumber(left.amount);

const compareByVendor = (left: Payable, right: Payable): number =>
  left.vendor.localeCompare(right.vendor);

const compareByDueDate = (left: Payable, right: Payable, descending: boolean): number => {
  const leftTime = parsePayableDate(left.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightTime = parsePayableDate(right.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return descending ? rightTime - leftTime : leftTime - rightTime;
};

export const sortPayables = (payables: Payable[], sort: PayablesSortOption): Payable[] => {
  const copy = [...payables];

  copy.sort((left, right) => {
    if (sort === 'amountDesc') {
      return compareByAmount(left, right);
    }
    if (sort === 'vendorAsc') {
      return compareByVendor(left, right);
    }
    return compareByDueDate(left, right, sort === 'dueDateDesc');
  });

  return copy;
};

type SummaryCardItem = { key: string; value: number; count?: number };

export const getSummaryCardItems = (summary: PayablesSummary): readonly SummaryCardItem[] =>
  [
    { key: 'toPay', value: summary.toPay, count: summary.toPayCount },
    { key: 'overdue', value: summary.overdue, count: summary.overdueCount },
    { key: 'dueThisWeek', value: summary.dueThisWeek },
    { key: 'paidTotal', value: summary.paidTotal, count: summary.paidTotalCount },
  ] as readonly SummaryCardItem[];
