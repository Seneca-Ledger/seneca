'use client';

import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Checkbox } from '@/app/components/ui/checkbox';
import type { Transaction } from '../editHelpers';
import type { ColumnLabels } from '../helpers/transactionDisplayHelpers';
import { getColumnLabels, getEditTableLabels } from '../helpers/transactionDisplayHelpers';
import { TransactionRow } from './TransactionRow';

/** Sentence case, grey and small: column titles label, they do not shout. */
const CELL_HEADER_SX = {
  fontWeight: 400,
  fontSize: 13,
  color: 'var(--text-muted)',
} as const;

type TableHeaderRowProps = {
  colLabels: ColumnLabels;
  selectedRows: Set<string>;
  transactions: Transaction[];
  onSelectAll: () => void;
};

function TableHeaderRow({
  colLabels,
  selectedRows,
  transactions,
  onSelectAll,
}: TableHeaderRowProps): React.ReactElement {
  return (
    <TableRow sx={{ borderBottom: '1px solid', borderBottomColor: 'divider' }}>
      <TableCell padding="checkbox">
        <Checkbox
          checked={selectedRows.size === transactions.length && transactions.length > 0}
          indeterminate={selectedRows.size > 0 && selectedRows.size < transactions.length}
          onCheckedChange={onSelectAll}
        />
      </TableCell>
      <TableCell sx={CELL_HEADER_SX}>{colLabels.date}</TableCell>
      <TableCell sx={CELL_HEADER_SX}>{colLabels.counterparty}</TableCell>
      <TableCell sx={CELL_HEADER_SX}>{colLabels.paymentPurpose}</TableCell>
      {/* One signed column instead of Expense and Income half-filled with dashes. */}
      <TableCell align="right" sx={CELL_HEADER_SX}>
        {colLabels.amount}
      </TableCell>
      <TableCell sx={CELL_HEADER_SX}>{colLabels.category}</TableCell>
      <TableCell sx={CELL_HEADER_SX}>
        <span className="u-visually-hidden">{colLabels.actions}</span>
      </TableCell>
    </TableRow>
  );
}

export type EditTransactionsTableProps = {
  transactions: Transaction[];
  selectedRows: Set<string>;
  locale: string;
  formatNumber: (n?: number | null) => string;
  columns: Record<string, { value?: string }>;
  labels: Record<string, { value?: string } | undefined>;
  onSelectAll: () => void;
  onRowSelect: (id: string) => void;
  onCategoryClick: (transaction: Transaction) => void;
  onDelete: (id: string) => Promise<void>;
};

export function EditTransactionsTable({
  transactions,
  selectedRows,
  locale,
  formatNumber,
  columns,
  labels,
  onSelectAll,
  onRowSelect,
  onCategoryClick,
  onDelete,
}: EditTransactionsTableProps): React.ReactElement {
  const colLabels = getColumnLabels(columns);
  const editLabels = getEditTableLabels(labels);
  return (
    <TableContainer
      component={Paper}
      elevation={0}
      className="seneca-stmt-edit-table"
      // `overflow: hidden` clipped the right-hand columns on phones; the
      // container scrolls sideways again, the way TableContainer does by default.
      sx={{ border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}
    >
      <Table size="small">
        <TableHead>
          <TableHeaderRow
            colLabels={colLabels}
            selectedRows={selectedRows}
            transactions={transactions}
            onSelectAll={onSelectAll}
          />
        </TableHead>
        <TableBody>
          {transactions.map(transaction => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              selectedRows={selectedRows}
              locale={locale}
              formatNumber={formatNumber}
              confirmDeleteLabel={editLabels.confirmDelete}
              deleteLabel={editLabels.deleteAction}
              moreActionsLabel={editLabels.moreActions}
              cancelLabel={editLabels.cancel}
              noCategoryLabel={editLabels.noCategory}
              assignCategoryLabel={editLabels.assignCategory}
              suggestedLabel={editLabels.suggested}
              onRowSelect={onRowSelect}
              onCategoryClick={onCategoryClick}
              onDelete={onDelete}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
