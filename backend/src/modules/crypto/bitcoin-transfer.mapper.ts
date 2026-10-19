/**
 * Turns mempool.space rows for a Bitcoin wallet into transfers and a balance.
 *
 * Bitcoin has no "from" and "to": a transaction spends outputs and creates new
 * ones, and a payment usually sends change back to the payer. So each transaction
 * is booked by what it did to the wallet — the sum its addresses received minus
 * the sum they spent. A payment with change books the amount that left plus the
 * fee, which is exactly how much the balance fell.
 *
 * A wallet is a set of addresses, not one: an extended key hands out a fresh
 * address per payment and sends the change to another, so a move between two of
 * its own addresses is not a payment at all. Free of I/O, so the rules are testable.
 */

import { aggregate, type ChainTransfer, formatUnits } from './crypto-transfer.mapper';

const BTC_DECIMALS = 8;

/**
 * Incoming amounts up to this many satoshi are dropped: 546 sat is the smallest
 * output the network relays, and "dust attacks" send exactly such outputs to many
 * addresses to trace who spends them together. They are not income.
 */
const DUST_SATS = 1_000;

/** A row from mempool.space `/api/address/{address}/txs/chain`. Only the fields we read. */
export interface MempoolTx {
  txid: string;
  status: { confirmed: boolean; block_time?: number };
  vin: { prevout?: { scriptpubkey_address?: string; value: number } | null }[];
  vout: { scriptpubkey_address?: string; value: number }[];
}

/** The part of mempool.space `/api/address/{address}` we read. */
export interface MempoolAddress {
  chain_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count?: number };
}

export function mapBitcoinTransfers(input: {
  /** Every address of this wallet: one, or all the ones an extended key derives. */
  addresses: string[];
  /** Every Bitcoin address the workspace watches, used to drop internal moves. */
  ownAddresses: string[];
  transactions: MempoolTx[];
}): ChainTransfer[] {
  const mine = new Set(input.addresses);
  const own = new Set(input.ownAddresses);
  const transfers: ChainTransfer[] = [];

  for (const tx of input.transactions) {
    // Unconfirmed transactions can still be replaced or dropped.
    if (!(tx.status?.confirmed && tx.status.block_time)) {
      continue;
    }

    const spent = sum(tx.vin.map(input => input.prevout).filter(isMine(mine)));
    const received = sum(tx.vout.filter(isMine(mine)));
    const net = received - spent;
    if (net === 0) {
      continue;
    }

    const isOutgoing = net < 0;
    // Change comes back to the wallet, so the other side is the first address the
    // transaction touches that the wallet does not own.
    const counterparty = isOutgoing
      ? tx.vout.find(
          output => output.scriptpubkey_address && !mine.has(output.scriptpubkey_address),
        )?.scriptpubkey_address
      : tx.vin.find(
          input =>
            input.prevout?.scriptpubkey_address && !mine.has(input.prevout.scriptpubkey_address),
        )?.prevout?.scriptpubkey_address;

    // A move between two of the workspace's own addresses changes neither's owner.
    // Its fee is still a cost, and it is what is left of the outgoing side here.
    if (counterparty && own.has(counterparty) && !mine.has(counterparty)) {
      const toOwn = sum(tx.vout.filter(isMine(new Set([counterparty]))));
      const fee = -net - toOwn;
      if (isOutgoing && fee > 0) {
        transfers.push(transfer(tx, fee, 'out', counterparty));
      }
      continue;
    }

    if (!isOutgoing && net <= DUST_SATS) {
      continue;
    }

    transfers.push(transfer(tx, Math.abs(net), isOutgoing ? 'out' : 'in', counterparty ?? ''));
  }

  return aggregate(transfers);
}

/** The wallet's balance: what every one of its addresses still holds. */
export function mapBitcoinBalance(
  accounts: MempoolAddress | (MempoolAddress | null)[] | null,
): { asset: string; amount: string }[] {
  const rows = Array.isArray(accounts) ? accounts : [accounts];
  const sats = rows.reduce((total, account) => {
    const stats = account?.chain_stats;
    return total + ((stats?.funded_txo_sum ?? 0) - (stats?.spent_txo_sum ?? 0));
  }, 0);
  return sats > 0 ? [{ asset: 'BTC', amount: formatUnits(BigInt(sats), BTC_DECIMALS) }] : [];
}

function transfer(
  tx: MempoolTx,
  sats: number,
  direction: 'in' | 'out',
  counterparty: string,
): ChainTransfer {
  return {
    hash: tx.txid,
    timestamp: tx.status.block_time as number,
    asset: 'BTC',
    amount: formatUnits(BigInt(sats), BTC_DECIMALS),
    direction,
    counterparty,
  };
}

function isMine(addresses: Set<string>) {
  return (
    output: { scriptpubkey_address?: string; value: number } | null | undefined,
  ): output is { scriptpubkey_address?: string; value: number } =>
    Boolean(output?.scriptpubkey_address && addresses.has(output.scriptpubkey_address));
}

function sum(outputs: { value: number }[]): number {
  return outputs.reduce((total, output) => total + output.value, 0);
}
