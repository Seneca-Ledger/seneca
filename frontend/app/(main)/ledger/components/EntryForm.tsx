'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { X } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { EntryInput } from '../hooks/useLedger';
import {
  accountDisplayName,
  amountToMinor,
  canPostEntry,
  draftBalance,
  formatMinor,
  isDraftSavable,
  newDraftLine,
  normaliseAmount,
  postableAccounts,
} from '../ledger.helpers';
import type { DraftLine, JournalEntry, LedgerAccount } from '../ledger.types';

interface EntryFormProps {
  baseCurrency: string;
  accounts: LedgerAccount[];
  systemNames: Record<string, string>;
  /** The saved draft, or null for a new entry. */
  draft: JournalEntry | null;
  busy: boolean;
  onSave: (input: EntryInput) => Promise<JournalEntry>;
  onPost: (id: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

const today = (): string => new Date().toISOString().slice(0, 10);

function linesOf(draft: JournalEntry | null, baseCurrency: string): DraftLine[] {
  if (!draft || draft.lines.length === 0) {
    return [newDraftLine('debit', baseCurrency), newDraftLine('credit', baseCurrency)];
  }
  return draft.lines.map(line => ({
    key: `saved-${line.lineNo}`,
    accountId: line.accountId,
    side: line.side,
    amount: line.amount,
    currency: line.currency,
  }));
}

/**
 * A manual entry. The difference is shown live for lines in the base
 * currency; lines in other currencies are converted by the server when the
 * draft is saved. Posting is offered only once the saved draft balances.
 */
export function EntryForm({
  baseCurrency,
  accounts,
  systemNames,
  draft,
  busy,
  onSave,
  onPost,
  onDelete,
}: EntryFormProps): React.ReactElement {
  const t = useIntlayer('ledgerPage');
  const [saved, setSaved] = useState<JournalEntry | null>(draft);
  const [entryDate, setEntryDate] = useState(draft?.entryDate ?? today());
  const [memo, setMemo] = useState(draft?.memo ?? '');
  const [lines, setLines] = useState<DraftLine[]>(() => linesOf(draft, baseCurrency));
  const [dirty, setDirty] = useState(draft === null);
  const [error, setError] = useState<string | null>(null);

  const choices = postableAccounts(accounts);
  const byId = new Map(accounts.map(account => [account.id, account]));
  const balance = draftBalance(lines, baseCurrency);
  const valid = isDraftSavable(entryDate, lines);
  const postable = canPostEntry({
    savedDifference: saved?.totals.difference ?? null,
    savedLines: saved?.lines.length ?? 0,
    dirty,
  });

  const edit = (key: string, patch: Partial<DraftLine>): void => {
    setLines(current => current.map(line => (line.key === key ? { ...line, ...patch } : line)));
    setDirty(true);
  };

  const save = (): void => {
    setError(null);
    onSave({
      entryDate,
      memo: memo.trim() || null,
      lines: lines.map(line => ({
        accountId: line.accountId,
        side: line.side,
        amount: normaliseAmount(line.amount),
        currency: line.currency,
      })),
    })
      .then(entry => {
        setSaved(entry);
        setLines(linesOf(entry, baseCurrency));
        setDirty(false);
      })
      .catch(err => setError(getApiErrorMessage(err)));
  };

  // Once saved, the server's figure is the truth: it has converted every currency.
  const shownDifference =
    saved && !dirty ? saved.totals.difference : formatMinor(balance.differenceMinor);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Box sx={{ flex: { sm: '0 0 200px' } }}>
          <CustomDatePicker
            label={t.dateLabel.value}
            value={entryDate}
            onChange={next => {
              setEntryDate(next);
              setDirty(true);
            }}
          />
        </Box>
        <TextField
          size="small"
          label={t.memoLabel.value}
          value={memo}
          onChange={event => {
            setMemo(event.target.value);
            setDirty(true);
          }}
          sx={{ flex: 1 }}
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
      </Stack>

      {lines.map(line => (
        <EntryLineRow
          key={line.key}
          line={line}
          choices={choices}
          account={byId.get(line.accountId)}
          systemNames={systemNames}
          removable={lines.length > 1}
          onChange={patch => edit(line.key, patch)}
          onRemove={() => {
            setLines(current => current.filter(item => item.key !== line.key));
            setDirty(true);
          }}
        />
      ))}

      <Box>
        <Button
          size="small"
          onClick={() => {
            setLines(current => [
              ...current,
              newDraftLine(balance.differenceMinor > 0 ? 'credit' : 'debit', baseCurrency),
            ]);
            setDirty(true);
          }}
        >
          {t.addLine}
        </Button>
      </Box>

      <BalanceStatus
        difference={shownDifference}
        baseCurrency={baseCurrency}
        pendingConversion={!balance.exact && dirty}
      />

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" disabled={!valid || busy || !dirty} onClick={save}>
          {t.saveDraft}
        </Button>
        <Button
          variant="contained"
          disabled={!postable || busy}
          onClick={() => saved && onPost(saved.id).catch(err => setError(getApiErrorMessage(err)))}
        >
          {t.post}
        </Button>
        {saved ? (
          <Button
            color="error"
            disabled={busy}
            onClick={() => onDelete(saved.id).catch(err => setError(getApiErrorMessage(err)))}
          >
            {t.deleteDraft}
          </Button>
        ) : null}
      </Stack>
      {postable ? null : (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {dirty && saved ? t.unsavedChanges : t.postHint}
        </Typography>
      )}
    </Stack>
  );
}

interface EntryLineRowProps {
  line: DraftLine;
  choices: LedgerAccount[];
  account: LedgerAccount | undefined;
  systemNames: Record<string, string>;
  removable: boolean;
  onChange: (patch: Partial<DraftLine>) => void;
  onRemove: () => void;
}

function EntryLineRow({
  line,
  choices,
  account,
  systemNames,
  removable,
  onChange,
  onRemove,
}: EntryLineRowProps): React.ReactElement {
  const t = useIntlayer('ledgerPage');
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
      <TextField
        select
        size="small"
        label={t.accountLabel.value}
        value={line.accountId}
        onChange={event => {
          const next = choices.find(choice => choice.id === event.target.value);
          // A cash account takes only its own currency.
          onChange({
            accountId: event.target.value,
            ...(next?.currency ? { currency: next.currency } : {}),
          });
        }}
        sx={{ flex: 2, minWidth: 200 }}
      >
        <MenuItem value="" disabled>
          {t.selectAccount}
        </MenuItem>
        {choices.map(choice => (
          <MenuItem key={choice.id} value={choice.id}>
            {choice.code} · {accountDisplayName(choice, systemNames)}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        value={line.side}
        onChange={event => onChange({ side: event.target.value as DraftLine['side'] })}
        sx={{ minWidth: 110 }}
        slotProps={{ htmlInput: { 'aria-label': t.sideLabel.value } }}
      >
        <MenuItem value="debit">{t.sideDebit}</MenuItem>
        <MenuItem value="credit">{t.sideCredit}</MenuItem>
      </TextField>
      <TextField
        size="small"
        label={t.amountLabel.value}
        value={line.amount}
        onChange={event => onChange({ amount: event.target.value })}
        error={line.amount !== '' && amountToMinor(line.amount) === null}
        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
        sx={{ maxWidth: 160 }}
      />
      <TextField
        size="small"
        label={t.currencyLabel.value}
        value={line.currency}
        disabled={Boolean(account?.currency)}
        onChange={event => onChange({ currency: event.target.value.toUpperCase().slice(0, 3) })}
        sx={{ maxWidth: 100 }}
      />
      <IconButton aria-label={t.removeLine.value} disabled={!removable} onClick={onRemove}>
        <X size={16} />
      </IconButton>
    </Stack>
  );
}

/** The live difference; green once debits and credits meet. */
function BalanceStatus({
  difference,
  baseCurrency,
  pendingConversion,
}: {
  difference: string;
  baseCurrency: string;
  pendingConversion: boolean;
}): React.ReactElement {
  const t = useIntlayer('ledgerPage');
  const zero = difference === '0.00';
  return (
    <Box
      role="status"
      sx={{
        p: 1.5,
        borderRadius: 1,
        bgcolor: zero ? 'success.light' : 'warning.light',
        color: zero ? 'success.contrastText' : 'warning.contrastText',
      }}
    >
      <Typography variant="body2" fontWeight={600}>
        {zero ? t.balanced : t.difference}: {difference} {baseCurrency}
      </Typography>
      {pendingConversion ? <Typography variant="caption">{t.foreignNote}</Typography> : null}
    </Box>
  );
}
