'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { MoreHorizontal } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { isSuggestion } from '@/app/lib/category-suggestion';
import type { Transaction } from '../editHelpers';
import {
  computeMissingCategory,
  getFieldDisplay,
  getRowSx,
} from '../helpers/transactionDisplayHelpers';
import { CategoryChip } from './CategoryChip';

type RowActionsProps = {
  transaction: Transaction;
  confirmDeleteLabel: string;
  deleteLabel: string;
  moreActionsLabel: string;
  cancelLabel: string;
  onDelete: (id: string) => Promise<void>;
};

/** Delete sits in the "…" menu behind a confirmation, shown on the row under the pointer. */
function RowActions({
  transaction,
  confirmDeleteLabel,
  deleteLabel,
  moreActionsLabel,
  cancelLabel,
  onDelete,
}: RowActionsProps): React.ReactElement {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Box className="seneca-stmt-edit-table__row-actions" sx={{ display: 'flex', gap: 0.25 }}>
        <IconButton
          size="small"
          aria-label={moreActionsLabel}
          aria-haspopup="menu"
          onClick={event => setMenuAnchor(event.currentTarget)}
          sx={{ color: 'text.secondary' }}
        >
          <MoreHorizontal size={16} />
        </IconButton>
      </Box>
      <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setConfirming(true);
          }}
          sx={{ color: 'var(--money-down)' }}
        >
          {deleteLabel}
        </MenuItem>
      </Menu>
      {confirming ? (
        <ModalShell
          isOpen
          onClose={() => setConfirming(false)}
          title={deleteLabel}
          size="sm"
          footer={
            <ModalFooter
              onCancel={() => setConfirming(false)}
              cancelText={cancelLabel}
              onConfirm={() => {
                setConfirming(false);
                void onDelete(transaction.id);
              }}
              confirmText={deleteLabel}
              confirmVariant="destructive"
            />
          }
        >
          <Typography variant="body2">{confirmDeleteLabel}</Typography>
        </ModalShell>
      ) : null}
    </>
  );
}

export type TransactionRowProps = {
  transaction: Transaction;
  selectedRows: Set<string>;
  locale: string;
  formatNumber: (n?: number | null) => string;
  confirmDeleteLabel: string;
  deleteLabel: string;
  moreActionsLabel: string;
  cancelLabel: string;
  noCategoryLabel: string;
  assignCategoryLabel: string;
  suggestedLabel: string;
  onRowSelect: (id: string) => void;
  onCategoryClick: (transaction: Transaction) => void;
  onDelete: (id: string) => Promise<void>;
};

/**
 * Date, counterparty, purpose and amount are what the bank printed: they stay
 * as parsed. Only the category is a person's to set, with a click on it.
 */
export function TransactionRow({
  transaction,
  selectedRows,
  locale,
  formatNumber,
  confirmDeleteLabel,
  deleteLabel,
  moreActionsLabel,
  cancelLabel,
  noCategoryLabel,
  assignCategoryLabel,
  suggestedLabel,
  onRowSelect,
  onCategoryClick,
  onDelete,
}: TransactionRowProps): React.ReactElement {
  const missingCategory = computeMissingCategory(transaction);
  const rowSx = getRowSx(missingCategory);
  const display = (field: keyof Transaction): string =>
    getFieldDisplay({ tx: transaction, field, locale, fmt: formatNumber });
  return (
    <TableRow hover sx={rowSx}>
      <TableCell padding="checkbox">
        <Checkbox
          checked={selectedRows.has(transaction.id)}
          onCheckedChange={() => onRowSelect(transaction.id)}
        />
      </TableCell>
      <TableCell sx={{ minWidth: 100 }}>{display('transactionDate')}</TableCell>
      <TableCell sx={{ minWidth: 150 }}>{transaction.counterpartyName}</TableCell>
      <TableCell sx={{ minWidth: 200, maxWidth: 300 }}>
        <Tooltip title={transaction.paymentPurpose}>
          <Typography
            variant="body2"
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {transaction.paymentPurpose}
          </Typography>
        </Tooltip>
      </TableCell>
      {/* One signed amount: money out in ink with a minus, money in sage with a plus. */}
      <TableCell
        align="right"
        className={PRIVATE_CLASS}
        sx={{
          fontWeight: 500,
          fontSize: '0.9375rem',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          color: Number(transaction.credit) > 0 ? 'var(--money-up)' : 'var(--foreground)',
        }}
      >
        {Number(transaction.credit) > 0
          ? `+${formatNumber(Number(transaction.credit))}`
          : Number(transaction.debit) > 0
            ? `−${formatNumber(Number(transaction.debit))}`
            : '—'}
      </TableCell>
      <TableCell sx={{ minWidth: 150 }}>
        <CategoryChip
          category={transaction.category}
          locale={locale}
          noCategoryLabel={noCategoryLabel}
          assignCategoryLabel={assignCategoryLabel}
          suggestedLabel={isSuggestion(transaction) ? suggestedLabel : undefined}
          onClick={() => onCategoryClick(transaction)}
        />
      </TableCell>
      <TableCell>
        <RowActions
          transaction={transaction}
          confirmDeleteLabel={confirmDeleteLabel}
          deleteLabel={deleteLabel}
          moreActionsLabel={moreActionsLabel}
          cancelLabel={cancelLabel}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  );
}
