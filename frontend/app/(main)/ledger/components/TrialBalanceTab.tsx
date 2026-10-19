'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import type React from 'react';
import { useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage, getApiErrorStatus } from '@/app/lib/api-error';
import { useTrialBalance } from '../hooks/useLedger';
import { accountDisplayName, defaultPeriod, withDepth } from '../ledger.helpers';
import { PeriodPicker } from './PeriodPicker';

/** Opening, turnover and closing, each split into debit and credit. */
const AMOUNT_COLUMNS = [
  'openingDebit',
  'openingCredit',
  'debit',
  'credit',
  'closingDebit',
  'closingCredit',
] as const;

interface TrialBalanceTabProps {
  systemNames: Record<string, string>;
  onOpenAccount: (id: string) => void;
}

/** Оборотно-сальдовая ведомость: opening balance, turnover and closing balance per account. */
export function TrialBalanceTab({
  systemNames,
  onOpenAccount,
}: TrialBalanceTabProps): React.ReactElement {
  const t = useIntlayer('ledgerPage');
  const [period, setPeriod] = useState(defaultPeriod);
  const [allowStale, setAllowStale] = useState(false);
  const report = useTrialBalance({ ...period, allowStale }, period.dateFrom <= period.dateTo);
  // 409 here means the ledger is still catching up: offer the stale view instead of an error.
  const stale = report.isError && getApiErrorStatus(report.error) === 409 && !allowStale;

  return (
    <Stack spacing={2}>
      <PeriodPicker value={period} onChange={setPeriod} />

      {stale ? (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" onClick={() => setAllowStale(true)}>
              {t.showAnyway}
            </Button>
          }
        >
          <strong>{t.staleTitle}</strong> {t.staleText}
        </Alert>
      ) : null}
      {report.isError && !stale ? (
        <Alert severity="error">{getApiErrorMessage(report.error)}</Alert>
      ) : null}
      {report.isPending && !report.isError ? <CircularProgress size={24} /> : null}

      {report.data ? (
        <>
          <Stack direction="row" spacing={1}>
            <Chip
              size="small"
              color={report.data.balanced ? 'success' : 'error'}
              label={report.data.balanced ? t.balancedBadge : t.unbalancedBadge}
            />
            {report.data.freshness.upToDate ? null : (
              <Chip size="small" color="warning" label={t.staleShown} />
            )}
          </Stack>
          <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell rowSpan={2}>{t.accountLabel}</TableCell>
                  <TableCell colSpan={2} align="center">
                    {t.colOpening}
                  </TableCell>
                  <TableCell colSpan={2} align="center">
                    {t.colTurnover}
                  </TableCell>
                  <TableCell colSpan={2} align="center">
                    {t.colClosing}
                  </TableCell>
                </TableRow>
                <TableRow>
                  {[0, 1, 2].flatMap(group => [
                    <TableCell key={`d${group}`} align="right">
                      {t.sideDebit}
                    </TableCell>,
                    <TableCell key={`c${group}`} align="right">
                      {t.sideCredit}
                    </TableCell>,
                  ])}
                </TableRow>
              </TableHead>
              <TableBody>
                {withDepth(report.data.rows).map(row => (
                  <TableRow key={row.accountId} hover>
                    <TableCell
                      sx={{
                        pl: 2 + row.depth * 2.5,
                        fontWeight: row.isPostable ? 400 : 600,
                        cursor: row.isPostable ? 'pointer' : 'default',
                      }}
                      onClick={row.isPostable ? () => onOpenAccount(row.accountId) : undefined}
                    >
                      {row.code} · {accountDisplayName({ ...row, isSystem: true }, systemNames)}
                    </TableCell>
                    {AMOUNT_COLUMNS.map(column => (
                      <TableCell
                        key={column}
                        align="right"
                        sx={{ fontWeight: row.isPostable ? 400 : 600 }}
                      >
                        {row[column] === '0.00' ? '' : row[column]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t.totalRow} ({report.data.baseCurrency})
                  </TableCell>
                  {AMOUNT_COLUMNS.map(column => (
                    <TableCell key={column} align="right" sx={{ fontWeight: 700 }}>
                      {report.data.totals[column]}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
        </>
      ) : null}
    </Stack>
  );
}
