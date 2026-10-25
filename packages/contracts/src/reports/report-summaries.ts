import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';

const Flow = Schema.Literals(['income', 'expense']);

const SummaryTotals = Schema.Struct({
  income: Schema.Number,
  expense: Schema.Number,
  net: Schema.Number,
  rows: Schema.Number,
});
const SummaryDay = Schema.Struct({
  date: Schema.String,
  income: Schema.Number,
  expense: Schema.Number,
});
const SummaryShare = Schema.Struct({
  name: Schema.String,
  amount: Schema.Number,
  rows: Schema.Number,
});

/** `GET /reports/statements/summary`: the last `days` of counted rows. */
export const StatementsSummary = Schema.Struct({
  totals: SummaryTotals,
  timeseries: Schema.Array(SummaryDay),
  categories: Schema.Array(SummaryShare),
  counterparties: Schema.Array(SummaryShare),
  recent: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      amount: Schema.Number,
      category: Schema.NullOr(Schema.String),
      counterparty: Schema.NullOr(Schema.String),
      updatedAt: Timestamp,
    }),
  ),
});
export type StatementsSummary = Wire<typeof StatementsSummary>;

/** `POST /reports/custom-tables/summary`: the same figures over custom table rows. */
export const CustomTablesSummary = Schema.Struct({
  totals: SummaryTotals,
  timeseries: Schema.Array(SummaryDay),
  categories: Schema.Array(SummaryShare),
  counterparties: Schema.Array(SummaryShare),
  recent: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      tableId: Schema.String,
      tableName: Schema.String,
      rowNumber: Schema.Number,
      amount: Schema.Number,
      category: Schema.NullOr(Schema.String),
      counterparty: Schema.NullOr(Schema.String),
      updatedAt: Timestamp,
    }),
  ),
  tables: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      income: Schema.Number,
      expense: Schema.Number,
      net: Schema.Number,
      rows: Schema.Number,
    }),
  ),
});
export type CustomTablesSummary = Wire<typeof CustomTablesSummary>;

/** `GET /reports/top-categories`. */
export const TopCategoriesReport = Schema.Struct({
  period: Schema.Struct({ from: Schema.String, to: Schema.String }),
  totals: Schema.Struct({
    income: Schema.Number,
    expense: Schema.Number,
    net: Schema.Number,
    transactions: Schema.Number,
  }),
  categories: Schema.Array(
    Schema.Struct({
      id: Schema.NullOr(Schema.String),
      name: Schema.String,
      amount: Schema.Number,
      percentage: Schema.Number,
      transactions: Schema.Number,
      type: Flow,
      color: Schema.optionalKey(Schema.NullOr(Schema.String)),
      icon: Schema.optionalKey(Schema.NullOr(Schema.String)),
    }),
  ),
  banks: Schema.Array(
    Schema.Struct({
      bankName: Schema.String,
      amount: Schema.Number,
      percentage: Schema.Number,
      statements: Schema.Number,
    }),
  ),
  counterparties: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      amount: Schema.Number,
      percentage: Schema.Number,
      transactions: Schema.Number,
      type: Flow,
    }),
  ),
});
export type TopCategoriesReport = Wire<typeof TopCategoriesReport>;

/** `GET /reports/spend-over-time`: income and spending per period. */
export const SpendOverTimeReport = Schema.Struct({
  groupBy: Schema.String,
  dateFrom: Schema.String,
  dateTo: Schema.String,
  points: Schema.Array(
    Schema.Struct({
      period: Schema.String,
      label: Schema.String,
      income: Schema.Number,
      expense: Schema.Number,
      net: Schema.Number,
      count: Schema.Number,
    }),
  ),
  totals: Schema.Struct({
    income: Schema.Number,
    expense: Schema.Number,
    net: Schema.Number,
    count: Schema.Number,
    avgPerPeriod: Schema.Number,
  }),
});
export type SpendOverTimeReport = Wire<typeof SpendOverTimeReport>;

/** `GET /reports/daily`. */
export const DailyReport = Schema.Struct({
  date: Schema.String,
  income: Schema.Struct({
    totalAmount: Schema.Number,
    transactionCount: Schema.Number,
    topCounterparties: Schema.Array(
      Schema.Struct({ name: Schema.String, amount: Schema.Number, count: Schema.Number }),
    ),
  }),
  expense: Schema.Struct({
    totalAmount: Schema.Number,
    transactionCount: Schema.Number,
    topCategories: Schema.Array(
      Schema.Struct({
        categoryId: Schema.String,
        categoryName: Schema.String,
        amount: Schema.Number,
        count: Schema.Number,
      }),
    ),
  }),
  summary: Schema.Struct({
    incomeTotal: Schema.Number,
    expenseTotal: Schema.Number,
    difference: Schema.Number,
    balance: Schema.optionalKey(Schema.Number),
  }),
});
export type DailyReport = Wire<typeof DailyReport>;

const PeriodFigures = Schema.Struct({
  income: Schema.Number,
  expense: Schema.Number,
  difference: Schema.Number,
});

const ReportSummary = Schema.Struct({
  totalIncome: Schema.Number,
  totalExpense: Schema.Number,
  difference: Schema.Number,
  transactionCount: Schema.Number,
});

/** `GET /reports/monthly`: a month by day, category and counterparty, against the month before. */
export const MonthlyReport = Schema.Struct({
  month: Schema.String,
  year: Schema.Number,
  dailyTrends: Schema.Array(
    Schema.Struct({ date: Schema.String, income: Schema.Number, expense: Schema.Number }),
  ),
  categoryDistribution: Schema.Array(
    Schema.Struct({
      categoryId: Schema.String,
      categoryName: Schema.String,
      amount: Schema.Number,
      percentage: Schema.Number,
      transactionCount: Schema.Number,
    }),
  ),
  counterpartyDistribution: Schema.Array(
    Schema.Struct({
      counterpartyName: Schema.String,
      amount: Schema.Number,
      percentage: Schema.Number,
      transactionCount: Schema.Number,
    }),
  ),
  comparison: Schema.Struct({
    currentPeriod: PeriodFigures,
    previousPeriod: PeriodFigures,
    change: Schema.Struct({
      incomeChange: Schema.Number,
      expenseChange: Schema.Number,
      differenceChange: Schema.Number,
      incomeChangePercent: Schema.Number,
      expenseChangePercent: Schema.Number,
      differenceChangePercent: Schema.Number,
    }),
  }),
  summary: ReportSummary,
});
export type MonthlyReport = Wire<typeof MonthlyReport>;

/** `POST /reports/custom`: a date range grouped by the field asked for. */
export const CustomReport = Schema.Struct({
  dateFrom: Schema.String,
  dateTo: Schema.String,
  groupBy: Schema.String,
  groups: Schema.Array(
    Schema.Struct({
      key: Schema.String,
      label: Schema.String,
      totalAmount: Schema.Number,
      transactionCount: Schema.Number,
      transactions: Schema.Array(
        Schema.Struct({
          id: Schema.String,
          date: Schema.String,
          counterparty: Schema.String,
          amount: Schema.Number,
          category: Schema.optionalKey(Schema.String),
          branch: Schema.optionalKey(Schema.String),
          wallet: Schema.optionalKey(Schema.String),
        }),
      ),
    }),
  ),
  summary: ReportSummary,
});
export type CustomReport = Wire<typeof CustomReport>;

/** `GET /reports/latest`: the day of the newest counted row, null without any. */
export const LatestReportPeriod = Schema.Struct({
  date: Schema.NullOr(Schema.String),
  year: Schema.NullOr(Schema.Number),
  month: Schema.NullOr(Schema.Number),
});
export type LatestReportPeriod = Wire<typeof LatestReportPeriod>;

/** `DELETE /reports/schedules/:scheduleId`. */
export const ReportScheduleRemoved = Schema.Struct({ success: Schema.Literal(true) });
export type ReportScheduleRemoved = Wire<typeof ReportScheduleRemoved>;
