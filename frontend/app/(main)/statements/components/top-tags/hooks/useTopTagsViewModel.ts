import {
  buildTopCategoriesLabels,
  createTx,
} from '@/app/(main)/statements/components/top-categories/helpers/buildTopCategoriesLabels';
import type { TopCategoriesDataReturn } from '@/app/(main)/statements/components/top-categories/hooks/useTopCategoriesData';
import {
  type TopCategoriesStateReturn,
  useTopCategoriesState,
} from '@/app/(main)/statements/components/top-categories/hooks/useTopCategoriesState';
import { useTopTagsData } from '@/app/(main)/statements/components/top-tags/hooks/useTopTagsData';
import {
  type TopAnalyticsViewModelReturn,
  useTopAnalyticsViewModel,
} from '@/app/(main)/statements/hooks/useTopAnalyticsViewModel';

type TxFn = (path: string[]) => string;

/** The category labels, with the ones that name what a row is said for tags. */
export const buildTopTagsLabels = (tx: TxFn): Record<string, string> => ({
  ...buildTopCategoriesLabels(tx),
  title: tx(['topTagsAnalytics', 'title']),
  leaderboard: tx(['topTagsAnalytics', 'leaderboard']),
  incomeLeaderboard: tx(['topTagsAnalytics', 'incomeLeaderboard']),
  category: tx(['topTagsAnalytics', 'tag']),
  loadError: tx(['topTagsAnalytics', 'loadError']),
});

export type TopTagsViewModelReturn = TopAnalyticsViewModelReturn<
  TopCategoriesStateReturn,
  TopCategoriesDataReturn
>;

export const useTopTagsViewModel = (month: Date): TopTagsViewModelReturn =>
  useTopAnalyticsViewModel(
    {
      useStateHook: useTopCategoriesState,
      useDataHook: useTopTagsData,
      createTx,
      buildLabels: buildTopTagsLabels,
    },
    month,
  );
