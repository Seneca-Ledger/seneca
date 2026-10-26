import * as Schema from 'effect/Schema';
import { DateOnly, DecimalString, Timestamp, type Wire } from '../common/wire';
import { LedgerAccountType } from './ledger';

const Freshness = Schema.Struct({
  upToDate: Schema.Boolean,
  pendingTransactions: Schema.Number,
  failingTransactions: Schema.Number,
});

/** An account and its amount in the base currency; headers carry the sum of their descendants. */
const LedgerAmountRow = Schema.Struct({
  accountId: Schema.String,
  parentId: Schema.NullOr(Schema.String),
  code: Schema.String,
  name: Schema.String,
  accountType: LedgerAccountType,
  isPostable: Schema.Boolean,
  amount: DecimalString,
});

/** `GET /ledger/reports/profit-and-loss`. */
export const ProfitAndLoss = Schema.Struct({
  baseCurrency: Schema.String,
  dateFrom: DateOnly,
  dateTo: DateOnly,
  freshness: Freshness,
  income: Schema.Array(LedgerAmountRow),
  expenses: Schema.Array(LedgerAmountRow),
  totals: Schema.Struct({
    income: DecimalString,
    expenses: DecimalString,
    netIncome: DecimalString,
  }),
});
export type ProfitAndLoss = Wire<typeof ProfitAndLoss>;

/** `GET /ledger/reports/balance-sheet`: the books on a day, profit to date as its own equity line. */
export const LedgerBalanceSheet = Schema.Struct({
  baseCurrency: Schema.String,
  date: DateOnly,
  freshness: Freshness,
  assets: Schema.Array(LedgerAmountRow),
  liabilities: Schema.Array(LedgerAmountRow),
  equity: Schema.Array(LedgerAmountRow),
  unclosedEarnings: DecimalString,
  totals: Schema.Struct({
    assets: DecimalString,
    liabilities: DecimalString,
    equity: DecimalString,
    liabilitiesAndEquity: DecimalString,
  }),
  balanced: Schema.Boolean,
});
export type LedgerBalanceSheet = Wire<typeof LedgerBalanceSheet>;

/** A foreign-currency revaluation entry and what it booked to FX gain and loss. */
export const LedgerRevaluation = Schema.Struct({
  entryId: Schema.String,
  entryNo: Schema.NullOr(Schema.String),
  entryDate: Schema.String,
  postedAt: Schema.NullOr(Timestamp),
  gain: Schema.String,
  loss: Schema.String,
});
export type LedgerRevaluation = Wire<typeof LedgerRevaluation>;

/** `GET /ledger/revaluations`. */
export const LedgerRevaluationList = Schema.Array(LedgerRevaluation);
export type LedgerRevaluationList = Wire<typeof LedgerRevaluationList>;

/** `POST /ledger/sync`: a sync was asked for. */
export const LedgerSyncQueued = Schema.Struct({ queued: Schema.Literal(true) });
export type LedgerSyncQueued = Wire<typeof LedgerSyncQueued>;
