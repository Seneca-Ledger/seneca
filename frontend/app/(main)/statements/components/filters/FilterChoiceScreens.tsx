'use client';

import Box from '@mui/material/Box';
import { FilterOptionRow } from './FilterOptionRow';
import type { FilterAvatarOption, FilterOption, FiltersDrawerLabels } from './filters-drawer.types';
import type { StatementFilters } from './statement-filters';

/** Filters drawer screens that pick from a list: yes/no, type, status, from/to, has, currency. */
export const BOOLEAN_FILTER_KEYS = ['approved', 'billable', 'exported', 'paid'] as const;
export type BooleanFilterKey = (typeof BOOLEAN_FILTER_KEYS)[number];

export function isBooleanFilterScreen(screen: string): screen is BooleanFilterKey {
  return (BOOLEAN_FILTER_KEYS as readonly string[]).includes(screen);
}

export function getBooleanFilterValue(
  filters: StatementFilters,
  screen: BooleanFilterKey,
): boolean | null {
  return filters[screen];
}

export function BooleanFilterScreen({
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

export function TypeFilterScreen({
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

export function StatusFilterScreen({
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

export function FromToFilterScreen({
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

export function HasFilterScreen({
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

export function CurrencyFilterScreen({
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
