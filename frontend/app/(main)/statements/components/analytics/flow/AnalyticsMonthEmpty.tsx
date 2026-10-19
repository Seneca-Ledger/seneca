'use client';

import { useMemo } from 'react';
import { resolveLocale } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { useAnalyticsPeriod } from '@/app/(main)/statements/components/analytics/flow/analytics-period';
import { EmptyStateIllustration } from '@/app/components/ui/EmptyStateIllustration';
import { useLocale } from '@/app/i18n';

type Props = {
  month: Date;
  isIncome: boolean;
  labels: { emptyMonthSpend: string; emptyMonthIncome: string; emptyMonthHint: string };
};

/** The month has nothing yet: say which month, and what fills it. */
export function AnalyticsMonthEmpty({ month, isIncome, labels }: Props): React.JSX.Element {
  const { locale } = useLocale();
  const period = useAnalyticsPeriod();
  const monthName = useMemo(
    () =>
      period?.label ??
      new Intl.DateTimeFormat(resolveLocale(locale), { month: 'long', year: 'numeric' }).format(
        month,
      ),
    [locale, month, period?.label],
  );
  const title = (isIncome ? labels.emptyMonthIncome : labels.emptyMonthSpend).replace(
    '{{month}}',
    monthName,
  );
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '32px 16px',
        textAlign: 'center',
      }}
    >
      <EmptyStateIllustration name="money-bag" size="md" />
      <p style={{ margin: '8px 0 0', fontSize: 18, fontWeight: 500, color: 'var(--foreground)' }}>
        {title}
      </p>
      <p style={{ margin: 0, maxWidth: 420, fontSize: 14, color: 'var(--text-muted)' }}>
        {labels.emptyMonthHint}
      </p>
    </div>
  );
}
