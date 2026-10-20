import { useTheme } from 'next-themes';
import { useMemo, useState } from 'react';
import {
  buildSpendOverTimeLabels,
  createTx,
} from '@/app/(main)/statements/components/spend-over-time/helpers/buildSpendOverTimeLabels';
import {
  type SpendOverTimeDataReturn,
  useSpendOverTimeData,
} from '@/app/(main)/statements/components/spend-over-time/hooks/useSpendOverTimeData';
import {
  type AnalyticsFilterOptionLabels,
  buildAnalyticsFilterLabels,
  buildAnalyticsFilterOptions,
} from '@/app/(main)/statements/helpers/analytics-filter-labels';
import {
  DEFAULT_SPEND_OVER_TIME_GROUP_BY,
  DEFAULT_SPEND_OVER_TIME_VIEW,
  type UseSpendOverTimeStateReturn,
  useSpendOverTimeState,
} from '@/app/(main)/statements/hooks/useSpendOverTimeState';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import { resolveCurrencyCode } from '@/app/lib/analytics-common';

type WorkspaceLike = { id: string; name?: string | null };
type SortKey = 'amount' | 'average' | 'operations';
type SourceLabels = {
  sourceBank: string;
  sourceReceipt: string;
  sourceCrypto: string;
};

const STORAGE_KEY = 'seneca-spend-over-time-filters-v3';

export type SpendOverTimeViewModelReturn = UseSpendOverTimeStateReturn &
  SpendOverTimeDataReturn & {
    labels: Record<string, string>;
    filterOptions: ReturnType<typeof buildAnalyticsFilterOptions>;
    filterOptionLabels: AnalyticsFilterOptionLabels;
    workspaces: WorkspaceLike[];
    workspaceCurrency: string;
    resolvedTheme: string | undefined;
    sourceLabels: SourceLabels;
    sortKey: SortKey;
    setSortKey: (key: SortKey) => void;
    searchInput: string;
    setSearchInput: (v: string) => void;
    selectedPeriod: string | null;
    setSelectedPeriod: (v: string | null) => void;
    groupByOptions: { value: string; label: string }[];
    viewOptions: { value: string; label: string }[];
    defaultGroupBy: string;
    defaultView: string;
  };

export const useSpendOverTimeViewModel = (): SpendOverTimeViewModelReturn => {
  const { user } = useAuth();
  const { currentWorkspace, workspaces } = useWorkspace();
  const { resolvedTheme } = useTheme();
  const workspaceCurrency = resolveCurrencyCode(currentWorkspace?.currency);
  const state = useSpendOverTimeState(STORAGE_KEY);
  const [sortKey, setSortKey] = useState<SortKey>('amount');
  const [searchInput, setSearchInput] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const t = useIntlayer('statementsPage');
  const spendT = useIntlayer('statementsSpendOverTime');
  const tx = useMemo(() => createTx(t), [t]);
  const labels = useMemo(() => buildSpendOverTimeLabels(tx), [tx]);
  const filterOptionLabels = useMemo(() => buildAnalyticsFilterLabels(tx), [tx]);
  const filterOptions = useMemo(
    () => buildAnalyticsFilterOptions(filterOptionLabels),
    [filterOptionLabels],
  );
  const data = useSpendOverTimeData({
    user,
    currentWorkspace,
    workspaces,
    workspaceCurrency,
    resolvedTheme,
    labels,
    state,
    sortKey,
    selectedPeriod,
    searchInput,
  });
  const sourceLabels = useMemo(
    () => ({
      sourceBank: labels.sourceBank,
      sourceReceipt: labels.sourceReceipt,
      sourceCrypto: labels.sourceCrypto,
    }),
    [labels],
  );
  const groupByOptions = useMemo(
    () => [
      { value: 'day', label: spendT.groupByDay.value },
      { value: 'week', label: spendT.groupByWeek.value },
      { value: 'month', label: spendT.groupByMonth.value },
      { value: 'quarter', label: spendT.groupByQuarter.value },
      { value: 'year', label: spendT.groupByYear.value },
    ],
    [spendT],
  );
  const viewOptions = useMemo(
    () => [
      { value: 'calendar', label: spendT.viewCalendar.value },
      { value: 'line', label: spendT.viewLine.value },
      { value: 'bar', label: spendT.viewBar.value },
      { value: 'stacked', label: spendT.viewStacked.value },
    ],
    [spendT],
  );
  return {
    ...state,
    ...data,
    labels,
    filterOptions,
    filterOptionLabels,
    workspaces,
    workspaceCurrency,
    resolvedTheme,
    sourceLabels,
    sortKey,
    setSortKey,
    searchInput,
    setSearchInput,
    selectedPeriod,
    setSelectedPeriod,
    groupByOptions,
    viewOptions,
    defaultGroupBy: DEFAULT_SPEND_OVER_TIME_GROUP_BY,
    defaultView: DEFAULT_SPEND_OVER_TIME_VIEW,
  };
};
