'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { PayeePicker } from './PayeePicker';
import type { PayeeRef } from './types';
import { useSetTransactionPayee } from './usePayees';

function fill(template: string, params: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => params[key] ?? '');
}

/**
 * The row's payee with a way to change it. The change is remembered for the
 * descriptor, so the next import of it lands on the same payee.
 */
export function TransactionPayeeField({
  transactionId,
  payee,
  counterpartyName,
}: {
  transactionId: string;
  payee: PayeeRef | null;
  counterpartyName: string;
}) {
  const t = useIntlayer('payees');
  const setPayee = useSetTransactionPayee();
  const [current, setCurrent] = useState<PayeeRef | null>(payee);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <Box
      data-testid="transaction-payee"
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, fontSize: 12 }}
    >
      <span style={{ color: 'var(--muted-foreground)' }}>{t.payee.value}:</span>
      <span style={{ fontWeight: 600 }}>{current?.name ?? '—'}</span>
      <IconButton
        size="small"
        aria-label={t.changePayee.value}
        title={t.changePayee.value}
        disabled={setPayee.isPending}
        onClick={event => setAnchor(event.currentTarget)}
        sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}
      >
        <Pencil size={14} />
      </IconButton>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        disableAutoFocus
      >
        <Box sx={{ p: 2 }}>
          <PayeePicker
            current={current}
            disabled={setPayee.isPending}
            onPick={(choice, name) => {
              setAnchor(null);
              void setPayee
                .mutateAsync({ transactionId, choice })
                .then(result => {
                  setCurrent(result.payee);
                  toast.success(fill(t.remembered.value, { raw: counterpartyName, payee: name }));
                })
                .catch((error: unknown) => toast.error(getApiErrorMessage(error, t.failed.value)));
            }}
          />
        </Box>
      </Popover>
    </Box>
  );
}
