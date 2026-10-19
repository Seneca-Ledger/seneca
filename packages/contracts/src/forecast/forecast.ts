import * as Schema from 'effect/Schema';
import { DateOnly, type Wire } from '../common/wire';

export const ForecastEventKind = Schema.Literals([
  'payable',
  'subscription',
  'invoice',
  'goal',
  'income',
  'scenario',
]);
export type ForecastEventKind = Wire<typeof ForecastEventKind>;

export const ForecastEvent = Schema.Struct({
  date: DateOnly,
  label: Schema.String,
  /** Positive = money in, negative = money out. Workspace currency. */
  amount: Schema.Number,
  kind: ForecastEventKind,
  /** The row behind the event; `exclude` in a scenario names these. */
  sourceId: Schema.String,
  isOverdue: Schema.optional(Schema.Boolean),
});
export type ForecastEvent = Wire<typeof ForecastEvent>;

export const ForecastDay = Schema.Struct({
  date: DateOnly,
  inflow: Schema.Number,
  outflow: Schema.Number,
  everyday: Schema.Number,
  irregularIncome: Schema.Number,
  balance: Schema.Number,
});
export type ForecastDay = Wire<typeof ForecastDay>;

/** A payday the history repeats. */
export const ForecastRecurringIncome = Schema.Struct({
  label: Schema.String,
  /** What the latest paydays brought (median of the last three), so a raise shows. */
  amount: Schema.Number,
  intervalDays: Schema.Number,
  /** Monthly payers are paid on a day of the month, not every N days; null otherwise. */
  dayOfMonth: Schema.NullOr(Schema.Number),
  lastDate: DateOnly,
  /** Before today when the payday is late but still expected. */
  nextDate: DateOnly,
  occurrences: Schema.Number,
  sourceId: Schema.String,
});
export type ForecastRecurringIncome = Wire<typeof ForecastRecurringIncome>;

/** `GET /forecast`. */
export const ForecastResponse = Schema.Struct({
  currency: Schema.String,
  /** The business profile reads the runway, the home one safe-to-spend. */
  profile: Schema.Literals(['home', 'business']),
  horizonDays: Schema.Number,
  openingBalance: Schema.Number,
  closingBalance: Schema.Number,
  totalInflow: Schema.Number,
  totalOutflow: Schema.Number,
  totalEveryday: Schema.Number,
  totalIrregularIncome: Schema.Number,
  days: Schema.Array(ForecastDay),
  events: Schema.Array(ForecastEvent),
  lowestBalance: Schema.Number,
  lowestBalanceDate: DateOnly,
  /** First day the projected balance goes negative, or null. */
  shortfallDate: Schema.NullOr(DateOnly),
  /** Committed items and paydays only, until the next payday (or the horizon). */
  safeToSpend: Schema.Struct({
    amount: Schema.Number,
    untilDate: DateOnly,
    nextIncomeDate: Schema.NullOr(DateOnly),
  }),
  /** Months the opening balance lasts at the pace of the year ahead; null when not burning. */
  runwayMonths: Schema.NullOr(Schema.Number),
  /** What the everyday average was built from. */
  everydayMonthly: Schema.Number,
  /** Income per month beyond the detected paydays, from the same history. */
  irregularIncomeMonthly: Schema.Number,
  monthlyIncome: Schema.Number,
  monthlyExpense: Schema.Number,
  monthsObserved: Schema.Number,
  recurringIncome: Schema.Array(ForecastRecurringIncome),
  /** Payables without a due date: owed, but not placeable on the curve. */
  unscheduledCommitted: Schema.Number,
  /**
   * Money held for tax by the workspace's own rule (VAT collected, a share of
   * earnings, minus tax already paid). Already taken out of safe-to-spend.
   */
  taxReserve: Schema.optional(Schema.Number),
});
export type ForecastResponse = Wire<typeof ForecastResponse>;
