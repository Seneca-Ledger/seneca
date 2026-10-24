'use client';

import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React from 'react';
import { DocumentTransactionRow } from './DocumentTransactionRow';
import type { Transaction } from './types';

const CELL_HEADER_SX = {
  fontWeight: 700,
  fontSize: '0.75rem',
  color: 'text.secondary',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

type DocumentTransactionTableProps = {
  transactions: Transaction[];
  formatDate: (d: string | null | undefined) => string;
  formatNumber: (v: number | undefined | null, currency?: string) => string;
  labels: {
    transactionList: React.ReactNode;
    transactionListDescription: React.ReactNode;
    total: React.ReactNode;
    totalExpenses: React.ReactNode;
    totalIncome: React.ReactNode;
    colDate: React.ReactNode;
    colDocNumber: React.ReactNode;
    colCounterparty: React.ReactNode;
    colBin: React.ReactNode;
    colPurpose: React.ReactNode;
    colDebit: React.ReactNode;
    colCredit: React.ReactNode;
    colCurrency: React.ReactNode;
  };
  totalExpense: number;
  totalIncome: number;
};

// eslint-disable-next-line max-lines-per-function
export function DocumentTransactionTable({
  transactions,
  formatDate,
  formatNumber,
  labels,
  totalExpense,
  totalIncome,
}: DocumentTransactionTableProps): React.JSX.Element {
  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'grey.200',
        overflow: 'hidden',
        '@media print': { pageBreakInside: 'auto' },
      }}
    >
      <Box
        sx={{
          p: 3,
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderBottomColor: 'grey.200',
          '@media print': {
            backgroundColor: '#f5f5f5 !important',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
          },
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: '700',
            color: 'text.primary',
          }}
        >
          {labels.transactionList}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            mt: 0.5,
          }}
        >
          {labels.transactionListDescription}
        </Typography>
      </Box>
      <TableContainer sx={{ '@media print': { overflow: 'visible' } }}>
        <Table sx={{ minWidth: 650, '@media print': { fontSize: '0.85rem' } }}>
          <TableHead>
            <TableRow
              sx={{
                bgcolor: 'grey.100',
                '@media print': {
                  backgroundColor: '#f5f5f5 !important',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact',
                },
              }}
            >
              <TableCell sx={CELL_HEADER_SX}>{labels.colDate}</TableCell>
              <TableCell sx={CELL_HEADER_SX}>{labels.colDocNumber}</TableCell>
              <TableCell sx={CELL_HEADER_SX}>{labels.colCounterparty}</TableCell>
              <TableCell sx={CELL_HEADER_SX}>{labels.colBin}</TableCell>
              <TableCell sx={CELL_HEADER_SX}>{labels.colPurpose}</TableCell>
              <TableCell align="right" sx={CELL_HEADER_SX}>
                {labels.colDebit}
              </TableCell>
              <TableCell align="right" sx={CELL_HEADER_SX}>
                {labels.colCredit}
              </TableCell>
              <TableCell sx={CELL_HEADER_SX}>{labels.colCurrency}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map(tx => (
              <DocumentTransactionRow
                key={tx.id}
                transaction={tx}
                formatDate={formatDate}
                formatNumber={formatNumber}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box
        sx={{
          p: 3,
          bgcolor: 'grey.50',
          borderTop: '2px solid',
          borderTopColor: 'grey.300',
          '@media print': {
            backgroundColor: '#f5f5f5 !important',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
            pageBreakInside: 'avoid',
          },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: 4,
            alignItems: 'center',
          }}
        >
          <Typography
            variant="body1"
            sx={{
              fontWeight: '700',
              color: 'text.primary',
            }}
          >
            {labels.total}
          </Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
              }}
            >
              {labels.totalExpenses}
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: '700',
                color: 'error.main',
              }}
            >
              {formatNumber(totalExpense)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
              }}
            >
              {labels.totalIncome}
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: '700',
                color: 'success.main',
              }}
            >
              {formatNumber(totalIncome)}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
