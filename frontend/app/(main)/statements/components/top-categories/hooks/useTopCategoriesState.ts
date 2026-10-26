'use client';

import type {
  CategorySortKey,
  TopCategoryFlowType,
} from '@/app/(main)/statements/components/top-categories.utils';
import {
  type TopAnalyticsStateReturn,
  useTopAnalyticsState,
} from '@/app/(main)/statements/hooks/useTopAnalyticsState';

export type TopCategoriesStateReturn = TopAnalyticsStateReturn<
  TopCategoryFlowType,
  CategorySortKey
>;

export const useTopCategoriesState = (): TopCategoriesStateReturn =>
  useTopAnalyticsState<TopCategoryFlowType, CategorySortKey>(
    'seneca-top-categories-filters',
    'spend',
    'amount',
  );
