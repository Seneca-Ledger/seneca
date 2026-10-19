'use client';

import Box from '@mui/material/Box';
import MuiButton from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { ChevronLeft } from '@/app/components/icons';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { ActiveRouteFilter } from './ActiveRouteFilter';
import { FilterOptionRow } from './FilterOptionRow';
import { FilterRow } from './FilterRow';
import { FilterSection } from './FilterSection';
import type {
  StatementFilterDateMode,
  StatementFilterDatePreset,
  StatementFilters,
} from './statement-filters';

export type FiltersDrawerLabels = {
  title: string;
  viewResults: string;
  saveSearch: string;
  resetFilters: string;
  reset?: string;
  general: string;
  expenses: string;
  reports: string;
  type: string;
  from: string;
  groupBy: string;
  has: string;
  keywords: string;
  limit: string;
  status: string;
  to: string;
  amount: string;
  approved: string;
  billable: string;
  currency: string;
  date: string;
  exported: string;
  paid: string;
  any: string;
  yes: string;
  no: string;
};

export type FilterOption = {
  value: string;
  label: string;
};

export type FilterDatePresetOption = {
  value: StatementFilterDatePreset;
  label: string;
};

export type FilterDateModeOption = {
  value: StatementFilterDateMode;
  label: string;
};

export type FilterAvatarOption = {
  id: string;
  label: string;
  description?: string | null;
  avatarUrl?: string | null;
  bankName?: string | null;
};

type FiltersDrawerProps = {
  open: boolean;
  onClose: () => void;
  filters: StatementFilters;
  screen: string;
  visibleScreens?: string[];
  onBack: () => void;
  onSelect: (field: string) => void;
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
  onResetAll: () => void;
  onViewResults: () => void;
  typeOptions: FilterOption[];
  statusOptions: FilterOption[];
  datePresets: FilterDatePresetOption[];
  dateModes: FilterDateModeOption[];
  fromOptions: FilterAvatarOption[];
  toOptions: FilterAvatarOption[];
  groupByOptions: FilterOption[];
  hasOptions: FilterOption[];
  currencyOptions: string[];
  labels: FiltersDrawerLabels;
  activeCount: number;
  routeFilterLabel?: string | null;
  onResetRouteFilter?: () => void;
};

const BOOLEAN_FILTER_KEYS = ['approved', 'billable', 'exported', 'paid'] as const;
type BooleanFilterKey = (typeof BOOLEAN_FILTER_KEYS)[number];

function isBooleanFilterScreen(screen: string): screen is BooleanFilterKey {
  return (BOOLEAN_FILTER_KEYS as readonly string[]).includes(screen);
}

function getBooleanFilterValue(
  filters: StatementFilters,
  screen: BooleanFilterKey,
): boolean | null {
  return filters[screen];
}

function BooleanFilterScreen({
  screen,
  filters,
  labels,
  onUpdateFilters,
}: {
  screen: BooleanFilterKey;
  filters: StatementFilters;
  labels: FiltersDrawerLabels;
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
}) {
  const currentValue = getBooleanFilterValue(filters, screen);
  const update = (value: boolean | null) => onUpdateFilters({ [screen]: value });
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <FilterOptionRow
        label={labels.any}
        selected={currentValue === null}
        onClick={() => update(null)}
        variant="radio"
      />
      <FilterOptionRow
        label={labels.yes}
        selected={currentValue === true}
        onClick={() => update(true)}
        variant="radio"
      />
      <FilterOptionRow
        label={labels.no}
        selected={currentValue === false}
        onClick={() => update(false)}
        variant="radio"
      />
    </Box>
  );
}

function TypeFilterScreen({
  filters,
  labels,
  typeOptions,
  onUpdateFilters,
}: {
  filters: StatementFilters;
  labels: FiltersDrawerLabels;
  typeOptions: FilterOption[];
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <FilterOptionRow
        label={labels.any}
        selected={!filters.type}
        onClick={() => onUpdateFilters({ type: null })}
        variant="radio"
      />
      {typeOptions.map(option => (
        <FilterOptionRow
          key={option.value}
          label={option.label}
          selected={filters.type === option.value}
          onClick={() => onUpdateFilters({ type: option.value })}
          variant="radio"
        />
      ))}
    </Box>
  );
}

function StatusFilterScreen({
  filters,
  labels,
  statusOptions,
  onUpdateFilters,
  toggleValue,
}: {
  filters: StatementFilters;
  labels: FiltersDrawerLabels;
  statusOptions: FilterOption[];
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
  toggleValue: (values: string[], value: string) => string[];
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <FilterOptionRow
        label={labels.any}
        selected={filters.statuses.length === 0}
        onClick={() => onUpdateFilters({ statuses: [] })}
        variant="checkbox"
      />
      {statusOptions.map(option => (
        <FilterOptionRow
          key={option.value}
          label={option.label}
          selected={filters.statuses.includes(option.value)}
          onClick={() => onUpdateFilters({ statuses: toggleValue(filters.statuses, option.value) })}
          variant="checkbox"
        />
      ))}
    </Box>
  );
}

function DateFilterScreen({
  filters,
  labels,
  datePresets,
  dateModes,
  onUpdateFilters,
}: {
  filters: StatementFilters;
  labels: FiltersDrawerLabels;
  datePresets: FilterDatePresetOption[];
  dateModes: FilterDateModeOption[];
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <FilterOptionRow
          label={labels.any}
          selected={!filters.date}
          onClick={() => onUpdateFilters({ date: null })}
          variant="radio"
        />
        {datePresets.map(option => (
          <FilterOptionRow
            key={option.value}
            label={option.label}
            selected={filters.date?.preset === option.value}
            onClick={() => onUpdateFilters({ date: { preset: option.value } })}
            variant="radio"
          />
        ))}
      </Box>
      <Box
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          pt: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
        }}
      >
        {dateModes.map(option => (
          <FilterOptionRow
            key={option.value}
            label={option.label}
            selected={filters.date?.mode === option.value}
            onClick={() =>
              onUpdateFilters({
                date: {
                  mode: option.value,
                  date: filters.date?.date || new Date().toISOString().slice(0, 10),
                },
              })
            }
            variant="radio"
          />
        ))}
        {filters.date?.mode ? (
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'rgba(249,250,251,0.6)',
              px: 1.5,
              py: 1.5,
            }}
          >
            <CustomDatePicker
              value={filters.date?.date || ''}
              onChange={value =>
                onUpdateFilters({ date: { mode: filters.date?.mode, date: value } })
              }
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function FromToFilterScreen({
  screen,
  filters,
  labels,
  fromOptions,
  toOptions,
  onUpdateFilters,
  toggleValue,
}: {
  screen: 'from' | 'to';
  filters: StatementFilters;
  labels: FiltersDrawerLabels;
  fromOptions: FilterAvatarOption[];
  toOptions: FilterAvatarOption[];
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
  toggleValue: (values: string[], value: string) => string[];
}) {
  const values = screen === 'from' ? filters.from : filters.to;
  const options = screen === 'from' ? fromOptions : toOptions;
  if (options.length === 0) {
    return (
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: 2,
          fontSize: 14,
          color: 'text.secondary',
        }}
      >
        {labels.any}
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {options.map(option => (
        <FilterOptionRow
          key={option.id}
          label={option.label}
          description={option.description}
          avatarUrl={option.avatarUrl}
          bankName={option.bankName}
          selected={values.includes(option.id)}
          onClick={() => onUpdateFilters({ [screen]: toggleValue(values, option.id) })}
        />
      ))}
    </Box>
  );
}

function GroupByFilterScreen({
  filters,
  labels,
  groupByOptions,
  onUpdateFilters,
}: {
  filters: StatementFilters;
  labels: FiltersDrawerLabels;
  groupByOptions: FilterOption[];
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <FilterOptionRow
        label={labels.any}
        selected={!filters.groupBy}
        onClick={() => onUpdateFilters({ groupBy: null })}
        variant="radio"
      />
      {groupByOptions.map(option => (
        <FilterOptionRow
          key={option.value}
          label={option.label}
          selected={filters.groupBy === option.value}
          onClick={() => onUpdateFilters({ groupBy: option.value })}
          variant="radio"
        />
      ))}
    </Box>
  );
}

function HasFilterScreen({
  filters,
  labels,
  hasOptions,
  onUpdateFilters,
  toggleValue,
}: {
  filters: StatementFilters;
  labels: FiltersDrawerLabels;
  hasOptions: FilterOption[];
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
  toggleValue: (values: string[], value: string) => string[];
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <FilterOptionRow
        label={labels.any}
        selected={filters.has.length === 0}
        onClick={() => onUpdateFilters({ has: [] })}
        variant="checkbox"
      />
      {hasOptions.map(option => (
        <FilterOptionRow
          key={option.value}
          label={option.label}
          selected={filters.has.includes(option.value)}
          onClick={() => onUpdateFilters({ has: toggleValue(filters.has, option.value) })}
          variant="checkbox"
        />
      ))}
    </Box>
  );
}

function CurrencyFilterScreen({
  filters,
  labels,
  currencyOptions,
  onUpdateFilters,
  toggleValue,
}: {
  filters: StatementFilters;
  labels: FiltersDrawerLabels;
  currencyOptions: string[];
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
  toggleValue: (values: string[], value: string) => string[];
}) {
  if (currencyOptions.length === 0) {
    return (
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: 2,
          fontSize: 14,
          color: 'text.secondary',
        }}
      >
        {labels.any}
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <FilterOptionRow
        label={labels.any}
        selected={filters.currencies.length === 0}
        onClick={() => onUpdateFilters({ currencies: [] })}
        variant="checkbox"
      />
      {currencyOptions.map(currency => (
        <FilterOptionRow
          key={currency}
          label={currency}
          selected={filters.currencies.includes(currency)}
          onClick={() => onUpdateFilters({ currencies: toggleValue(filters.currencies, currency) })}
          variant="checkbox"
        />
      ))}
    </Box>
  );
}

function KeywordsFilterScreen({
  filters,
  labels,
  onUpdateFilters,
  inputStyle,
}: {
  filters: StatementFilters;
  labels: FiltersDrawerLabels;
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
  inputStyle: React.CSSProperties;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="body2" fontWeight={500} color="text.secondary">
        {labels.keywords}
      </Typography>
      <input
        value={filters.keywords}
        onChange={event => onUpdateFilters({ keywords: event.target.value })}
        placeholder={labels.keywords}
        style={inputStyle}
      />
    </Box>
  );
}

function parseNumberInput(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function AmountFilterScreen({
  filters,
  labels,
  onUpdateFilters,
  inputStyle,
}: {
  filters: StatementFilters;
  labels: FiltersDrawerLabels;
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
  inputStyle: React.CSSProperties;
}) {
  const t = useIntlayer('statementFilterControls');
  const amountMinValue = filters.amountMin !== null ? String(filters.amountMin) : '';
  const amountMaxValue = filters.amountMax !== null ? String(filters.amountMax) : '';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="body2" fontWeight={500} color="text.secondary">
          {t.min}
        </Typography>
        <input
          inputMode="decimal"
          value={amountMinValue}
          onChange={event => onUpdateFilters({ amountMin: parseNumberInput(event.target.value) })}
          placeholder="0"
          style={{ ...inputStyle, marginTop: 8 }}
        />
      </Box>
      <Box>
        <Typography variant="body2" fontWeight={500} color="text.secondary">
          {t.max}
        </Typography>
        <input
          inputMode="decimal"
          value={amountMaxValue}
          onChange={event => onUpdateFilters({ amountMax: parseNumberInput(event.target.value) })}
          placeholder="0"
          style={{ ...inputStyle, marginTop: 8 }}
        />
      </Box>
    </Box>
  );
}

function LimitFilterScreen({
  filters,
  labels,
  onUpdateFilters,
  inputStyle,
}: {
  filters: StatementFilters;
  labels: FiltersDrawerLabels;
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
  inputStyle: React.CSSProperties;
}) {
  const limitValue = filters.limit !== null ? String(filters.limit) : '';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="body2" fontWeight={500} color="text.secondary">
        {labels.limit}
      </Typography>
      <input
        inputMode="numeric"
        value={limitValue}
        onChange={event => onUpdateFilters({ limit: parseNumberInput(event.target.value) })}
        placeholder="0"
        style={inputStyle}
      />
    </Box>
  );
}

function booleanFilterDisplayValue(value: boolean | null, labels: FiltersDrawerLabels): string {
  if (value === null) {
    return labels.any;
  }
  return value ? labels.yes : labels.no;
}

type FilterRowConfig = {
  screen: string;
  label: string;
  value: string;
};

function buildFilterRows(
  filters: StatementFilters,
  labels: FiltersDrawerLabels,
): { general: FilterRowConfig[]; expenses: FilterRowConfig[]; reports: FilterRowConfig[] } {
  const summaryValue = (value?: string | null, fallback?: string) =>
    value && value.length > 0 ? value : fallback || labels.any;

  return {
    general: [
      { screen: 'type', label: labels.type, value: summaryValue(filters.type) },
      {
        screen: 'from',
        label: labels.from,
        value: summaryValue(filters.from.length ? `${filters.from.length}` : ''),
      },
      { screen: 'keywords', label: labels.keywords, value: summaryValue(filters.keywords) },
      {
        screen: 'status',
        label: labels.status,
        value: summaryValue(filters.statuses.length ? `${filters.statuses.length}` : ''),
      },
      {
        screen: 'to',
        label: labels.to,
        value: summaryValue(filters.to.length ? `${filters.to.length}` : ''),
      },
      { screen: 'groupBy', label: labels.groupBy, value: summaryValue(filters.groupBy) },
      {
        screen: 'has',
        label: labels.has,
        value: summaryValue(filters.has.length ? `${filters.has.length}` : ''),
      },
      {
        screen: 'limit',
        label: labels.limit,
        value: summaryValue(filters.limit ? `${filters.limit}` : ''),
      },
    ],
    expenses: [
      {
        screen: 'amount',
        label: labels.amount,
        value: summaryValue(filters.amountMin || filters.amountMax ? 'set' : ''),
      },
      {
        screen: 'billable',
        label: labels.billable,
        value: booleanFilterDisplayValue(filters.billable, labels),
      },
    ],
    reports: [
      {
        screen: 'approved',
        label: labels.approved,
        value: booleanFilterDisplayValue(filters.approved, labels),
      },
      {
        screen: 'currency',
        label: labels.currency,
        value: summaryValue(filters.currencies.length > 0 ? `${filters.currencies.length}` : ''),
      },
      { screen: 'date', label: labels.date, value: summaryValue(filters.date ? 'set' : '') },
      {
        screen: 'exported',
        label: labels.exported,
        value: booleanFilterDisplayValue(filters.exported, labels),
      },
      {
        screen: 'paid',
        label: labels.paid,
        value: booleanFilterDisplayValue(filters.paid, labels),
      },
    ],
  };
}

function RootFilterRows({
  rows,
  isScreenVisible,
  onSelect,
}: {
  rows: FilterRowConfig[];
  isScreenVisible: (screenId: string) => boolean;
  onSelect: (field: string) => void;
}) {
  return (
    <>
      {rows.map(
        row =>
          isScreenVisible(row.screen) && (
            <FilterRow
              key={row.screen}
              label={row.label}
              value={row.value}
              onClick={() => onSelect(row.screen)}
            />
          ),
      )}
    </>
  );
}

type ScreenContentProps = {
  screen: string;
  filters: StatementFilters;
  labels: FiltersDrawerLabels;
  typeOptions: FilterOption[];
  statusOptions: FilterOption[];
  datePresets: FilterDatePresetOption[];
  dateModes: FilterDateModeOption[];
  fromOptions: FilterAvatarOption[];
  toOptions: FilterAvatarOption[];
  groupByOptions: FilterOption[];
  hasOptions: FilterOption[];
  currencyOptions: string[];
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
  toggleValue: (values: string[], value: string) => string[];
  inputStyle: React.CSSProperties;
};

function ScreenContent(props: ScreenContentProps) {
  const { screen, filters, labels, onUpdateFilters, toggleValue, inputStyle } = props;
  if (screen === 'type') {
    return (
      <TypeFilterScreen
        filters={filters}
        labels={labels}
        typeOptions={props.typeOptions}
        onUpdateFilters={onUpdateFilters}
      />
    );
  }
  if (screen === 'status') {
    return (
      <StatusFilterScreen
        filters={filters}
        labels={labels}
        statusOptions={props.statusOptions}
        onUpdateFilters={onUpdateFilters}
        toggleValue={toggleValue}
      />
    );
  }
  if (screen === 'date') {
    return (
      <DateFilterScreen
        filters={filters}
        labels={labels}
        datePresets={props.datePresets}
        dateModes={props.dateModes}
        onUpdateFilters={onUpdateFilters}
      />
    );
  }
  if (screen === 'from' || screen === 'to') {
    return (
      <FromToFilterScreen
        screen={screen}
        filters={filters}
        labels={labels}
        fromOptions={props.fromOptions}
        toOptions={props.toOptions}
        onUpdateFilters={onUpdateFilters}
        toggleValue={toggleValue}
      />
    );
  }
  if (screen === 'keywords') {
    return (
      <KeywordsFilterScreen
        filters={filters}
        labels={labels}
        onUpdateFilters={onUpdateFilters}
        inputStyle={inputStyle}
      />
    );
  }
  if (screen === 'amount') {
    return (
      <AmountFilterScreen
        filters={filters}
        labels={labels}
        onUpdateFilters={onUpdateFilters}
        inputStyle={inputStyle}
      />
    );
  }
  if (isBooleanFilterScreen(screen)) {
    return (
      <BooleanFilterScreen
        screen={screen}
        filters={filters}
        labels={labels}
        onUpdateFilters={onUpdateFilters}
      />
    );
  }
  if (screen === 'groupBy') {
    return (
      <GroupByFilterScreen
        filters={filters}
        labels={labels}
        groupByOptions={props.groupByOptions}
        onUpdateFilters={onUpdateFilters}
      />
    );
  }
  if (screen === 'has') {
    return (
      <HasFilterScreen
        filters={filters}
        labels={labels}
        hasOptions={props.hasOptions}
        onUpdateFilters={onUpdateFilters}
        toggleValue={toggleValue}
      />
    );
  }
  if (screen === 'limit') {
    return (
      <LimitFilterScreen
        filters={filters}
        labels={labels}
        onUpdateFilters={onUpdateFilters}
        inputStyle={inputStyle}
      />
    );
  }
  if (screen === 'currency') {
    return (
      <CurrencyFilterScreen
        filters={filters}
        labels={labels}
        currencyOptions={props.currencyOptions}
        onUpdateFilters={onUpdateFilters}
        toggleValue={toggleValue}
      />
    );
  }
  return null;
}

const SCREEN_TITLE_MAP: Record<string, keyof FiltersDrawerLabels> = {
  type: 'type',
  status: 'status',
  date: 'date',
  from: 'from',
  to: 'to',
  keywords: 'keywords',
  amount: 'amount',
  approved: 'approved',
  billable: 'billable',
  groupBy: 'groupBy',
  has: 'has',
  limit: 'limit',
  currency: 'currency',
  exported: 'exported',
  paid: 'paid',
};

function getScreenTitle(screen: string, labels: FiltersDrawerLabels): string {
  const key = SCREEN_TITLE_MAP[screen];
  return (key ? labels[key] : undefined) ?? labels.title;
}

export function FiltersDrawer({
  open,
  onClose,
  filters,
  screen,
  visibleScreens,
  onBack,
  onSelect,
  onUpdateFilters,
  onResetAll,
  onViewResults,
  typeOptions,
  statusOptions,
  datePresets,
  dateModes,
  fromOptions,
  toOptions,
  groupByOptions,
  hasOptions,
  currencyOptions,
  labels,
  activeCount,
  routeFilterLabel,
  onResetRouteFilter,
}: FiltersDrawerProps) {
  const isRoot = screen === 'root';
  const allowedScreens = new Set(visibleScreens || []);
  const isScreenVisible = (screenId: string) =>
    visibleScreens === undefined || allowedScreens.has(screenId);
  const screenTitle = isRoot ? labels.title : getScreenTitle(screen, labels);

  const toggleValue = (values: string[], value: string) =>
    values.includes(value) ? values.filter(item => item !== value) : [...values, value];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: tokens.radius.md,
    border: '1px solid var(--border-color)',
    background: 'var(--card-bg)',
    padding: '8px 12px',
    fontSize: 14,
    color: 'var(--foreground)',
    boxSizing: 'border-box',
  };

  const filterRows = buildFilterRows(filters, labels);

  const viewResultsButton = (
    <MuiButton variant="contained" sx={{ width: '100%' }} size="large" onClick={onViewResults}>
      {labels.viewResults}
      {activeCount > 0 && (
        <Box
          component="span"
          sx={{
            ml: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: tokens.radius.full,
            bgcolor: 'rgba(255,255,255,0.2)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {activeCount}
        </Box>
      )}
    </MuiButton>
  );

  return (
    <DrawerShell
      isOpen={open}
      onClose={onClose}
      position="right"
      width="sm"
      showCloseButton={false}
      title={
        <Box
          sx={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <IconButton
              type="button"
              onClick={isRoot ? onClose : onBack}
              aria-label={screenTitle}
              size="small"
            >
              <ChevronLeft size={20} />
            </IconButton>
            <Typography variant="subtitle1" fontWeight={600} color="text.primary">
              {screenTitle}
            </Typography>
          </Box>
          {isRoot && (
            <button
              type="button"
              onClick={onResetAll}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--primary)',
              }}
            >
              {labels.resetFilters}
            </button>
          )}
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {isRoot ? (
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              pb: 14,
            }}
          >
            {routeFilterLabel && onResetRouteFilter ? (
              <ActiveRouteFilter
                label={routeFilterLabel}
                resetLabel={labels.reset ?? labels.resetFilters}
                onReset={onResetRouteFilter}
              />
            ) : null}
            <FilterSection title={labels.general}>
              <RootFilterRows
                rows={filterRows.general}
                isScreenVisible={isScreenVisible}
                onSelect={onSelect}
              />
            </FilterSection>
            <FilterSection title={labels.expenses}>
              <RootFilterRows
                rows={filterRows.expenses}
                isScreenVisible={isScreenVisible}
                onSelect={onSelect}
              />
            </FilterSection>
            <FilterSection title={labels.reports}>
              <RootFilterRows
                rows={filterRows.reports}
                isScreenVisible={isScreenVisible}
                onSelect={onSelect}
              />
            </FilterSection>
          </Box>
        ) : (
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
              pb: 10,
            }}
          >
            <Box sx={{ bgcolor: 'transparent', p: 0 }}>
              {routeFilterLabel && onResetRouteFilter ? (
                <Box sx={{ mb: 2.5 }}>
                  <ActiveRouteFilter
                    label={routeFilterLabel}
                    resetLabel={labels.reset ?? labels.resetFilters}
                    onReset={onResetRouteFilter}
                  />
                </Box>
              ) : null}
              <ScreenContent
                screen={screen}
                filters={filters}
                labels={labels}
                typeOptions={typeOptions}
                statusOptions={statusOptions}
                datePresets={datePresets}
                dateModes={dateModes}
                fromOptions={fromOptions}
                toOptions={toOptions}
                groupByOptions={groupByOptions}
                hasOptions={hasOptions}
                currencyOptions={currencyOptions}
                onUpdateFilters={onUpdateFilters}
                toggleValue={toggleValue}
                inputStyle={inputStyle}
              />
            </Box>
          </Box>
        )}

        {isRoot ? (
          <Box
            sx={{
              position: 'sticky',
              bottom: 0,
              pt: 2,
              pb: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              bgcolor: 'background.paper',
            }}
          >
            <MuiButton variant="outlined" sx={{ width: '100%' }} size="large" disabled>
              {labels.saveSearch}
            </MuiButton>
            {viewResultsButton}
          </Box>
        ) : (
          <Box sx={{ position: 'sticky', bottom: 0, pt: 2, pb: 1, bgcolor: 'background.paper' }}>
            {viewResultsButton}
          </Box>
        )}
      </Box>
    </DrawerShell>
  );
}
