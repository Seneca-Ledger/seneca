import {
  buildTopCategoriesLabels,
  createTx,
} from '@/app/(main)/statements/components/top-categories/helpers/buildTopCategoriesLabels';
import {
  type TopCategoriesDataReturn,
  useTopCategoriesData,
} from '@/app/(main)/statements/components/top-categories/hooks/useTopCategoriesData';
import {
  type TopCategoriesStateReturn,
  useTopCategoriesState,
} from '@/app/(main)/statements/components/top-categories/hooks/useTopCategoriesState';
import {
  type TopAnalyticsViewModelReturn,
  useTopAnalyticsViewModel,
} from '@/app/(main)/statements/hooks/useTopAnalyticsViewModel';

export type TopCategoriesViewModelReturn = TopAnalyticsViewModelReturn<
  TopCategoriesStateReturn,
  TopCategoriesDataReturn
>;

export const useTopCategoriesViewModel = (month: Date): TopCategoriesViewModelReturn =>
  useTopAnalyticsViewModel(
    {
      useStateHook: useTopCategoriesState,
      useDataHook: useTopCategoriesData,
      createTx,
      buildLabels: buildTopCategoriesLabels,
    },
    month,
  );
