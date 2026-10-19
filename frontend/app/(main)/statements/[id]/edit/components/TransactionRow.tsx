'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { CheckCircle2, MoreHorizontal, Pencil, XCircle } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import type { BranchOption, CategoryOption, FieldChangeParams, Transaction } from '../editHelpers';
import {
  computeMissingCategory,
  getEditValue,
  getFieldDisplay,
  getRowSx,
  isMultilineField,
} from '../helpers/transactionDisplayHelpers';

type SelectFieldItem = { id: string; name: string };
type SelectEditCellParams = {
  value: string;
  items: SelectFieldItem[];
  multiline: boolean;
  notSelectedLabel: string;
  onChange: (value: string) => void;
};

function SelectEditCell({
  value,
  items,
  multiline,
  notSelectedLabel,
  onChange,
}: SelectEditCellParams): React.ReactElement {
  return (
    <TextField
      size="small"
      fullWidth
      multiline={multiline}
      select
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <MenuItem value="">{notSelectedLabel}</MenuItem>
      {items.map(item => (
        <MenuItem key={item.id} value={item.id}>
          {item.name}
        </MenuItem>
      ))}
    </TextField>
  );
}

type EditCellParams = {
  transaction: Transaction;
  edited: Partial<Transaction>;
  field: keyof Transaction;
  categories: CategoryOption[];
  branches: BranchOption[];
  wallets: BranchOption[];
  onFieldChange: (params: FieldChangeParams) => void;
  notSelectedLabel: string;
};

function EditCell({
  transaction,
  edited,
  field,
  categories,
  branches,
  wallets,
  onFieldChange,
  notSelectedLabel,
}: EditCellParams): React.ReactElement {
  const multiline = isMultilineField(field);
  const onChange = (value: string): void => onFieldChange({ id: transaction.id, field, value });
  const editValue = (f: keyof Transaction): string => getEditValue(edited, transaction, f);
  if (field === 'categoryId') {
    return (
      <SelectEditCell
        value={editValue('categoryId')}
        items={categories}
        multiline={multiline}
        notSelectedLabel={notSelectedLabel}
        onChange={onChange}
      />
    );
  }
  if (field === 'branchId') {
    return (
      <SelectEditCell
        value={editValue('branchId')}
        items={branches}
        multiline={multiline}
        notSelectedLabel={notSelectedLabel}
        onChange={onChange}
      />
    );
  }
  if (field === 'walletId') {
    return (
      <SelectEditCell
        value={editValue('walletId')}
        items={wallets}
        multiline={multiline}
        notSelectedLabel={notSelectedLabel}
        onChange={onChange}
      />
    );
  }
  return (
    <TextField
      size="small"
      fullWidth
      multiline={multiline}
      value={editValue(field)}
      onChange={e => onChange(e.target.value)}
    />
  );
}

type CategoryChipProps = {
  transaction: Transaction;
  locale: string;
  noCategoryLabel: string;
  assignCategoryLabel: string;
};

/**
 * The category as text behind a small dot, not a filled pill down the whole
 * column: a light frame shows on the row under the pointer, saying it can be
 * changed. No category is an ochre dot, a thing to do rather than an error.
 */
function CategoryChip({
  transaction,
  locale,
  noCategoryLabel,
  assignCategoryLabel,
}: CategoryChipProps): React.ReactElement {
  const missing = !transaction.category?.name;
  const isDisabled = transaction.category?.isEnabled === false;
  const displayName = missing
    ? noCategoryLabel
    : getCategoryDisplayName(
        {
          name: transaction.category?.name ?? '',
          source: transaction.category?.source,
          isSystem: transaction.category?.isSystem,
        },
        locale,
      );
  return (
    <Box
      component="span"
      className="seneca-stmt-edit-table__category"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.25,
        ml: -1,
        borderRadius: 999,
        border: '1px solid transparent',
        fontSize: 13.5,
        color: missing ? 'var(--text-muted)' : 'var(--foreground)',
      }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          flexShrink: 0,
          bgcolor: missing || isDisabled ? 'var(--attention)' : 'var(--muted-foreground)',
        }}
      />
      {isDisabled ? `${displayName} — ${assignCategoryLabel}` : displayName}
    </Box>
  );
}

type RowActionsProps = {
  isEditing: boolean;
  transaction: Transaction;
  confirmDeleteLabel: string;
  deleteLabel: string;
  moreActionsLabel: string;
  cancelLabel: string;
  onSave: (id: string) => void;
  onCancel: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => Promise<void>;
};

/**
 * Edit shows on the row under the pointer; delete sits in the "…" menu behind
 * a confirmation, away from the pencil it used to stand next to.
 */
function RowActions({
  isEditing,
  transaction,
  confirmDeleteLabel,
  deleteLabel,
  moreActionsLabel,
  cancelLabel,
  onSave,
  onCancel,
  onEdit,
  onDelete,
}: RowActionsProps): React.ReactElement {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirming, setConfirming] = useState(false);
  if (isEditing) {
    return (
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <IconButton
          size="small"
          onClick={() => onSave(transaction.id)}
          sx={{ color: 'var(--money-up)' }}
        >
          <CheckCircle2 size={18} />
        </IconButton>
        <IconButton size="small" onClick={onCancel} sx={{ color: 'text.secondary' }}>
          <XCircle size={18} />
        </IconButton>
      </Box>
    );
  }
  return (
    <>
      <Box className="seneca-stmt-edit-table__row-actions" sx={{ display: 'flex', gap: 0.25 }}>
        <IconButton
          size="small"
          onClick={() => onEdit(transaction)}
          sx={{ color: 'text.secondary' }}
        >
          <Pencil size={16} />
        </IconButton>
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
  isEditing: boolean;
  edited: Partial<Transaction>;
  selectedRows: Set<string>;
  categories: CategoryOption[];
  branches: BranchOption[];
  wallets: BranchOption[];
  locale: string;
  formatNumber: (n?: number | null) => string;
  confirmDeleteLabel: string;
  deleteLabel: string;
  moreActionsLabel: string;
  cancelLabel: string;
  notSelectedLabel: string;
  noCategoryLabel: string;
  assignCategoryLabel: string;
  onRowSelect: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  onDelete: (id: string) => Promise<void>;
  onFieldChange: (params: FieldChangeParams) => void;
};

export function TransactionRow({
  transaction,
  isEditing,
  edited,
  selectedRows,
  categories,
  branches,
  wallets,
  locale,
  formatNumber,
  confirmDeleteLabel,
  deleteLabel,
  moreActionsLabel,
  cancelLabel,
  notSelectedLabel,
  noCategoryLabel,
  assignCategoryLabel,
  onRowSelect,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onFieldChange,
}: TransactionRowProps): React.ReactElement {
  const missingCategory = computeMissingCategory(edited, transaction);
  const rowSx = getRowSx(missingCategory);
  const display = (field: keyof Transaction): string =>
    getFieldDisplay({ tx: transaction, field, locale, fmt: formatNumber });
  const editCell = (field: keyof Transaction): React.ReactElement => (
    <EditCell
      transaction={transaction}
      edited={edited}
      field={field}
      categories={categories}
      branches={branches}
      wallets={wallets}
      onFieldChange={onFieldChange}
      notSelectedLabel={notSelectedLabel}
    />
  );
  return (
    <TableRow hover sx={rowSx}>
      <TableCell padding="checkbox">
        <Checkbox
          checked={selectedRows.has(transaction.id)}
          onCheckedChange={() => onRowSelect(transaction.id)}
        />
      </TableCell>
      <TableCell sx={{ minWidth: 100 }}>
        {isEditing ? editCell('transactionDate') : display('transactionDate')}
      </TableCell>
      <TableCell sx={{ minWidth: 150 }}>
        {isEditing ? editCell('counterpartyName') : transaction.counterpartyName}
      </TableCell>
      <TableCell sx={{ minWidth: 200, maxWidth: 300 }}>
        {isEditing ? (
          editCell('paymentPurpose')
        ) : (
          <Tooltip title={transaction.paymentPurpose}>
            <Typography
              variant="body2"
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {transaction.paymentPurpose}
            </Typography>
          </Tooltip>
        )}
      </TableCell>
      {/* One signed amount: money out in ink with a minus, money in sage with a plus. */}
      <TableCell
        align="right"
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
        {isEditing ? (
          editCell('categoryId')
        ) : (
          <CategoryChip
            transaction={transaction}
            locale={locale}
            noCategoryLabel={noCategoryLabel}
            assignCategoryLabel={assignCategoryLabel}
          />
        )}
      </TableCell>
      <TableCell>
        <RowActions
          isEditing={isEditing}
          transaction={transaction}
          confirmDeleteLabel={confirmDeleteLabel}
          deleteLabel={deleteLabel}
          moreActionsLabel={moreActionsLabel}
          cancelLabel={cancelLabel}
          onSave={onSave}
          onCancel={onCancel}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  );
}
