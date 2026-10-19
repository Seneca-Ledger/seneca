'use client';

import { DateFilterDropdown } from '@/app/(main)/statements/components/filters/DateFilterDropdown';
import { FromFilterDropdown } from '@/app/(main)/statements/components/filters/FromFilterDropdown';
import { StatusFilterDropdown } from '@/app/(main)/statements/components/filters/StatusFilterDropdown';
import type { StatementFilters } from '@/app/(main)/statements/components/filters/statement-filters';
import { TypeFilterDropdown } from '@/app/(main)/statements/components/filters/TypeFilterDropdown';
import { ChevronDown, Columns2, Search, SlidersHorizontal } from '@/app/components/icons';
import { FilterChipButton } from '@/app/components/ui/filter-chip-button';
import { tokens } from '@/lib/theme-tokens';
import { BulkActionsBar } from './BulkActionsBar';
import { StatementsDuplicateGroup } from './StatementsDuplicateGroup';

// ---------------------------------------------------------------------------
// Shared option types
// ---------------------------------------------------------------------------

interface TypeOption {
  value: string;
  label: string;
}

interface StatusOption {
  value: string;
  label: string;
}

type DatePresetValue = 'thisMonth' | 'lastMonth' | 'yearToDate';
type DateModeValue = 'on' | 'after' | 'before';

interface DatePreset {
  value: DatePresetValue;
  label: string;
}

interface DateMode {
  value: DateModeValue;
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
}

// ---------------------------------------------------------------------------
// Exported prop type
// ---------------------------------------------------------------------------

export interface StatementsListHeaderProps {
  searchInput: string;
  searchPlaceholder: string;
  selectedCount: number;
  hasSelectedDuplicates: boolean;
  draftFilters: StatementFilters;
  filterLabels: FilterLabels;
  filterOptionLabels: FilterOptionLabels;
  typeOptions: TypeOption[];
  statusOptions: StatusOption[];
  datePresets: DatePreset[];
  dateModes: DateMode[];
  fromOptions: FromOption[];
  activeFilterCount: number;
  loading: boolean;
  duplicateStatementIds: string[];
  selectDuplicatesLabel: string;
  typeDropdownOpen: boolean;
  statusDropdownOpen: boolean;
  dateDropdownOpen: boolean;
  fromDropdownOpen: boolean;
  mergeDuplicatesLabel: string;
  dismissDuplicateLabel: string;
  markDuplicateLabel: string;
  markNotDuplicateLabel: string;
  onSearchChange: (value: string) => void;
  onTypeDropdownOpenChange: (open: boolean) => void;
  onStatusDropdownOpenChange: (open: boolean) => void;
  onDateDropdownOpenChange: (open: boolean) => void;
  onFromDropdownOpenChange: (open: boolean) => void;
  onUpdateFilter: (next: Partial<StatementFilters>) => void;
  onApplyAndClose: (close: () => void) => void;
  onResetAndClose: (key: keyof StatementFilters, close: () => void) => void;
  onOpenFiltersDrawer: () => void;
  onColumnsOpen: () => void;
  onSelectDetectedDuplicates: () => void;
  onMergeDuplicates: () => void;
  onDismissDuplicates: () => void;
  onMarkAsDuplicate: () => void;
  onExportSelected: () => void;
  onDeleteSelected: () => void;
}

// ---------------------------------------------------------------------------
// Inline sub-components
// ---------------------------------------------------------------------------

function SearchBar({
  searchInput,
  searchPlaceholder,
  onSearchChange,
}: {
  searchInput: string;
  searchPlaceholder: string;
  onSearchChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <div className="seneca-stmt-list-view__search" data-tour-id="search-bar">
      <Search className="seneca-stmt-list-view__search-icon" size={16} />
      <input
        type="text"
        value={searchInput}
        onChange={e => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="seneca-stmt-list-view__search-input"
      />
    </div>
  );
}

function FiltersButton({
  filterLabels,
  activeFilterCount,
  onOpenFiltersDrawer,
}: {
  filterLabels: FilterLabels;
  activeFilterCount: number;
  onOpenFiltersDrawer: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        borderRadius: tokens.radius.md,
        padding: '6px 8px',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--primary)',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
      }}
      onClick={onOpenFiltersDrawer}
    >
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
    </button>
  );
}

function ColumnsButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        borderRadius: tokens.radius.md,
        padding: '6px 8px',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--primary)',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
      }}
      onClick={onClick}
    >
      <Columns2 size={14} />
      {label}
    </button>
  );
}

interface FilterChipsRowProps {
  draftFilters: StatementFilters;
  filterLabels: FilterLabels;
  filterOptionLabels: FilterOptionLabels;
  typeOptions: TypeOption[];
  statusOptions: StatusOption[];
  datePresets: DatePreset[];
  dateModes: DateMode[];
  fromOptions: FromOption[];
  activeFilterCount: number;
  loading: boolean;
  duplicateStatementIds: string[];
  selectDuplicatesLabel: string;
  typeDropdownOpen: boolean;
  statusDropdownOpen: boolean;
  dateDropdownOpen: boolean;
  fromDropdownOpen: boolean;
  onTypeDropdownOpenChange: (open: boolean) => void;
  onStatusDropdownOpenChange: (open: boolean) => void;
  onDateDropdownOpenChange: (open: boolean) => void;
  onFromDropdownOpenChange: (open: boolean) => void;
  onUpdateFilter: (next: Partial<StatementFilters>) => void;
  onApplyAndClose: (close: () => void) => void;
  onResetAndClose: (key: keyof StatementFilters, close: () => void) => void;
  onOpenFiltersDrawer: () => void;
  onColumnsOpen: () => void;
  onSelectDetectedDuplicates: () => void;
}

function FilterChipsRow({
  draftFilters,
  filterLabels,
  filterOptionLabels,
  typeOptions,
  statusOptions,
  datePresets,
  dateModes,
  fromOptions,
  activeFilterCount,
  loading,
  duplicateStatementIds,
  selectDuplicatesLabel,
  typeDropdownOpen,
  statusDropdownOpen,
  dateDropdownOpen,
  fromDropdownOpen,
  onTypeDropdownOpenChange,
  onStatusDropdownOpenChange,
  onDateDropdownOpenChange,
  onFromDropdownOpenChange,
  onUpdateFilter,
  onApplyAndClose,
  onResetAndClose,
  onOpenFiltersDrawer,
  onColumnsOpen,
  onSelectDetectedDuplicates,
}: FilterChipsRowProps): React.JSX.Element {
  const activeType = draftFilters.type;
  const activeStatuses = draftFilters.statuses;
  const activeDate = draftFilters.date;
  const activeFrom = draftFilters.from;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        overflowX: 'auto',
      }}
      data-tour-id="statements-filters"
    >
      <TypeFilterDropdown
        open={typeDropdownOpen}
        onOpenChange={onTypeDropdownOpenChange}
        options={typeOptions}
        value={activeType}
        onChange={value => onUpdateFilter({ type: value })}
        onApply={() => onApplyAndClose(() => onTypeDropdownOpenChange(false))}
        onReset={() => onResetAndClose('type', () => onTypeDropdownOpenChange(false))}
        trigger={
          <FilterChipButton active={Boolean(activeType)}>
            {activeType
              ? typeOptions.find(o => o.value === activeType)?.label || filterLabels.type
              : filterLabels.type}
            <ChevronDown size={14} />
          </FilterChipButton>
        }
        applyLabel={filterOptionLabels.apply}
        resetLabel={filterOptionLabels.reset}
      />

      <StatusFilterDropdown
        open={statusDropdownOpen}
        onOpenChange={onStatusDropdownOpenChange}
        options={statusOptions}
        values={activeStatuses}
        onChange={values => onUpdateFilter({ statuses: values })}
        onApply={() => onApplyAndClose(() => onStatusDropdownOpenChange(false))}
        onReset={() => onResetAndClose('statuses', () => onStatusDropdownOpenChange(false))}
        trigger={
          <FilterChipButton active={activeStatuses.length > 0}>
            {activeStatuses.length > 0
              ? `${filterLabels.status} (${activeStatuses.length})`
              : filterLabels.status}
            <ChevronDown size={14} />
          </FilterChipButton>
        }
        applyLabel={filterOptionLabels.apply}
        resetLabel={filterOptionLabels.reset}
      />

      <DateFilterDropdown
        open={dateDropdownOpen}
        onOpenChange={onDateDropdownOpenChange}
        presets={datePresets}
        modes={dateModes}
        value={activeDate}
        onChange={value => onUpdateFilter({ date: value })}
        onApply={() => onApplyAndClose(() => onDateDropdownOpenChange(false))}
        onReset={() => onResetAndClose('date', () => onDateDropdownOpenChange(false))}
        trigger={
          <FilterChipButton active={Boolean(activeDate)}>
            {activeDate?.preset
              ? datePresets.find(o => o.value === activeDate.preset)?.label
              : activeDate?.mode
                ? dateModes.find(o => o.value === activeDate.mode)?.label
                : filterLabels.date}
            <ChevronDown size={14} />
          </FilterChipButton>
        }
        applyLabel={filterOptionLabels.apply}
        resetLabel={filterOptionLabels.reset}
      />

      <FromFilterDropdown
        open={fromDropdownOpen}
        onOpenChange={onFromDropdownOpenChange}
        options={fromOptions}
        values={activeFrom}
        onChange={values => onUpdateFilter({ from: values })}
        onApply={() => onApplyAndClose(() => onFromDropdownOpenChange(false))}
        onReset={() => onResetAndClose('from', () => onFromDropdownOpenChange(false))}
        trigger={
          <FilterChipButton active={activeFrom.length > 0}>
            {activeFrom.length > 0
              ? `${filterLabels.from} (${activeFrom.length})`
              : filterLabels.from}
            <ChevronDown size={14} />
          </FilterChipButton>
        }
        applyLabel={filterOptionLabels.apply}
        resetLabel={filterOptionLabels.reset}
      />

      <StatementsDuplicateGroup
        loading={loading}
        duplicateStatementIds={duplicateStatementIds}
        selectDuplicatesLabel={selectDuplicatesLabel}
        onSelectDetectedDuplicates={onSelectDetectedDuplicates}
      />

      <FiltersButton
        filterLabels={filterLabels}
        activeFilterCount={activeFilterCount}
        onOpenFiltersDrawer={onOpenFiltersDrawer}
      />

      <ColumnsButton label={filterLabels.columns} onClick={onColumnsOpen} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function StatementsListHeader({
  searchInput,
  searchPlaceholder,
  selectedCount,
  hasSelectedDuplicates,
  draftFilters,
  filterLabels,
  filterOptionLabels,
  typeOptions,
  statusOptions,
  datePresets,
  dateModes,
  fromOptions,
  activeFilterCount,
  loading,
  duplicateStatementIds,
  selectDuplicatesLabel,
  typeDropdownOpen,
  statusDropdownOpen,
  dateDropdownOpen,
  fromDropdownOpen,
  mergeDuplicatesLabel,
  dismissDuplicateLabel,
  markDuplicateLabel,
  onSearchChange,
  onTypeDropdownOpenChange,
  onStatusDropdownOpenChange,
  onDateDropdownOpenChange,
  onFromDropdownOpenChange,
  onUpdateFilter,
  onApplyAndClose,
  onResetAndClose,
  onOpenFiltersDrawer,
  onColumnsOpen,
  onSelectDetectedDuplicates,
  onMergeDuplicates,
  onDismissDuplicates,
  onMarkAsDuplicate,
  onExportSelected,
  onDeleteSelected,
}: StatementsListHeaderProps): React.JSX.Element {
  return (
    <div
      className="seneca-stmt-list-view__header"
      style={{
        marginBottom: 24,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SearchBar
          searchInput={searchInput}
          searchPlaceholder={searchPlaceholder}
          onSearchChange={onSearchChange}
        />
      </div>

      {selectedCount > 0 ? (
        <BulkActionsBar
          selectedCount={selectedCount}
          hasSelectedDuplicates={hasSelectedDuplicates}
          mergeDuplicatesLabel={mergeDuplicatesLabel}
          dismissDuplicateLabel={dismissDuplicateLabel}
          markDuplicateLabel={markDuplicateLabel}
          onMergeDuplicates={onMergeDuplicates}
          onDismissDuplicates={onDismissDuplicates}
          onMarkAsDuplicate={onMarkAsDuplicate}
          onExportSelected={onExportSelected}
          onDeleteSelected={onDeleteSelected}
        />
      ) : (
        <FilterChipsRow
          draftFilters={draftFilters}
          filterLabels={filterLabels}
          filterOptionLabels={filterOptionLabels}
          typeOptions={typeOptions}
          statusOptions={statusOptions}
          datePresets={datePresets}
          dateModes={dateModes}
          fromOptions={fromOptions}
          activeFilterCount={activeFilterCount}
          loading={loading}
          duplicateStatementIds={duplicateStatementIds}
          selectDuplicatesLabel={selectDuplicatesLabel}
          typeDropdownOpen={typeDropdownOpen}
          statusDropdownOpen={statusDropdownOpen}
          dateDropdownOpen={dateDropdownOpen}
          fromDropdownOpen={fromDropdownOpen}
          onTypeDropdownOpenChange={onTypeDropdownOpenChange}
          onStatusDropdownOpenChange={onStatusDropdownOpenChange}
          onDateDropdownOpenChange={onDateDropdownOpenChange}
          onFromDropdownOpenChange={onFromDropdownOpenChange}
          onUpdateFilter={onUpdateFilter}
          onApplyAndClose={onApplyAndClose}
          onResetAndClose={onResetAndClose}
          onOpenFiltersDrawer={onOpenFiltersDrawer}
          onColumnsOpen={onColumnsOpen}
          onSelectDetectedDuplicates={onSelectDetectedDuplicates}
        />
      )}
    </div>
  );
}
