'use client';

import { FiltersDrawer } from '@/app/(main)/statements/components/filters/FiltersDrawer';
import type {
  AnalyticsFilterOptionLabels,
  buildAnalyticsFilterOptions,
} from '@/app/(main)/statements/helpers/analytics-filter-labels';
import { buildFiltersDrawerLabels } from '@/app/(main)/statements/helpers/buildFiltersDrawerLabels';
import type { UseStatementFiltersReturn } from '@/app/(main)/statements/hooks/useStatementFilters';

type TopAnalyticsFilterVm = {
  labels: Record<string, string>;
  filterOptions: ReturnType<typeof buildAnalyticsFilterOptions>;
  filterOptionLabels: AnalyticsFilterOptionLabels;
  fromOptions: {
    id: string;
    label: string;
    description?: string | null;
    avatarUrl?: string | null;
    bankName?: string | null;
  }[];
  currencyOptions: string[];
  filterState: UseStatementFiltersReturn;
};

type Props = { vm: TopAnalyticsFilterVm };

export function TopAnalyticsFiltersDrawer({ vm }: Props): React.JSX.Element {
  const { labels, filterOptions, filterOptionLabels } = vm;
  const fs = vm.filterState;
  const onClose = (): void => {
    fs.setFiltersDrawerOpen(false);
    fs.setFiltersDrawerScreen('root');
  };
  const drawerLabels = buildFiltersDrawerLabels(labels, filterOptionLabels);
  return (
    <FiltersDrawer
      open={fs.filtersDrawerOpen}
      onClose={onClose}
      filters={fs.draftFilters}
      screen={fs.filtersDrawerScreen}
      onBack={() => fs.setFiltersDrawerScreen('root')}
      onSelect={fs.setFiltersDrawerScreen}
      onUpdateFilters={fs.updateFilter}
      onResetAll={fs.resetAllFilters}
      onViewResults={() => {
        fs.applyFilterChanges();
        onClose();
      }}
      typeOptions={filterOptions.typeOptions}
      statusOptions={filterOptions.statusOptions}
      datePresets={filterOptions.datePresets}
      dateModes={filterOptions.dateModes}
      fromOptions={vm.fromOptions}
      toOptions={vm.fromOptions}
      groupByOptions={filterOptions.groupByOptions}
      hasOptions={filterOptions.hasOptions}
      currencyOptions={vm.currencyOptions}
      labels={drawerLabels}
      activeCount={fs.activeFilterCount}
    />
  );
}
