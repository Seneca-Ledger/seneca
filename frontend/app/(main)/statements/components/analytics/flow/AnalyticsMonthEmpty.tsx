'use client';

import { useMemo } from 'react';
import { resolveLocale } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
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
  const monthName = useMemo(
    () =>
      new Intl.DateTimeFormat(resolveLocale(locale), { month: 'long', year: 'numeric' }).format(
        month,
      ),
    [locale, month],
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
      <p style={{ marginTop: 8, fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>
        {title}
      </p>
      <p style={{ maxWidth: 420, fontSize: 13, color: 'var(--muted-foreground)' }}>
        {labels.emptyMonthHint}
      </p>
    </div>
  );
}
