'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useState } from 'react';
import { RotateCcw } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { JournalEntry } from '../ledger.types';

interface EntryDetailProps {
  entry: JournalEntry;
  canPost: boolean;
  busy: boolean;
  onReverse: (id: string) => Promise<unknown>;
  onOpenEntry: (id: string) => void;
}

/** A booked entry, read-only: the only thing left to do with it is reverse it. */
export function EntryDetail({
  entry,
  canPost,
  busy,
  onReverse,
  onOpenEntry,
}: EntryDetailProps): React.ReactElement {
  const t = useIntlayer('ledgerPage');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const reversible = entry.status === 'posted' && !entry.reversalOfId;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {entry.entryDate}
        </Typography>
        <Chip
          size="small"
          label={entry.status === 'reversed' ? t.statusReversed : t.statusPosted}
        />
        {entry.reversalOfId ? (
          <Chip
            size="small"
            variant="outlined"
            label={t.reversal}
            onClick={() => onOpenEntry(entry.reversalOfId as string)}
          />
        ) : null}
      </Stack>
      {entry.memo ? <Typography variant="body2">{entry.memo}</Typography> : null}

      <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t.accountLabel}</TableCell>
              <TableCell align="right">{t.sideDebit}</TableCell>
              <TableCell align="right">{t.sideCredit}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entry.lines.map(line => (
              <TableRow key={line.lineNo}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }} component="span">
                    {line.accountCode}
                  </Typography>{' '}
                  {line.accountName}
                </TableCell>
                <TableCell align="right">{line.side === 'debit' ? amountCell(line) : ''}</TableCell>
                <TableCell align="right">
                  {line.side === 'credit' ? amountCell(line) : ''}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>
                {t.totalsLabel} ({entry.baseCurrency})
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {entry.totals.baseDebit}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {entry.totals.baseCredit}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {entry.reversedById ? (
        <Button
          variant="text"
          onClick={() => onOpenEntry(entry.reversedById as string)}
          sx={{ alignSelf: 'flex-start' }}
        >
          {t.reversedBy}
        </Button>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {canPost && reversible ? (
        confirming ? (
          <Alert
            severity="warning"
            action={
              <Button
                color="inherit"
                size="small"
                disabled={busy}
                onClick={() => onReverse(entry.id).catch(err => setError(getApiErrorMessage(err)))}
              >
                {t.reverse}
              </Button>
            }
          >
            {t.reverseConfirm}
          </Alert>
        ) : (
          <Button
            startIcon={<RotateCcw size={16} />}
            variant="outlined"
            onClick={() => setConfirming(true)}
            sx={{ alignSelf: 'flex-start' }}
          >
            {t.reverse}
          </Button>
        )
      ) : null}
    </Stack>
  );
}

/** Foreign-currency lines show what was booked and what it came to in the base. */
function amountCell(line: JournalEntry['lines'][number]): string {
  return line.currency === '' || line.baseAmount === line.amount
    ? line.amount
    : `${line.amount} ${line.currency} → ${line.baseAmount}`;
}
