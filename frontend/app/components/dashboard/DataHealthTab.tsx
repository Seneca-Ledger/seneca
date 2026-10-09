'use client';

import Link from 'next/link';
import type React from 'react';
import { resolveLocale } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { ChevronRight } from '@/app/components/icons';
import type { DashboardData } from '@/app/hooks/useDashboard';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { actionIcoClass, actionIcon, resolveActionPriority } from './action-items';
import {
  buildDataHealthMetrics,
  buildDataHealthQuickLinks,
  type DataHealthQuickLink,
  getRelativeTime,
} from './data-health-model';
import { DATA_HEALTH_HISTORY_METRICS, MonthlyHistoryCard } from './MonthlyHistoryCard';
import { Chip, ChipGroup, DashboardCard, KpiCard, SectionHeader } from './ui';

interface DataHealthTabProps {
  data: DashboardData;
  formatAmount: (value: number) => string;
  displayMonth: Date;
  onSelectMonth: (year: number, month: number) => void;
}

type Health = DashboardData['dataHealth'];

function fillCount(template: string, count: number): string {
  return template.split('{count}').join(String(count));
}

function LastUploadCard({ health }: { health: Health }): React.JSX.Element {
  const t = useIntlayer('dataHealthTab');
  const { locale } = useLocale();
  if (!health.lastUploadDate) {
    return (
      <KpiCard
        label={t.lastUpload.value}
        value={t.noDataYet}
        caption={<Link href="/statements/submit">{t.uploadFirstStatement}</Link>}
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
  return <KpiCard label={t.lastUpload.value} value={relative} caption={exact} />;
}

function UnapprovedCashCard({
  health,
  formatAmount,
}: {
  health: Health;
  formatAmount: (value: number) => string;
}): React.JSX.Element {
  const t = useIntlayer('dataHealthTab');
  const pending = health.unapprovedCash > 0;
  return (
    <KpiCard
      label={t.unapprovedCash.value}
      value={pending ? formatAmount(health.unapprovedCash) : t.allCashApproved}
      tone={pending ? 'warning' : 'positive'}
      caption={pending ? <Link href="/review">{t.reviewApproveCash}</Link> : undefined}
    />
  );
}

function ActionRequiredCard({ links }: { links: DataHealthQuickLink[] }): React.JSX.Element {
  const t = useIntlayer('dataHealthTab');
  return (
    <DashboardCard title={t.actionRequired}>
      <div className="lumio-dashboard__action-list">
        {links.map(link => {
          const Icon = actionIcon(link.type);
          return (
            <Link key={link.id} href={link.href} className="lumio-dashboard__action-row">
              <div
                className={`lumio-dashboard__action-ico ${actionIcoClass(resolveActionPriority(link.type))}`}
              >
                <Icon size={15} />
              </div>
              <div className="lumio-dashboard__action-body">
                <div className="lumio-dashboard__action-title">{link.label}</div>
              </div>
              <ChevronRight size={14} className="lumio-dashboard__action-chevron" />
            </Link>
          );
        })}
      </div>
    </DashboardCard>
  );
}

export function DataHealthTab({
  data,
  formatAmount,
  displayMonth,
  onSelectMonth,
}: DataHealthTabProps): React.JSX.Element {
  const t = useIntlayer('dataHealthTab');
  const health = data.dataHealth;
  const labels = {
    uncategorized: t.uncategorizedLabel.value,
    statementErrors: t.statementErrorsLabel.value,
    pendingReview: t.pendingReviewLabel.value,
    receiptsPending: t.receiptsPendingLabel.value,
    parsingWarnings: t.parsingWarningsLabel.value,
    quickLinkUncategorized: t.quickLinkUncategorized.value,
    quickLinkStatementErrors: t.quickLinkStatementErrors.value,
    quickLinkPendingStatements: t.quickLinkPendingStatements.value,
    quickLinkReceipts: t.quickLinkReceipts.value,
  };
  const metrics = buildDataHealthMetrics(health, labels);
  const quickLinks = buildDataHealthQuickLinks(health, labels);

  return (
    <div className="lumio-dashboard__tab">
      <ChipGroup wrap>
        <Chip href="/statements">{t.uploadParse}</Chip>
        <Chip href="/review">{fillCount(t.reviewQueue.value, health.statementsPendingReview)}</Chip>
      </ChipGroup>
      <section>
        <SectionHeader title={t.dataQualityMetrics} />
        <div className="lumio-dashboard__stat-grid lumio-dashboard__stat-grid--auto">
          {metrics.map(metric => (
            <KpiCard
              key={metric.key}
              label={metric.label}
              value={metric.value}
              tone={metric.tone}
              href={metric.href}
              caption={
                metric.value === 0
                  ? t.allGood.value
                  : t.metricNeedsAttention.value.split('{value}').join(String(metric.value))
              }
            />
          ))}
        </div>
      </section>
      <MonthlyHistoryCard
        displayMonth={displayMonth}
        metrics={DATA_HEALTH_HISTORY_METRICS}
        onSelectMonth={onSelectMonth}
      />
      <div className="lumio-dashboard__grid lumio-dashboard__grid--pair">
        <LastUploadCard health={health} />
        <UnapprovedCashCard health={health} formatAmount={formatAmount} />
      </div>
      {quickLinks.length > 0 && <ActionRequiredCard links={quickLinks} />}
    </div>
  );
}
