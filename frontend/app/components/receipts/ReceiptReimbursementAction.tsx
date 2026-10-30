'use client';

import { Box, Typography } from '@mui/material';
import Link from 'next/link';
import type React from 'react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ActionRow } from '@/app/components/transactions/TransactionActionRow';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useIntlayer } from '@/app/i18n';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { payablesApi } from '@/app/lib/payables-api';

/**
 * "Someone will pay me back": books the receipt's amount as owed to the user,
 * on the Receive page, under the name of whoever owes it. When the money comes
 * in it is settled there like any other receivable.
 */
export function ReceiptReimbursementAction({
  vendor,
  amount,
  currency,
  statementId,
}: {
  vendor: string;
  amount: number;
  currency: string;
  statementId: string | null;
}): React.JSX.Element {
  const t = useIntlayer('receiptMoneyActions');
  const [open, setOpen] = useState(false);
  const [debtor, setDebtor] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);

  if (created) {
    return (
      <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>
        {t.owedCreated}{' '}
        <Link href="/statements/receive" style={{ color: 'var(--primary)' }}>
          {t.openReceive}
        </Link>
      </Typography>
    );
  }

  const submit = async () => {
    setSaving(true);
    await payablesApi
      .create({
        direction: 'receivable',
        vendor: debtor.trim(),
        amount,
        currency,
        statementId: statementId ?? undefined,
        comment: t.owedComment.value.replace('{vendor}', vendor),
      })
      .then(() => {
        setCreated(true);
        invalidateFinancialData();
      })
      .catch(() => toast.error(t.owedFailed.value))
      .finally(() => setSaving(false));
  };

  return (
    <Box>
      <ActionRow label={t.payMeBack} hint={t.payMeBackHint} onClick={() => setOpen(!open)} />
      {open && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Input
            aria-label={t.debtor.value}
            placeholder={t.debtor.value}
            value={debtor}
            maxLength={255}
            onChange={event => setDebtor(event.target.value)}
          />
          <Button disabled={saving || !debtor.trim()} onClick={() => void submit()}>
            {t.addOwed}
          </Button>
        </Box>
      )}
    </Box>
  );
}
