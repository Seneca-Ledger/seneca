import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BankSyncPanel } from './BankSyncPanel';

const account = (id: string, name: string, enabled: boolean) => ({
  id,
  name,
  org: 'Demo Bank',
  currency: 'USD',
  enabled,
  walletId: null,
  linkId: null,
  lastSyncAt: null,
  balance: 100,
  balanceDate: null,
  consentExpiresAt: null,
  syncFrom: null,
  health: 'ok',
  lastError: null,
  balanceDrift: null,
});

const connections = [
  {
    id: 'c1',
    provider: 'simplefin',
    linkStyle: 'token',
    label: 'Bridge',
    status: 'connected',
    config: {
      label: 'Bridge',
      autoSync: true,
      links: [],
      accounts: [account('ACT-1', 'Checking', true), account('ACT-2', 'Savings', false)],
      lastSyncAt: null,
      lastError: null,
    },
  },
];

vi.mock('@/app/lib/api', () => ({ default: { post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: vi.fn(async ({ url }: { url: string }) =>
    url.endsWith('/connections') ? connections : [],
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
