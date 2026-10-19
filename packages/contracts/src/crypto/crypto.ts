import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';
import { SupportedChainId } from '../requests/crypto';

/** Coin amounts stay decimal strings: 18-decimal tokens overflow a JS number. */
const CoinAmount = Schema.String;

/** An address we read, a line the user keeps, or a CSV an exchange exported. */
export const CryptoWalletKind = Schema.Literals(['onchain', 'manual', 'exchange']);
export type CryptoWalletKind = Wire<typeof CryptoWalletKind>;

export const CryptoWalletBalance = Schema.Struct({
  /** Ticker, uppercase. */
  asset: Schema.String,
  amount: CoinAmount,
  /** What one unit cost, for a holding entered by hand; absent means unknown, not zero. */
  costPerUnit: Schema.optional(Schema.Number),
});
export type CryptoWalletBalance = Wire<typeof CryptoWalletBalance>;

/** One row of `GET /crypto/wallets`. */
export const CryptoWallet = Schema.Struct({
  id: Schema.String,
  address: Schema.NullOr(Schema.String),
  kind: CryptoWalletKind,
  /** The lines the user typed, for a manual wallet; empty for an on-chain one. */
  balances: Schema.Array(CryptoWalletBalance),
  chainId: Schema.Number,
  chainName: Schema.String,
  label: Schema.NullOr(Schema.String),
  lastSyncedAt: Schema.NullOr(Timestamp),
  lastSyncError: Schema.NullOr(Schema.String),
  transactionCount: Schema.Number,
});
export type CryptoWallet = Wire<typeof CryptoWallet>;

export const CryptoWalletList = Schema.Array(CryptoWallet);
export type CryptoWalletList = Wire<typeof CryptoWalletList>;

export const CryptoHolding = Schema.Struct({
  asset: Schema.String,
  amount: CoinAmount,
  /** Current price of one unit, in the summary currency. */
  price: Schema.Number,
  value: Schema.Number,
  /** What one coin cost on average (FIFO); null when no purchase is on record. */
  avgCost: Schema.NullOr(Schema.Number),
  cost: Schema.NullOr(Schema.Number),
  unrealized: Schema.NullOr(Schema.Number),
  unrealizedPercent: Schema.NullOr(Schema.Number),
  /** Profit already taken on this asset, over the whole history we hold. */
  realized: Schema.Number,
  /** A disposal had no purchase behind it, so the basis is only part of the story. */
  basisIncomplete: Schema.Boolean,
});
export type CryptoHolding = Wire<typeof CryptoHolding>;

/** `GET /crypto/summary`. */
export const CryptoSummary = Schema.Struct({
  currency: Schema.String,
  /**
   * Current value of every priced holding, in the workspace currency. For a
   * `month` already over: the portfolio as the last sync before its end valued
   * it, with `holdings` empty, since which coins were held then is not kept.
   */
  portfolioValue: Schema.Number,
  /** Booked value of incoming transfers over the window. */
  income: Schema.Number,
  /** Booked value of outgoing transfers, including gas, over the window. */
  expense: Schema.Number,
  walletCount: Schema.Number,
  holdings: Schema.Array(CryptoHolding),
  /** Held but unpriceable, so deliberately outside `portfolioValue`. */
  unpriced: Schema.Array(Schema.Struct({ asset: Schema.String, amount: CoinAmount })),
  cost: Schema.NullOr(Schema.Number),
  unrealized: Schema.NullOr(Schema.Number),
  realized: Schema.Number,
  /** Percent move against yesterday's prices; null when a price is missing. */
  portfolioChangeSinceYesterday: Schema.NullOr(Schema.Number),
});
export type CryptoSummary = Wire<typeof CryptoSummary>;

/** One row of `GET /crypto/transactions`. */
export const CryptoTransaction = Schema.Struct({
  id: Schema.String,
  date: Timestamp,
  walletId: Schema.String,
  walletLabel: Schema.NullOr(Schema.String),
  walletAddress: Schema.NullOr(Schema.String),
  walletChainName: Schema.NullOr(Schema.String),
  direction: Schema.Literals(['in', 'out']),
  asset: Schema.NullOr(Schema.String),
  cryptoAmount: Schema.NullOr(CoinAmount),
  /** Booked value in `currency`. */
  amount: Schema.Number,
  currency: Schema.String,
  counterparty: Schema.NullOr(Schema.String),
  txHash: Schema.NullOr(Schema.String),
});
export type CryptoTransaction = Wire<typeof CryptoTransaction>;

export const CryptoTransactionList = Schema.Array(CryptoTransaction);
export type CryptoTransactionList = Wire<typeof CryptoTransactionList>;

/** `GET /crypto/history`: the portfolio's value on the days a sync recorded it. */
export const CryptoHistory = Schema.Struct({
  currency: Schema.String,
  series: Schema.Array(Schema.Struct({ date: Schema.String, value: Schema.Number })),
});
export type CryptoHistory = Wire<typeof CryptoHistory>;

export const CryptoDisposal = Schema.Struct({
  /** Unique within the report: same coin, same day, same size can happen twice. */
  id: Schema.String,
  asset: Schema.String,
  /** When it was sold. */
  date: Schema.String,
  /** Coins sold, as far as a purchase backs them. */
  amount: Schema.Number,
  proceeds: Schema.Number,
  cost: Schema.Number,
  gain: Schema.Number,
  /** When the oldest consumed purchase was made; null when none did. */
  acquiredOn: Schema.NullOr(Schema.String),
  heldDays: Schema.NullOr(Schema.Number),
  /** Coins in this sale that no purchase backs. */
  uncoveredAmount: Schema.Number,
  uncoveredProceeds: Schema.Number,
  /** True when part of the sale has no cost to measure against. */
  costIncomplete: Schema.Boolean,
});
export type CryptoDisposal = Wire<typeof CryptoDisposal>;

/** `GET /crypto/gains`: the sales in a year (or ever) and what they had cost. */
export const CryptoGains = Schema.Struct({
  currency: Schema.String,
  disposals: Schema.Array(CryptoDisposal),
  proceeds: Schema.Number,
  cost: Schema.Number,
  gain: Schema.Number,
  /** Sales with coins no purchase backs; their gain is not a finished number. */
  incompleteCount: Schema.Number,
});
export type CryptoGains = Wire<typeof CryptoGains>;

export const ChainFamily = Schema.Literals(['evm', 'tron', 'bitcoin', 'solana']);
export type ChainFamily = Wire<typeof ChainFamily>;

export const CryptoNetwork = Schema.Struct({
  chainId: SupportedChainId,
  name: Schema.String,
  family: ChainFamily,
  nativeAsset: Schema.String,
});
export type CryptoNetwork = Wire<typeof CryptoNetwork>;

/** `GET /crypto/networks`. */
export const CryptoNetworkList = Schema.Array(CryptoNetwork);
export type CryptoNetworkList = Wire<typeof CryptoNetworkList>;
