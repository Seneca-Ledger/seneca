import { createHash } from 'crypto';

export type ChainFamily = 'evm' | 'tron' | 'bitcoin' | 'solana';

interface ChainConfig {
  name: string;
  family: ChainFamily;
  /** Ticker of the chain's own coin, used for fees and plain transfers. */
  nativeAsset: string;
  /** Etherscan-compatible Blockscout API, EVM chains only. */
  explorerUrl?: string;
}

export const ETHEREUM_CHAIN_ID = 1;
export const OPTIMISM_CHAIN_ID = 10;
export const POLYGON_CHAIN_ID = 137;
export const BASE_CHAIN_ID = 8453;
export const ARBITRUM_CHAIN_ID = 42161;
/**
 * Tron is not an EVM chain, but its EVM-compatible JSON-RPC reports this chain id
 * (0x2b6653dc), so it fits the same `chain_id` column without a made-up number.
 */
export const TRON_CHAIN_ID = 728126428;
/**
 * Bitcoin and Solana have no EVM chain id. These are Lumio's own, parked in a range
 * no live EVM chain uses so they can share the `chain_id` column. Never send them
 * to anything that expects a real EVM chain id.
 */
export const BITCOIN_CHAIN_ID = 2_000_000_000;
export const SOLANA_CHAIN_ID = 2_000_000_501;

/**
 * Every chain Lumio syncs and the provider it syncs from (see crypto-sync.service.ts).
 * Adding a chain here is NOT enough on its own: an EVM chain needs its own explorer
 * host, and any other family needs a reader of its own, or the sync would pull
 * another chain's transactions into it.
 */
export const CHAINS: Record<number, ChainConfig> = {
  [ETHEREUM_CHAIN_ID]: {
    name: 'Ethereum',
    family: 'evm',
    nativeAsset: 'ETH',
    explorerUrl: 'https://eth.blockscout.com/api',
  },
  [BASE_CHAIN_ID]: {
    name: 'Base',
    family: 'evm',
    nativeAsset: 'ETH',
    explorerUrl: 'https://base.blockscout.com/api',
  },
  [ARBITRUM_CHAIN_ID]: {
    name: 'Arbitrum',
    family: 'evm',
    nativeAsset: 'ETH',
    explorerUrl: 'https://arbitrum.blockscout.com/api',
  },
  [OPTIMISM_CHAIN_ID]: {
    name: 'Optimism',
    family: 'evm',
    nativeAsset: 'ETH',
    explorerUrl: 'https://optimism.blockscout.com/api',
  },
  [POLYGON_CHAIN_ID]: {
    name: 'Polygon',
    family: 'evm',
    nativeAsset: 'POL',
    explorerUrl: 'https://polygon.blockscout.com/api',
  },
  [TRON_CHAIN_ID]: { name: 'Tron', family: 'tron', nativeAsset: 'TRX' },
  [BITCOIN_CHAIN_ID]: { name: 'Bitcoin', family: 'bitcoin', nativeAsset: 'BTC' },
  [SOLANA_CHAIN_ID]: { name: 'Solana', family: 'solana', nativeAsset: 'SOL' },
};

export const SUPPORTED_CHAIN_IDS = Object.keys(CHAINS).map(Number);

/** EVM chains, ascending by chain id (numeric object keys always iterate that way). */
export const EVM_CHAIN_IDS = SUPPORTED_CHAIN_IDS.filter(id => CHAINS[id].family === 'evm');

export const DEFAULT_CHAIN_ID = ETHEREUM_CHAIN_ID;

export const NATIVE_ASSET_BY_CHAIN: Record<number, string> = Object.fromEntries(
  SUPPORTED_CHAIN_IDS.map(id => [id, CHAINS[id].nativeAsset]),
);

export const CHAIN_NAMES: Record<number, string> = Object.fromEntries(
  SUPPORTED_CHAIN_IDS.map(id => [id, CHAINS[id].name]),
);

/** xpub, ypub or zpub: the account key a Bitcoin wallet exports. */
export const EXTENDED_KEY_PATTERN = /^[xyz]pub[1-9A-HJ-NP-Za-km-z]{95,115}$/;

export const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
/** Base58check, always starting with `T`. Case-sensitive, unlike an EVM address. */
export const TRON_ADDRESS_PATTERN = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
/** Native SegWit / Taproot. Bech32 is case-insensitive but never mixed-case. */
const BITCOIN_BECH32_PATTERN = /^(bc1[02-9ac-hj-np-z]{11,71}|BC1[02-9AC-HJ-NP-Z]{11,71})$/;
/** Legacy (1…) and P2SH (3…), base58check. */
const BITCOIN_BASE58_PATTERN = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/;
const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]+$/;

/**
 * The family an address belongs to, read off its format; null when it is none.
 *
 * Bitcoin's legacy addresses and Solana's are both base58, and a Solana address can
 * start with 1 or 3 too, so shape alone cannot tell them apart. The bytes can: a
 * Bitcoin address decodes to 25 bytes whose last four are a checksum, a Solana
 * address to exactly 32 bytes of public key.
 */
export function familyForAddress(address: string): ChainFamily | null {
  if (EVM_ADDRESS_PATTERN.test(address)) {
    return 'evm';
  }
  // An extended public key is a whole Bitcoin wallet rather than one address.
  if (EXTENDED_KEY_PATTERN.test(address) && hasBase58Checksum(address)) {
    return 'bitcoin';
  }
  if (TRON_ADDRESS_PATTERN.test(address) && hasBase58Checksum(address)) {
    return 'tron';
  }
  if (BITCOIN_BECH32_PATTERN.test(address)) {
    return 'bitcoin';
  }
  if (BITCOIN_BASE58_PATTERN.test(address) && hasBase58Checksum(address)) {
    return 'bitcoin';
  }
  if (BASE58_PATTERN.test(address) && base58Decode(address)?.length === 32) {
    return 'solana';
  }
  return null;
}

/** The chain an address belongs to by default; for EVM that is Ethereum mainnet. */
export function chainIdForAddress(address: string): number | null {
  const family = familyForAddress(address);
  if (family === null) {
    return null;
  }
  if (family === 'evm') {
    return DEFAULT_CHAIN_ID;
  }
  return SUPPORTED_CHAIN_IDS.find(id => CHAINS[id].family === family) ?? null;
}

/**
 * EVM and bech32 addresses are case-insensitive and stored lowercase so the unique
 * constraint catches case variants. Base58 (Tron, Solana, legacy Bitcoin) is
 * case-sensitive: lowercasing it would make a different, invalid address.
 */
export function normalizeAddress(address: string, chainId: number): string {
  const family = CHAINS[chainId]?.family;
  if (family === 'evm' || (family === 'bitcoin' && /^bc1/i.test(address))) {
    return address.toLowerCase();
  }
  return address;
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(value: string): Buffer | null {
  let number = 0n;
  for (const char of value) {
    const digit = BASE58_ALPHABET.indexOf(char);
    if (digit === -1) {
      return null;
    }
    number = number * 58n + BigInt(digit);
  }
  const hex = number === 0n ? '' : number.toString(16);
  const body = Buffer.from(hex.length % 2 ? `0${hex}` : hex, 'hex');
  // Each leading '1' stands for one leading zero byte.
  const zeros = value.match(/^1*/)?.[0].length ?? 0;
  return Buffer.concat([Buffer.alloc(zeros), body]);
}

function hasBase58Checksum(value: string): boolean {
  const bytes = base58Decode(value);
  if (bytes?.length !== 25) {
    return false;
  }
  const payload = bytes.subarray(0, 21);
  const digest = createHash('sha256')
    .update(createHash('sha256').update(payload).digest())
    .digest();
  return digest.subarray(0, 4).equals(bytes.subarray(21));
}

interface PriceableAsset {
  /** Canonical ticker. What we display, and what keys the price cache. */
  ticker: string;
  coingeckoId: string;
  /**
   * Lowercase Ethereum-mainnet contract, absent for the chain's own coin and for
   * assets that live natively on another chain (MATIC, OP). An asset with no
   * contract here can never be matched against a token balance or transfer.
   */
  contract?: string;
}

/**
 * Every asset we can put a price on, and the exact contract that asset lives at.
 *
 * Contract addresses come from CoinGecko's own `platforms.ethereum` field, so the
 * thing we price and the thing we match are the same token by construction.
 */
const PRICEABLE_ASSETS: PriceableAsset[] = [
  { ticker: 'ETH', coingeckoId: 'ethereum' },
  { ticker: 'WETH', coingeckoId: 'weth', contract: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' },
  { ticker: 'USDT', coingeckoId: 'tether', contract: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
  {
    ticker: 'USDC',
    coingeckoId: 'usd-coin',
    contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  },
  { ticker: 'DAI', coingeckoId: 'dai', contract: '0x6b175474e89094c44da98b954eedeac495271d0f' },
  {
    ticker: 'WBTC',
    coingeckoId: 'wrapped-bitcoin',
    contract: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  },
  {
    ticker: 'LINK',
    coingeckoId: 'chainlink',
    contract: '0x514910771af9ca656af840dff83e8264ecf986ca',
  },
  { ticker: 'UNI', coingeckoId: 'uniswap', contract: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' },
  { ticker: 'AAVE', coingeckoId: 'aave', contract: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9' },
  { ticker: 'MATIC', coingeckoId: 'matic-network' },
  {
    ticker: 'ARB',
    coingeckoId: 'arbitrum',
    contract: '0xb50721bcf8d664c30412cfbc6cf7a15145234ad1',
  },
  { ticker: 'OP', coingeckoId: 'optimism' },
  { ticker: 'TRX', coingeckoId: 'tron' },
  { ticker: 'POL', coingeckoId: 'polygon-ecosystem-token' },
  { ticker: 'BTC', coingeckoId: 'bitcoin' },
  { ticker: 'SOL', coingeckoId: 'solana' },
  {
    ticker: 'LDO',
    coingeckoId: 'lido-dao',
    contract: '0x5a98fcbea516cf06857215779fd812ca3bef1b32',
  },
  {
    ticker: 'SHIB',
    coingeckoId: 'shiba-inu',
    contract: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
  },
  { ticker: 'PEPE', coingeckoId: 'pepe', contract: '0x6982508145454ce325ddbe47a25d4ec3d2311933' },
  {
    ticker: 'CRV',
    coingeckoId: 'curve-dao-token',
    contract: '0xd533a949740bb3306d119cc777fa900ba034cd52',
  },
  { ticker: 'MKR', coingeckoId: 'maker', contract: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2' },
  {
    ticker: 'ENS',
    coingeckoId: 'ethereum-name-service',
    contract: '0xc18360217d8f7ab5e7c516566761ea12ce7f9d72',
  },
];

/** CoinGecko ids for the assets we can price. Anything absent prices as null. */
export const COINGECKO_IDS: Record<string, string> = Object.fromEntries(
  PRICEABLE_ASSETS.map(asset => [asset.ticker, asset.coingeckoId]),
);

/**
 * Lowercase contract address to canonical ticker, per chain.
 *
 * This is the spam filter, and it is why a token's own `symbol` is never trusted:
 * anyone can deploy a contract calling itself `USDT`, and pricing it by that name
 * would credit the holder with money they do not have. A contract absent from this
 * table has no price and is ignored — which is also what happens to the homoglyph
 * tickers (`ꓴꓢꓓꓔ`) that airdrop spam likes to use.
 *
 * Addresses are chain-specific: a new chain needs its own block, not a reuse of
 * this one.
 */
export const TICKER_BY_CONTRACT: Record<number, Record<string, string>> = {
  [ETHEREUM_CHAIN_ID]: Object.fromEntries(
    PRICEABLE_ASSETS.filter(asset => asset.contract).map(asset => [asset.contract, asset.ticker]),
  ),
  // L2 contracts come from CoinGecko too: the coin's `platforms` field, or a
  // contract lookup for tokens CoinGecko lists as a coin of their own. Bridged
  // USDT (USDT0 on Arbitrum and Polygon, the canonical bridge's USDT on Base and
  // Optimism) is its own CoinGecko coin but redeems 1:1, so it books as USDT; the
  // same goes for the bridged WBTC on Arbitrum and Polygon.
  [BASE_CHAIN_ID]: {
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC',
    '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2': 'USDT',
    '0x0555e30da8f98308edb960aa94c0db47230d2b9c': 'WBTC',
    '0x88fb150bdc53a65fe94dea0c9ba0a6daf8c6e196': 'LINK',
  },
  [ARBITRUM_CHAIN_ID]: {
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'USDC',
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 'USDT',
    '0x912ce59144191c1204e64559fe8253a0e49e6548': 'ARB',
    '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': 'WBTC',
    '0xf97f4df75117a78c1a5a0dbb814af92458539fb4': 'LINK',
  },
  [OPTIMISM_CHAIN_ID]: {
    '0x0b2c639c533813f4aa9d7837caf62653d097ff85': 'USDC',
    '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58': 'USDT',
    '0x4200000000000000000000000000000000000042': 'OP',
    '0x68f180fcce6836688e9084f035309e29bf0a2095': 'WBTC',
    '0x350a791bfc2c21f9ed5d10980dad2e2638ffa7f6': 'LINK',
  },
  [POLYGON_CHAIN_ID]: {
    '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': 'USDC',
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 'USDT',
    '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6': 'WBTC',
    '0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39': 'LINK',
  },
};

/**
 * TRC-20 tokens we count on Tron, keyed by base58 contract (case-sensitive).
 *
 * The decimals live here rather than being read from the chain because TronGrid's
 * account endpoint reports raw TRC-20 balances with no decimals beside them.
 * Same spam rule as `TICKER_BY_CONTRACT`: a contract absent here is ignored,
 * whatever symbol it gives itself — and fake-USDT address poisoning is rife on Tron.
 */
export const TRON_TOKENS: Record<string, { ticker: string; decimals: number }> = {
  TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t: { ticker: 'USDT', decimals: 6 },
};

/**
 * SPL tokens we count on Solana, keyed by mint (base58, case-sensitive), from
 * CoinGecko's `platforms.solana`. Same spam rule: any other mint is ignored.
 */
export const SOLANA_TOKENS: Record<string, { ticker: string; decimals: number }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { ticker: 'USDC', decimals: 6 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { ticker: 'USDT', decimals: 6 },
};
