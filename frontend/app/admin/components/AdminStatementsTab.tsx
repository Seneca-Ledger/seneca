'use client';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import React from 'react';
import { AlertCircle, RefreshCw, Trash2 } from '@/app/components/icons';
import { formatStoredDate } from '@/app/lib/user-format-store';

interface Statement {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  bankName: string;
  totalTransactions: number;
  createdAt: string;
  processedAt: string | null;
  errorMessage: string | null;
}

export interface AdminStatementsTabProps {
  statements: Statement[];
  loading: boolean;
  searchTerm: string;
  locale: string;
  labels: {
    search: string;
    refresh: React.ReactNode;
    tableHeaders: { key: string; label: React.ReactNode }[];
  };
  getStatusLabel: (status: string) => string;
  getStatusColor: (status: string) => 'success' | 'info' | 'error' | 'default';
  onSearchChange: (term: string) => void;
  onRefresh: () => void;
  onShowError: (statement: Statement) => void;
  onReprocess: (id: string) => void;
  onDelete: (id: string) => void;
}

function StatementActions({
  statement,
  loading,
  onShowError,
  onReprocess,
  onDelete,
}: {
  statement: Statement;
  loading: boolean;
  onShowError: (s: Statement) => void;
  onReprocess: (id: string) => void;
  onDelete: (id: string) => void;
}): React.JSX.Element {
  return (
    <>
      <IconButton
        size="small"
        onClick={() => onShowError(statement)}
        disabled={!statement.errorMessage}
      >
        <AlertCircle size={18} />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => onReprocess(statement.id)}
        disabled={statement.status === 'processing' || loading}
      >
        <RefreshCw size={18} />
      </IconButton>
      <IconButton size="small" onClick={() => onDelete(statement.id)}>
        <Trash2 size={18} />
      </IconButton>
    </>
  );
}

function StatementsTableBody({
  statements,
  locale,
  loading,
  getStatusLabel,
  getStatusColor,
  onShowError,
  onReprocess,
  onDelete,
}: {
  statements: Statement[];
  locale: string;
  loading: boolean;
  getStatusLabel: (s: string) => string;
  getStatusColor: (s: string) => 'success' | 'info' | 'error' | 'default';
  onShowError: (s: Statement) => void;
  onReprocess: (id: string) => void;
  onDelete: (id: string) => void;
}): React.JSX.Element {
  return (
    <TableBody>
      {statements.map(stmt => (
        <TableRow key={stmt.id}>
          <TableCell>{stmt.fileName}</TableCell>
          <TableCell>{stmt.fileType.toUpperCase()}</TableCell>
          <TableCell>{stmt.bankName}</TableCell>
          <TableCell>
            <Chip
              label={getStatusLabel(stmt.status)}
              color={getStatusColor(stmt.status)}
              size="small"
            />
          </TableCell>
          <TableCell>{stmt.totalTransactions || 0}</TableCell>
          <TableCell>{formatStoredDate(stmt.createdAt, locale)}</TableCell>
          <TableCell>
            {stmt.processedAt ? formatStoredDate(stmt.processedAt, locale) : '-'}
          </TableCell>
          <TableCell>
            <StatementActions
              statement={stmt}
              loading={loading}
              onShowError={onShowError}
              onReprocess={onReprocess}
              onDelete={onDelete}
            />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

export function AdminStatementsTab({
  statements,
  loading,
  searchTerm,
  locale,
  labels,
  getStatusLabel,
  getStatusColor,
  onSearchChange,
  onRefresh,
  onShowError,
  onReprocess,
  onDelete,
}: AdminStatementsTabProps): React.JSX.Element {
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
        <TextField
          label={labels.search}
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          inputProps={{ 'data-tour-id': 'admin-statements-search' }}
          sx={{ flexGrow: 1 }}
        />
        <Button variant="outlined" startIcon={<RefreshCw size={16} />} onClick={onRefresh}>
          {labels.refresh}
        </Button>
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {labels.tableHeaders.map(({ key, label }) => (
                <TableCell key={key}>{label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <StatementsTableBody
            statements={statements}
            locale={locale}
            loading={loading}
            getStatusLabel={getStatusLabel}
            getStatusColor={getStatusColor}
            onShowError={onShowError}
            onReprocess={onReprocess}
            onDelete={onDelete}
          />
        </Table>
      </TableContainer>
    </Box>
  );
}
