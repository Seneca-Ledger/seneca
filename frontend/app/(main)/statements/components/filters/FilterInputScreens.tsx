'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { useIntlayer } from '@/app/i18n';
import { FilterOptionRow } from './FilterOptionRow';
import type {
  FilterDateModeOption,
  FilterDatePresetOption,
  FiltersDrawerLabels,
} from './filters-drawer.types';
import type { StatementFilters } from './statement-filters';

/** Filters drawer screens that take typed input: a date, keywords, an amount range, a limit. */
export function DateFilterScreen({
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

export function KeywordsFilterScreen({
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
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          color: 'text.secondary',
        }}
      >
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

export function parseNumberInput(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function AmountFilterScreen({
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
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            color: 'text.secondary',
          }}
        >
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
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            color: 'text.secondary',
          }}
        >
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

export function LimitFilterScreen({
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
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          color: 'text.secondary',
        }}
      >
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
