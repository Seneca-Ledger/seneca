import { useEffect, useMemo, useState } from 'react';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { fetchExchangeRate } from '@/app/lib/exchange-rate';
import type { StatementColumn } from '../columns/statement-columns';
import type { StatementsStatement as Statement } from './statementsViewTypes';

const normalizeCurrencyCode = (currency: string | null | undefined): string | null => {
  const normalized = String(currency || '')
    .trim()
    .toUpperCase();
  if (normalized === 'NIS' || normalized === '\u20aa') {
    return 'ILS';
  }
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
};

const resolveStatementCurrency = (statement: Statement): string | null =>
  normalizeCurrencyCode(
    statement.currency ||
      statement.parsedData?.currency ||
      statement.parsingDetails?.metadataExtracted?.currency ||
      statement.parsingDetails?.metadataExtracted?.headerDisplay?.currencyDisplay,
  );

const formatCurrentExchangeRateLabel = (from: string, to: string, rate: number): string => {
  const formattedRate = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: rate >= 10 ? 2 : 4,
  }).format(rate);
  return `1 ${from} = ${formattedRate} ${to}`;
};

/**
 * Today's rate into the workspace currency for each currency on the page
 * (and USD), as "1 EUR = 3.95 ILS", while the Exchange rate column is shown.
 */
export function useCurrentExchangeRateLabels({
  columns,
  workspaceCurrency,
  statements,
}: {
  columns: StatementColumn[];
  workspaceCurrency: string | null | undefined;
  statements: Statement[];
}): Record<string, string> {
  const [currentExchangeRateLabels, setCurrentExchangeRateLabels] = useState<
    Record<string, string>
  >({});
  const exchangeRateColumnVisible = columns.some(
    column => column.id === 'exchangeRate' && column.visible,
  );
  const exchangeRateTargetCurrency = normalizeCurrencyCode(workspaceCurrency) ?? FALLBACK_CURRENCY;
  const exchangeRateSourceCurrencies = useMemo(() => {
    if (!exchangeRateColumnVisible) {
      return [];
    }
    const currencies = new Set<string>(['USD']);
    for (const statement of statements) {
      const currency = resolveStatementCurrency(statement);
      if (currency && currency !== exchangeRateTargetCurrency) {
        currencies.add(currency);
      }
    }
    return Array.from(currencies).sort();
  }, [exchangeRateColumnVisible, exchangeRateTargetCurrency, statements]);

  useEffect(() => {
    if (!exchangeRateColumnVisible) {
      setCurrentExchangeRateLabels({});
      return;
    }

    const localLabels: Record<string, string> =
      exchangeRateTargetCurrency === 'USD'
        ? { 'USD:USD': formatCurrentExchangeRateLabel('USD', 'USD', 1) }
        : {};
    const sourceCurrenciesToLoad = exchangeRateSourceCurrencies.filter(
      from => from !== exchangeRateTargetCurrency,
    );

    if (sourceCurrenciesToLoad.length === 0) {
      setCurrentExchangeRateLabels(localLabels);
      return;
    }

    let cancelled = false;
    const target = exchangeRateTargetCurrency;

    const loadCurrentRates = async (): Promise<void> => {
      const entries = await Promise.all(
        sourceCurrenciesToLoad.map(async from => {
          const key = `${from}:${target}`;
          const rate = await fetchExchangeRate(from, target);
          if (rate === null) {
            return [key, null] as const;
          }
          return [key, formatCurrentExchangeRateLabel(from, target, rate)] as const;
        }),
      );

      if (cancelled) {
        return;
      }
      setCurrentExchangeRateLabels({
        ...localLabels,
        ...entries.reduce<Record<string, string>>((acc, [key, label]) => {
          if (label) {
            acc[key] = label;
          }
          return acc;
        }, {}),
      });
    };

    void loadCurrentRates();

    return () => {
      cancelled = true;
    };
  }, [exchangeRateColumnVisible, exchangeRateSourceCurrencies, exchangeRateTargetCurrency]);

  return currentExchangeRateLabels;
}
