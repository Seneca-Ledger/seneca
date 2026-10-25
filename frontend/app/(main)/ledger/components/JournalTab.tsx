'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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
import type React from 'react';
import { useState } from 'react';
import { Plus } from '@/app/components/icons';
import { useQuickActions } from '@/app/components/mobile/quick-actions-store';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { AppPagination } from '@/app/components/ui/pagination';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import { useJournalEntries, useJournalEntry, useLedgerMutations } from '../hooks/useLedger';
import type { EntrySource, EntryStatus, LedgerAccount } from '../ledger.types';
import { EntryDetail } from './EntryDetail';
import { EntryForm } from './EntryForm';
import { RevaluationButton } from './RevaluationButton';

interface JournalTabProps {
  baseCurrency: string;
  accounts: LedgerAccount[];
  systemNames: Record<string, string>;
  canPost: boolean;
}

/** `null` = drawer closed, `'new'` = a new entry, otherwise the id of the entry shown. */
type Open = null | 'new' | string;

const ENTRY_STATUSES: readonly EntryStatus[] = ['draft', 'posted', 'reversed'];
const ENTRY_SOURCES: readonly EntrySource[] = [
  'transaction',
  'manual',
  'opening_balance',
  'fx_revaluation',
  'invoice',
  'credit_note',
];

/** A select's value as a filter; anything else (the "all" item) is no filter. */
const asEntryStatus = (value: string): EntryStatus | '' =>
  ENTRY_STATUSES.find(status => status === value) ?? '';
const asEntrySource = (value: string): EntrySource | '' =>
  ENTRY_SOURCES.find(source => source === value) ?? '';

export function JournalTab({
  baseCurrency,
  accounts,
  systemNames,
  canPost,
}: JournalTabProps): React.ReactElement {
  const t = useIntlayer('ledgerPage');
  const [status, setStatus] = useState<EntryStatus | ''>('');
  const [source, setSource] = useState<EntrySource | ''>('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Open>(null);
  useQuickActions(
    canPost
      ? [{ id: 'new-entry', label: t.newEntry.value, icon: Plus, run: () => setOpen('new') }]
      : null,
  );

  const list = useJournalEntries({ status, source, page });
  const detail = useJournalEntry(open && open !== 'new' ? open : null);
  const mutations = useLedgerMutations();
  const busy =
    mutations.saveDraft.isPending ||
    mutations.postEntry.isPending ||
    mutations.reverseEntry.isPending ||
    mutations.deleteDraft.isPending;

  const statusLabel: Record<EntryStatus, React.ReactNode> = {
    draft: t.statusDraft,
    posted: t.statusPosted,
    reversed: t.statusReversed,
  };
  const sourceLabel: Record<EntrySource, React.ReactNode> = {
    transaction: t.sourceTransaction,
    manual: t.sourceManual,
    opening_balance: t.sourceOpening,
    fx_revaluation: t.sourceFx,
    invoice: t.sourceInvoice,
    credit_note: t.sourceCreditNote,
  };

  const renderDrawer = (): React.ReactNode => {
    if (open === 'new') {
      return (
        <EntryForm
          key="new"
          baseCurrency={baseCurrency}
          accounts={accounts}
          systemNames={systemNames}
          draft={null}
          busy={busy}
          onSave={input => mutations.saveDraft.mutateAsync({ id: null, input })}
          onPost={id => mutations.postEntry.mutateAsync(id).then(entry => setOpen(entry.id))}
          onDelete={id => mutations.deleteDraft.mutateAsync(id).then(() => setOpen(null))}
        />
      );
    }
    if (detail.isError) {
      return <Alert severity="error">{t.loadError}</Alert>;
    }
    if (!detail.data) {
      return <CircularProgress size={24} />;
    }
    if (detail.data.status === 'draft' && canPost) {
      return (
        <EntryForm
          key={detail.data.id}
          baseCurrency={baseCurrency}
          accounts={accounts}
          systemNames={systemNames}
          draft={detail.data}
          busy={busy}
          onSave={input => mutations.saveDraft.mutateAsync({ id: detail.data.id, input })}
          onPost={id => mutations.postEntry.mutateAsync(id).then(entry => setOpen(entry.id))}
          onDelete={id => mutations.deleteDraft.mutateAsync(id).then(() => setOpen(null))}
        />
      );
    }
    return (
      <EntryDetail
        entry={detail.data}
        canPost={canPost}
        busy={busy}
        onReverse={id =>
          mutations.reverseEntry.mutateAsync({ id }).then(reversal => setOpen(reversal.id))
        }
        onOpenEntry={setOpen}
      />
    );
  };

  const drawerTitle = (): React.ReactNode => {
    if (open === 'new') {
      return t.newEntry;
    }
    if (detail.data?.entryNo) {
      return `${t.entryTitle.value} #${detail.data.entryNo}`;
    }
    return t.draftTitle;
  };

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{
          alignItems: { sm: 'center' },
        }}
      >
        <TextField
          select
          size="small"
          label={t.filterStatus.value}
          value={status}
          onChange={event => {
            setStatus(asEntryStatus(event.target.value));
            setPage(1);
          }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">{t.allStatuses}</MenuItem>
          {(Object.keys(statusLabel) as EntryStatus[]).map(key => (
            <MenuItem key={key} value={key}>
              {statusLabel[key]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t.filterSource.value}
          value={source}
          onChange={event => {
            setSource(asEntrySource(event.target.value));
            setPage(1);
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">{t.allSources}</MenuItem>
          {(Object.keys(sourceLabel) as EntrySource[]).map(key => (
            <MenuItem key={key} value={key}>
              {sourceLabel[key]}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flex: 1 }} />
        {canPost ? <RevaluationButton /> : null}
        {canPost ? (
          <Button
            variant="contained"
            className="seneca-bottom-bar-source"
            onClick={() => setOpen('new')}
          >
            <Plus size={18} aria-hidden />
            {t.newEntry}
          </Button>
        ) : null}
      </Stack>

      {list.isError ? <Alert severity="error">{t.loadError}</Alert> : null}
      {list.data && list.data.total === 0 ? <Alert severity="info">{t.emptyJournal}</Alert> : null}
      {list.data && list.data.total > 0 ? (
        <Paper
          variant="outlined"
          sx={{ overflowX: 'auto', opacity: list.isPlaceholderData ? 0.6 : 1 }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t.colNo}</TableCell>
                <TableCell>{t.colDate}</TableCell>
                <TableCell>{t.colMemo}</TableCell>
                <TableCell>{t.colSource}</TableCell>
                <TableCell>{t.colStatus}</TableCell>
                <TableCell align="right">
                  {t.colAmount} ({baseCurrency})
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.data.data.map(entry => (
                <TableRow
                  key={entry.id}
                  hover
                  onClick={() => setOpen(entry.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{entry.entryNo ?? '—'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{entry.entryDate}</TableCell>
                  <TableCell
                    sx={{
                      maxWidth: 360,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.memo ?? ''}
                  </TableCell>
                  <TableCell>{sourceLabel[entry.source]}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={entry.reversalOfId ? t.reversal : statusLabel[entry.status]}
                    />
                  </TableCell>
                  <TableCell align="right" className={PRIVATE_CLASS}>
                    {entry.baseTotal}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      ) : null}
      {list.data && list.data.totalPages > 1 ? (
        <AppPagination page={page} total={list.data.totalPages} onChange={setPage} />
      ) : null}

      <DrawerShell
        isOpen={open !== null}
        onClose={() => setOpen(null)}
        title={drawerTitle()}
        width="xl"
      >
        {open !== null ? renderDrawer() : null}
      </DrawerShell>
    </Stack>
  );
}
