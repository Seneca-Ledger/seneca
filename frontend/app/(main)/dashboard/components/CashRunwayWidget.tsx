'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import type React from 'react';
import { CardLink, DashboardCard, ListRow } from '@/app/components/dashboard/ui';
import { AlertTriangle } from '@/app/components/icons';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import { fillTemplate, text } from '../helpers/dashboard-helpers';

interface CommitmentItem {
  date: string;
  label: string;
  amount: number;
  source: 'payable' | 'subscription';
  sourceId: string;
  isOverdue: boolean;
}

interface Commitments {
  currency: string;
  horizonDays: number;
  openingBalance: number;
  totalCommitted: number;
  unscheduledCommitted: number;
  items: CommitmentItem[];
  lowestBalance: number;
  lowestBalanceDate: string;
  shortfallDate: string | null;
}

const HORIZON_DAYS = 60;
const VISIBLE_ITEMS = 5;

type CashRunwayWidgetProps = {
  formatAmount: (value: number) => string;
};

/** Cached, so the widget is drawn at once when Overview is opened again. */
function useCommitments(): { data: Commitments | null; loaded: boolean } {
  const workspaceId = useWorkspaceId();
  const { data, isPending } = useQuery({
    queryKey: queryKeys.dashboardCommitments(workspaceId, HORIZON_DAYS),
    queryFn: ({ signal }) =>
      apiQuery<Commitments>({
        url: '/dashboard/commitments',
        params: { days: HORIZON_DAYS },
        signal,
      }),
    enabled: Boolean(workspaceId),
  });
  // A failed projection shows the empty state rather than breaking the dashboard.
  return { data: data ?? null, loaded: !isPending };
}

function RunwayBody({
  data,
  formatAmount,
}: {
  data: Commitments;
  formatAmount: (value: number) => string;
}): React.JSX.Element {
  const t = useIntlayer('cashRunwayWidget');
  const hasShortfall = data.shortfallDate !== null;
  const summary = hasShortfall
    ? fillTemplate(text(t.shortfallSummary), {
        date: data.shortfallDate ?? '',
        days: String(data.horizonDays),
      })
    : fillTemplate(text(t.safeSummary), {
        amount: formatAmount(data.lowestBalance),
        days: String(data.horizonDays),
      });
  return (
    <>
      <p
        className={clsx(
          'lumio-dashboard__card-note',
          hasShortfall && 'lumio-dashboard__card-note--danger',
        )}
      >
        {hasShortfall && <AlertTriangle size={15} />}
        <span>{summary}</span>
      </p>
      <div className="lumio-dashboard__list">
        {data.items.slice(0, VISIBLE_ITEMS).map(item => (
          <ListRow
            key={`${item.source}-${item.sourceId}-${item.date}`}
            primary={item.label}
            secondary={
              item.isOverdue ? (
                <span className="lumio-dashboard__amount--negative">{t.overdue}</span>
              ) : (
                item.date
              )
            }
            trailing={formatAmount(item.amount)}
          />
        ))}
      </div>
      {data.unscheduledCommitted > 0 && (
        <p className="lumio-dashboard__card-note lumio-dashboard__card-note--footer">
          {fillTemplate(text(t.unscheduled), { amount: formatAmount(data.unscheduledCommitted) })}
        </p>
      )}
    </>
  );
}

export function CashRunwayWidget({
  formatAmount,
}: CashRunwayWidgetProps): React.JSX.Element | null {
  const t = useIntlayer('cashRunwayWidget');
  const { data, loaded } = useCommitments();

  if (!loaded) {
    return null;
  }

  const isEmpty = !data || (data.items.length === 0 && data.unscheduledCommitted === 0);
  return (
    <DashboardCard title={t.title} action={<CardLink href="/forecast">{t.openForecast}</CardLink>}>
      {isEmpty ? (
        <div className="lumio-dashboard__card-empty">{t.emptyDescription}</div>
      ) : (
        <RunwayBody data={data} formatAmount={formatAmount} />
      )}
    </DashboardCard>
  );
}
