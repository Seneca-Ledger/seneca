'use client';
import { useAmountViewText } from './ChoiceFilterScreen';
import { FilterRow } from './FilterRow';
import type { FiltersDrawerLabels } from './filters-drawer.types';
import type { StatementFilters } from './statement-filters';

/** The rows of the drawer's first screen, one per filter, each saying what it is set to. */
export function booleanFilterDisplayValue(
  value: boolean | null,
  labels: FiltersDrawerLabels,
): string {
  if (value === null) {
    return labels.any;
  }
  return value ? labels.yes : labels.no;
}

export type FilterRowConfig = {
  screen: string;
  label: string;
  value: string;
};

export function buildFilterRows(
  filters: StatementFilters,
  labels: FiltersDrawerLabels,
  amountView: ReturnType<typeof useAmountViewText>,
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
        screen: 'amountView',
        label: amountView.title,
        value:
          amountView.options.find(option => option.value === (filters.amountView ?? 'spending'))
            ?.label ?? labels.any,
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

export function RootFilterRows({
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
