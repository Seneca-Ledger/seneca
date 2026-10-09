'use client';

import { Box, Chip, TableCell, TableRow, Typography } from '@mui/material';
import React from 'react';
import { Calendar } from '@/app/components/icons';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import type { Transaction } from './types';

type DocumentTransactionRowProps = {
  transaction: Transaction;
  formatDate: (d: string | null | undefined) => string;
  formatNumber: (v: number | undefined | null, currency?: string) => string;
};

// eslint-disable-next-line max-lines-per-function, complexity
export function DocumentTransactionRow({
  transaction,
  formatDate,
  formatNumber,
}: DocumentTransactionRowProps): React.JSX.Element {
  return (
    <TableRow
      key={transaction.id}
      sx={{
        '&:hover': { bgcolor: 'grey.50' },
        '&:last-child td': { borderBottom: 0 },
        borderLeft: '3px solid',
        borderLeftColor: transaction.debit ? 'error.main' : 'success.main',
        '@media print': {
          pageBreakInside: 'avoid',
          borderLeftColor: transaction.debit ? '#f44336 !important' : '#4caf50 !important',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        },
      }}
    >
      <TableCell sx={{ minWidth: 100 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Calendar size={16} style={{ color: 'var(--mui-palette-text-secondary)' }} />
          <Typography variant="body2" fontWeight="500">
            {formatDate(transaction.transactionDate)}
          </Typography>
        </Box>
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {transaction.documentNumber || '—'}
        </Typography>
      </TableCell>
      <TableCell sx={{ minWidth: 200 }}>
        <Typography variant="body2" fontWeight="600" color="text.primary">
          {transaction.counterpartyName}
        </Typography>
        {transaction.counterpartyBank && (
          <Typography variant="caption" color="text.secondary" display="block">
            {transaction.counterpartyBank}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" fontFamily="monospace">
          {transaction.counterpartyBin || '—'}
        </Typography>
      </TableCell>
      <TableCell sx={{ maxWidth: 300 }}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {transaction.paymentPurpose}
        </Typography>
        {transaction.category && (
          <Chip
            label={
              transaction.category.isEnabled === false
                ? `${transaction.category.name} - disabled`
                : transaction.category.name
            }
            size="small"
            sx={{
              mt: 1,
              height: 20,
              fontSize: '0.7rem',
              bgcolor: transaction.category.isEnabled === false ? 'error.50' : 'primary.50',
              color: transaction.category.isEnabled === false ? 'error.main' : 'primary.main',
              fontWeight: 600,
            }}
          />
        )}
      </TableCell>
      <TableCell align="right">
        {transaction.debit ? (
          <Typography variant="body2" fontWeight="700" color="error.main">
            {formatNumber(transaction.debit, transaction.currency)}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">
        {transaction.credit ? (
          <Typography variant="body2" fontWeight="700" color="success.main">
            {formatNumber(transaction.credit, transaction.currency)}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary" fontFamily="monospace">
          {transaction.currency || FALLBACK_CURRENCY}
        </Typography>
      </TableCell>
    </TableRow>
  );
}
