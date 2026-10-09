// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addressFamily, type CryptoNetwork } from '../hooks/useCrypto';
import { ConnectWalletDrawer } from './ConnectWalletDrawer';

vi.mock('@/app/components/ui/drawer-shell', () => ({
  DrawerShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const NETWORKS: CryptoNetwork[] = [
  { chainId: 1, name: 'Ethereum', family: 'evm', nativeAsset: 'ETH' },
  { chainId: 8453, name: 'Base', family: 'evm', nativeAsset: 'ETH' },
  { chainId: 137, name: 'Polygon', family: 'evm', nativeAsset: 'POL' },
  { chainId: 2_000_000_000, name: 'Bitcoin', family: 'bitcoin', nativeAsset: 'BTC' },
];

const LABELS = {
  title: 'Connect wallet',
  walletsLabel: 'Browser wallet',
  install: 'Install',
  manualHint: 'or paste',
  addressLabel: 'Address',
  nameLabel: 'Name',
  invalidAddress: 'Invalid address',
  networksHint: 'hint',
  networksLabel: 'Networks',
  networkDetected: 'Network:',
  noNetworkSelected: 'Tick at least one network',
  noWallet: 'No wallet',
  readOnly: 'Read-only',
  connect: 'Connect',
  cancel: 'Cancel',
};

function renderDrawer() {
  const onSubmit = vi.fn(async () => true);
  render(
    <ConnectWalletDrawer
      open
      saving={false}
      serverError={null}
      labels={LABELS}
      networks={NETWORKS}
      onClose={() => undefined}
      onSubmit={onSubmit}
    />,
  );
  const type = (value: string) =>
    fireEvent.change(screen.getByLabelText('Address'), { target: { value } });
  const connect = () => fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  return { onSubmit, type, connect };
}

describe('ConnectWalletDrawer', () => {
  it('offers every EVM network for a 0x address and sends the ticked ones', async () => {
    const { onSubmit, type, connect } = renderDrawer();
    type('0x899cd926a9028afe9056e76cc01f32ee859e7a65');

    fireEvent.click(screen.getByLabelText('Base'));
    connect();

    await vi.waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        '0x899cd926a9028afe9056e76cc01f32ee859e7a65',
        '',
        [1, 137],
      ),
    );
    expect(screen.queryByLabelText('Bitcoin')).toBeNull();
  });

  it('refuses a 0x address with every network unticked', () => {
    const { onSubmit, type, connect } = renderDrawer();
    type('0x899cd926a9028afe9056e76cc01f32ee859e7a65');
    for (const name of ['Ethereum', 'Base', 'Polygon']) {
      fireEvent.click(screen.getByLabelText(name));
    }

    connect();

    expect(screen.getByText('Tick at least one network')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the detected network for a Bitcoin address and sends no chain list', async () => {
    const { onSubmit, type, connect } = renderDrawer();
    type('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');

    expect(screen.getByText('Bitcoin')).toBeTruthy();
    expect(screen.queryByLabelText('Ethereum')).toBeNull();
    connect();

    await vi.waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        '',
        undefined,
      ),
    );
  });
});

describe('ConnectWalletDrawer wallet picker', () => {
  const listeners: Array<(event: Event) => void> = [];

  afterEach(() => {
    for (const listener of listeners.splice(0)) {
      window.removeEventListener('eip6963:requestProvider', listener);
    }
    delete (window as { phantom?: unknown }).phantom;
  });

  /** Plays an EIP-6963 wallet: answers every discovery request with its provider. */
  function announceEvmWallet(rdns: string, name: string, account: string) {
    const provider = { request: vi.fn(async () => [account]) };
    const listener = () =>
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: { info: { uuid: `${rdns}-uuid`, name, icon: 'data:,', rdns }, provider },
        }),
      );
    listeners.push(listener);
    window.addEventListener('eip6963:requestProvider', listener);
    return provider;
  }

  it('fills the address from an announced EVM wallet, lower-cased', async () => {
    const provider = announceEvmWallet(
      'io.rabby',
      'Rabby Wallet',
      '0x899CD926A9028AFE9056E76CC01F32EE859E7A65',
    );
    renderDrawer();

    fireEvent.click(await screen.findByRole('button', { name: /Rabby/ }));

    await vi.waitFor(() =>
      expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe(
        '0x899cd926a9028afe9056e76cc01f32ee859e7a65',
      ),
    );
    expect(provider.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
    // A known wallet is shown once, under its catalogue name.
    expect(screen.queryByText('Rabby Wallet')).toBeNull();
  });

  it('fills a Solana address from Phantom and leaves its case alone', async () => {
    const publicKey = 'vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg';
    (window as { phantom?: unknown }).phantom = {
      solana: { connect: vi.fn(async () => ({ publicKey: { toString: () => publicKey } })) },
    };
    renderDrawer();

    fireEvent.click(await screen.findByRole('button', { name: /Phantom/ }));

    await vi.waitFor(() =>
      expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe(publicKey),
    );
    expect(screen.getByText('Solana')).toBeTruthy();
  });

  it('links a missing wallet to its install page instead of prompting', async () => {
    renderDrawer();

    const metaMask = await screen.findByRole('link', { name: /MetaMask/ });

    expect(metaMask.getAttribute('href')).toBe('https://metamask.io/download/');
    expect(metaMask.getAttribute('target')).toBe('_blank');
  });
});

describe('addressFamily', () => {
  it.each([
    ['0x899cd926a9028afe9056e76cc01f32ee859e7a65', 'evm'],
    ['TLLU15qbiSEqv2y3DLfbHTHS5TVdjQ7hoJ', 'tron'],
    ['bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'bitcoin'],
    ['3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', 'bitcoin'],
    ['vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg', 'solana'],
    // A whole wallet rather than one address, and still Bitcoin.
    [
      'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs',
      'bitcoin',
    ],
    ['not an address', null],
  ])('reads %s as %s', (address, family) => {
    expect(addressFamily(address)).toBe(family);
  });
});
