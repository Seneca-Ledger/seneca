import { useMemo, useState } from 'react';
import { DEFAULT_RECENT_CURRENCIES } from '@/app/lib/currency';
import {
  buildCurrencySearchIndex,
  type CurrencySearchItem,
} from '@/app/lib/statement-expense-drawer';

/** Currency picker state for the overview form: search, recents and the "not selected" match. */
export function useCurrencyState(
  currency: string,
  notSelectedLabel: string,
): {
  selectedCurrencyItem: CurrencySearchItem | null | undefined;
  currencyQuery: string;
  selectedMatchesSearch: boolean;
  recentCurrencyItems: CurrencySearchItem[];
  allCurrencyItems: CurrencySearchItem[];
  notSelectedMatchesSearch: boolean;
  currencySearch: string;
  setCurrencySearch: (v: string) => void;
  pushRecentCurrency: (code: string) => void;
} {
  const [currencySearch, setCurrencySearch] = useState('');
  const [recentCurrencies, setRecentCurrencies] = useState<string[]>([
    ...DEFAULT_RECENT_CURRENCIES,
  ]);
  const currencyItems = useMemo(() => buildCurrencySearchIndex(), []);
  const currencyByCode = useMemo(
    () => new Map(currencyItems.map(item => [item.code, item])),
    [currencyItems],
  );
  const selectedCurrencyItem = currency ? currencyByCode.get(currency) : null;
  const currencyQuery = currencySearch.trim().toLowerCase();

  const selectedMatchesSearch = useMemo(() => {
    if (!(selectedCurrencyItem && currencyQuery)) {
      return Boolean(selectedCurrencyItem);
    }
    return selectedCurrencyItem.searchText.includes(currencyQuery);
  }, [selectedCurrencyItem, currencyQuery]);

  const recentCurrencyItems = useMemo(
    () =>
      recentCurrencies
        .map(code => currencyByCode.get(code))
        .filter((item): item is CurrencySearchItem => Boolean(item))
        .filter(item => item.code !== currency),
    [recentCurrencies, currencyByCode, currency],
  );
  const allCurrencyItems = useMemo(() => {
    const source =
      currencyQuery.length > 0
        ? currencyItems.filter(item => item.searchText.includes(currencyQuery))
        : currencyItems;
    return source.filter(item => item.code !== currency);
  }, [currencyItems, currencyQuery, currency]);

  const notSelectedMatchesSearch =
    currencyQuery.length === 0 || notSelectedLabel.toLowerCase().includes(currencyQuery);
  const pushRecentCurrency = (code: string): void => {
    setRecentCurrencies(prev => [code, ...prev.filter(c => c !== code)]);
  };
  return {
    selectedCurrencyItem,
    currencyQuery,
    selectedMatchesSearch,
    recentCurrencyItems,
    allCurrencyItems,
    notSelectedMatchesSearch,
    currencySearch,
    setCurrencySearch,
    pushRecentCurrency,
  };
}
