// @vitest-environment jsdom
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Transaction } from '../editHelpers';
import { TransactionRow } from './TransactionRow';

const base: Transaction = {
  id: 'tx-1',
  transactionDate: '2026-01-28',
  counterpartyName: 'N26 Business',
  paymentPurpose: 'Business You account fee',
  debit: 9.9,
  credit: 0,
  transactionType: 'expense',
  category: { id: 'c-1', name: 'Bank fees' },
};

const renderRow = (transaction: Transaction, onDelete = vi.fn(async () => undefined)) =>
  render(
    <Table>
      <TableBody>
        <TransactionRow
          transaction={transaction}
          isEditing={false}
          edited={{}}
          selectedRows={new Set()}
          categories={[]}
          branches={[]}
          wallets={[]}
          locale="en"
          formatNumber={value => (value ?? 0).toFixed(2)}
          confirmDeleteLabel="Delete transaction?"
          deleteLabel="Delete"
          moreActionsLabel="More actions"
          cancelLabel="Cancel"
          notSelectedLabel="Not selected"
          noCategoryLabel="No category"
          assignCategoryLabel="Assign category"
          onRowSelect={vi.fn()}
          onEdit={vi.fn()}
          onSave={vi.fn()}
          onCancel={vi.fn()}
          onDelete={onDelete}
          onFieldChange={vi.fn()}
        />
      </TableBody>
    </Table>,
  );

describe('TransactionRow', () => {
  it('shows one signed amount: out with a minus, in with a plus', () => {
    const { unmount } = renderRow(base);
    expect(screen.getByText('−9.90')).toBeInTheDocument();
    unmount();

    renderRow({ ...base, debit: 0, credit: 25.2, transactionType: 'income' });
    expect(screen.getByText('+25.20')).toBeInTheDocument();
  });

  it('shows the category as text, and a missing one as a thing to do', () => {
    const { container, unmount } = renderRow(base);
    expect(screen.getByText('Bank fees')).toBeInTheDocument();
    expect(container.querySelector('.MuiChip-root')).toBeNull();
    unmount();

    renderRow({ ...base, category: undefined });
    expect(screen.getByText('No category')).toBeInTheDocument();
  });

  it('deletes only from the menu, after a confirmation', () => {
    const onDelete = vi.fn(async () => undefined);
    renderRow(base, onDelete);

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Delete transaction?')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1) as HTMLElement);
    expect(onDelete).toHaveBeenCalledWith('tx-1');
  });
});
