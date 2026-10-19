'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { useLedgerMutations } from '../hooks/useLedger';
import type { RevaluationResult } from '../ledger.types';

const today = (): string => new Date().toISOString().slice(0, 10);

/** What the last request did, in words. */
function ResultAlert({ result }: { result: RevaluationResult }): React.ReactElement {
  const t = useIntlayer('ledgerPage');
  if (result.status === 'nothing_to_revalue') {
    return <Alert severity="info">{t.revalueNothing}</Alert>;
  }
  const { revaluation } = result;
  return (
    <Alert severity="success">
      {result.status === 'posted' ? t.revaluePosted : t.revalueUnchanged} #{revaluation.entryNo}
      {' · '}
      {t.revalueGain}: {revaluation.gain} · {t.revalueLoss}: {revaluation.loss}
    </Alert>
  );
}

/**
 * Revalues foreign-currency balances at the rate of a chosen day. The server
 * refuses a day before the latest revaluation, a future day, and a ledger
 * that is still catching up; those arrive as coded errors.
 */
export function RevaluationButton(): React.ReactElement {
  const t = useIntlayer('ledgerPage');
  const { revalue } = useLedgerMutations();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);

  const close = (): void => {
    setOpen(false);
    revalue.reset();
  };

  return (
    <>
      <Button variant="outlined" onClick={() => setOpen(true)}>
        {t.revalue}
      </Button>
      <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
        <DialogTitle>{t.revalueTitle}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t.revalueHint}
          </Typography>
          <CustomDatePicker
            label={t.revalueDate.value}
            size="medium"
            value={date}
            maxDate={today()}
            onChange={setDate}
          />
          {revalue.data ? <ResultAlert result={revalue.data} /> : null}
          {revalue.isError ? (
            <Alert severity="error">{getApiErrorMessage(revalue.error)}</Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>{t.close}</Button>
          <Button
            variant="contained"
            disabled={!date || revalue.isPending}
            onClick={() => revalue.mutate(date)}
          >
            {t.revalueConfirm}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
