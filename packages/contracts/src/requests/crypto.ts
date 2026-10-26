import * as Schema from 'effect/Schema';
import { NumericInput, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

const Uuid = Schema.String.check(Schema.isUUID());
const PositiveInt = NumericInput.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1));
const Ticker = Schema.String.check(
  Schema.isBetweenLength(2, 20),
  Schema.isPattern(/^[A-Za-z0-9.$]+$/, { message: 'A ticker is letters and digits' }),
);

/**
 * The networks a wallet can be read from: Ethereum, Optimism, Polygon, Base,
 * Arbitrum, Tron, and the synthetic ids for Bitcoin and Solana. Mirrors
 * CHAINS in the backend's crypto.constants; a spec holds them equal.
 */
export const SupportedChainId = Schema.Literals([
  1, 10, 137, 8453, 42161, 728126428, 2000000000, 2000000501,
]);
export type SupportedChainId = Wire<typeof SupportedChainId>;

/**
 * A coin the user keeps themselves: on an exchange, or in cold storage they would
 * rather not name an address for. One line per ticker; sending the same ticker
 * again replaces the amount rather than adding a second line.
 */
export const ManualHoldingBody = Schema.Struct({
  /** Ticker, e.g. `BTC`. Upper-cased by the service. */
  asset: Ticker,
  /** Amount held, as a decimal string: 18-decimal tokens overflow a number. */
  amount: Schema.String.check(
    Schema.isPattern(/^\d+(\.\d{1,18})?$/, { message: 'An amount is a positive decimal' }),
  ),
  /** What one unit cost, in the workspace currency. Omitted when unknown. */
  costPerUnit: optionalNullable(Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))),
  label: optionalNullable(Schema.String.check(Schema.isBetweenLength(1, 100))),
});
export type ManualHoldingBody = Wire<typeof ManualHoldingBody>;

export const ConnectCryptoWalletBody = Schema.Struct({
  /**
   * A public address — EVM (`0x…`), Tron (`T…`), Bitcoin or Solana — or a Bitcoin
   * extended public key (`xpub…`, 111 characters), which stands for every address
   * that wallet uses. The format is checked in the service, where the network is
   * read off it.
   */
  address: Schema.String.check(Schema.isBetweenLength(26, 120)),
  /** Optional: one network. Read off the address format when both fields are absent. */
  chainId: optionalNullable(SupportedChainId),
  /**
   * Optional: several networks for one EVM address, which is the same address on
   * every EVM chain. One wallet is created per chain.
   */
  chainIds: optionalNullable(
    Schema.Array(SupportedChainId).check(Schema.isMinLength(1), Schema.isMaxLength(8)),
  ),
  label: optionalNullable(Schema.String.check(Schema.isBetweenLength(1, 100))),
});
export type ConnectCryptoWalletBody = Wire<typeof ConnectCryptoWalletBody>;

export const CryptoWalletParams = Schema.Struct({ id: Uuid });
export type CryptoWalletParams = Wire<typeof CryptoWalletParams>;

/** `DELETE /crypto/holdings/:asset`: the ticker of a manual holding. */
export const CryptoHoldingParams = Schema.Struct({ asset: Ticker });
export type CryptoHoldingParams = Wire<typeof CryptoHoldingParams>;

/** `GET /crypto/icon/:asset`: any text; the icons service tells a bad ticker (CRYPTO_TICKER_INVALID). */
export const CryptoIconParams = Schema.Struct({ asset: Schema.String });
export type CryptoIconParams = Wire<typeof CryptoIconParams>;

/** `GET /crypto/summary`: a rolling window of `days` (capped at 365, default 30), or one month. */
export const CryptoSummaryQuery = Schema.Struct({
  days: Schema.optional(PositiveInt),
  month: Schema.optional(
    Schema.String.check(
      Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' }),
    ),
  ),
});
export type CryptoSummaryQuery = Wire<typeof CryptoSummaryQuery>;

/** `GET /crypto/transactions`: the latest `limit` (capped at 100, default 20). */
export const CryptoTransactionsQuery = Schema.Struct({ limit: Schema.optional(PositiveInt) });
export type CryptoTransactionsQuery = Wire<typeof CryptoTransactionsQuery>;

/** `GET /crypto/history`: the last `days` (capped at 1825, default 90). */
export const CryptoHistoryQuery = Schema.Struct({ days: Schema.optional(PositiveInt) });
export type CryptoHistoryQuery = Wire<typeof CryptoHistoryQuery>;

/** `GET /crypto/gains` and `/gains/by-owner`: one tax year, or the whole history without it. */
export const CryptoGainsQuery = Schema.Struct({
  year: Schema.optional(
    NumericInput.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(2009),
      Schema.isLessThanOrEqualTo(2100),
    ),
  ),
});
export type CryptoGainsQuery = Wire<typeof CryptoGainsQuery>;
