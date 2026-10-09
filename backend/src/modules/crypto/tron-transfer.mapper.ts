/**
 * Turns TronGrid rows into the same transfers and balances the Ethereum sync
 * produces, so booking them is shared.
 *
 * Kept free of I/O, like `crypto-transfer.mapper.ts`, so the rules are testable.
 */

import { createHash } from 'crypto';
import type { CryptoWalletBalance as WalletBalance } from '../../entities/crypto-wallet.entity';
import { aggregate, type ChainTransfer, formatUnits, toBigInt } from './crypto-transfer.mapper';

/** TRX has six decimals; one TRX is a million sun. */
const TRX_DECIMALS = 6;

/**
 * Incoming amounts below a hundredth of a unit are dropped. Tron is full of
 * address-poisoning dust — a 1-sun TRX transfer from an address that mimics one
 * the user pays, hoping they copy it from their history. It is worth nothing and
 * booking it would fill the statement with fake counterparties. Outgoing amounts
 * are never dropped: those the user sent themselves.
 */
const DUST_FRACTION_DIGITS = 2;

/** A row from TronGrid's `/v1/accounts/{address}/transactions`. Only the fields we read. */
export interface TronGridTx {
  txID: string;
  block_timestamp: number;
  ret?: { contractRet?: string; fee?: number }[];
  raw_data: {
    contract: {
      type: string;
      parameter: { value: { owner_address?: string; to_address?: string; amount?: number } };
    }[];
  };
}

/** A row from TronGrid's `/v1/accounts/{address}/transactions/trc20`. */
export interface TronGridTrc20Transfer {
  transaction_id: string;
  block_timestamp: number;
  from: string;
  to: string;
  value: string;
  type?: string;
  token_info: { address: string; decimals?: number };
}

/** The part of TronGrid's `/v1/accounts/{address}` we read. */
export interface TronGridAccount {
  /** TRX balance in sun. Absent for an address that has never been activated. */
  balance?: number;
  /** One single-key object per token: `{ [contract]: rawBalance }`. */
  trc20?: Record<string, string>[];
}

export type TronTokenTable = Record<string, { ticker: string; decimals: number }>;

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * TronGrid reports native transfers with hex addresses (`41` + 20 bytes) and TRC-20
 * transfers with base58 ones; everything is compared in base58, the form users see.
 */
export function tronHexToBase58(hex: string): string {
  if (!/^41[0-9a-fA-F]{40}$/.test(hex)) {
    return '';
  }
  const payload = Buffer.from(hex, 'hex');
  const checksum = sha256(sha256(payload)).subarray(0, 4);
  let value = BigInt(`0x${Buffer.concat([payload, checksum]).toString('hex')}`);

  let encoded = '';
  while (value > 0n) {
    encoded = BASE58_ALPHABET[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  return encoded;
}

export function mapTronTransfers(input: {
  address: string;
  /** Every Tron address the workspace watches, used to drop internal moves. */
  ownAddresses: string[];
  tokens: TronTokenTable;
  transactions: TronGridTx[];
  tokenTransfers: TronGridTrc20Transfer[];
}): ChainTransfer[] {
  const me = input.address;
  const own = new Set(input.ownAddresses);
  const transfers: ChainTransfer[] = [];

  for (const tx of input.transactions) {
    const contract = tx.raw_data?.contract?.[0];
    const value = contract?.parameter?.value;
    if (!(contract && value)) {
      continue;
    }
    const from = tronHexToBase58(value.owner_address ?? '');
    const to = tronHexToBase58(value.to_address ?? '');
    const isOutgoing = from === me;
    const timestamp = Math.floor(tx.block_timestamp / 1000);

    // Tron burns TRX for bandwidth and energy instead of charging gas. The sender
    // pays it on every kind of transaction — a USDT transfer's fee sits on its
    // TriggerSmartContract row — and pays it even when the call fails.
    const fee = toBigInt(String(tx.ret?.[0]?.fee ?? 0));
    if (isOutgoing && fee > 0n) {
      transfers.push({
        hash: tx.txID,
        timestamp,
        asset: 'TRX',
        amount: formatUnits(fee, TRX_DECIMALS),
        direction: 'out',
        counterparty: to,
        leg: 'fee',
      });
    }

    // Only a plain TRX transfer moves TRX; resource delegation, votes and contract
    // calls do not. A failed transfer moved nothing but its fee.
    if (contract.type !== 'TransferContract' || tx.ret?.[0]?.contractRet !== 'SUCCESS') {
      continue;
    }
    const amount = toBigInt(String(value.amount ?? 0));
    const counterparty = isOutgoing ? to : from;
    if (amount === 0n || own.has(counterparty) || isDust(amount, TRX_DECIMALS, isOutgoing)) {
      continue;
    }

    transfers.push({
      hash: tx.txID,
      timestamp,
      asset: 'TRX',
      amount: formatUnits(amount, TRX_DECIMALS),
      direction: isOutgoing ? 'out' : 'in',
      counterparty,
    });
  }

  for (const transfer of input.tokenTransfers) {
    // A contract we cannot price is spam; its self-declared symbol is never read.
    const token = input.tokens[transfer.token_info?.address];
    if (!token || (transfer.type && transfer.type !== 'Transfer')) {
      continue;
    }
    const isOutgoing = transfer.from === me;
    const counterparty = isOutgoing ? transfer.to : transfer.from;
    const amount = toBigInt(transfer.value);
    if (amount === 0n || own.has(counterparty) || isDust(amount, token.decimals, isOutgoing)) {
      continue;
    }

    transfers.push({
      hash: transfer.transaction_id,
      timestamp: Math.floor(transfer.block_timestamp / 1000),
      asset: token.ticker,
      amount: formatUnits(amount, token.decimals),
      direction: isOutgoing ? 'out' : 'in',
      counterparty,
    });
  }

  return aggregate(transfers);
}

/** The address's current holdings; tokens outside `tokens` are ignored as spam. */
export function mapTronBalances(input: {
  account: TronGridAccount | null;
  tokens: TronTokenTable;
}): WalletBalance[] {
  const balances: WalletBalance[] = [];
  const native = toBigInt(String(input.account?.balance ?? 0));
  if (native > 0n) {
    balances.push({ asset: 'TRX', amount: formatUnits(native, TRX_DECIMALS) });
  }

  for (const entry of input.account?.trc20 ?? []) {
    for (const [contract, raw] of Object.entries(entry)) {
      const token = input.tokens[contract];
      const value = toBigInt(raw);
      if (token && value > 0n) {
        balances.push({ asset: token.ticker, amount: formatUnits(value, token.decimals) });
      }
    }
  }

  return balances;
}

function isDust(amount: bigint, decimals: number, isOutgoing: boolean): boolean {
  if (isOutgoing || decimals < DUST_FRACTION_DIGITS) {
    return false;
  }
  return amount < 10n ** BigInt(decimals - DUST_FRACTION_DIGITS);
}

function sha256(data: Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}
