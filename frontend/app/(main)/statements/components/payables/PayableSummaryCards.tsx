'use client';

import React from 'react';
import { Banknote, CalendarClock, CheckCircle2, Clock3 } from '@/app/components/icons';
import { Card } from '@/app/components/ui/card';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import type { PayablesSummary } from '@/app/lib/payables-api';
import { formatMoney, getSummaryCardItems } from './payables-utils';

interface PayableSummaryCardsProps {
  summary: PayablesSummary;
  locale?: string;
  currency?: string;
  labels: {
    toPay: string;
    overdue: string;
    dueThisWeek: string;
    paidTotal: string;
    itemsSuffix: string;
  };
}

const cardIcons = {
  toPay: Banknote,
  overdue: Clock3,
  dueThisWeek: CalendarClock,
  paidTotal: CheckCircle2,
} as const;

// eslint-disable-next-line max-lines-per-function
function PayableSummaryCards({
  summary,
  locale = 'en',
  currency = FALLBACK_CURRENCY,
  labels,
}: PayableSummaryCardsProps): React.JSX.Element {
  const items = getSummaryCardItems(summary).map(item => ({
    ...item,
    label: labels[item.key as keyof typeof labels],
    icon: cardIcons[item.key as keyof typeof cardIcons],
  }));

  return (
    <div className="lumio-payable-summary">
      {items.map(item => {
        const Icon = item.icon;
        const count = 'count' in item ? item.count : undefined;

        return (
          <Card
            key={item.key}
            style={{ border: '1px solid var(--border-color)', boxShadow: 'none' }}
          >
            <div className="lumio-payable-summary__card-content">
              <div className="lumio-payable-summary__card-header">
                <span>{item.label}</span>
                <span className="lumio-payable-summary__icon">
                  <Icon size={16} />
                </span>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    letterSpacing: '-0.025em',
                    color: 'var(--foreground)',
                  }}
                >
                  {formatMoney(item.value, currency, locale)}
                </div>
                {typeof count === 'number' ? (
                  <div style={{ marginTop: 4, fontSize: 14, color: 'var(--muted-foreground)' }}>
                    {count} {labels.itemsSuffix}
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default PayableSummaryCards;
