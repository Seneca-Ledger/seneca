'use client';

import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined';
import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { useTodayNote } from './overview-month';
import { CardEmpty, CardLink, Chip, ChipGroup, DashboardCard, ListRow } from './ui';

const DAYS = 7;
const VISIBLE_ITEMS = 6;

const fill = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );

/** Whole days from today to a `YYYY-MM-DD` day, by the calendar rather than the clock. */
function daysFromToday(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.UTC(year, month - 1, date) - start) / 86_400_000);
}

interface UpcomingChargesCardProps {
  /** Formats an amount in the workspace currency, which the summary is in. */
  formatAmount: (value: number) => string;
}

/**
 * The subscriptions that charge this week, so a card is topped up or a trial
 * cancelled in time, with what the subscriptions page flags beside it.
 */
export function UpcomingChargesCard({
  formatAmount,
}: UpcomingChargesCardProps): React.JSX.Element | null {
  const t = useIntlayer('overviewWidgets');
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const today = useTodayNote();
  const upcoming = useQuery({
    queryKey: queryKeys.subscriptionsUpcoming({ workspaceId, days: DAYS }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/subscriptions/upcoming',
        params: { days: DAYS },
        signal,
        contract: 'UpcomingSubscriptionList',
      }),
    enabled: Boolean(workspaceId),
  });
  // Same request and key as the subscriptions page, so either fills the other's cache.
  const summary = useQuery({
    queryKey: queryKeys.subscriptionsSummary(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/subscriptions/summary', signal, contract: 'SubscriptionSummary' }),
    enabled: Boolean(workspaceId),
  });

  // Without the list there is nothing to say; a viewer without access gets no card.
  if (!upcoming.data) {
    return null;
  }

  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const flags = summary.data
    ? [
        summary.data.priceChangeCount > 0 && {
          label: fill(t.priceChanges.value, { count: String(summary.data.priceChangeCount) }),
          // Rings every subscription whose price changed (data-attention-group).
          href: '/subscriptions?focus=price-changed',
        },
        summary.data.duplicateCount > 0 && {
          label: fill(t.duplicates.value, { count: String(summary.data.duplicateCount) }),
          href: undefined,
        },
      ].filter((flag): flag is { label: string; href: string | undefined } => Boolean(flag))
    : [];

  return (
    <DashboardCard
      title={t.sections.upcomingCharges}
      subtitle={today ? `${today} · ${t.upcomingSubtitle.value}` : t.upcomingSubtitle}
      action={<CardLink href="/subscriptions">{t.allSubscriptions}</CardLink>}
    >
      {upcoming.data.length === 0 ? (
        <CardEmpty icon={EventRepeatOutlined}>{t.upcomingEmpty}</CardEmpty>
      ) : (
        <div className="seneca-dashboard__list">
          {upcoming.data.slice(0, VISIBLE_ITEMS).map(item => {
            const day = item.nextChargeDate?.slice(0, 10) ?? null;
            const offset = day ? daysFromToday(day) : null;
            return (
              <ListRow
                key={item.id}
                href="/subscriptions"
                primary={item.vendorName}
                secondary={
                  day && offset !== null
                    ? `${formatStoredDateWithOptions(day, { day: 'numeric', month: 'short' })} · ${relative.format(offset, 'day')}`
                    : undefined
                }
                trailing={
                  <PrivateAmount>
                    {formatMoney(Number(item.amount), item.currency, locale)}
                  </PrivateAmount>
                }
              />
            );
          })}
        </div>
      )}
      {summary.data && summary.data.totalMonthlyCost > 0 && (
        <p className="seneca-dashboard__card-note seneca-dashboard__card-note--footer">
          {fillTemplateNodes(t.upcomingMonthly.value, {
            amount: formatAmount(summary.data.totalMonthlyCost),
          })}
        </p>
      )}
      {flags.length > 0 && (
        <ChipGroup>
          {flags.map(flag => (
            <Chip key={flag.label} tone="warning" href={flag.href}>
              {flag.label}
            </Chip>
          ))}
        </ChipGroup>
      )}
    </DashboardCard>
  );
}
