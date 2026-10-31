'use client';
import {
  Box,
  Chip,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';
import { Search as SearchIcon } from '@/app/components/icons';
import { AppPagination } from '@/app/components/ui/pagination';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { Select } from '@/app/components/ui/select';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { StatementTransaction } from '@/app/lib/contracts';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { useCategoryName } from '@/app/lib/use-category-name';
import { resolveLocaleTag } from '@/app/lib/user-format';
import { formatStoredDate } from '@/app/lib/user-format-store';
import {
  getNamedObjectLabel,
  getTransactionValue,
  PaymentPurposeCell,
} from './transactions/TransactionsViewParts';

/** A statement's row as the storage and shared pages receive it: money as decimal strings. */
export type Transaction = StatementTransaction;

interface TransactionsViewProps {
  transactions: Transaction[];
}

type ColumnDef = {
  key: string;
  label: string;
  render?: (tx: Transaction) => React.ReactNode;
};

/**
 * Component for displaying transactions list with search and pagination
 */
export default function TransactionsView({ transactions }: TransactionsViewProps) {
  const t = useIntlayer('transactionsView');
  const { locale } = useLocale();
  const categoryName = useCategoryName();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const formatDate = useCallback(
    (dateString: string): string => {
      const date = new Date(dateString);
      return formatStoredDate(date, resolveLocaleTag(locale));
    },
    [locale],
  );

  const formatAmount = useCallback(
    (amount: number, currency?: string): string => {
      return new Intl.NumberFormat(resolveLocaleTag(locale), {
        style: 'currency',
        currency: currency || FALLBACK_CURRENCY,
        minimumFractionDigits: 2,
      }).format(amount);
    },
    [locale],
  );

  const getTypeColor = useCallback((type: string) => {
    const colors: Record<string, 'success' | 'error' | 'info'> = {
      INCOME: 'success',
      EXPENSE: 'error',
      TRANSFER: 'info',
    };
    return colors[type] || 'default';
  }, []);

  const getTypeLabel = useCallback(
    (type: string) => {
      switch (type) {
        case 'INCOME':
          return t.type.income;
        case 'EXPENSE':
          return t.type.expense;
        case 'TRANSFER':
          return t.type.transfer;
        default:
          return type;
      }
    },
    [t],
  );

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return transactions.filter(
      tx =>
        tx.counterpartyName?.toLowerCase().includes(query) ||
        tx.paymentPurpose?.toLowerCase().includes(query) ||
        tx.category?.name?.toLowerCase().includes(query) ||
        tx.documentNumber?.toLowerCase().includes(query) ||
        tx.counterpartyBin?.toLowerCase().includes(query) ||
        tx.article?.toLowerCase().includes(query),
    );
  }, [transactions, searchQuery]);

  const paginatedTransactions = filteredTransactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / rowsPerPage));

  const availableColumns: ColumnDef[] = useMemo(() => {
    const presentKeys = new Set<string>();
    transactions.forEach(tx => {
      Object.keys(tx).forEach(key => {
        if (key === 'id') {
          return;
        }
        presentKeys.add(key);
      });
    });

    const preferredOrder: Array<keyof Transaction> = [
      'transactionDate',
      'documentNumber',
      'counterpartyName',
      'counterpartyBin',
      'paymentPurpose',
      'debit',
      'credit',
      'currency',
      'exchangeRate',
      'transactionType',
      'category',
      'article',
      'amountForeign',
      'branch',
      'wallet',
    ];

    const labelMap: Record<string, string> = {
      transactionDate: t.columns.transactionDate.value,
      documentNumber: t.columns.documentNumber.value,
      counterpartyName: t.columns.counterpartyName.value,
      counterpartyBin: t.columns.counterpartyBin.value,
      paymentPurpose: t.columns.paymentPurpose.value,
      debit: t.columns.debit.value,
      credit: t.columns.credit.value,
      currency: t.columns.currency.value,
      exchangeRate: t.columns.exchangeRate.value,
      transactionType: t.columns.transactionType.value,
      category: t.columns.category.value,
      article: t.columns.article.value,
      amountForeign: t.columns.amountForeign.value,
      branch: t.columns.branch.value,
      wallet: t.columns.wallet.value,
    };

    const renderers: Record<string, (tx: Transaction) => React.ReactNode> = {
      transactionDate: tx => formatDate(tx.transactionDate),
      debit: tx =>
        Number(tx.debit) > 0 ? (
          <PrivateAmount>{formatAmount(Number(tx.debit), tx.currency)}</PrivateAmount>
        ) : (
          t.dash
        ),
      credit: tx =>
        Number(tx.credit) > 0 ? (
          <PrivateAmount>{formatAmount(Number(tx.credit), tx.currency)}</PrivateAmount>
        ) : (
          t.dash
        ),
      currency: tx => tx.currency || FALLBACK_CURRENCY,
      exchangeRate: tx =>
        tx.exchangeRate
          ? Number(tx.exchangeRate).toLocaleString(resolveLocaleTag(locale), {
              minimumFractionDigits: 2,
            })
          : t.dash,
      transactionType: tx => (
        <Chip
          label={getTypeLabel(tx.transactionType)}
          size="small"
          color={getTypeColor(tx.transactionType)}
        />
      ),
      category: tx =>
        tx.category?.name ? (
          <Chip
            label={
              tx.category.isEnabled === false
                ? `${categoryName(tx.category.name)} — select category`
                : categoryName(tx.category.name)
            }
            size="small"
            variant="outlined"
            color={tx.category.isEnabled === false ? 'error' : 'default'}
          />
        ) : (
          t.dash
        ),
      branch: tx => tx.branch?.name || t.dash.value,
      wallet: tx => tx.wallet?.name || t.dash.value,
      paymentPurpose: tx => <PaymentPurposeCell tx={tx} fallback={t.dash.value} />,
      counterpartyName: tx => tx.counterpartyName || t.dash.value,
      counterpartyBin: tx => tx.counterpartyBin || t.dash.value,
      documentNumber: tx => tx.documentNumber || t.dash.value,
      amountForeign: tx =>
        tx.amountForeign ? (
          <PrivateAmount>
            {Number(tx.amountForeign).toLocaleString(resolveLocaleTag(locale), {
              minimumFractionDigits: 2,
            })}
          </PrivateAmount>
        ) : (
          t.dash
        ),
    };

    const columns: ColumnDef[] = [];

    preferredOrder.forEach(key => {
      if (presentKeys.has(key)) {
        columns.push({
          key,
          label: labelMap[key] || key,
          render: renderers[key],
        });
        presentKeys.delete(key);
      }
    });

    // Any other keys from backend that we don't know about yet
    Array.from(presentKeys).forEach(key => {
      columns.push({
        key,
        label: labelMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
        render: (tx: Transaction) => {
          const value = getTransactionValue(tx, key);
          if (value === null || value === undefined || value === '') {
            return t.dash;
          }
          if (typeof value === 'number') {
            return value.toLocaleString(resolveLocaleTag(locale));
          }
          if (typeof value === 'object') {
            return getNamedObjectLabel(value) || JSON.stringify(value);
          }
          return value.toString();
        },
      });
    });

    return columns;
  }, [transactions, locale, t, formatDate, formatAmount, getTypeColor, getTypeLabel, categoryName]);

  return (
    <Box>
      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder={t.searchPlaceholder.value}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      {/* Transactions table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {availableColumns.map(col => (
                <TableCell key={col.key}>{col.label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={availableColumns.length || 1} align="center">
                  {t.empty}
                </TableCell>
              </TableRow>
            ) : (
              paginatedTransactions.map(tx => (
                <TableRow key={tx.id} hover>
                  {availableColumns.map(col => (
                    <TableCell key={col.key}>
                      {col.render
                        ? col.render(tx)
                        : (getTransactionValue(tx, col.key) ?? '—').toString()}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            px: 2,
            py: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
              {t.pagination.rowsPerPage.value}:
            </span>
            <Select
              size="small"
              value={rowsPerPage}
              onChange={value => {
                setRowsPerPage(Number.parseInt(value, 10));
                setPage(0);
              }}
              options={[
                { value: 10, label: '10' },
                { value: 25, label: '25' },
                { value: 50, label: '50' },
                { value: 100, label: '100' },
              ]}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
              {filteredTransactions.length === 0
                ? `0-0 ${t.pagination.of.value} 0`
                : `${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, filteredTransactions.length)} ${t.pagination.of.value} ${filteredTransactions.length}`}
            </span>
            <AppPagination
              page={page + 1}
              total={totalPages}
              onChange={nextPage => setPage(nextPage - 1)}
            />
          </Box>
        </Box>
      </TableContainer>
    </Box>
  );
}
