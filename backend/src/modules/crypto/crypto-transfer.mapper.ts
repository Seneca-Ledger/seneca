/**
 * Turns raw block-explorer rows into the transfers we actually book.
 *
 * Kept free of I/O so the rules that decide what counts as income, what counts
 * as an expense, and what counts as nothing at all can be tested directly.
 */

import type { CryptoWalletBalance as WalletBalance } from '../../entities/crypto-wallet.entity';

/** A row from Etherscan's `txlist` action. Only the fields we read are declared. */
export interface EtherscanTx {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  isError?: string;
}

/** A row from Etherscan's `tokentx` action (ERC-20 transfers). */
export interface EtherscanTokenTx {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenDecimal: string;
}

/** A row from Etherscan's `tokenlist` action — the address's current token balances. */
export interface EtherscanTokenBalance {
  balance: string;
  contractAddress: string;
  decimals: string;
  type: string;
}

export interface ChainTransfer {
  hash: string;
  /** Seconds since epoch, as the explorer reports it. */
  timestamp: number;
  asset: string;
  /** Native amount as a positive decimal string, e.g. `0.184`. */
  amount: string;
  direction: 'in' | 'out';
  /** The other address, lowercase. Empty for contract creation. */
  counterparty: string;
  /**
   * `value` is money that moved, `fee` is what the chain charged for moving it.
   * They are kept apart so a transfer's amount is the amount the user sent, not
   * the amount plus gas — cost basis counts the former.
   */
  leg?: TransferLegKind;
  /** The transaction's fee, folded onto this value leg; same asset as `asset` is not implied. */
  fee?: { asset: string; amount: string };
  /**
   * Set when the same transaction moved value both ways: a swap. Both legs carry
   * it, and neither is income or spending — only a change of what is held.
   */
  isTrade?: boolean;
}

export type TransferLegKind = 'value' | 'fee';

export interface MapTransfersInput {
  address: string;
  nativeAsset: string;
  /** Every address the workspace watches, used to drop internal moves. */
  ownAddresses: string[];
  /** Lowercase contract address to canonical ticker; see `TICKER_BY_CONTRACT`. */
  tickerByContract: Record<string, string>;
  transactions: EtherscanTx[];
  tokenTransfers: EtherscanTokenTx[];
}

/**
 * Money moving between two wallets the same workspace owns is not income and not
 * an expense — booking both legs would inflate every total on the dashboard.
 * The gas such a move burns is a genuine expense and is still booked, as a fee
 * leg `finalizeTransfers` later folds onto the transfer it paid for.
 */
export function mapChainTransfers(input: MapTransfersInput): ChainTransfer[] {
  const me = input.address.toLowerCase();
  const own = new Set(input.ownAddresses.map(address => address.toLowerCase()));
  const transfers: ChainTransfer[] = [];

  for (const tx of input.transactions) {
    const from = tx.from.toLowerCase();
    const to = (tx.to ?? '').toLowerCase();
    const isOutgoing = from === me;

    // Gas is paid by the sender even when the transaction reverts.
    if (isOutgoing) {
      const gas = toBigInt(tx.gasUsed) * toBigInt(tx.gasPrice);
      if (gas > 0n) {
        transfers.push({
          hash: tx.hash,
          timestamp: Number(tx.timeStamp),
          asset: input.nativeAsset,
          amount: formatUnits(gas, 18),
          direction: 'out',
          counterparty: to,
          leg: 'fee',
        });
      }
    }

    // A reverted transaction moved no value, only gas.
    if (tx.isError === '1') {
      continue;
    }

    const value = toBigInt(tx.value);
    if (value === 0n) {
      continue;
    }

    const counterparty = isOutgoing ? to : from;
    if (own.has(counterparty)) {
      continue;
    }

    transfers.push({
      hash: tx.hash,
      timestamp: Number(tx.timeStamp),
      asset: input.nativeAsset,
      amount: formatUnits(value, 18),
      direction: isOutgoing ? 'out' : 'in',
      counterparty,
    });
  }

  for (const transfer of input.tokenTransfers) {
    const from = transfer.from.toLowerCase();
    const to = transfer.to.toLowerCase();
    const isOutgoing = from === me;
    const counterparty = isOutgoing ? to : from;
    if (own.has(counterparty)) {
      continue;
    }

    // A contract we cannot price is spam as far as the ledger is concerned, and
    // its self-declared symbol is worth nothing — resolve the ticker by address.
    const asset = input.tickerByContract[transfer.contractAddress?.toLowerCase()];
    const value = toBigInt(transfer.value);
    if (!asset || value === 0n) {
      continue;
    }

    transfers.push({
      hash: transfer.hash,
      timestamp: Number(transfer.timeStamp),
      asset,
      amount: formatUnits(value, Number(transfer.tokenDecimal) || 0),
      direction: isOutgoing ? 'out' : 'in',
      counterparty,
    });
  }

  return aggregate(transfers);
}

/**
 * Turns the chain's reported balances into the holdings we show.
 *
 * A token counts only when its contract is one we can price. That rejects the two
 * things a `tokenlist` is full of: airdropped spam, and impostors that borrow a
 * real ticker — the token's own `symbol` is never consulted, so a contract calling
 * itself `USDT` cannot be added to the real USDT balance.
 *
 * NFTs (`ERC-721`, `ERC-1155`) are left out too: their balance counts tokens, not
 * money, and pricing that by ticker would be nonsense.
 */
export function mapWalletBalances(input: {
  nativeAsset: string;
  /** Native balance in wei, as the explorer reports it. */
  nativeBalance: string;
  /** Lowercase contract address to canonical ticker; see `TICKER_BY_CONTRACT`. */
  tickerByContract: Record<string, string>;
  tokens: EtherscanTokenBalance[];
}): WalletBalance[] {
  const balances: WalletBalance[] = [];

  const native = toBigInt(input.nativeBalance);
  if (native > 0n) {
    balances.push({ asset: input.nativeAsset.toUpperCase(), amount: formatUnits(native, 18) });
  }

  const amountByTicker = new Map<string, string>();

  for (const token of input.tokens) {
    if (token.type && token.type.toUpperCase() !== 'ERC-20') {
      continue;
    }

    const ticker = input.tickerByContract[token.contractAddress?.toLowerCase()];
    const value = toBigInt(token.balance);
    if (!ticker || value === 0n) {
      continue;
    }

    const amount = formatUnits(value, Number(token.decimals) || 0);
    amountByTicker.set(ticker, addDecimals(amountByTicker.get(ticker) ?? '0', amount));
  }

  for (const [ticker, amount] of amountByTicker) {
    balances.push({ asset: ticker, amount });
  }

  return balances;
}

/**
 * One on-chain transaction can move the same asset the same way more than once —
 * a batch payout, for instance. The database holds one row per
 * (hash, asset, direction, leg), so those parts are summed here rather than dropped
 * by the unique index later. Fee legs are summed on their own: gas is not part of
 * the amount that was sent.
 */
export function aggregate(transfers: ChainTransfer[]): ChainTransfer[] {
  const merged = new Map<string, ChainTransfer>();

  for (const transfer of transfers) {
    const key = `${transfer.hash}:${transfer.asset}:${transfer.direction}:${transfer.leg ?? 'value'}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...transfer });
      continue;
    }
    existing.amount = addDecimals(existing.amount, transfer.amount);
    // Gas and value share a counterparty; keep the first non-empty one.
    existing.counterparty = existing.counterparty || transfer.counterparty;
  }

  return [...merged.values()].sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * The last pass before transfers are booked, shared by every chain.
 *
 * Two things happen here. A transaction that moved value both in and out is a
 * swap: both legs are marked, and the caller books them as a pair rather than as
 * income and spending — selling one coin for another is neither. And a fee leg is
 * folded onto the outgoing value leg it paid for, so an ordinary send is one row
 * ("sent 0.5 ETH, fee 0.0012") instead of two. A swap keeps its fee separate:
 * the swap itself nets out, the fee is money genuinely gone.
 *
 * Chains that report no fee leg of their own (Bitcoin, Solana) are untouched —
 * there the fee is already inside the balance delta the chain reports.
 */
export function finalizeTransfers(transfers: ChainTransfer[]): ChainTransfer[] {
  const byHash = new Map<string, ChainTransfer[]>();
  for (const transfer of transfers) {
    const group = byHash.get(transfer.hash);
    if (group) {
      group.push(transfer);
    } else {
      byHash.set(transfer.hash, [transfer]);
    }
  }

  const result: ChainTransfer[] = [];
  for (const group of byHash.values()) {
    const values = group.filter(transfer => (transfer.leg ?? 'value') === 'value');
    const fees = group.filter(transfer => transfer.leg === 'fee');
    const isTrade =
      values.some(transfer => transfer.direction === 'in') &&
      values.some(transfer => transfer.direction === 'out');

    const outgoing = values.filter(transfer => transfer.direction === 'out');
    const foldable = !isTrade && outgoing.length === 1 && fees.length > 0;

    for (const transfer of values) {
      result.push({
        ...transfer,
        leg: 'value',
        ...(isTrade ? { isTrade: true } : {}),
        ...(foldable && transfer === outgoing[0]
          ? {
              fee: {
                asset: fees[0].asset,
                amount: fees.reduce((sum, f) => addDecimals(sum, f.amount), '0'),
              },
            }
          : {}),
      });
    }

    if (!foldable) {
      for (const fee of fees) {
        result.push({ ...fee, leg: 'fee' });
      }
    }
  }

  return result.sort((a, b) => a.timestamp - b.timestamp);
}

export function toBigInt(value: string | undefined): bigint {
  if (!value) {
    return 0n;
  }
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

/** Integer-safe formatting: token amounts overflow `number` long before 18 decimals. */
export function formatUnits(value: bigint, decimals: number): string {
  if (decimals <= 0) {
    return value.toString();
  }
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, -decimals);
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  const formatted = fraction ? `${whole}.${fraction}` : whole;
  return negative ? `-${formatted}` : formatted;
}

/** Adds two decimal strings without going through binary floating point. */
export function addDecimals(a: string, b: string): string {
  const scale = Math.max(fractionLength(a), fractionLength(b));
  const sum = toScaledBigInt(a, scale) + toScaledBigInt(b, scale);
  return formatUnits(sum, scale);
}

function fractionLength(value: string): number {
  const dot = value.indexOf('.');
  return dot === -1 ? 0 : value.length - dot - 1;
}

function toScaledBigInt(value: string, scale: number): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(`${whole}${fraction.padEnd(scale, '0')}`);
}
