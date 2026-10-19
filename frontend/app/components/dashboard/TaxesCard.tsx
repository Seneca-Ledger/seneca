'use client';

import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import {
  formatMoney as formatTaxMoney,
  type TaxDeadline,
} from '@/app/(main)/reports/components/tax-return.helpers';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { formatMoney } from '@/app/lib/format-money';
import { apiQueryDecoded, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { useTodayNote } from './overview-month';
import { DashboardCard, ListRow } from './ui';

/** Deadlines shown at once; the reports page has the rest. */
const VISIBLE_DEADLINES = 2;
/** A return missed longer ago than this is no longer news here. */
const OVERDUE_WINDOW_DAYS = 60;

const fill = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );

const DEADLINE_HREF: Record<TaxDeadline['kind'], string> = {
  vat_return: '/reports?tab=tax',
  income_tax: '/tax-declaration',
};

/**
 * What the tax side asks of the user now: how much to keep aside, how close
 * turnover is to the VAT threshold, and the next returns due. Each part shows
 * only when the workspace's tax setup makes it apply; with none, no card.
 */
export function TaxesCard(): React.JSX.Element | null {
  const t = useIntlayer('overviewWidgets');
  const today = useTodayNote();
  const taxText = useIntlayer('taxReturnView');
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  // Same requests and keys as the reports page, so the two share one cache.
  const reserve = useQuery({
    queryKey: queryKeys.taxReserve(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/tax/settings/reserve/amount', signal, contract: 'TaxReserve' }),
    enabled: Boolean(workspaceId),
  });
  const threshold = useQuery({
    queryKey: queryKeys.taxThreshold(workspaceId),
    queryFn: ({ signal }) =>
      apiClient
        .get('/tax/settings/threshold', { signal })
        // No status (not a business, or registered already): null, sent as an empty body.
        .then(response =>
          checkContract('TaxThresholdStatus', response.data || null, '/tax/settings/threshold'),
        ),
    enabled: Boolean(workspaceId),
  });
  const deadlines = useQuery({
    queryKey: queryKeys.taxDeadlines(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/tax/deadlines', signal, contract: 'TaxDeadlineList' }),
    enabled: Boolean(workspaceId),
  });

  // Nothing set up to reserve for: neither VAT nor a share of earnings.
  const held = reserve.data && (reserve.data.vat || reserve.data.incomeTax) ? reserve.data : null;
  const status = threshold.data?.threshold ? threshold.data : null;
  const due = (deadlines.data ?? [])
    .filter(item => !item.done && item.daysLeft >= -OVERDUE_WINDOW_DAYS)
    .slice(0, VISIBLE_DEADLINES);

  if (!(held || status || due.length > 0)) {
    return null;
  }

  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  return (
    <DashboardCard title={t.sections.taxes} subtitle={today}>
      <div className="seneca-dashboard__list">
        {held && (
          <ListRow
            href="/reports?tab=tax-year"
            primary={fill(t.reserveCaption.value, { year: String(held.year) })}
            trailing={formatMoney(held.total, held.currency, locale)}
          />
        )}
        {status && (
          <ListRow
            href="/reports?tab=tax"
            primary={taxText.registrationThreshold.value}
            secondary={taxText.thresholdProgress.value
              .replace('{turnover}', formatTaxMoney(status.turnover, status.currency))
              .replace('{threshold}', formatTaxMoney(status.threshold ?? 0, status.currency))
              .replace('{percent}', String(Math.round(status.percentUsed)))}
            trailing={
              <span
                className={
                  status.percentUsed >= 80 ? 'seneca-dashboard__amount--negative' : undefined
                }
              >
                {Math.round(status.percentUsed)}%
              </span>
            }
          />
        )}
        {due.map(item => (
          <ListRow
            key={`${item.kind}-${item.periodEnd}`}
            href={DEADLINE_HREF[item.kind] ?? '/reports?tab=tax'}
            primary={item.returnName}
            secondary={formatStoredDateWithOptions(item.dueDate, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            trailing={
              <span
                className={item.daysLeft < 0 ? 'seneca-dashboard__amount--negative' : undefined}
              >
                {relative.format(item.daysLeft, 'day')}
              </span>
            }
          />
        ))}
      </div>
    </DashboardCard>
  );
}
