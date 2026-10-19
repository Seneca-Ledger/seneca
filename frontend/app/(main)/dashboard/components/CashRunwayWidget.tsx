'use client';

import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import type React from 'react';
import { NetWorthChart } from '@/app/(main)/net-worth/components/NetWorthChart';
import { useTodayNote } from '@/app/components/dashboard/overview-month';
import { useIsWideSection } from '@/app/components/dashboard/section-span';
import { CardEmpty, CardLink, DashboardCard, ListRow } from '@/app/components/dashboard/ui';
import { AlertTriangle } from '@/app/components/icons';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import type { DashboardCommitmentsResponse } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { fillTemplate, text } from '../helpers/dashboard-helpers';

type Commitments = DashboardCommitmentsResponse;

const HORIZON_DAYS = 60;
const VISIBLE_ITEMS = 5;
/** With the row to itself the card has room for the balance line and a longer list. */
const WIDE_VISIBLE_ITEMS = 10;

type CashRunwayWidgetProps = {
  formatAmount: (value: number) => string;
};

/** Cached, so the widget is drawn at once when Overview is opened again. */
function useCommitments(): { data: Commitments | null; loaded: boolean } {
  const workspaceId = useWorkspaceId();
  const { data, isPending } = useQuery({
    queryKey: queryKeys.dashboardCommitments(workspaceId, HORIZON_DAYS),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        contract: 'DashboardCommitmentsResponse',
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
  const wideText = useIntlayer('dashboardWideView');
  const wide = useIsWideSection();
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
  const items = (limit: number): React.JSX.Element => (
    <div className="seneca-dashboard__list">
      {data.items.slice(0, limit).map(item => (
        <ListRow
          key={`${item.source}-${item.sourceId}-${item.date}`}
          primary={item.label}
          secondary={
            item.isOverdue ? (
              <span className="seneca-dashboard__amount--negative">{t.overdue}</span>
            ) : (
              item.date
            )
          }
          trailing={formatAmount(item.amount)}
        />
      ))}
    </div>
  );
  return (
    <>
      <p
        className={clsx(
          'seneca-dashboard__card-note',
          hasShortfall && 'seneca-dashboard__card-note--danger',
        )}
      >
        {hasShortfall && <AlertTriangle size={15} />}
        <span>{summary}</span>
      </p>
      {wide && data.days.length > 1 ? (
        // With room: the projected balance day by day, beside what pulls it down.
        <div className="seneca-dashboard__chart-aside">
          <figure
            className="seneca-dashboard__chart-aside-main"
            aria-label={wideText.balanceByDay.value}
          >
            <NetWorthChart
              points={data.days.map(day => ({ date: day.date, value: day.balance }))}
              positive={!hasShortfall}
              formatValue={formatAmount}
            />
          </figure>
          {items(WIDE_VISIBLE_ITEMS)}
        </div>
      ) : (
        items(VISIBLE_ITEMS)
      )}{' '}
      {data.unscheduledCommitted > 0 && (
        <p className="seneca-dashboard__card-note seneca-dashboard__card-note--footer">
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
  const today = useTodayNote();
  const { data, loaded } = useCommitments();

  if (!loaded) {
    return null;
  }

  const isEmpty = !data || (data.items.length === 0 && data.unscheduledCommitted === 0);
  return (
    <DashboardCard
      title={t.title}
      subtitle={today}
      action={<CardLink href="/forecast">{t.openForecast}</CardLink>}
    >
      {isEmpty ? (
        <CardEmpty icon={EventAvailableOutlined}>{t.emptyDescription}</CardEmpty>
      ) : (
        <RunwayBody data={data} formatAmount={formatAmount} />
      )}
    </DashboardCard>
  );
}
