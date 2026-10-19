/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function */
'use client';
import {
  Box,
  Chip,
  IconButton,
  MenuItem,
  TableCell,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import { CheckCircle2, Pencil, Trash2, TriangleAlert, XCircle } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import { formatStoredDate } from '@/app/lib/user-format-store';
import type { Transaction } from './editHelpers';
import { isIdEmpty, resolveLocale } from './editHelpers';

interface TransactionTableRowProps {
  transaction: Transaction;
  edited: Partial<Transaction>;
  isEditing: boolean;
  isSelected: boolean;
  locale: string;
  labels: Record<string, { value?: string }>;
  categories: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  wallets: { id: string; name: string }[];
  formatNumber: (num?: number | null) => string;
  onRowSelect: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
  onDelete: (id: string) => Promise<void>;
  onFieldChange: (id: string, field: keyof Transaction, value: string) => void;
}

function EditCell({
  transaction,
  edited,
  field,
  categories,
  branches,
  wallets,
  labels,
  onFieldChange,
}: {
  transaction: Transaction;
  edited: Partial<Transaction>;
  field: keyof Transaction;
  categories: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  wallets: { id: string; name: string }[];
  labels: Record<string, { value?: string }>;
  onFieldChange: (id: string, field: keyof Transaction, value: string) => void;
}) {
  const commonTextFieldProps = {
    size: 'small' as const,
    fullWidth: true,
    multiline: field === 'paymentPurpose' || field === 'comments',
  };

  const selectOptions: Record<string, { id: string; name: string }[]> = {
    categoryId: categories,
    branchId: branches,
    walletId: wallets,
  };

  const options = selectOptions[field];
  if (options) {
    return (
      <TextField
        {...commonTextFieldProps}
        select
        value={(edited[field] as string) || (transaction[field] as string) || ''}
        onChange={e => onFieldChange(transaction.id, field, e.target.value)}
      >
        <MenuItem value="">{labels.notSelected?.value || 'Not selected'}</MenuItem>
        {options.map(opt => (
          <MenuItem key={opt.id} value={opt.id}>
            {opt.name}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  return (
    <TextField
      {...commonTextFieldProps}
      value={edited[field] ?? transaction[field] ?? ''}
      onChange={e => onFieldChange(transaction.id, field, e.target.value)}
    />
  );
}

function CategoryChip({
  transaction,
  locale,
  labels,
}: {
  transaction: Transaction;
  locale: string;
  labels: Record<string, { value?: string }>;
}) {
  if (!transaction.category?.name) {
    return (
      <Chip
        label={labels.noCategoryOption?.value || 'No category'}
        size="small"
        icon={<TriangleAlert size={16} />}
        sx={{
          bgcolor: 'error.50',
          color: 'error.700',
          border: '1px solid',
          borderColor: 'error.100',
          fontWeight: 600,
          fontSize: '0.8125rem',
          '& .MuiChip-icon': { color: 'error.600' },
        }}
      />
    );
  }

  const { category } = transaction;
  const displayName = getCategoryDisplayName(
    { name: category.name, source: category.source, isSystem: category.isSystem },
    locale,
  );
  const isDisabled = category.isEnabled === false;
  const label = isDisabled
    ? `${displayName} — ${labels.assignCategory?.value || 'Assign category'}`
    : displayName;

  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: isDisabled ? 'error.50' : 'primary.50',
        color: isDisabled ? 'error.700' : 'primary.700',
        border: isDisabled ? '1px solid' : 'none',
        borderColor: isDisabled ? 'error.200' : 'transparent',
        fontWeight: 500,
        fontSize: '0.8125rem',
      }}
    />
  );
}

function DisplayCell({
  transaction,
  field,
  locale,
  formatNumber,
}: {
  transaction: Transaction;
  field: keyof Transaction;
  locale: string;
  formatNumber: (num?: number | null) => string;
}) {
  if (field === 'transactionDate') {
    return <>{formatStoredDate(transaction.transactionDate, resolveLocale(locale))}</>;
  }
  if (field === 'debit' || field === 'credit') {
    const value = transaction[field];
    return <>{value ? formatNumber(value) : '—'}</>;
  }
  return <>{String(transaction[field] ?? '') || '—'}</>;
}

export function TransactionTableRow({
  transaction,
  edited,
  isEditing,
  isSelected,
  locale,
  labels,
  categories,
  branches,
  wallets,
  formatNumber,
  onRowSelect,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onFieldChange,
}: TransactionTableRowProps) {
  const missingCategory =
    isIdEmpty((edited as Transaction).categoryId) &&
    isIdEmpty(transaction.categoryId) &&
    isIdEmpty(transaction.category?.id);

  const editCellProps = {
    transaction,
    edited,
    categories,
    branches,
    wallets,
    labels,
    onFieldChange,
  };

  return (
    <TableRow
      hover
      sx={{
        bgcolor: missingCategory ? 'error.50' : undefined,
        borderLeft: missingCategory ? '3px solid' : undefined,
        borderLeftColor: missingCategory ? 'error.400' : undefined,
        transition: 'all 0.15s',
        '&:hover': { bgcolor: missingCategory ? 'error.100' : 'grey.50' },
      }}
    >
      <TableCell padding="checkbox">
        <Checkbox checked={isSelected} onCheckedChange={() => onRowSelect(transaction.id)} />
      </TableCell>
      <TableCell sx={{ minWidth: 100 }}>
        {isEditing ? (
          <EditCell {...editCellProps} field="transactionDate" />
        ) : (
          <DisplayCell
            transaction={transaction}
            field="transactionDate"
            locale={locale}
            formatNumber={formatNumber}
          />
        )}
      </TableCell>
      <TableCell sx={{ minWidth: 150 }}>
        {isEditing ? (
          <EditCell {...editCellProps} field="counterpartyName" />
        ) : (
          transaction.counterpartyName
        )}
      </TableCell>
      <TableCell sx={{ minWidth: 200, maxWidth: 300 }}>
        {isEditing ? (
          <EditCell {...editCellProps} field="paymentPurpose" />
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
      <TableCell align="right" sx={{ color: 'error.600', fontWeight: 600, fontSize: '0.9375rem' }}>
        {transaction.debit ? formatNumber(transaction.debit) : '—'}
      </TableCell>
      <TableCell
        align="right"
        sx={{ color: 'success.600', fontWeight: 600, fontSize: '0.9375rem' }}
      >
        {transaction.credit ? formatNumber(transaction.credit) : '—'}
      </TableCell>
      <TableCell sx={{ minWidth: 150 }}>
        {isEditing ? (
          <EditCell {...editCellProps} field="categoryId" />
        ) : (
          <Box>
            <CategoryChip transaction={transaction} locale={locale} labels={labels} />
          </Box>
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => onSave(transaction.id)}
              sx={{ color: 'success.600', '&:hover': { bgcolor: 'success.50' } }}
            >
              <CheckCircle2 size={18} />
            </IconButton>
            <IconButton
              size="small"
              onClick={onCancel}
              sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'grey.100' } }}
            >
              <XCircle size={18} />
            </IconButton>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => onEdit(transaction)}
              sx={{ color: 'primary.600', '&:hover': { bgcolor: 'primary.50' } }}
            >
              <Pencil size={18} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => {
                if (window.confirm(labels.confirmDeleteOne?.value || 'Delete transaction?')) {
                  void onDelete(transaction.id);
                }
              }}
              sx={{ color: 'error.600', '&:hover': { bgcolor: 'error.50' } }}
            >
              <Trash2 size={18} />
            </IconButton>
          </Box>
        )}
      </TableCell>
    </TableRow>
  );
}
