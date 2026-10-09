// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionDetailsTab } from './TransactionDetailsTab';
import type { Transaction } from './types';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('@/app/contexts/CurrencyDisplayContext', () => ({
  useCurrencyDisplay: () => ({ showConverted: false, workspaceCurrency: 'EUR' }),
}));
vi.mock('./hooks/useWorkspaceMembers', () => ({ useWorkspaceMembers: () => [] }));
vi.mock('./hooks/useBulkUpdateOwner', () => ({ useBulkUpdateOwner: () => vi.fn() }));

function income(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    transactionDate: '2026-10-01',
    counterpartyName: 'Broker AG',
    paymentPurpose: 'Payout',
    debit: 0,
    credit: 120,
    amount: 120,
    transactionType: 'income',
    currency: 'EUR',
    transferPairId: null,
    transferPairKind: null,
    investmentAccountId: null,
    ...overrides,
  } as Transaction;
}

const renderTab = (transaction: Transaction) =>
  render(<TransactionDetailsTab transaction={transaction} categories={[]} onSplitDone={vi.fn()} />);

describe('TransactionDetailsTab — investment income', () => {
  beforeEach(() => {
    api.get.mockReset().mockResolvedValue({
      data: [{ id: 'account-1', name: 'Broker', kind: 'investment' }],
    });
    api.post.mockReset().mockResolvedValue({ data: {} });
    api.delete.mockReset().mockResolvedValue({ data: {} });
  });

  it('links an incoming row as a dividend, asking which account paid it', async () => {
    renderTab(income());

    fireEvent.click(screen.getByRole('button', { name: 'Mark as a dividend or interest' }));
    expect(await screen.findByText('From which account?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Broker' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/investments/contributions', {
        transactionId: 'tx-1',
        accountId: 'account-1',
        role: 'income',
      }),
    );
  });

  it('links an incoming row as a withdrawal', async () => {
    renderTab(income());

    fireEvent.click(screen.getByRole('button', { name: 'Mark as a withdrawal' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Broker' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/investments/contributions', {
        transactionId: 'tx-1',
        accountId: 'account-1',
        role: 'withdrawal',
      }),
    );
  });

  it('shows a linked dividend for what it is, and offers no transfer for it', () => {
    renderTab(income({ investmentAccountId: 'account-1' }));

    expect(screen.getByTestId('investment-income-badge')).toHaveTextContent(
      'Dividend or interest from investments',
    );
    expect(screen.queryByRole('button', { name: 'Transfer between accounts' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Not from investments' }));
    expect(api.delete).toHaveBeenCalledWith('/investments/contributions/tx-1');
  });

  it('labels a withdrawal as one, not as a contribution', () => {
    renderTab(
      income({
        investmentAccountId: 'account-1',
        transferPairId: 'tx-1',
        transferPairKind: 'investment',
      }),
    );

    expect(screen.getByTestId('transfer-badge')).toHaveTextContent('Withdrawal from investments');
  });
});
