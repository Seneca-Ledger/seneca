'use client';

import Button from '@mui/material/Button';
import Link from 'next/link';
import type React from 'react';
import { fillTemplate, resolveLocale } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { ChevronRight, FileUp } from '@/app/components/icons';
import type { DashboardData } from '@/app/hooks/useDashboard';
import { useIntlayer, useLocale } from '@/app/i18n';
import { reviewHref } from '@/app/lib/review-links';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import {
  buildDataHealthMetrics,
  type DataHealthMetric,
  type DataHealthMetricKey,
  getRelativeTime,
} from './data-health-model';
import { DATA_HEALTH_HISTORY_METRICS, MonthlyHistoryCard } from './MonthlyHistoryCard';
import { DashboardCard, ListRow } from './ui';
import { useMonthLabel } from './use-month-label';

interface DataHealthTabProps {
  data: DashboardData;
  formatAmount: (value: number) => string;
  displayMonth: Date;
  onSelectMonth: (year: number, month: number) => void;
}

type Health = DashboardData['dataHealth'];
type DataHealthDictionary = ReturnType<typeof useIntlayer<'dataHealthTab'>>;
type FinanceOpsDictionary = ReturnType<typeof useIntlayer<'financeOpsTab'>>;

const METRIC_LABEL: Record<
  DataHealthMetricKey,
  | 'uncategorizedLabel'
  | 'statementErrorsLabel'
  | 'pendingReviewLabel'
  | 'receiptsPendingLabel'
  | 'parsingWarningsLabel'
> = {
  uncategorizedTransactions: 'uncategorizedLabel',
  statementsWithErrors: 'statementErrorsLabel',
  statementsPendingReview: 'pendingReviewLabel',
  receiptsPendingReview: 'receiptsPendingLabel',
  parsingWarnings: 'parsingWarningsLabel',
};

/** The verb on each open check, in the words the Finance ops list uses. */
const METRIC_ACTION: Record<
  DataHealthMetricKey,
  'actionCategorize' | 'actionReview' | 'actionMatch' | 'attentionOpen'
> = {
  uncategorizedTransactions: 'actionCategorize',
  statementsWithErrors: 'attentionOpen',
  statementsPendingReview: 'actionReview',
  receiptsPendingReview: 'actionMatch',
  parsingWarnings: 'attentionOpen',
};

const capitalize = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** A reference fact: a label, a figure of moderate size and one line under it. */
function FactCard({
  label,
  value,
  caption,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  caption?: React.ReactNode;
}): React.JSX.Element {
  return (
    <DashboardCard title={label}>
      <div className="seneca-fact__value">{value}</div>
      {caption && <div className="seneca-fact__caption">{caption}</div>}
    </DashboardCard>
  );
}

function LastUploadCard({ health }: { health: Health }): React.JSX.Element {
  const t = useIntlayer('dataHealthTab');
  const { locale } = useLocale();
  if (!health.lastUploadDate) {
    return (
      <FactCard
        label={t.lastUpload}
        value={t.noDataYet}
        caption={
          <Link href="/statements/submit" className="seneca-close-step__action">
            {t.uploadFirstStatement.value}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        }
      />
    );
  }
  const relative = getRelativeTime(health.lastUploadDate, {
    today: t.relativeToday.value,
    yesterday: t.relativeYesterday.value,
    daysAgo: t.relativeDaysAgo.value,
    oneWeekAgo: t.relativeOneWeekAgo.value,
    weeksAgo: t.relativeWeeksAgo.value,
    oneMonthAgo: t.relativeOneMonthAgo.value,
    monthsAgo: t.relativeMonthsAgo.value,
  });
  const exact = formatStoredDateWithOptions(
    health.lastUploadDate,
    { year: 'numeric', month: 'short', day: 'numeric' },
    resolveLocale(locale),
  );
  return <FactCard label={t.lastUpload} value={relative} caption={exact} />;
}

/** The money in rows Review still asks about: left out of every figure until confirmed. */
function NotCountedCard({
  health,
  formatAmount,
  displayMonth,
}: {
  health: Health;
  formatAmount: (value: number) => string;
  displayMonth: Date;
}): React.JSX.Element {
  const t = useIntlayer('dataHealthTab');
  const ops = useIntlayer('financeOpsTab');
  // Whether anything waits is a matter of rows, not of the sum: unconfirmed
  // spending makes it negative, and rows can cancel out to zero.
  const pending = health.statementsPendingReview > 0;
  const amount = health.unapprovedCash;
  return (
    <FactCard
      label={t.notCountedLabel}
      value={amount < 0 ? `−${formatAmount(Math.abs(amount))}` : formatAmount(amount)}
      caption={
        pending ? (
          <>
            {t.notCountedHint.value}{' '}
            <Link href={reviewHref(displayMonth)} className="seneca-close-step__action">
              {ops.actionReview.value}
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
          </>
        ) : (
          t.allConfirmed.value
        )
      }
    />
  );
}

function ActionRequiredCard({
  open,
  t,
  ops,
}: {
  open: DataHealthMetric[];
  t: DataHealthDictionary;
  ops: FinanceOpsDictionary;
}): React.JSX.Element {
  return (
    <DashboardCard title={t.actionRequired}>
      <div className="seneca-dashboard__list">
        {open.map(metric => (
          <ListRow
            key={metric.key}
            className="seneca-close-step"
            leading={<span className="seneca-close-step__open" aria-hidden="true" />}
            primary={`${t[METRIC_LABEL[metric.key]].value}: ${metric.value}`}
            trailing={
              <Link href={metric.href} className="seneca-close-step__action">
                {ops[METRIC_ACTION[metric.key]].value}
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            }
          />
        ))}
      </div>
    </DashboardCard>
  );
}

/**
 * Data quality for the picked month: one line of how it stands, the checks
 * that need work (each once, with where to do it), and the year by month.
 */
export function DataHealthTab({
  data,
  formatAmount,
  displayMonth,
  onSelectMonth,
}: DataHealthTabProps): React.JSX.Element {
  const t = useIntlayer('dataHealthTab');
  const ops = useIntlayer('financeOpsTab');
  const month = capitalize(useMonthLabel(displayMonth));
  const health = data.dataHealth;
  const metrics = buildDataHealthMetrics(health, displayMonth);
  const open = metrics.filter(metric => metric.value > 0);
  const clear = metrics.filter(metric => metric.value === 0);

  return (
    <div className="seneca-dashboard__tab">
      <header className="seneca-close-head">
        <div>
          <h2 className="seneca-close-head__title">
            {open.length > 0
              ? fillTemplate(t.summaryAttention.value, {
                  month,
                  count: String(open.length),
                  total: String(metrics.length),
                })
              : fillTemplate(t.summaryClear.value, { month })}
          </h2>
          {open.length > 0 && clear.length > 0 && (
            <p className="seneca-close-head__note">
              {`${t.allGood.value}: ${clear.map(metric => t[METRIC_LABEL[metric.key]].value).join(' · ')}`}
            </p>
          )}
        </div>
        <Button
          component={Link}
          href="/statements?openExpenseDrawer=scan"
          variant="contained"
          size="small"
          startIcon={<FileUp size={16} />}
        >
          {ops.upload.value}
        </Button>
      </header>
      <MonthlyHistoryCard
        displayMonth={displayMonth}
        metrics={DATA_HEALTH_HISTORY_METRICS}
        onSelectMonth={onSelectMonth}
      />
      <div className="seneca-dashboard__grid seneca-dashboard__grid--pair">
        <LastUploadCard health={health} />
        <NotCountedCard health={health} formatAmount={formatAmount} displayMonth={displayMonth} />
      </div>
      {open.length > 0 && <ActionRequiredCard open={open} t={t} ops={ops} />}
    </div>
  );
}
