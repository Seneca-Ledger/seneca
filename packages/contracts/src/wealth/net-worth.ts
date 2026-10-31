import * as Schema from 'effect/Schema';
import { DateOnly, type Wire } from '../common/wire';
import { Metal } from './metals';

export const NetWorthRange = Schema.Literals([
  '1d',
  '30d',
  '90d',
  '180d',
  'ytd',
  '1y',
  '3y',
  '5y',
  'all',
]);
export type NetWorthRange = Wire<typeof NetWorthRange>;

export const CapitalRole = Schema.Literals(['income', 'neutral', 'drain']);
export type CapitalRole = Wire<typeof CapitalRole>;

export const RiskLevel = Schema.Literals(['low', 'medium', 'high']);
export type RiskLevel = Wire<typeof RiskLevel>;

export const NetWorthPoint = Schema.Struct({
  date: DateOnly,
  value: Schema.Number,
  /** The two sides of the day, so the chart can show what the net hides. */
  assets: Schema.Number,
  liabilities: Schema.Number,
});
export type NetWorthPoint = Wire<typeof NetWorthPoint>;

export const NetWorthBreakdownItem = Schema.Struct({
  code: Schema.String,
  name: Schema.String,
  amount: Schema.Number,
  percent: Schema.Number,
});
export type NetWorthBreakdownItem = Wire<typeof NetWorthBreakdownItem>;

/** One bucket of a classification split. `key` is null for what is unlabelled. */
export const NetWorthClassificationItem = Schema.Struct({
  key: Schema.NullOr(Schema.String),
  amount: Schema.Number,
  percent: Schema.Number,
});
export type NetWorthClassificationItem = Wire<typeof NetWorthClassificationItem>;

/** An asset line the user can classify, with what it is currently worth. */
export const NetWorthAssetLine = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  name: Schema.String,
  amount: Schema.Number,
  capitalRole: Schema.NullOr(CapitalRole),
  riskLevel: Schema.NullOr(RiskLevel),
  /** False for cash, whose risk is fixed rather than chosen. */
  isClassifiable: Schema.Boolean,
});
export type NetWorthAssetLine = Wire<typeof NetWorthAssetLine>;

/** What one line, or the rates, did to the number over the window. */
export const NetWorthAttributionRow = Schema.Struct({
  id: Schema.String,
  code: Schema.String,
  name: Schema.String,
  amount: Schema.Number,
});
export type NetWorthAttributionRow = Wire<typeof NetWorthAttributionRow>;

export const NetWorthChangeKind = Schema.Literals(['money', 'revaluation', 'fx']);
export type NetWorthChangeKind = Wire<typeof NetWorthChangeKind>;

/**
 * Where the change over the window came from. Both lists add up to `change`
 * exactly: one answers "which of my things moved", the other "was it me or
 * was it the market".
 */
export const NetWorthAttribution = Schema.Struct({
  byAccount: Schema.Array(NetWorthAttributionRow),
  byKind: Schema.Array(Schema.Struct({ kind: NetWorthChangeKind, amount: Schema.Number })),
});
export type NetWorthAttribution = Wire<typeof NetWorthAttribution>;

/**
 * What came in over the window and what share of it was kept. `rate` is null
 * when nothing came in: a share of nothing is not zero, it is nothing to say.
 */
export const NetWorthSavings = Schema.Struct({
  income: Schema.Number,
  kept: Schema.Number,
  rate: Schema.NullOr(Schema.Number),
});
export type NetWorthSavings = Wire<typeof NetWorthSavings>;

/**
 * The same net worth measured in troy ounces of a metal: the money figures
 * divided by the spot price of the day each point belongs to, never by today's.
 */
export const NetWorthDenominated = Schema.Struct({
  metal: Metal,
  unit: Schema.Literal('ozt'),
  current: Schema.Number,
  previous: Schema.Number,
  change: Schema.Number,
  changePercent: Schema.NullOr(Schema.Number),
  series: Schema.Array(NetWorthPoint),
});
export type NetWorthDenominated = Wire<typeof NetWorthDenominated>;

/**
 * The fixed groups a summary of everything owned and owed is told in, the
 * same whichever chart of accounts the workspace keeps; listed in display order.
 */
export const NetWorthGroupKey = Schema.Literals([
  'cash',
  'investments',
  'crypto',
  'retirement',
  'real_estate',
  'vehicles',
  'other_assets',
  'credit_cards',
  'loans',
  'mortgage',
  'other_liabilities',
]);
export type NetWorthGroupKey = Wire<typeof NetWorthGroupKey>;

/** One group with its value over the window; `series` follows the dates of the response's own `series`. */
export const NetWorthGroup = Schema.Struct({
  key: NetWorthGroupKey,
  side: Schema.Literals(['asset', 'liability']),
  amount: Schema.Number,
  changePercent: Schema.NullOr(Schema.Number),
  series: Schema.Array(Schema.Number),
  lines: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      code: Schema.String,
      name: Schema.String,
      amount: Schema.Number,
    }),
  ),
});
export type NetWorthGroup = Wire<typeof NetWorthGroup>;

/** `GET /reports/net-worth`. */
export const NetWorthResponse = Schema.Struct({
  range: NetWorthRange,
  /** The window actually charted, which a custom `from`/`to` decides. */
  from: DateOnly,
  to: DateOnly,
  currency: Schema.String,
  current: Schema.Number,
  previous: Schema.Number,
  change: Schema.Number,
  changePercent: Schema.NullOr(Schema.Number),
  assetsTotal: Schema.Number,
  liabilitiesTotal: Schema.Number,
  series: Schema.Array(NetWorthPoint),
  breakdown: Schema.Array(NetWorthBreakdownItem),
  byRisk: Schema.Array(NetWorthClassificationItem),
  byRole: Schema.Array(NetWorthClassificationItem),
  /** Share of assets sitting in medium or high risk. */
  riskyPercent: Schema.Number,
  assetLines: Schema.Array(NetWorthAssetLine),
  /** Currencies left out of the figures because no rate to `currency` was found. */
  missingRates: Schema.Array(Schema.String),
  /** The account ids left out, echoed back so the page can show what is hidden. */
  excluded: Schema.Array(Schema.String),
  /** What made the change over the window, by line and by cause. */
  attribution: NetWorthAttribution,
  savings: NetWorthSavings,
  /** Present only when the caller asked to see the figures in metal. */
  denominated: Schema.optional(Schema.NullOr(NetWorthDenominated)),
  /** The highest sampled net worth over the whole history, and when. */
  allTimeHigh: Schema.NullOr(Schema.Struct({ value: Schema.Number, date: DateOnly })),
  /** Investment holdings by asset class; cash and the other sheet lines keep their own buckets. */
  byAssetClass: Schema.Array(NetWorthClassificationItem),
  /** Assets, then debts, by group, each with its own trend. */
  groups: Schema.Array(NetWorthGroup),
});
export type NetWorthResponse = Wire<typeof NetWorthResponse>;
