/**
 * Read-only access to the wallets installed in the browser.
 *
 * A wallet library (wagmi, RainbowKit, WalletConnect) would buy session handling
 * and signing we do not need: all we ever ask a wallet for is the public address
 * it is already willing to announce. No signing, no private key, no transaction
 * ever leaves this file.
 *
 * EVM wallets are found through EIP-6963 announcements, so several of them can
 * sit side by side without fighting over `window.ethereum`. Solana and Tron
 * wallets have no such standard and are read off their own globals.
 */

import { useEffect, useState } from 'react';
import { type WalletIconId, walletIconSrc } from './wallet-icons';

export type BrowserWalletFamily = 'evm' | 'solana' | 'tron';

export interface BrowserWallet {
  id: string;
  name: string;
  family: BrowserWalletFamily;
  /** Image URL: a bundled mark, or the icon an unknown EVM wallet announced itself with. */
  icon: string;
  installed: boolean;
  installUrl?: string;
  /** Opens the wallet's account prompt and resolves to the chosen public address. */
  connect: () => Promise<string>;
}

export class WalletUnavailableError extends Error {
  constructor() {
    super('Browser wallet not detected');
    this.name = 'WalletUnavailableError';
  }
}

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  isMetaMask?: boolean;
}

interface Eip6963Detail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
}

interface SolanaProvider {
  connect(): Promise<unknown>;
  publicKey?: { toString(): string } | null;
}

interface TronLinkProvider {
  request(args: { method: string }): Promise<unknown>;
  tronWeb?: { defaultAddress?: { base58?: string | false } };
}

type WalletGlobals = {
  ethereum?: Eip1193Provider;
  phantom?: { solana?: SolanaProvider };
  solflare?: SolanaProvider;
  tronLink?: TronLinkProvider;
};

type CatalogEntry = {
  id: WalletIconId;
  name: string;
  family: BrowserWalletFamily;
  installUrl: string;
  /** EIP-6963 reverse-DNS id, for EVM wallets. */
  rdns?: string;
};

/** Wallets offered even when missing, so the user sees what can be connected. */
const CATALOG: CatalogEntry[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    family: 'evm',
    rdns: 'io.metamask',
    installUrl: 'https://metamask.io/download/',
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    family: 'evm',
    rdns: 'com.coinbase.wallet',
    installUrl: 'https://www.coinbase.com/wallet/downloads',
  },
  {
    id: 'rabby',
    name: 'Rabby',
    family: 'evm',
    rdns: 'io.rabby',
    installUrl: 'https://rabby.io/',
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    family: 'evm',
    rdns: 'com.trustwallet.app',
    installUrl: 'https://trustwallet.com/download',
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    family: 'evm',
    rdns: 'com.okex.wallet',
    installUrl: 'https://www.okx.com/web3',
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    family: 'evm',
    rdns: 'me.rainbow',
    installUrl: 'https://rainbow.me/download',
  },
  { id: 'phantom', name: 'Phantom', family: 'solana', installUrl: 'https://phantom.com/download' },
  {
    id: 'solflare',
    name: 'Solflare',
    family: 'solana',
    installUrl: 'https://solflare.com/download',
  },
  { id: 'tronlink', name: 'TronLink', family: 'tron', installUrl: 'https://www.tronlink.org/' },
];

/**
 * Phantom also announces an EVM provider. It is offered as a Solana wallet, which
 * is the address its users hold funds on, so the EVM announcement is not listed twice.
 */
const HIDDEN_RDNS = new Set(['app.phantom']);

function walletGlobals(): WalletGlobals {
  return typeof window === 'undefined' ? {} : (window as unknown as WalletGlobals);
}

async function requestEvmAddress(provider: Eip1193Provider): Promise<string> {
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as unknown;
  const address = Array.isArray(accounts) ? accounts[0] : undefined;
  if (typeof address !== 'string' || !address) {
    throw new Error('Wallet returned no account');
  }
  return address.toLowerCase();
}

async function requestSolanaAddress(provider: SolanaProvider | undefined): Promise<string> {
  if (!provider) {
    throw new WalletUnavailableError();
  }
  // Phantom resolves with `{ publicKey }`, Solflare with a boolean; both set `publicKey`.
  const result = (await provider.connect()) as { publicKey?: { toString(): string } } | undefined;
  const address = (result?.publicKey ?? provider.publicKey)?.toString();
  if (!address) {
    throw new Error('Wallet returned no account');
  }
  return address;
}

async function requestTronAddress(provider: TronLinkProvider | undefined): Promise<string> {
  if (!provider) {
    throw new WalletUnavailableError();
  }
  await provider.request({ method: 'tron_requestAccounts' });
  const address = provider.tronWeb?.defaultAddress?.base58;
  if (typeof address !== 'string' || !address) {
    throw new Error('Wallet returned no account');
  }
  return address;
}

function solanaProvider(id: WalletIconId): SolanaProvider | undefined {
  const globals = walletGlobals();
  return id === 'phantom' ? globals.phantom?.solana : globals.solflare;
}

function catalogProvider(
  entry: CatalogEntry,
  announced: Map<string, Eip6963Detail>,
): Pick<BrowserWallet, 'installed' | 'connect'> {
  const globals = walletGlobals();
  if (entry.family === 'solana') {
    return {
      installed: solanaProvider(entry.id) !== undefined,
      connect: () => requestSolanaAddress(solanaProvider(entry.id)),
    };
  }
  if (entry.family === 'tron') {
    return {
      installed: globals.tronLink !== undefined,
      connect: () => requestTronAddress(walletGlobals().tronLink),
    };
  }
  // A MetaMask too old for EIP-6963 still sits on `window.ethereum`.
  const legacyMetaMask =
    entry.id === 'metamask' && globals.ethereum?.isMetaMask ? globals.ethereum : undefined;
  const provider = (entry.rdns && announced.get(entry.rdns)?.provider) || legacyMetaMask;
  return {
    installed: provider !== undefined,
    connect: () =>
      provider ? requestEvmAddress(provider) : Promise.reject(new WalletUnavailableError()),
  };
}

function buildWallets(announced: Eip6963Detail[]): BrowserWallet[] {
  const byRdns = new Map(announced.map(detail => [detail.info.rdns, detail]));
  const known: BrowserWallet[] = CATALOG.map(entry => ({
    id: entry.id,
    name: entry.name,
    family: entry.family,
    icon: walletIconSrc(entry.id),
    installUrl: entry.installUrl,
    ...catalogProvider(entry, byRdns),
  }));

  const knownRdns = new Set(CATALOG.map(entry => entry.rdns));
  const others: BrowserWallet[] = announced
    .filter(detail => !(knownRdns.has(detail.info.rdns) || HIDDEN_RDNS.has(detail.info.rdns)))
    .map(detail => ({
      id: detail.info.uuid,
      name: detail.info.name,
      family: 'evm',
      icon: detail.info.icon,
      installed: true,
      connect: () => requestEvmAddress(detail.provider),
    }));

  // Installed wallets first; the order within each group stays as listed.
  return [...known, ...others].sort((a, b) => Number(b.installed) - Number(a.installed));
}

/** Every wallet the drawer offers, installed or not, updated as EVM wallets announce themselves. */
export function useBrowserWallets(): BrowserWallet[] {
  // Filled after mount: the server cannot see the extensions, and a first client
  // render that did would not match the server HTML.
  const [wallets, setWallets] = useState<BrowserWallet[]>([]);

  useEffect(() => {
    const announced: Eip6963Detail[] = [];
    const onAnnounce = (event: Event): void => {
      const detail = (event as CustomEvent<Eip6963Detail>).detail;
      if (!detail?.info?.rdns || announced.some(item => item.info.uuid === detail.info.uuid)) {
        return;
      }
      announced.push(detail);
      setWallets(buildWallets(announced));
    };
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    setWallets(buildWallets(announced));
    return () => window.removeEventListener('eip6963:announceProvider', onAnnounce);
  }, []);

  return wallets;
}
