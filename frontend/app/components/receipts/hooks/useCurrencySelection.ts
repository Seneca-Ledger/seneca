'use client';

import { useMemo, useState } from 'react';
import { DEFAULT_RECENT_CURRENCIES } from '@/app/lib/currency';
import {
  buildCurrencySearchIndex,
  type CurrencySearchItem,
} from '@/app/lib/statement-expense-drawer';
import type { EditableReceiptParsedData } from '../receipt-types';

interface UseCurrencySelectionParams {
  value: EditableReceiptParsedData;
  onChange: (value: EditableReceiptParsedData) => void;
  onCurrencyChange?: (value: EditableReceiptParsedData) => void | Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function
export function useCurrencySelection({
  value,
  onChange,
  onCurrencyChange,
}: UseCurrencySelectionParams) {
  const [currencyDrawerOpen, setCurrencyDrawerOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [recentCurrencies, setRecentCurrencies] = useState<string[]>([
    ...DEFAULT_RECENT_CURRENCIES,
  ]);

  const currencyItems = useMemo(() => buildCurrencySearchIndex(), []);
  const currencyByCode = useMemo(
    () => new Map(currencyItems.map(item => [item.code, item] as const)),
    [currencyItems],
  );
  const selectedCurrencyItem = value.currency ? currencyByCode.get(value.currency) : null;
  const currencyQuery = currencySearch.trim().toLowerCase();

  const selectedMatchesSearch = useMemo(() => {
    if (!selectedCurrencyItem) return false;
    if (!currencyQuery) return true;
    return selectedCurrencyItem.searchText.includes(currencyQuery);
  }, [selectedCurrencyItem, currencyQuery]);

  const recentCurrencyItems = useMemo(
    () =>
      recentCurrencies
        .map(code => currencyByCode.get(code))
        .filter((item): item is CurrencySearchItem => Boolean(item))
        .filter(item => item.code !== value.currency),
    [recentCurrencies, currencyByCode, value.currency],
  );

  const allCurrencyItems = useMemo(() => {
    const source =
      currencyQuery.length > 0
        ? currencyItems.filter(item => item.searchText.includes(currencyQuery))
        : currencyItems;
    return source.filter(item => item.code !== value.currency);
  }, [currencyItems, currencyQuery, value.currency]);

  const pushRecentCurrency = (currencyCode: string): void => {
    setRecentCurrencies(prev => [currencyCode, ...prev.filter(item => item !== currencyCode)]);
  };

  const handleSelectCurrency = (currencyCode: string): void => {
    const nextValue = { ...value, currency: currencyCode };
    onChange(nextValue);
    void onCurrencyChange?.(nextValue);
    pushRecentCurrency(currencyCode);
    setCurrencySearch('');
    setCurrencyDrawerOpen(false);
  };

  const openCurrencyDrawer = (): void => {
    setCurrencyDrawerOpen(true);
  };
  const closeCurrencyDrawer = (): void => {
    setCurrencyDrawerOpen(false);
    setCurrencySearch('');
  };

  return {
    currencyDrawerOpen,
    currencySearch,
    setCurrencySearch,
    selectedCurrencyItem,
    currencyQuery,
    selectedMatchesSearch,
    recentCurrencyItems,
    allCurrencyItems,
    handleSelectCurrency,
    openCurrencyDrawer,
    closeCurrencyDrawer,
  };
}
