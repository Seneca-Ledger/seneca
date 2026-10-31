// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Payable } from '@/app/lib/payables-api';
import PayablesList from './PayablesList';

vi.mock('@/app/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
// The picture tile fetches on its own and has its own tests.
vi.mock('@/app/components/item-images/ItemThumb', () => ({ ItemThumb: () => null }));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({ notInAccount: { value: 'not in an account yet' } }),
}));

const LABELS = {
  vendor: 'Customer',
  dueDate: 'Due date',
  amount: 'Amount',
  source: 'Source',
  status: 'Status',
  actions: 'Actions',
  markPaid: 'Mark received',
  edit: 'Edit',
  archive: 'Archive',
  delete: 'Delete',
  pageShown: 'Showing {from}–{to} of {count}',
  statusLabels: { to_pay: 'To receive', paid: 'Received', overdue: 'Overdue', partially_paid: 'Partially received' },
  sourceLabels: { manual: 'Manual', invoice: 'Invoice' },
  amountPaid: 'received',
};

function payable(overrides: Partial<Payable> & Pick<Payable, 'id' | 'vendor'>): Payable {
  return {
    amount: '100.00',
    paidAmount: '0.00',
    currency: 'USD',
    dueDate: '2099-01-01',
    status: 'to_pay',
    source: 'manual',
    ...overrides,
  } as Payable;
}

function renderList(items: Payable[], onEdit = vi.fn(), totalPages = 1) {
  render(
    <PayablesList
      items={items}
      labels={LABELS}
      emptyTitle="Nothing"
      emptyDescription="Nothing yet"
      pagination={{ page: 1, totalPages, totalItems: items.length, pageSize: 20, onPageChange: vi.fn() }}
      onEdit={onEdit}
      onMarkPaid={vi.fn()}
      onArchive={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  return { onEdit };
}

describe('PayablesList', () => {
  it('says how long an overdue one has waited, as a quiet status', () => {
    const due = new Date();
    due.setDate(due.getDate() - 21);
    const dueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    renderList([payable({ id: 'p-1', vendor: 'HoldYou', dueDate })]);

    const status = screen.getByText('Overdue');
    expect(status.className).toContain('seneca-payable-status--overdue');
    expect(screen.getByText(/21 days ago/)).toBeInTheDocument();
  });

  it('hides the source column while every row has the same one', () => {
    renderList([payable({ id: 'p-1', vendor: 'A' }), payable({ id: 'p-2', vendor: 'B' })]);
    expect(screen.queryByText('Source')).toBeNull();
  });

  it('shows the source column once sources differ', () => {
    renderList([
      payable({ id: 'p-1', vendor: 'A' }),
      payable({ id: 'p-2', vendor: 'B', source: 'invoice' }),
    ]);
    expect(screen.getByText('Source')).toBeInTheDocument();
  });

  it('writes a received one once, without repeating its amount as received', () => {
    renderList([payable({ id: 'p-1', vendor: 'A', status: 'paid', paidAmount: '100.00', amount: '100.00' })]);
    expect(screen.queryByText(/received$/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark received' })).toBeNull();
  });

  it('opens the bill from the row, and keeps edit in the menu', () => {
    const { onEdit } = renderList([payable({ id: 'p-1', vendor: 'HoldYou' })]);

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'HoldYou' }));
    expect(onEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Mark received' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('shows no pagination for a single page', () => {
    renderList([payable({ id: 'p-1', vendor: 'A' })]);
    expect(screen.queryByText(/Showing/)).toBeNull();
  });

  it('says a received one has no money in an account yet, until its bank row is linked', () => {
    renderList([
      payable({ id: 'p-1', vendor: 'Logika', status: 'paid', paidAmount: '410.00', unbookedAmount: '410.00' }),
      payable({ id: 'p-2', vendor: 'Booked', status: 'paid', paidAmount: '70.00', unbookedAmount: '0.00' }),
    ]);

    expect(screen.getAllByText(/not in an account yet/)).toHaveLength(1);
  });
});
