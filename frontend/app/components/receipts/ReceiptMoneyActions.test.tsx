// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceiptBillAction } from './ReceiptBillAction';
import { ReceiptReimbursementAction } from './ReceiptReimbursementAction';

const api = vi.hoisted(() => ({
  create: vi.fn(),
  allocate: vi.fn(),
  allocationSuggestion: vi.fn(),
}));

vi.mock('@/app/lib/payables-api', () => ({ payablesApi: api }));
vi.mock('@/app/lib/invalidate-document-lists', () => ({ invalidateFinancialData: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

const VENDOR = 'ACME Store - Wireless Buds';

describe('ReceiptReimbursementAction', () => {
  beforeEach(() => api.create.mockReset());

  it('books the receipt as owed by the person named, on Receive', async () => {
    api.create.mockResolvedValue({});
    render(
      <ReceiptReimbursementAction
        vendor={VENDOR}
        amount={2.97}
        currency="USD"
        statementId="statement-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Someone will pay me back/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Who pays you back' }), {
      target: { value: 'Member One' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith({
        direction: 'receivable',
        vendor: 'Member One',
        amount: 2.97,
        currency: 'USD',
        statementId: 'statement-1',
        comment: `Paid on their behalf: ${VENDOR}`,
      }),
    );
    expect(await screen.findByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/statements/receive',
    );
  });
});

describe('ReceiptBillAction', () => {
  beforeEach(() => {
    api.allocate.mockReset();
    api.allocationSuggestion.mockReset();
  });

  it('records a payment of the picked bill from the transaction', async () => {
    api.allocationSuggestion.mockResolvedValue({
      transactionId: 'tx-1',
      available: 40,
      currency: 'USD',
      exact: true,
      unallocated: 0,
      allocations: [
        { payableId: 'bill-1', vendor: 'Example Power', dueDate: null, outstanding: 40, amount: 40, partial: false },
      ],
    });
    api.allocate.mockResolvedValue([]);
    render(<ReceiptBillAction transactionId="tx-1" paidOn="2026-10-29" />);

    fireEvent.click(screen.getByRole('button', { name: /Pays a bill/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Example Power/ }));

    await waitFor(() =>
      expect(api.allocate).toHaveBeenCalledWith({
        transactionId: 'tx-1',
        allocations: [{ payableId: 'bill-1', amount: 40 }],
        paidOn: '2026-10-29',
      }),
    );
    expect(await screen.findByText('Recorded as a payment of Example Power')).toBeInTheDocument();
  });

  it('says so when no bill in the currency is open', async () => {
    api.allocationSuggestion.mockResolvedValue({
      transactionId: 'tx-1',
      available: 40,
      currency: 'USD',
      exact: false,
      unallocated: 40,
      allocations: [],
    });
    render(<ReceiptBillAction transactionId="tx-1" paidOn={null} />);

    fireEvent.click(screen.getByRole('button', { name: /Pays a bill/ }));

    expect(await screen.findByText('No open bills in USD')).toBeInTheDocument();
  });
});
