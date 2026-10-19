import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReconciliationData } from '../useReconciliation';
import { ReconcileView } from './ReconcileView';

const hookMock = vi.hoisted(() => ({ state: {} as Record<string, unknown>, confirm: vi.fn() }));
vi.mock('../useReconciliation', () => ({ useReconciliation: () => hookMock.state }));

const data: ReconciliationData = {
  currency: 'USD',
  matches: [
    {
      itemId: 'p1',
      transactionId: 't1',
      confidence: 0.95,
      reasons: ['amount', 'vendor', 'date'],
      item: {
        id: 'p1',
        direction: 'payable',
        vendor: 'Landlord LLC',
        amount: 500,
        currency: 'USD',
        dueDate: '2026-09-30',
        createdAt: '2026-09-01T00:00:00Z',
        status: 'to_pay',
        amountInWorkspace: 500,
      },
      transaction: {
        id: 't1',
        type: 'expense',
        amount: 500,
        currency: 'USD',
        date: '2026-10-01',
        counterpartyName: 'LANDLORD LLC',
        paymentPurpose: null,
      },
    },
  ],
  unmatchedItems: [
    {
      id: 'p2',
      direction: 'receivable',
      vendor: 'Acme',
      amount: 300,
      currency: 'USD',
      dueDate: null,
      createdAt: '2026-09-01T00:00:00Z',
      status: 'to_pay',
      amountInWorkspace: 300,
    },
  ],
  unmatchedRowCount: 4,
  duplicates: [{ vendor: 'Landlord LLC', amount: 500, currency: 'USD', itemIds: ['p1', 'p3'] }],
  ageing: [
    { direction: 'payable', buckets: { current: 0, d1_30: 500, d31_60: 0, d61_90: 0, d90_plus: 120 }, total: 620, top: [] },
    { direction: 'receivable', buckets: { current: 300, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 }, total: 300, top: [] },
  ],
};

describe('ReconcileView', () => {
  beforeEach(() => {
    hookMock.confirm.mockReset();
    hookMock.state = {
      data,
      isPending: false,
      isFetching: false,
      error: null,
      confirm: hookMock.confirm,
      confirming: false,
    };
  });

  it('shows the pair with its evidence, ageing per direction and the duplicate, and confirms on click', () => {
    render(<ReconcileView />);

    expect(screen.getByText('Landlord LLC')).toBeInTheDocument();
    expect(screen.getByText(/95%/)).toBeInTheDocument();
    expect(screen.getByText('Bank rows without a bill: 4')).toBeInTheDocument();
    expect(screen.getByText(/2 within a week/)).toBeInTheDocument();
    expect(screen.getByText('Owed to us')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(hookMock.confirm).toHaveBeenCalledWith('p1', 't1');
  });

  it('says so when nothing pairs', () => {
    hookMock.state = { ...hookMock.state, data: { ...data, matches: [] } };
    render(<ReconcileView />);
    expect(screen.getByText(/No pairs/)).toBeInTheDocument();
  });
});
