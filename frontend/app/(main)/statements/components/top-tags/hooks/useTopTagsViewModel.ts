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

type TxFn = (path: string[], fallback: string) => string;

/** The category labels, with the ones that name what a row is said for tags. */
export const buildTopTagsLabels = (tx: TxFn): Record<string, string> => ({
  ...buildTopCategoriesLabels(tx),
  title: tx(['topTagsAnalytics', 'title'], 'Top tags'),
  leaderboard: tx(['topTagsAnalytics', 'leaderboard'], 'Top tags list'),
  incomeLeaderboard: tx(['topTagsAnalytics', 'incomeLeaderboard'], 'Top income tags list'),
  category: tx(['topTagsAnalytics', 'tag'], 'Tag'),
  loadError: 'Failed to load tag data',
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
