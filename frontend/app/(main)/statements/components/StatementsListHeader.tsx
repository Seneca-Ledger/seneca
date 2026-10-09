'use client';

import { type ComponentPropsWithoutRef, useEffect } from 'react';
import { ColumnsDrawer } from '@/app/(main)/statements/components/columns/ColumnsDrawer';
import type {
  StatementColumn,
  StatementColumnId,
} from '@/app/(main)/statements/components/columns/statement-columns';
import { DateFilterDropdown } from '@/app/(main)/statements/components/filters/DateFilterDropdown';
import { FiltersDrawer } from '@/app/(main)/statements/components/filters/FiltersDrawer';
import type { StatementFilters } from '@/app/(main)/statements/components/filters/statement-filters';
import { ChevronDown, SlidersHorizontal } from '@/app/components/icons';
import { SHORTCUT_OPEN_FILTERS } from '@/app/lib/keyboard-shortcuts';
import { tokens } from '@/lib/theme-tokens';
import { StatementsBulkActions } from './StatementsBulkActions';
import { StatementsQueueTabs } from './StatementsQueueTabs';
import { StatementsToolbarButton } from './StatementsToolbarButton';
import { StatementsUploadButton } from './StatementsUploadButton';

interface FilterOption {
  value: string;
  label: string;
}

interface DatePreset {
  value: 'thisMonth' | 'lastMonth' | 'yearToDate';
  label: string;
}

interface DateMode {
  value: 'on' | 'after' | 'before';
  label: string;
}

interface FromOption {
  id: string;
  label: string;
  description?: string | null;
  avatarUrl?: string | null;
  iconUrl?: string | null;
  bankName?: string | null;
}

interface GroupByOption {
  value: string;
  label: string;
}

interface HasOption {
  value: string;
  label: string;
}

interface FilterLabels {
  type: string;
  status: string;
  date: string;
  from: string;
  filters: string;
  columns: string;
}

interface FilterOptionLabels {
  apply: string;
  reset: string;
  resetFilters: string;
  viewResults: string;
  save: string;
  saveSearch: string;
  any: string;
  yes: string;
  no: string;
  drawerTitle: string;
  drawerGeneral: string;
  drawerExpenses: string;
  drawerReports: string;
  drawerGroupBy: string;
  drawerHas: string;
  drawerKeywords: string;
  drawerLimit: string;
  drawerTo: string;
  drawerAmount: string;
  drawerApproved: string;
  drawerBillable: string;
  hasCurrency: string;
  columnExported: string;
  paid: string;
  columnsTitle: string;
}

interface Props {
  selectedCount: number;
  selectedActionsOpen: boolean;
  hasSelectedDuplicates: boolean;
  draftFilters: StatementFilters;
  activeFilterCount: number;
  dateDropdownOpen: boolean;
  filtersDrawerOpen: boolean;
  filtersDrawerScreen: string;
  columnsDrawerOpen: boolean;
  columnsWithLabels: StatementColumn[];
  visibleFilterScreens: string[];
  typeOptions: FilterOption[];
  statusOptions: FilterOption[];
  datePresets: DatePreset[];
  dateModes: DateMode[];
  fromOptions: FromOption[];
  toOptions: FromOption[];
  groupByOptions: GroupByOption[];
  hasOptions: HasOption[];
  currencyOptions: string[];
  filterLabels: FilterLabels;
  filterOptionLabels: FilterOptionLabels;
  mergeDuplicatesLabel: string;
  dismissDuplicateLabel: string;
  markDuplicateLabel: string;
  onToggleActionsOpen: () => void;
  onMerge: () => void;
  onDismiss: () => void;
  onMarkDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
  onDateDropdownChange: (open: boolean) => void;
  onFiltersDrawerClose: () => void;
  onFiltersDrawerOpen: () => void;
  onFiltersBack: () => void;
  onFiltersSelect: (field: string) => void;
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
  onResetAllFilters: () => void;
  routeFilterLabel: string | null;
  onResetRouteFilter: () => void;
  onViewResults: () => void;
  onApplyDate: () => void;
  onResetDate: () => void;
  onColumnsClose: () => void;
  onColumnsToggle: (id: StatementColumnId, visible: boolean) => void;
  onColumnsReorder: (activeId: StatementColumnId, overId: StatementColumnId) => void;
  onColumnsSave: () => void;
}

function DateChipLabel({
  draftFilters,
  datePresets,
  dateModes,
  fallbackLabel,
  ...rest
}: {
  draftFilters: StatementFilters;
  datePresets: DatePreset[];
  dateModes: DateMode[];
  fallbackLabel: string;
  [key: string]: unknown;
}): React.JSX.Element {
  const label = draftFilters.date?.preset
    ? (datePresets.find(o => o.value === draftFilters.date?.preset)?.label ?? fallbackLabel)
    : draftFilters.date?.mode
      ? (dateModes.find(o => o.value === draftFilters.date?.mode)?.label ?? fallbackLabel)
      : fallbackLabel;
  return (
    <StatementsToolbarButton
      {...(rest as ComponentPropsWithoutRef<typeof StatementsToolbarButton>)}
    >
      {label}
      <ChevronDown size={14} />
    </StatementsToolbarButton>
  );
}

export function StatementsListHeader({
  selectedCount,
  selectedActionsOpen,
  hasSelectedDuplicates,
  draftFilters,
  activeFilterCount,
  dateDropdownOpen,
  filtersDrawerOpen,
  filtersDrawerScreen,
  columnsDrawerOpen,
  columnsWithLabels,
  visibleFilterScreens,
  typeOptions,
  statusOptions,
  datePresets,
  dateModes,
  fromOptions,
  toOptions,
  groupByOptions,
  hasOptions,
  currencyOptions,
  filterLabels,
  filterOptionLabels,
  mergeDuplicatesLabel,
  dismissDuplicateLabel,
  markDuplicateLabel,
  onToggleActionsOpen,
  onMerge,
  onDismiss,
  onMarkDuplicate,
  onExport,
  onDelete,
  onDateDropdownChange,
  onFiltersDrawerClose,
  onFiltersDrawerOpen,
  onFiltersBack,
  onFiltersSelect,
  onUpdateFilters,
  onResetAllFilters,
  routeFilterLabel,
  onResetRouteFilter,
  onViewResults,
  onApplyDate,
  onResetDate,
  onColumnsClose,
  onColumnsToggle,
  onColumnsReorder,
  onColumnsSave,
}: Props): React.JSX.Element {
  useEffect(() => {
    const handleOpenFilters = (): void => {
      onFiltersDrawerOpen();
    };
    window.addEventListener(SHORTCUT_OPEN_FILTERS, handleOpenFilters);
    return () => {
      window.removeEventListener(SHORTCUT_OPEN_FILTERS, handleOpenFilters);
    };
  }, [onFiltersDrawerOpen]);

  return (
    <div
      className="lumio-stmt-list-view__header"
      style={{ marginBottom: 24, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {/* The tab strip scrolls inside its own column, so the actions stay in the corner.
          Date and Filters ride here; every other filter lives inside the Filters drawer. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StatementsQueueTabs />
        </div>
        <DateFilterDropdown
          open={dateDropdownOpen}
          onOpenChange={onDateDropdownChange}
          presets={datePresets}
          modes={dateModes}
          value={draftFilters.date}
          onChange={value => onUpdateFilters({ date: value })}
          onApply={onApplyDate}
          onReset={onResetDate}
          trigger={
            <DateChipLabel
              draftFilters={draftFilters}
              datePresets={datePresets}
              dateModes={dateModes}
              fallbackLabel={filterLabels.date}
            />
          }
          applyLabel={filterOptionLabels.apply}
          resetLabel={filterOptionLabels.reset}
        />
        <StatementsToolbarButton data-tour-id="statements-filters" onClick={onFiltersDrawerOpen}>
          <SlidersHorizontal size={14} />
          {filterLabels.filters}
          {activeFilterCount > 0 ? (
            <span
              style={{
                marginLeft: 4,
                display: 'inline-flex',
                height: 20,
                width: 20,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: tokens.radius.full,
                background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--primary)',
              }}
            >
              {activeFilterCount}
            </span>
          ) : null}
        </StatementsToolbarButton>
        {/* Keeps the primary action from reading as one more filter button. */}
        <span
          aria-hidden
          style={{
            width: 1,
            alignSelf: 'stretch',
            minHeight: 24,
            background: 'var(--border-color)',
            flexShrink: 0,
          }}
        />
        <StatementsUploadButton />
      </div>

      {selectedCount > 0 ? (
        <StatementsBulkActions
          selectedCount={selectedCount}
          selectedActionsOpen={selectedActionsOpen}
          hasSelectedDuplicates={hasSelectedDuplicates}
          mergeDuplicatesLabel={mergeDuplicatesLabel}
          dismissDuplicateLabel={dismissDuplicateLabel}
          markDuplicateLabel={markDuplicateLabel}
          onToggleActionsOpen={onToggleActionsOpen}
          onMerge={onMerge}
          onDismiss={onDismiss}
          onMarkDuplicate={onMarkDuplicate}
          onExport={onExport}
          onDelete={onDelete}
        />
      ) : null}

      <FiltersDrawer
        open={filtersDrawerOpen}
        onClose={onFiltersDrawerClose}
        filters={draftFilters}
        screen={filtersDrawerScreen}
        visibleScreens={visibleFilterScreens}
        onBack={onFiltersBack}
        onSelect={onFiltersSelect}
        onUpdateFilters={onUpdateFilters}
        onResetAll={onResetAllFilters}
        routeFilterLabel={routeFilterLabel}
        onResetRouteFilter={onResetRouteFilter}
        onViewResults={onViewResults}
        typeOptions={typeOptions}
        statusOptions={statusOptions}
        datePresets={datePresets}
        dateModes={dateModes}
        fromOptions={fromOptions}
        toOptions={toOptions}
        groupByOptions={groupByOptions}
        hasOptions={hasOptions}
        currencyOptions={currencyOptions}
        labels={{
          title: filterOptionLabels.drawerTitle,
          viewResults: filterOptionLabels.viewResults,
          saveSearch: filterOptionLabels.saveSearch,
          resetFilters: filterOptionLabels.resetFilters,
          general: filterOptionLabels.drawerGeneral,
          expenses: filterOptionLabels.drawerExpenses,
          reports: filterOptionLabels.drawerReports,
          type: filterLabels.type,
          from: filterLabels.from,
          groupBy: filterOptionLabels.drawerGroupBy,
          has: filterOptionLabels.drawerHas,
          keywords: filterOptionLabels.drawerKeywords,
          limit: filterOptionLabels.drawerLimit,
          status: filterLabels.status,
          to: filterOptionLabels.drawerTo,
          amount: filterOptionLabels.drawerAmount,
          approved: filterOptionLabels.drawerApproved,
          billable: filterOptionLabels.drawerBillable,
          currency: filterOptionLabels.hasCurrency,
          date: filterLabels.date,
          exported: filterOptionLabels.columnExported,
          paid: filterOptionLabels.paid,
          any: filterOptionLabels.any,
          yes: filterOptionLabels.yes,
          no: filterOptionLabels.no,
        }}
        activeCount={activeFilterCount}
      />

      <ColumnsDrawer
        open={columnsDrawerOpen}
        onClose={onColumnsClose}
        columns={columnsWithLabels}
        onToggle={onColumnsToggle}
        onReorder={onColumnsReorder}
        onSave={onColumnsSave}
        labels={{
          title: filterOptionLabels.columnsTitle,
          save: filterOptionLabels.save,
        }}
      />
    </div>
  );
}
