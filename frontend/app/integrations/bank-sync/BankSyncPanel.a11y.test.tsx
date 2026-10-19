import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BankSyncPanel } from './BankSyncPanel';

const connectedStatus = {
  connected: true,
  status: 'connected',
  settings: {
    autoSync: true,
    accounts: [
      {
        id: 'ACT-1',
        name: 'Checking',
        org: 'Demo Bank',
        currency: 'USD',
        enabled: true,
        walletId: null,
        lastSyncAt: null,
        balance: 2957.5,
        balanceDate: null,
      },
      {
        id: 'ACT-2',
        name: 'Savings',
        org: 'Demo Bank',
        currency: 'USD',
        enabled: false,
        walletId: null,
        lastSyncAt: null,
        balance: 100,
        balanceDate: null,
      },
    ],
    lastSyncAt: null,
    lastError: null,
  },
};

vi.mock('@/app/lib/api', () => ({ default: { post: vi.fn(), delete: vi.fn() } }));
vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: vi.fn(async ({ url }: { url: string }) =>
    url === '/wallets' ? [] : connectedStatus,
  ),
  checkContract: vi.fn(async (_name: string, data: unknown) => data),
}));

describe('BankSyncPanel switches', () => {
  it('names each account switch after its account, so a screen reader can tell them apart', async () => {
    render(<BankSyncPanel onConnectionChange={vi.fn()} />);

    expect(await screen.findByRole('switch', { name: /Checking$/ })).toBeChecked();
    expect(screen.getByRole('switch', { name: /Savings$/ })).not.toBeChecked();
  });
});
