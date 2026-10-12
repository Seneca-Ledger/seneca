'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';

interface Props {
  amount: number;
  currency: string;
  date: string;
  workspaceCurrency: string;
  label: string;
  noRateLabel: string;
  formatAmount: (amount: number, currency: string) => string;
  inkLabel: string;
  inkValue: string;
}

type Quote = { rate: number; missing: boolean; rateDate: string | null };

/** The row's amount in the workspace currency with the rate used, or the plain fact that there is none. */
export function ConvertedAmountRow({
  amount,
  currency,
  date,
  workspaceCurrency,
  label,
  noRateLabel,
  formatAmount,
  inkLabel,
  inkValue,
}: Props): React.JSX.Element | null {
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    let active = true;
    apiQueryDecoded({
      url: '/exchange-rates',
      params: { from: currency, to: workspaceCurrency, date: date.slice(0, 10) },
      contract: 'ExchangeRateQuote',
    })
      .then(next => {
        if (active) setQuote(next);
      })
      .catch(() => {
        if (active) setQuote(null);
      });
    return () => {
      active = false;
    };
  }, [currency, workspaceCurrency, date]);

  if (!quote) return null;
  return (
    <div className="lumio-tx-detail__row" data-testid="converted-amount">
      <span style={{ color: inkLabel }}>{label}:</span>
      <span style={{ fontWeight: 600, color: inkValue }}>
        {quote.missing
          ? noRateLabel
          : `${formatAmount(Math.abs(amount) * quote.rate, workspaceCurrency)} · ${quote.rate.toFixed(4)}${
              quote.rateDate ? ` (${quote.rateDate})` : ''
            }`}
      </span>
    </div>
  );
}
