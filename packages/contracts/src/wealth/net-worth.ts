import * as Schema from 'effect/Schema';
import { DateOnly, type Wire } from '../common/wire';
import { Metal } from './metals';

export const NetWorthRange = Schema.Literals([
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

/** `GET /reports/net-worth`. */
export const NetWorthResponse = Schema.Struct({
  range: NetWorthRange,
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
  /** Present only when the caller asked to see the figures in metal. */
  denominated: Schema.optional(Schema.NullOr(NetWorthDenominated)),
  /** The highest sampled net worth over the whole history, and when. */
  allTimeHigh: Schema.NullOr(Schema.Struct({ value: Schema.Number, date: DateOnly })),
  /** Investment holdings by asset class; cash and the other sheet lines keep their own buckets. */
  byAssetClass: Schema.Array(NetWorthClassificationItem),
});
export type NetWorthResponse = Wire<typeof NetWorthResponse>;
