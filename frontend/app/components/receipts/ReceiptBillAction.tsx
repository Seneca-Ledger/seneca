'use client';

import { Box, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ActionRow } from '@/app/components/transactions/TransactionActionRow';
import { Button } from '@/app/components/ui/button';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { type AllocationSuggestion, payablesApi } from '@/app/lib/payables-api';

type Bill = AllocationSuggestion['allocations'][number];

/**
 * "Pays a bill": the open bills this receipt's transaction could settle, from
 * the server's suggestion (same currency, vendor matches first). Picking one
 * records a payment from the transaction on the Pay page.
 */
export function ReceiptBillAction({
  transactionId,
  paidOn,
}: {
  transactionId: string;
  paidOn: string | null;
}): React.JSX.Element {
  const t = useIntlayer('receiptMoneyActions');
  const { locale } = useLocale();
  const [suggestion, setSuggestion] = useState<AllocationSuggestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [paid, setPaid] = useState<string | null>(null);

  if (paid) {
    return (
      <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>
        {t.billPaid.value.replace('{vendor}', paid)}
      </Typography>
    );
  }

  const load = async () => {
    await payablesApi
      .allocationSuggestion(transactionId)
      .then(setSuggestion)
      .catch(() => toast.error(t.billFailed.value));
  };

  const pay = async (bill: Bill) => {
    setSaving(true);
    await payablesApi
      .allocate({
        transactionId,
        allocations: [{ payableId: bill.payableId, amount: bill.amount }],
        paidOn: paidOn ?? undefined,
      })
      .then(() => {
        setPaid(bill.vendor);
        invalidateFinancialData();
      })
      .catch(() => toast.error(t.billFailed.value))
      .finally(() => setSaving(false));
  };

  return (
    <Box>
      <ActionRow
        label={t.paysBill}
        hint={t.paysBillHint}
        onClick={() => (suggestion ? setSuggestion(null) : void load())}
      />
      {suggestion && suggestion.allocations.length === 0 && (
        <Typography sx={{ mt: 1, fontSize: 14, color: 'var(--text-muted)' }}>
          {t.noBills.value.replace('{currency}', suggestion.currency)}
        </Typography>
      )}
      {suggestion?.allocations.map(bill => (
        <Button
          key={bill.payableId}
          variant="ghost"
          disabled={saving}
          onClick={() => void pay(bill)}
          style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginTop: 4 }}
        >
          <span>{bill.vendor}</span>
          <PrivateAmount>{formatMoney(bill.amount, suggestion.currency, locale)}</PrivateAmount>
        </Button>
      ))}
    </Box>
  );
}
