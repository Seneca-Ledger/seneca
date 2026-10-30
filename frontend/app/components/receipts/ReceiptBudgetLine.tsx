'use client';

import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type React from 'react';
import { fetchBudgets } from '@/app/(main)/budgets/hooks/useBudgetsPage';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { queryKeys } from '@/app/lib/query-keys';

/**
 * How the budget for the receipt's category stands in the period of the
 * receipt's date. Read only: the budget page is one click away. Nothing is
 * shown when no budget covers the category.
 */
export function ReceiptBudgetLine({
  categoryId,
  date,
}: {
  categoryId: string;
  date: string;
}): React.JSX.Element | null {
  const t = useIntlayer('receiptBudgetLine');
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const { data } = useQuery({
    queryKey: queryKeys.budgetsAt(workspaceId, date),
    queryFn: ({ signal }) => fetchBudgets(signal, date),
    enabled: Boolean(workspaceId),
  });

  const budget = data?.find(row => row.categoryId === categoryId);
  if (!budget) {
    return null;
  }
  const available = budget.availableAmount ?? budget.limitAmount;
  const left = available - budget.spentAmount;
  const money = (value: number) => formatMoney(value, budget.currency, locale);
  const [before, after] = (left < 0 ? t.over.value : t.left.value).split('{amount}');

  return (
    <Box>
      <Typography sx={{ mb: 0.5, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
        {t.label}
      </Typography>
      <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>
        <Link href="/budgets" style={{ color: 'var(--primary)' }}>
          {budget.name}
        </Link>
        {' · '}
        {before}
        <PrivateAmount>
          <Box
            component="span"
            sx={{
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 500,
              // An overrun is the one real signal here; a balance left stays ink.
              color: left < 0 ? 'var(--money-down)' : 'var(--foreground)',
            }}
          >
            {money(Math.abs(left))}
          </Box>
        </PrivateAmount>
        {after?.replace('{limit}', money(available))}
      </Typography>
    </Box>
  );
}
