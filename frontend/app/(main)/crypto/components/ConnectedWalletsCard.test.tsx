import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CryptoWallet } from '../hooks/useCrypto';
import { ConnectedWalletsCard } from './ConnectedWalletsCard';

const labels = {
  title: 'Connected wallets',
  sync: 'Sync',
  remove: 'Disconnect',
  transactions: 'transactions',
  neverSynced: 'never synced',
};

function wallet(overrides: Partial<CryptoWallet> = {}): CryptoWallet {
  return {
    id: 'w-1',
    address: '0x899cd926a9028afe9056e76cc01f32ee859e7a65',
    kind: 'onchain',
    balances: [],
    chainId: 1,
    chainName: 'Ethereum',
    label: 'MetaMask',
    lastSyncedAt: '2026-10-04T21:00:00.000Z',
    lastSyncError: null,
    transactionCount: 47,
    ...overrides,
  };
}

function renderCard(wallets: CryptoWallet[], handlers: { onSync?: () => void; onRemove?: () => void } = {}) {
  render(
    <ConnectedWalletsCard
      wallets={wallets}
      locale="en"
      busyWalletId={null}
      labels={labels}
      onSync={handlers.onSync ?? vi.fn()}
      onRemove={handlers.onRemove ?? vi.fn()}
    />,
  );
}

describe('ConnectedWalletsCard', () => {
  it('holds every wallet under one title', () => {
    renderCard([wallet(), wallet({ id: 'w-2', label: 'Ledger', chainName: 'Tron' })]);

    expect(screen.getAllByText(labels.title)).toHaveLength(1);
    expect(screen.getByText('MetaMask')).toBeInTheDocument();
    expect(screen.getByText('Ledger')).toBeInTheDocument();
  });

  it('offers no sync for an exchange account: there is no chain to re-read', () => {
    renderCard([wallet({ kind: 'exchange', label: 'Coinbase', address: null })]);

    expect(screen.queryByRole('button', { name: /^Sync/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Disconnect/ })).toBeInTheDocument();
  });

  it('disconnects the wallet the button belongs to', async () => {
    const onRemove = vi.fn();
    renderCard([wallet(), wallet({ id: 'w-2', label: 'Ledger' })], { onRemove });

    await userEvent.click(screen.getByRole('button', { name: 'Disconnect Ledger' }));

    expect(onRemove).toHaveBeenCalledWith('w-2');
  });

  it('says when a wallet has never been synced', () => {
    renderCard([wallet({ lastSyncedAt: null })]);

    expect(screen.getByText(/never synced/)).toBeInTheDocument();
  });
});
