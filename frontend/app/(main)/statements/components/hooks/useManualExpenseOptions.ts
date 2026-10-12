'use client';

import { useState } from 'react';
import apiClient from '@/app/lib/api';
import { checkContract } from '@/app/lib/query-fn-schema';
import type { StatementCategoryNode } from '@/app/lib/statement-categories';
import type { TaxRateOption } from '@/app/lib/statement-expense-drawer';
import {
  filterEnabledCategories,
  type StatementCategoryWithEnabled,
} from '../StatementsListView.utils';

interface UseManualExpenseOptionsReturn {
  manualExpenseCategories: StatementCategoryNode[];
  manualExpenseTaxRates: TaxRateOption[];
  loadManualExpenseOptions: () => Promise<void>;
}

async function fetchManualExpenseOptions(): Promise<{
  categories: StatementCategoryNode[];
  taxRates: TaxRateOption[];
}> {
  const [categoriesResponse, taxRatesResponse] = await Promise.all([
    apiClient.get('/categories', { params: { type: 'expense' } }),
    apiClient.get('/tax-rates'),
  ]);

  const rawCategories: StatementCategoryWithEnabled[] = await checkContract(
    'CategoryList',
    categoriesResponse.data,
    '/categories',
  );

  const rawTaxRates = (taxRatesResponse.data?.data ?? taxRatesResponse.data ?? []) as Array<
    TaxRateOption & { rate: number | string }
  >;

  return {
    categories: filterEnabledCategories(rawCategories),
    taxRates: rawTaxRates.map(taxRate => ({
      ...taxRate,
      rate: Number(taxRate.rate ?? 0),
      isEnabled: taxRate.isEnabled !== false,
    })),
  };
}

export function useManualExpenseOptions(): UseManualExpenseOptionsReturn {
  const [manualExpenseCategories, setManualExpenseCategories] = useState<StatementCategoryNode[]>(
    [],
  );
  const [manualExpenseTaxRates, setManualExpenseTaxRates] = useState<TaxRateOption[]>([]);

  // The request lives in a module-level helper: React Compiler skips hooks
  // whose try/catch contains optional chaining.
  const loadManualExpenseOptions = async (): Promise<void> => {
    const options = await fetchManualExpenseOptions().catch((error: unknown) => {
      console.error('Failed to load manual expense options:', error);
      return null;
    });
    setManualExpenseCategories(options ? options.categories : []);
    setManualExpenseTaxRates(options ? options.taxRates : []);
  };

  return { manualExpenseCategories, manualExpenseTaxRates, loadManualExpenseOptions };
}
