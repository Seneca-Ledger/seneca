import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvestmentAccount } from '../hooks/useInvestments';
import { InvestmentsCard } from './InvestmentsCard';

const hookMock = vi.hoisted(() => ({
  accounts: [] as InvestmentAccount[],
  createAccount: vi.fn(async () => undefined),
  deleteAccount: vi.fn(async () => undefined),
  addHolding: vi.fn(async () => undefined),
  updateHolding: vi.fn(async () => undefined),
  deleteHolding: vi.fn(async () => undefined),
  refreshPrices: vi.fn(async () => undefined),
}));

vi.mock('../hooks/useInvestments', async importOriginal => ({
  ...(await importOriginal<typeof import('../hooks/useInvestments')>()),
  useInvestments: () => ({
    accounts: hookMock.accounts,
    isPending: false,
    saving: false,
    createAccount: hookMock.createAccount,
    deleteAccount: hookMock.deleteAccount,
    addHolding: hookMock.addHolding,
    updateHolding: hookMock.updateHolding,
    deleteHolding: hookMock.deleteHolding,
    refreshPrices: hookMock.refreshPrices,
  }),
}));

const pension: InvestmentAccount = {
  id: 'acc-1',
  name: 'Pension',
  kind: 'retirement',
  currency: 'USD',
  value: 1205,
  contributed: 1000,
  withdrawn: 0,
  income: 0,
  netInvested: 1000,
  gain: 205,
  holdings: [
    {
      id: 'h1',
      symbol: 'VWCE.DE',
      name: 'World ETF',
      assetClass: 'etf',
      quantity: 10,
      price: 120.5,
      priceCurrency: 'EUR',
      priceSource: 'auto',
      pricedAt: '2026-10-01T00:00:00Z',
      value: 1205,
    },
  ],
};

describe('InvestmentsCard', () => {
  beforeEach(() => {
    hookMock.accounts = [];
    hookMock.createAccount.mockClear();
    hookMock.addHolding.mockClear();
    hookMock.refreshPrices.mockClear();
  });

  it('creates an account from the form', () => {
    render(<InvestmentsCard currency="USD" locale="en" />);

    expect(screen.getByText('No investment or retirement accounts yet')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Account name'), { target: { value: 'Broker' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }));
    expect(hookMock.createAccount).toHaveBeenCalledWith('Broker', 'investment');
  });

  it('lists holdings with value, contributed and gain, and offers a price refresh', () => {
    hookMock.accounts = [pension];
    render(<InvestmentsCard currency="USD" locale="en" />);

    expect(screen.getByText('World ETF')).toBeInTheDocument();
    expect(screen.getByText(/Gain: \+/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh prices' }));
    expect(hookMock.refreshPrices).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Ticker'), { target: { value: 'aapl' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add holding' }));
    expect(hookMock.addHolding).toHaveBeenCalledWith(
      'acc-1',
      expect.objectContaining({ symbol: 'aapl', quantity: 3, priceCurrency: 'USD' }),
    );
  });
});
