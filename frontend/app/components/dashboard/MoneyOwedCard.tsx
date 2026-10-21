'use client';

import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { invoicesApi } from '@/app/lib/invoices-api';
import { queryKeys } from '@/app/lib/query-keys';
import { useTodayNote } from './overview-month';
import { DashboardCard, ListRow } from './ui';

interface MoneyOwedCardProps {
  /**
   * Bills to pay or scheduled, and, apart from them, bills past due: the
   * dashboard summary counts the two separately, in the workspace currency.
   */
  payable: number;
  overduePayable: number;
  formatAmount: (value: number) => string;
}

/**
 * Both sides of what is still open: invoices clients have not paid, one line
 * per currency since they do not add up, and bills still to pay.
 */
export function MoneyOwedCard({
  payable,
  overduePayable,
  formatAmount,
}: MoneyOwedCardProps): React.JSX.Element | null {
  const t = useIntlayer('overviewWidgets');
  const today = useTodayNote();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  // A workspace without invoicing, or a viewer without access, still sees its bills.
  const { data: ageing } = useQuery({
    queryKey: queryKeys.invoicesAgeing(workspaceId),
    queryFn: () => invoicesApi.ageing(),
    enabled: Boolean(workspaceId),
  });

  const receivables = (ageing?.totals ?? []).filter(total => total.total > 0);
  const owed = payable + overduePayable;
  if (receivables.length === 0 && owed <= 0) {
    return null;
  }

  const overdueLine = (amount: string | null) =>
    amount ? (
      <span className="seneca-dashboard__amount--negative">
        {fillTemplateNodes(t.overdueAmount.value, { amount })}
      </span>
    ) : (
      t.nothingOverdue.value
    );
  const several = receivables.length > 1;

  return (
    <DashboardCard title={t.sections.moneyOwed} subtitle={today}>
      <div className="seneca-dashboard__list">
        {receivables.map(total => {
          const money = (value: number) => formatMoney(value, total.currency, locale);
          const overdue = total.total - total.current;
          return (
            <ListRow
              key={total.currency}
              href="/invoices"
              primary={several ? `${t.owedToYou.value} · ${total.currency}` : t.owedToYou.value}
              secondary={overdueLine(overdue > 0 ? money(overdue) : null)}
              trailing={<PrivateAmount>{money(total.total)}</PrivateAmount>}
            />
          );
        })}
        {owed > 0 && (
          <ListRow
            href={overduePayable > 0 ? '/statements/pay?status=overdue' : '/statements/pay'}
            primary={t.youOwe.value}
            secondary={overdueLine(overduePayable > 0 ? formatAmount(overduePayable) : null)}
            trailing={<PrivateAmount>{formatAmount(owed)}</PrivateAmount>}
          />
        )}
      </div>
    </DashboardCard>
  );
}
