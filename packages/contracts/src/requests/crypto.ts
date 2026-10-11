import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

/**
 * The networks a wallet can be read from: Ethereum, Optimism, Polygon, Base,
 * Arbitrum, Tron, and the synthetic ids for Bitcoin and Solana. Mirrors
 * CHAINS in the backend's crypto.constants.
 */
const SupportedChainId = Schema.Literals([
  1, 10, 137, 8453, 42161, 728126428, 2000000000, 2000000501,
]);

/**
 * A coin the user keeps themselves: on an exchange, or in cold storage they would
 * rather not name an address for. One line per ticker; sending the same ticker
 * again replaces the amount rather than adding a second line.
 */
export const ManualHoldingBody = Schema.Struct({
  /** Ticker, e.g. `BTC`. Upper-cased by the service. */
  asset: Schema.String.check(
    Schema.isBetweenLength(2, 20),
    Schema.isPattern(/^[A-Za-z0-9.$]+$/, { message: 'A ticker is letters and digits' }),
  ),
  /** Amount held, as a decimal string: 18-decimal tokens overflow a number. */
  amount: Schema.String.check(
    Schema.isPattern(/^\d+(\.\d{1,18})?$/, { message: 'An amount is a positive decimal' }),
  ),
  /** What one unit cost, in the workspace currency. Omitted when unknown. */
  costPerUnit: Schema.optional(Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))),
  label: Schema.optional(Schema.String.check(Schema.isBetweenLength(1, 100))),
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
  chainId: Schema.optional(SupportedChainId),
  /**
   * Optional: several networks for one EVM address, which is the same address on
   * every EVM chain. One wallet is created per chain.
   */
  chainIds: Schema.optional(
    Schema.Array(SupportedChainId).check(Schema.isMinLength(1), Schema.isMaxLength(8)),
  ),
  label: Schema.optional(Schema.String.check(Schema.isBetweenLength(1, 100))),
});
export type ConnectCryptoWalletBody = Wire<typeof ConnectCryptoWalletBody>;
