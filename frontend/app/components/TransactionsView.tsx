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
import { Select } from '@/app/components/ui/select';
import { useIntlayer, useLocale } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { formatStoredDate } from '@/app/lib/user-format-store';

export interface Transaction {
  id: string;
  transactionDate: string;
  documentNumber?: string;
  counterpartyName: string;
  counterpartyBin?: string;
  paymentPurpose: string;
  debit: number;
  credit: number;
  amount: number;
  transactionType: string;
  currency?: string;
  exchangeRate?: number;
  article?: string;
  amountForeign?: number;
  category?: { name: string; isEnabled?: boolean };
  branch?: { name: string };
  wallet?: { name: string };
}

interface TransactionsViewProps {
  transactions: Transaction[];
}

type ColumnDef = {
  key: string;
  label: string;
  render?: (tx: Transaction) => React.ReactNode;
};

const getTransactionValue = (transaction: Transaction, key: string): unknown => {
  const record = transaction as unknown as Record<string, unknown>;
  return record[key];
};

const getNamedObjectLabel = (value: object): string | null => {
  const record = value as Record<string, unknown>;
  return typeof record.name === 'string' ? record.name : null;
};

/**
 * Component for displaying transactions list with search and pagination
 */
export default function TransactionsView({ transactions }: TransactionsViewProps) {
  const t = useIntlayer('transactionsView');
  const { locale } = useLocale();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const formatDate = useCallback(
    (dateString: string): string => {
      const date = new Date(dateString);
      return formatStoredDate(
        date,
        locale === 'kk' ? 'kk-KZ' : locale === 'ru' ? 'ru-RU' : 'en-US',
      );
    },
    [locale],
  );

  const formatAmount = useCallback(
    (amount: number, currency?: string): string => {
      return new Intl.NumberFormat(
        locale === 'kk' ? 'kk-KZ' : locale === 'ru' ? 'ru-RU' : 'en-US',
        {
          style: 'currency',
          currency: currency || FALLBACK_CURRENCY,
          minimumFractionDigits: 2,
        },
      ).format(amount);
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
      debit: tx => (tx.debit > 0 ? formatAmount(tx.debit, tx.currency) : t.dash),
      credit: tx => (tx.credit > 0 ? formatAmount(tx.credit, tx.currency) : t.dash),
      currency: tx => tx.currency || FALLBACK_CURRENCY,
      exchangeRate: tx =>
        tx.exchangeRate
          ? tx.exchangeRate.toLocaleString(
              locale === 'kk' ? 'kk-KZ' : locale === 'ru' ? 'ru-RU' : 'en-US',
              { minimumFractionDigits: 2 },
            )
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
                ? `${tx.category.name} — select category`
                : tx.category.name
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
      paymentPurpose: tx => tx.paymentPurpose || t.dash.value,
      counterpartyName: tx => tx.counterpartyName || t.dash.value,
      counterpartyBin: tx => tx.counterpartyBin || t.dash.value,
      documentNumber: tx => tx.documentNumber || t.dash.value,
      amountForeign: tx =>
        tx.amountForeign
          ? tx.amountForeign.toLocaleString(
              locale === 'kk' ? 'kk-KZ' : locale === 'ru' ? 'ru-RU' : 'en-US',
              { minimumFractionDigits: 2 },
            )
          : t.dash,
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
            return value.toLocaleString(
              locale === 'kk' ? 'kk-KZ' : locale === 'ru' ? 'ru-RU' : 'en-US',
            );
          }
          if (typeof value === 'object') {
            return getNamedObjectLabel(value) || JSON.stringify(value);
          }
          return value.toString();
        },
      });
    });

    return columns;
  }, [transactions, locale, t, formatDate, formatAmount, getTypeColor, getTypeLabel]);

  return (
    <Box>
      {/* Search */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder={t.searchPlaceholder.value}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
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
