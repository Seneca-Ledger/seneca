'use client';

import Skeleton from '@mui/material/Skeleton';
import React from 'react';
import type { LucideIcon } from '@/app/components/icons';
import { Card } from '@/app/components/ui/card';
import { fillTemplateNodes, PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import {
  AlarmClock,
  Calendar,
  ReceiptText,
  TrayArrowDown,
  WalletArrowUp,
} from '@/app/lib/category-line-icons';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { formatMoney } from '@/app/lib/format-money';
import type { PayableDirection, PayablesSummary } from '@/app/lib/payables-api';
import { getSummaryCardItems } from './payables-utils';

/** An overview shows whole units; cents only where they are a real part of the figure. */
const CENTS_BELOW = 100;

interface PayableSummaryCardsProps {
  /** Null while it loads: the cards keep their labels, the figures wait. */
  summary: PayablesSummary | null;
  locale?: string;
  currency?: string;
  direction?: PayableDirection;
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
const CARD_KEYS = ['toPay', 'overdue', 'dueThisWeek', 'paidTotal'];

/** What each figure is, drawn faintly behind it as on the dashboard tiles. */
const ICONS: Record<PayableDirection, Record<string, LucideIcon>> = {
  payable: {
    toPay: ReceiptText,
    overdue: AlarmClock,
    dueThisWeek: Calendar,
    paidTotal: WalletArrowUp,
  },
  receivable: {
    toPay: ReceiptText,
    overdue: AlarmClock,
    dueThisWeek: Calendar,
    paidTotal: TrayArrowDown,
  },
};

function PayableSummaryCards({
  summary,
  locale = 'en',
  currency = FALLBACK_CURRENCY,
  direction = 'payable',
  labels,
}: PayableSummaryCardsProps): React.JSX.Element {
  const loading = summary === null;
  const cards = summary
    ? getSummaryCardItems(summary)
    : CARD_KEYS.map(key => ({ key, value: 0, count: 0 }));
  const items = cards.map(item => ({
    ...item,
    label: labels[item.key as keyof typeof labels],
    icon: ICONS[direction][item.key],
  }));
  const converted = summary?.convertedCurrencies ?? [];
  const unbookedText = useIntlayer('payablesUnbooked');
  // Received on paper, not yet in an account: it counts as income once its bank row arrives.
  const unbooked = summary?.unbookedTotal ?? 0;
  const money = (value: number) =>
    formatMoney(value, currency, locale, {
      fractionDigits: Math.abs(value) < CENTS_BELOW ? 2 : 0,
    });

  return (
    <div className="seneca-payable-summary-wrap">
      <div className="seneca-payable-summary">
        {items.map(item => (
          <Card
            key={item.key}
            className="seneca-payable-summary__card"
            style={{ border: '1px solid var(--border-color)', boxShadow: 'none' }}
          >
            {/* One shape for every card: label, figure, count — so the row does not jump. */}
            {item.icon && <item.icon className="seneca-payable-summary__icon" aria-hidden="true" />}
            <div className="seneca-payable-summary__card-content">
              <div className="seneca-payable-summary__label">{item.label}</div>
              <div className={`seneca-payable-summary__value ${PRIVATE_CLASS}`}>
                {loading ? (
                  <Skeleton variant="text" width={120} />
                ) : item.value === 0 ? (
                  EMPTY
                ) : (
                  money(item.value)
                )}
              </div>
              <div className="seneca-payable-summary__count">
                {loading ? (
                  <Skeleton variant="text" width={56} />
                ) : (
                  `${item.count} ${labels.itemsSuffix}`
                )}
                {item.key === 'paidTotal' && unbooked > 0 && (
                  <span className="seneca-payable-summary__unbooked">
                    {' · '}
                    {fillTemplateNodes(unbookedText.notInAccountTotal.value, {
                      amount: money(unbooked),
                    })}
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {converted.length > 0 && (
        <p className="seneca-payable-summary__note">
          {labels.convertedNote
            .replace('{currency}', currency)
            .replace('{currencies}', converted.join(', '))}
        </p>
      )}
    </div>
  );
}

export default PayableSummaryCards;
