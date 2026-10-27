'use client';

import Box from '@mui/material/Box';
import { useIntlayer } from '@/app/i18n';
import { STATEMENT_AMOUNT_VIEWS, type StatementAmountView } from './amount-view';
import { FilterOptionRow } from './FilterOptionRow';
import type { StatementFilters } from './statement-filters';

type ChoiceOption = { value: string; label: string };

/** One choice out of several, as radio rows; `anyLabel` adds a row for none. */
export function ChoiceFilterScreen({
  value,
  options,
  anyLabel,
  onSelect,
}: {
  value: string | null;
  options: ChoiceOption[];
  anyLabel?: string;
  onSelect: (value: string | null) => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {anyLabel ? (
        <FilterOptionRow
          label={anyLabel}
          selected={!value}
          onClick={() => onSelect(null)}
          variant="radio"
        />
      ) : null}
      {options.map(option => (
        <FilterOptionRow
          key={option.value}
          label={option.label}
          selected={value === option.value}
          onClick={() => onSelect(option.value)}
          variant="radio"
        />
      ))}
    </Box>
  );
}

/** The title of the Amount shows setting and the label of each choice. */
export function useAmountViewText(): { title: string; options: ChoiceOption[] } {
  const text = useIntlayer('statementAmountView');
  return {
    title: text.title.value,
    options: STATEMENT_AMOUNT_VIEWS.map(view => ({ value: view, label: text[view].value })),
  };
}

/** Spending is the default, kept as no setting at all. */
export function AmountViewFilterScreen({
  filters,
  options,
  onUpdateFilters,
}: {
  filters: StatementFilters;
  options: ChoiceOption[];
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
}) {
  return (
    <ChoiceFilterScreen
      value={filters.amountView ?? 'spending'}
      options={options}
      onSelect={value =>
        onUpdateFilters({
          amountView: value === 'spending' ? null : (value as StatementAmountView | null),
        })
      }
    />
  );
}
