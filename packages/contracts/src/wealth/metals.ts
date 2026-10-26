import * as Schema from 'effect/Schema';
import { DateOnly, Timestamp, type Wire } from '../common/wire';
import { InvestmentPriceSource } from './investments';

/** The four metals with an ISO 4217 code, so the rate tables already quote them. */
export const Metal = Schema.Literals(['XAU', 'XAG', 'XPT', 'XPD']);
export type Metal = Wire<typeof Metal>;

export const MetalWeightUnit = Schema.Literals(['g', 'ozt', 'kg']);
export type MetalWeightUnit = Wire<typeof MetalWeightUnit>;

/** A purchase receipt, enough of it to recognise; also a row of `GET /metals/receipt-options`. */
export const MetalReceipt = Schema.Struct({
  id: Schema.String,
  vendor: Schema.NullOr(Schema.String),
  date: Schema.NullOr(DateOnly),
  amount: Schema.NullOr(Schema.Number),
  currency: Schema.NullOr(Schema.String),
});
export type MetalReceipt = Wire<typeof MetalReceipt>;

export const MetalReceiptList = Schema.Array(MetalReceipt);
export type MetalReceiptList = Wire<typeof MetalReceiptList>;

export const MetalLot = Schema.Struct({
  id: Schema.String,
  metal: Metal,
  name: Schema.String,
  /** Pieces in the lot. */
  quantity: Schema.Number,
  unitWeight: Schema.Number,
  weightUnit: MetalWeightUnit,
  purity: Schema.Number,
  /** Fine metal in the lot, troy ounces. */
  fineOunces: Schema.Number,
  /** Spot price of one fine troy ounce. */
  price: Schema.Number,
  priceCurrency: Schema.String,
  priceSource: InvestmentPriceSource,
  /** When the price was quoted, so the UI can say how old it is. */
  pricedAt: Schema.NullOr(Timestamp),
  /** Melt value in the workspace currency. */
  value: Schema.Number,
  acquiredOn: Schema.NullOr(DateOnly),
  counterparty: Schema.NullOr(Schema.String),
  /** What was paid, as entered and in the workspace currency. */
  costTotal: Schema.NullOr(Schema.Number),
  costCurrency: Schema.NullOr(Schema.String),
  cost: Schema.NullOr(Schema.Number),
  /** value − cost; null when the lot has no recorded cost. */
  gain: Schema.NullOr(Schema.Number),
  /** What one fine ounce cost, the number people compare lots by. */
  costPerOunce: Schema.NullOr(Schema.Number),
  /** Paid over the melt value on the day it was bought, and as a share of it. */
  premium: Schema.NullOr(Schema.Number),
  premiumPercent: Schema.NullOr(Schema.Number),
  /** Melt value less what a dealer keeps: what selling would actually bring. */
  dealerValue: Schema.Number,
  /** Dealer value against cost, in percent; null without a cost. */
  roi: Schema.NullOr(Schema.Number),
  /** Germany only: the day a private sale stops being taxable (§ 23 EStG). */
  taxFreeFrom: Schema.NullOr(DateOnly),
  /** Where the photo of the lot is served from; null when there is none. */
  photoUrl: Schema.NullOr(Schema.String),
  storageLocation: Schema.NullOr(Schema.String),
  /** What it is insured for, as entered and in the workspace currency. */
  insuredValue: Schema.NullOr(Schema.Number),
  insuredCurrency: Schema.NullOr(Schema.String),
  insured: Schema.NullOr(Schema.Number),
  receipt: Schema.NullOr(MetalReceipt),
  /** Whose metal it is; a tax return belongs to a person, not to a workspace. */
  ownerUserId: Schema.NullOr(Schema.String),
});
export type MetalLot = Wire<typeof MetalLot>;

export const MetalTotals = Schema.Struct({
  metal: Metal,
  fineOunces: Schema.Number,
  price: Schema.Number,
  /** The oldest quote among the lots. */
  pricedAt: Schema.NullOr(Timestamp),
  value: Schema.Number,
  cost: Schema.Number,
  gain: Schema.Number,
  /** Average cost of a fine ounce across the lots still held. */
  costPerOunce: Schema.NullOr(Schema.Number),
  dealerValue: Schema.Number,
  /** Percent below spot a dealer pays for this metal. */
  dealerDiscount: Schema.Number,
  /** Result of the sales already made, in the workspace currency. */
  realized: Schema.Number,
});
export type MetalTotals = Wire<typeof MetalTotals>;

export const MetalSale = Schema.Struct({
  id: Schema.String,
  metal: Metal,
  lotName: Schema.String,
  quantity: Schema.Number,
  fineOunces: Schema.Number,
  proceeds: Schema.Number,
  proceedsCurrency: Schema.String,
  costBasis: Schema.NullOr(Schema.Number),
  /** proceeds − cost basis, in the workspace currency. */
  realized: Schema.NullOr(Schema.Number),
  soldOn: DateOnly,
  /** The day the sold pieces were bought; null when the lot never said. */
  acquiredOn: Schema.NullOr(DateOnly),
  counterparty: Schema.NullOr(Schema.String),
  ownerUserId: Schema.NullOr(Schema.String),
});
export type MetalSale = Wire<typeof MetalSale>;

/** `GET /metals`. */
export const MetalsSummary = Schema.Struct({
  currency: Schema.String,
  value: Schema.Number,
  cost: Schema.Number,
  gain: Schema.Number,
  dealerValue: Schema.Number,
  realized: Schema.Number,
  /** What the lots are insured for in total; zero when nobody filled it in. */
  insured: Schema.Number,
  byMetal: Schema.Array(MetalTotals),
  lots: Schema.Array(MetalLot),
  sales: Schema.Array(MetalSale),
  dealerDiscount: Schema.Struct({
    XAU: Schema.Number,
    XAG: Schema.Number,
    XPT: Schema.Number,
    XPD: Schema.Number,
  }),
  /** The balance-sheet account the lots sit on; null until the first lot. */
  accountId: Schema.NullOr(Schema.String),
  /** Country the workspace files tax in, so the UI knows whose rules apply. */
  jurisdiction: Schema.NullOr(Schema.String),
});
export type MetalsSummary = Wire<typeof MetalsSummary>;

/** What a dealer pays below spot, in percent, per metal. */
export const MetalDealerDiscounts = Schema.Struct({
  XAU: Schema.Number,
  XAG: Schema.Number,
  XPT: Schema.Number,
  XPD: Schema.Number,
});
export type MetalDealerDiscounts = Wire<typeof MetalDealerDiscounts>;

/** `PATCH /metals/settings`. */
export const MetalSettings = Schema.Struct({ dealerDiscount: MetalDealerDiscounts });
export type MetalSettings = Wire<typeof MetalSettings>;

/** `POST /metals/lots/:id/sell`: the sale, and what is left of the lot (null when sold out). */
export const MetalSaleResult = Schema.Struct({
  sale: MetalSale,
  lot: Schema.NullOr(MetalLot),
});
export type MetalSaleResult = Wire<typeof MetalSaleResult>;
