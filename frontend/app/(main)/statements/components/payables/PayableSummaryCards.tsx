'use client';

import React from 'react';
import { Card } from '@/app/components/ui/card';
import { useIntlayer } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { formatMoney } from '@/app/lib/format-money';
import type { PayablesSummary } from '@/app/lib/payables-api';
import { getSummaryCardItems } from './payables-utils';

/** An overview shows whole units; cents only where they are a real part of the figure. */
const CENTS_BELOW = 100;

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
    /** "In {currency}, converted from {currencies}": under the cards when bills were converted. */
    convertedNote: string;
  };
}

const EMPTY = '—';

function PayableSummaryCards({
  summary,
  locale = 'en',
  currency = FALLBACK_CURRENCY,
  labels,
}: PayableSummaryCardsProps): React.JSX.Element {
  const items = getSummaryCardItems(summary).map(item => ({
    ...item,
    label: labels[item.key as keyof typeof labels],
  }));
  const converted = summary.convertedCurrencies ?? [];
  const unbookedText = useIntlayer('payablesUnbooked');
  // Received on paper, not yet in an account: it counts as income once its bank row arrives.
  const unbooked = summary.unbookedTotal ?? 0;
  const money = (value: number) =>
    formatMoney(value, currency, locale, {
      fractionDigits: Math.abs(value) < CENTS_BELOW ? 2 : 0,
    });

  return (
    <div className="lumio-payable-summary-wrap">
      <div className="lumio-payable-summary">
        {items.map(item => (
          <Card
            key={item.key}
            style={{ border: '1px solid var(--border-color)', boxShadow: 'none' }}
          >
            {/* One shape for every card: label, figure, count — so the row does not jump. */}
            <div className="lumio-payable-summary__card-content">
              <div className="lumio-payable-summary__label">{item.label}</div>
              <div className="lumio-payable-summary__value">
                {item.value === 0 ? EMPTY : money(item.value)}
              </div>
              <div className="lumio-payable-summary__count">
                {item.count} {labels.itemsSuffix}
                {item.key === 'paidTotal' && unbooked > 0 && (
                  <span className="lumio-payable-summary__unbooked">
                    {' · '}
                    {unbookedText.notInAccountTotal.value.replace('{amount}', money(unbooked))}
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {converted.length > 0 && (
        <p className="lumio-payable-summary__note">
          {labels.convertedNote
            .replace('{currency}', currency)
            .replace('{currencies}', converted.join(', '))}
        </p>
      )}
    </div>
  );
}

export default PayableSummaryCards;
