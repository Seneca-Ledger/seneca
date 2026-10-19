'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { CreateCreditNoteInput } from '@/app/lib/credit-notes-api';
import { formatMoney } from '@/app/lib/format-money';
import type { Invoice } from '@/app/lib/invoices-api';

type CreditNoteDialogProps = {
  /** The invoice being credited; the dialog is closed while null. */
  invoice: Invoice | null;
  /** What is left that can be credited: the total less earlier credit notes. */
  creditable: number;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (payload: CreateCreditNoteInput) => void;
};

/**
 * Raises a credit note against one invoice.
 *
 * Opens on everything still creditable — most credits are for the whole
 * invoice — and a smaller figure scales the invoice's own lines, so each tax
 * rate comes back at the rate it went out at.
 */
export function CreditNoteDialog({
  invoice,
  creditable,
  submitting,
  onClose,
  onConfirm,
}: CreditNoteDialogProps): React.JSX.Element | null {
  const t = useIntlayer('invoicesPage');
  const { locale } = useLocale();
  const [amount, setAmount] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (!invoice) {
    return null;
  }

  const typed = amount ?? creditable.toFixed(2);
  const value = Math.round(Number(typed) * 100) / 100;
  const tooMuch = Number.isFinite(value) && value > creditable + 0.005;
  const valid = Number.isFinite(value) && value > 0 && !tooMuch;
  const partial = valid && value < creditable - 0.005;

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      size="sm"
      title={String(t.detail.creditNoteTitle.value)}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t.actions.cancel.value}
          </Button>
          <Button
            disabled={!valid || submitting}
            onClick={() =>
              onConfirm({
                reason: reason.trim() || undefined,
                applications: [
                  {
                    invoiceId: invoice.id,
                    // Everything creditable is the default, and the server
                    // works it out itself when no amount is given.
                    amount: partial ? value : undefined,
                  },
                ],
              })
            }
          >
            {t.detail.creditNoteConfirm.value}
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {invoice.invoiceNumber} · {formatMoney(Number(invoice.total), invoice.currency, locale)}
        </Typography>
        <TextField
          size="small"
          type="number"
          label={String(t.detail.creditNoteAmount.value)}
          value={typed}
          error={tooMuch}
          helperText={
            tooMuch
              ? String(t.detail.creditNoteTooMuch.value)
              : `${String(t.detail.creditNoteCreditable.value)} ${formatMoney(creditable, invoice.currency, locale)}`
          }
          onChange={event => setAmount(event.target.value)}
          inputProps={{ min: 0, step: 0.01, 'aria-label': String(t.detail.creditNoteAmount.value) }}
        />
        <TextField
          size="small"
          multiline
          minRows={2}
          label={String(t.detail.creditNoteReason.value)}
          value={reason}
          onChange={event => setReason(event.target.value)}
        />
        <Alert severity="info">{t.detail.creditNoteHint.value}</Alert>
      </Box>
    </ModalShell>
  );
}
