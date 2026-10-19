'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useState } from 'react';
import { AppPagination } from '@/app/components/ui/pagination';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage, getApiErrorStatus } from '@/app/lib/api-error';
import { useAccountCard } from '../hooks/useLedger';
import { accountDisplayName, defaultPeriod, postableAccounts } from '../ledger.helpers';
import type { LedgerAccount } from '../ledger.types';
import { PeriodPicker } from './PeriodPicker';

interface AccountCardTabProps {
  accounts: LedgerAccount[];
  systemNames: Record<string, string>;
  accountId: string | null;
  onChangeAccount: (id: string) => void;
}

/** Карточка счёта: every line on one account in a period, with its running balance. */
export function AccountCardTab({
  accounts,
  systemNames,
  accountId,
  onChangeAccount,
}: AccountCardTabProps): React.ReactElement {
  const t = useIntlayer('ledgerPage');
  const [period, setPeriod] = useState(defaultPeriod);
  const [page, setPage] = useState(1);
  const [allowStale, setAllowStale] = useState(false);
  const card = useAccountCard(accountId, { ...period, allowStale, page });
  const stale = card.isError && getApiErrorStatus(card.error) === 409 && !allowStale;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          select
          size="small"
          label={t.accountLabel.value}
          value={accountId ?? ''}
          onChange={event => {
            onChangeAccount(event.target.value);
            setPage(1);
          }}
          sx={{ minWidth: 280 }}
        >
          <MenuItem value="" disabled>
            {t.selectAccount}
          </MenuItem>
          {postableAccounts(accounts).map(account => (
            <MenuItem key={account.id} value={account.id}>
              {account.code} · {accountDisplayName(account, systemNames)}
            </MenuItem>
          ))}
        </TextField>
        <PeriodPicker
          value={period}
          onChange={next => {
            setPeriod(next);
            setPage(1);
          }}
        />
      </Stack>

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
      {card.isError && !stale ? (
        <Alert severity="error">{getApiErrorMessage(card.error)}</Alert>
      ) : null}
      {accountId && card.isPending && !card.isError ? <CircularProgress size={24} /> : null}

      {card.data ? (
        <>
          <Typography variant="body2">
            {t.openingBalance}: <strong>{card.data.openingBalance}</strong> · {t.closingBalance}:{' '}
            <strong>{card.data.closingBalance}</strong> {card.data.baseCurrency}
          </Typography>
          {card.data.lines.length === 0 ? (
            <Alert severity="info">{t.emptyAccount}</Alert>
          ) : (
            <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t.colDate}</TableCell>
                    <TableCell>{t.colNo}</TableCell>
                    <TableCell>{t.colMemo}</TableCell>
                    <TableCell align="right">{t.sideDebit}</TableCell>
                    <TableCell align="right">{t.sideCredit}</TableCell>
                    <TableCell align="right">{t.colRunning}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {card.data.lines.map(line => (
                    <TableRow key={`${line.entryId}-${line.lineNo}`}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{line.entryDate}</TableCell>
                      <TableCell>{line.entryNo}</TableCell>
                      <TableCell
                        sx={{
                          maxWidth: 320,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {line.memo ?? ''}
                      </TableCell>
                      <TableCell align="right">
                        {line.side === 'debit' ? line.baseAmount : ''}
                      </TableCell>
                      <TableCell align="right">
                        {line.side === 'credit' ? line.baseAmount : ''}
                      </TableCell>
                      <TableCell align="right">{line.runningBalance}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
          {card.data.totalPages > 1 ? (
            <AppPagination page={page} total={card.data.totalPages} onChange={setPage} />
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
