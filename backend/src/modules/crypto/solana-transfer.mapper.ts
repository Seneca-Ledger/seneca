/**
 * Turns Solana RPC rows into transfers and balances.
 *
 * A Solana transaction can bundle any number of program calls, so instead of
 * decoding instructions each one is booked by what it did to this address: the
 * change in its SOL balance (which already includes the fee it paid) and the
 * change in each token it holds. Free of I/O, so the rules are testable.
 */

import type { CryptoWalletBalance as WalletBalance } from '../../entities/crypto-wallet.entity';
import { aggregate, type ChainTransfer, formatUnits, toBigInt } from './crypto-transfer.mapper';

const SOL_DECIMALS = 9;

/**
 * Incoming amounts below these are dropped. Address poisoning is as common on
 * Solana as on Tron: tiny transfers from look-alike addresses, hoping the user
 * copies one from their history. Outgoing amounts are never dropped.
 */
const DUST_LAMPORTS = 1_000_000n; // 0.001 SOL
const DUST_TOKEN_FRACTION_DIGITS = 2; // 0.01 of a token

export type SolanaTokenTable = Record<string, { ticker: string; decimals: number }>;

interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
}

/** `getTransaction` with `jsonParsed`, the fields we read. */
export interface SolanaTx {
  blockTime: number | null;
  meta: {
    err: unknown;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: TokenBalance[];
    postTokenBalances?: TokenBalance[];
  } | null;
  transaction: {
    signatures: string[];
    message: { accountKeys: ({ pubkey: string } | string)[] };
  };
}

/** One entry of `getTokenAccountsByOwner` with `jsonParsed`. */
export interface SolanaTokenAccount {
  account: {
    data: { parsed: { info: { mint: string; tokenAmount: { amount: string } } } };
  };
}

export function mapSolanaTransfers(input: {
  address: string;
  /** Every Solana address the workspace watches, used to drop internal moves. */
  ownAddresses: string[];
  tokens: SolanaTokenTable;
  transactions: SolanaTx[];
}): ChainTransfer[] {
  const me = input.address;
  const own = new Set(input.ownAddresses);
  const transfers: ChainTransfer[] = [];

  for (const tx of input.transactions) {
    const meta = tx.meta;
    const hash = tx.transaction?.signatures?.[0];
    if (!(meta && hash && tx.blockTime)) {
      continue;
    }
    const keys = tx.transaction.message.accountKeys.map(key =>
      typeof key === 'string' ? key : key.pubkey,
    );
    const timestamp = tx.blockTime;

    // A failed transaction still charged its fee, and the SOL delta shows exactly that.
    const deltas = keys.map((_, index) =>
      BigInt((meta.postBalances[index] ?? 0) - (meta.preBalances[index] ?? 0)),
    );
    const sol = mapSolDelta(keys, deltas, me, own);
    if (sol) {
      transfers.push({ hash, timestamp, asset: 'SOL', ...sol });
    }

    if (meta.err) {
      continue;
    }
    transfers.push(...mapTokenDeltas(meta, { hash, timestamp, me, own, tokens: input.tokens }));
  }

  return aggregate(transfers);
}

export function mapSolanaBalances(input: {
  lamports: number;
  tokenAccounts: SolanaTokenAccount[];
  tokens: SolanaTokenTable;
}): WalletBalance[] {
  const balances: WalletBalance[] = [];
  if (input.lamports > 0) {
    balances.push({ asset: 'SOL', amount: formatUnits(BigInt(input.lamports), SOL_DECIMALS) });
  }

  const rawByTicker = new Map<string, { raw: bigint; decimals: number }>();
  for (const entry of input.tokenAccounts) {
    const info = entry.account?.data?.parsed?.info;
    const token = info && input.tokens[info.mint];
    if (!token) {
      continue;
    }
    // A wallet can hold several accounts of the same mint; they add up.
    const current = rawByTicker.get(token.ticker)?.raw ?? 0n;
    rawByTicker.set(token.ticker, {
      raw: current + toBigInt(info.tokenAmount.amount),
      decimals: token.decimals,
    });
  }
  for (const [ticker, { raw, decimals }] of rawByTicker) {
    if (raw > 0n) {
      balances.push({ asset: ticker, amount: formatUnits(raw, decimals) });
    }
  }
  return balances;
}

/** Token balance changes of accounts owned by `me`, one transfer per mint. */
function mapTokenDeltas(
  meta: NonNullable<SolanaTx['meta']>,
  context: {
    hash: string;
    timestamp: number;
    me: string;
    own: Set<string>;
    tokens: SolanaTokenTable;
  },
): ChainTransfer[] {
  const deltaByOwnerMint = new Map<string, bigint>();
  const add = (entries: TokenBalance[] | undefined, sign: bigint): void => {
    for (const entry of entries ?? []) {
      const key = `${entry.owner ?? ''}|${entry.mint}`;
      deltaByOwnerMint.set(
        key,
        (deltaByOwnerMint.get(key) ?? 0n) + sign * toBigInt(entry.uiTokenAmount.amount),
      );
    }
  };
  add(meta.preTokenBalances, -1n);
  add(meta.postTokenBalances, 1n);

  const transfers: ChainTransfer[] = [];
  for (const [key, delta] of deltaByOwnerMint) {
    const [owner, mint] = key.split('|');
    const token = context.tokens[mint];
    if (owner !== context.me || !token || delta === 0n) {
      continue;
    }
    const isOutgoing = delta < 0n;
    const amount = isOutgoing ? -delta : delta;
    // The counterparty is the other owner whose balance of this mint moved the other way.
    let counterparty = '';
    for (const [otherKey, otherDelta] of deltaByOwnerMint) {
      const [otherOwner, otherMint] = otherKey.split('|');
      if (otherMint === mint && otherOwner !== context.me && otherDelta < 0n !== isOutgoing) {
        counterparty = otherOwner;
        break;
      }
    }
    if (counterparty && context.own.has(counterparty)) {
      continue;
    }
    const dust = 10n ** BigInt(Math.max(token.decimals - DUST_TOKEN_FRACTION_DIGITS, 0));
    if (!isOutgoing && amount < dust) {
      continue;
    }
    transfers.push({
      hash: context.hash,
      timestamp: context.timestamp,
      asset: token.ticker,
      amount: formatUnits(amount, token.decimals),
      direction: isOutgoing ? 'out' : 'in',
      counterparty,
    });
  }
  return transfers;
}

/**
 * What the SOL balance change of `me` books as, or null for nothing. A move to
 * another of the workspace's addresses books only the fee it cost; the receiving
 * side books nothing.
 */
function mapSolDelta(
  keys: string[],
  deltas: bigint[],
  me: string,
  own: Set<string>,
): Pick<ChainTransfer, 'amount' | 'direction' | 'counterparty'> | null {
  const mine = keys.indexOf(me);
  const delta = mine === -1 ? 0n : deltas[mine];
  if (delta === 0n) {
    return null;
  }
  const isOutgoing = delta < 0n;
  // The counterparty is whoever moved the other way the most.
  const counterparty = largestOpposite(keys, deltas, me, isOutgoing);
  let amount = isOutgoing ? -delta : delta;

  if (counterparty !== '' && own.has(counterparty)) {
    if (!isOutgoing) {
      return null;
    }
    amount -= deltas[keys.indexOf(counterparty)];
  }
  if (amount <= 0n || (!isOutgoing && amount < DUST_LAMPORTS)) {
    return null;
  }
  return {
    amount: formatUnits(amount, SOL_DECIMALS),
    direction: isOutgoing ? 'out' : 'in',
    counterparty,
  };
}

function largestOpposite(
  keys: string[],
  deltas: bigint[],
  me: string,
  isOutgoing: boolean,
): string {
  let best = '';
  let bestSize = 0n;
  keys.forEach((key, index) => {
    const delta = deltas[index];
    const opposite = isOutgoing ? delta > 0n : delta < 0n;
    const size = delta < 0n ? -delta : delta;
    if (key !== me && opposite && size > bestSize) {
      best = key;
      bestSize = size;
    }
  });
  return best;
}
