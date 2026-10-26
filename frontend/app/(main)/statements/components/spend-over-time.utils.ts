import type { StatementFilterItem } from '@/app/(main)/statements/components/filters/statement-filters';
import { formatDateISO, resolveAmountFlow } from './shared-analytics.utils';

export type SpendOverTimeFlowType = 'expense' | 'income';
export type SpendOverTimeSourceType = 'statement' | 'receipt';
export type SpendOverTimeSourceChannel = 'bank' | 'receipt' | 'crypto';
export type SpendOverTimeGroupBy = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type SpendOverTimeRecord = StatementFilterItem & {
  sourceType: SpendOverTimeSourceType;
  sourceChannel: SpendOverTimeSourceChannel;
  flowType: SpendOverTimeFlowType;
  amount: number;
  currencyValue: string;
  dateValue: string;
  transactionId?: string | null;
  workspaceId?: string;
  workspaceName?: string;
  merchant?: string | null;
  paymentPurpose?: string | null;
  /** The document behind the operation, opened the way the Documents list opens it. */
  href?: string | null;
};

export type SpendOverTimePoint = {
  period: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  count: number;
  statementAmount: number;
  receiptAmount: number;
};

export type SpendOverTimeTotals = {
  income: number;
  expense: number;
  net: number;
  count: number;
  avgPerPeriod: number;
  statementAmount: number;
  receiptAmount: number;
};

export type SpendOverTimeReport = {
  points: SpendOverTimePoint[];
  totals: SpendOverTimeTotals;
};

type ResolveSpendOverTimeFlowInput = {
  sourceType: SpendOverTimeSourceType;
  debit?: number | string | null;
  credit?: number | string | null;
  amount?: number | string | null;
  transactionType?: 'income' | 'expense' | 'transfer' | 'unknown' | null;
};

const toDateOnly = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const getWeekStart = (date: Date): Date => {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const result = new Date(date);
  result.setDate(date.getDate() + diff);
  return new Date(result.getFullYear(), result.getMonth(), result.getDate());
};

const DAY_PERIOD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const buildPeriodMeta = (
  date: Date,
  groupBy: SpendOverTimeGroupBy,
): { period: string; label: string } => {
  if (groupBy === 'day') {
    const period = formatDateISO(date);
    return { period, label: period };
  }

  if (groupBy === 'week') {
    const weekStart = getWeekStart(date);
    const period = formatDateISO(weekStart);
    return { period, label: period };
  }

  if (groupBy === 'month') {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const period = `${year}-${month}`;
    const label = monthFormatter.format(new Date(Date.UTC(year, date.getMonth(), 1)));
    return { period, label };
  }

  if (groupBy === 'quarter') {
    const year = date.getFullYear();
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const period = `${year}-Q${quarter}`;
    return { period, label: `Q${quarter} ${year}` };
  }

  const period = `${date.getFullYear()}`;
  return { period, label: period };
};

export const isSpendOverTimeDayPeriod = (period: string | null | undefined): boolean =>
  Boolean(period && DAY_PERIOD_REGEX.test(period));

const spendOverTimePeriodBuilders: Record<SpendOverTimeGroupBy, (date: Date) => string> = {
  day: formatDateISO,
  week: date => formatDateISO(getWeekStart(date)),
  month: date => `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`,
  quarter: date => `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`,
  year: date => `${date.getFullYear()}`,
};

export const matchesSpendOverTimePeriod = (
  date: Date,
  period: string,
  groupBy: SpendOverTimeGroupBy,
): boolean => {
  return spendOverTimePeriodBuilders[groupBy](date) === period;
};

const getSpendOverTimeRecordDate = (record: SpendOverTimeRecord): Date | null =>
  toDateOnly(record.dateValue || record.createdAt || null);

const getSpendOverTimeRecordTime = (record: SpendOverTimeRecord): number =>
  getSpendOverTimeRecordDate(record)?.getTime() ?? 0;

export const filterSpendOverTimeDrillDownRecords = (
  period: string,
  groupBy: SpendOverTimeGroupBy,
  records: SpendOverTimeRecord[],
): SpendOverTimeRecord[] =>
  records
    .filter(record => {
      const date = getSpendOverTimeRecordDate(record);
      return date ? matchesSpendOverTimePeriod(date, period, groupBy) : false;
    })
    .sort((a, b) => getSpendOverTimeRecordTime(b) - getSpendOverTimeRecordTime(a));

export const buildSpendOverTimeSelectedPoint = (
  period: string | null,
  records: SpendOverTimeRecord[],
): SpendOverTimePoint | null => {
  if (!period || records.length === 0) {
    return null;
  }
  const point = records.reduce<SpendOverTimePoint>(
    (result, record) => {
      if (record.flowType === 'income') {
        result.income += record.amount;
      } else {
        result.expense += record.amount;
      }
      if (record.sourceType === 'receipt') {
        result.receiptAmount += record.amount;
      } else {
        result.statementAmount += record.amount;
      }
      result.count += 1;
      result.net = result.income - result.expense;
      return result;
    },
    {
      period,
      label: period,
      income: 0,
      expense: 0,
      net: 0,
      count: 0,
      statementAmount: 0,
      receiptAmount: 0,
    },
  );
  return {
    ...point,
    income: Number(point.income.toFixed(2)),
    expense: Number(point.expense.toFixed(2)),
    net: Number(point.net.toFixed(2)),
    statementAmount: Number(point.statementAmount.toFixed(2)),
    receiptAmount: Number(point.receiptAmount.toFixed(2)),
  };
};

export const resolveSpendOverTimeFlow = (
  input: ResolveSpendOverTimeFlowInput,
): { flowType: 'income' | 'expense'; amount: number } => {
  return resolveAmountFlow({
    sourceType: input.sourceType,
    debit: input.debit,
    credit: input.credit,
    amount: input.amount,
    transactionType: input.transactionType,
    expenseFlowType: 'expense',
  });
};

export const dedupeSpendOverTimeReceiptRecords = (
  receipts: SpendOverTimeRecord[],
  existingTransactionIds: Set<string>,
): SpendOverTimeRecord[] => {
  return receipts.filter(receipt => {
    if (!receipt.transactionId) {
      return true;
    }
    return !existingTransactionIds.has(receipt.transactionId);
  });
};

export const buildSpendOverTimeReport = (
  records: SpendOverTimeRecord[],
  groupBy: SpendOverTimeGroupBy,
): SpendOverTimeReport => {
  const pointsMap = new Map<string, SpendOverTimePoint>();

  records.forEach(record => {
    const date = toDateOnly(record.dateValue || record.createdAt || null);
    if (!date || record.amount <= 0) {
      return;
    }

    const meta = buildPeriodMeta(date, groupBy);
    const existing = pointsMap.get(meta.period) || {
      period: meta.period,
      label: meta.label,
      income: 0,
      expense: 0,
      net: 0,
      count: 0,
      statementAmount: 0,
      receiptAmount: 0,
    };

    if (record.flowType === 'income') {
      existing.income += record.amount;
    } else {
      existing.expense += record.amount;
    }

    if (record.sourceType === 'receipt') {
      existing.receiptAmount += record.amount;
    } else {
      existing.statementAmount += record.amount;
    }

    existing.count += 1;
    existing.net = existing.income - existing.expense;
    pointsMap.set(meta.period, existing);
  });

  const points = Array.from(pointsMap.values())
    .sort((a, b) => a.period.localeCompare(b.period))
    .map(point => ({
      ...point,
      income: Number(point.income.toFixed(2)),
      expense: Number(point.expense.toFixed(2)),
      net: Number(point.net.toFixed(2)),
      statementAmount: Number(point.statementAmount.toFixed(2)),
      receiptAmount: Number(point.receiptAmount.toFixed(2)),
    }));

  const totals = points.reduce<SpendOverTimeTotals>(
    (result, point) => {
      result.income += point.income;
      result.expense += point.expense;
      result.net += point.net;
      result.count += point.count;
      result.statementAmount += point.statementAmount;
      result.receiptAmount += point.receiptAmount;
      return result;
    },
    {
      income: 0,
      expense: 0,
      net: 0,
      count: 0,
      avgPerPeriod: 0,
      statementAmount: 0,
      receiptAmount: 0,
    },
  );

  const totalFlow = totals.income + totals.expense;
  totals.avgPerPeriod = points.length > 0 ? Number((totalFlow / points.length).toFixed(2)) : 0;
  totals.income = Number(totals.income.toFixed(2));
  totals.expense = Number(totals.expense.toFixed(2));
  totals.net = Number(totals.net.toFixed(2));
  totals.statementAmount = Number(totals.statementAmount.toFixed(2));
  totals.receiptAmount = Number(totals.receiptAmount.toFixed(2));

  return {
    points,
    totals,
  };
};
