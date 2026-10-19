'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchExchangeRate } from '@/app/lib/exchange-rate';

type RecordWithCurrency = { currencyValue?: string | null };

/**
 * Fetches conversion rates for every distinct currency present in `records` and
 * returns a `convert` helper that turns an amount into `targetCurrency`.
 * Amounts in unrecognized/not-yet-loaded currencies pass through unconverted.
 */
export function useCurrencyConversion(
  records: RecordWithCurrency[],
  targetCurrency: string,
): { convert: (amount: number, currency: string | null | undefined) => number } {
  const [rates, setRates] = useState<Record<string, number>>({});

  const currenciesKey = useMemo(() => {
    const set = new Set(
      records
        .map(r => (r.currencyValue || '').toUpperCase())
        .filter(c => c && c !== targetCurrency),
    );
    return Array.from(set).sort().join(',');
  }, [records, targetCurrency]);

  useEffect(() => {
    const currencies = currenciesKey ? currenciesKey.split(',') : [];
    if (currencies.length === 0) {
      return;
    }
    let cancelled = false;

    const loadRates = async (): Promise<void> => {
      const entries = await Promise.all(
        currencies.map(
          async from => [from, await fetchExchangeRate(from, targetCurrency)] as const,
        ),
      );
      if (cancelled) {
        return;
      }
      setRates(prev => {
        const next = { ...prev };
        for (const [from, rate] of entries) {
          if (rate !== null) {
            next[from] = rate;
          }
        }
        return next;
      });
    };

    void loadRates();
    return () => {
      cancelled = true;
    };
  }, [currenciesKey, targetCurrency]);

  const convert = useCallback(
    (amount: number, currency: string | null | undefined): number => {
      const source = (currency || '').toUpperCase();
      if (!source || source === targetCurrency) {
        return amount;
      }
      const rate = rates[source];
      return rate !== undefined ? amount * rate : amount;
    },
    [rates, targetCurrency],
  );

  return { convert };
}
