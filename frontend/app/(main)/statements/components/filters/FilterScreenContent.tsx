'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, isValid, parseISO } from 'date-fns';
import React from 'react';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { FilterOptionRow } from './FilterOptionRow';
import type {
  FilterAvatarOption,
  FilterDateModeOption,
  FilterDatePresetOption,
  FilterOption,
  FiltersDrawerLabels,
} from './FiltersDrawer';
import type { StatementFilters } from './statement-filters';

export type FilterScreenContentProps = {
  screen: string;
  filters: StatementFilters;
  labels: FiltersDrawerLabels;
  onUpdateFilters: (next: Partial<StatementFilters>) => void;
  typeOptions: FilterOption[];
  statusOptions: FilterOption[];
  datePresets: FilterDatePresetOption[];
  dateModes: FilterDateModeOption[];
  fromOptions: FilterAvatarOption[];
  toOptions: FilterAvatarOption[];
  groupByOptions: FilterOption[];
  hasOptions: FilterOption[];
  currencyOptions: string[];
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  borderRadius: tokens.radius.md,
  border: '1px solid var(--border-color)',
  background: 'var(--card-bg)',
  padding: '8px 12px',
  fontSize: 14,
  color: 'var(--foreground)',
  boxSizing: 'border-box',
};

function withToggle(values: string[]): (value: string) => string[] {
  return (value: string) =>
    values.includes(value) ? values.filter(v => v !== value) : [...values, value];
}

function TypeScreen({
  filters,
  labels,
  typeOptions,
  onUpdateFilters,
}: FilterScreenContentProps): React.ReactElement {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <FilterOptionRow
        label={labels.any}
        selected={!filters.type}
        onClick={() => onUpdateFilters({ type: null })}
        variant="radio"
      />
      {typeOptions.map(opt => (
        <FilterOptionRow
          key={opt.value}
          label={opt.label}
          selected={filters.type === opt.value}
          onClick={() => onUpdateFilters({ type: opt.value })}
          variant="radio"
        />
      ))}
    </Box>
  );
}

function StatusScreen({
  filters,
  labels,
  statusOptions,
  onUpdateFilters,
}: FilterScreenContentProps): React.ReactElement {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <FilterOptionRow
        label={labels.any}
        selected={filters.statuses.length === 0}
        onClick={() => onUpdateFilters({ statuses: [] })}
        variant="checkbox"
      />
      {statusOptions.map(opt => (
        <FilterOptionRow
          key={opt.value}
          label={opt.label}
          selected={filters.statuses.includes(opt.value)}
          onClick={() => onUpdateFilters({ statuses: withToggle(filters.statuses)(opt.value) })}
          variant="checkbox"
        />
      ))}
    </Box>
  );
}

function DateScreen({
  filters,
  labels,
  datePresets,
  dateModes,
  onUpdateFilters,
}: FilterScreenContentProps): React.ReactElement {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <FilterOptionRow
          label={labels.any}
          selected={!filters.date}
          onClick={() => onUpdateFilters({ date: null })}
          variant="radio"
        />
        {datePresets.map(opt => (
          <FilterOptionRow
            key={opt.value}
            label={opt.label}
            selected={filters.date?.preset === opt.value}
            onClick={() => onUpdateFilters({ date: { preset: opt.value } })}
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
        {dateModes.map(opt => (
          <FilterOptionRow
            key={opt.value}
            label={opt.label}
            selected={filters.date?.mode === opt.value}
            onClick={() =>
              onUpdateFilters({
                date: {
                  mode: opt.value,
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
            <DatePicker
              value={filters.date?.date ? parseISO(filters.date.date) : null}
              onChange={(d: Date | null) =>
                onUpdateFilters({
                  date: {
                    mode: filters.date?.mode,
                    date: d && isValid(d) ? format(d, 'yyyy-MM-dd') : '',
                  },
                })
              }
              slotProps={{ textField: { size: 'small', fullWidth: true } as never }}
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function FromToScreen({
  screen,
  filters,
  labels,
  fromOptions,
  toOptions,
  onUpdateFilters,
}: FilterScreenContentProps): React.ReactElement {
  const values = screen === 'from' ? filters.from : filters.to;
  const options = screen === 'from' ? fromOptions : toOptions;
  const emptyBox = (
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
  if (options.length === 0) {
    return emptyBox;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {options.map(opt => (
        <FilterOptionRow
          key={opt.id}
          label={opt.label}
          description={opt.description}
          avatarUrl={opt.avatarUrl}
          bankName={opt.bankName}
          selected={values.includes(opt.id)}
          onClick={() =>
            onUpdateFilters(
              screen === 'from'
                ? { from: withToggle(values)(opt.id) }
                : { to: withToggle(values)(opt.id) },
            )
          }
        />
      ))}
    </Box>
  );
}

function KeywordsScreen({
  filters,
  labels,
  onUpdateFilters,
}: FilterScreenContentProps): React.ReactElement {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="body2" fontWeight={500} color="text.secondary">
        {labels.keywords}
      </Typography>
      <input
        value={filters.keywords}
        onChange={e => onUpdateFilters({ keywords: e.target.value })}
        placeholder={labels.keywords}
        style={INPUT_STYLE}
      />
    </Box>
  );
}

function AmountScreen({ filters, onUpdateFilters }: FilterScreenContentProps): React.ReactElement {
  const t = useIntlayer('statementFilterControls');
  const parseNum = (v: string): number | null => {
    const n = Number(v);
    return v.trim() && Number.isFinite(n) ? n : null;
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="body2" fontWeight={500} color="text.secondary">
          {t.min}
        </Typography>
        <input
          inputMode="decimal"
          value={filters.amountMin !== null ? String(filters.amountMin) : ''}
          onChange={e => onUpdateFilters({ amountMin: parseNum(e.target.value) })}
          placeholder="0"
          style={{ ...INPUT_STYLE, marginTop: 8 }}
        />
      </Box>
      <Box>
        <Typography variant="body2" fontWeight={500} color="text.secondary">
          {t.max}
        </Typography>
        <input
          inputMode="decimal"
          value={filters.amountMax !== null ? String(filters.amountMax) : ''}
          onChange={e => onUpdateFilters({ amountMax: parseNum(e.target.value) })}
          placeholder="0"
          style={{ ...INPUT_STYLE, marginTop: 8 }}
        />
      </Box>
    </Box>
  );
}

const BOOLEAN_FIELD_MAP: Record<string, 'approved' | 'billable' | 'exported' | 'paid'> = {
  approved: 'approved',
  billable: 'billable',
  exported: 'exported',
  paid: 'paid',
};

function BooleanScreen({
  screen,
  filters,
  labels,
  onUpdateFilters,
}: FilterScreenContentProps): React.ReactElement {
  const field = BOOLEAN_FIELD_MAP[screen];
  const current = filters[field] as boolean | null;
  const update = (v: boolean | null): void => onUpdateFilters({ [field]: v });
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <FilterOptionRow
        label={labels.any}
        selected={current === null}
        onClick={() => update(null)}
        variant="radio"
      />
      <FilterOptionRow
        label={labels.yes}
        selected={current === true}
        onClick={() => update(true)}
        variant="radio"
      />
      <FilterOptionRow
        label={labels.no}
        selected={current === false}
        onClick={() => update(false)}
        variant="radio"
      />
    </Box>
  );
}

function GroupByScreen({
  filters,
  labels,
  groupByOptions,
  onUpdateFilters,
}: FilterScreenContentProps): React.ReactElement {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <FilterOptionRow
        label={labels.any}
        selected={!filters.groupBy}
        onClick={() => onUpdateFilters({ groupBy: null })}
        variant="radio"
      />
      {groupByOptions.map(opt => (
        <FilterOptionRow
          key={opt.value}
          label={opt.label}
          selected={filters.groupBy === opt.value}
          onClick={() => onUpdateFilters({ groupBy: opt.value })}
          variant="radio"
        />
      ))}
    </Box>
  );
}

function HasScreen({
  filters,
  labels,
  hasOptions,
  onUpdateFilters,
}: FilterScreenContentProps): React.ReactElement {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <FilterOptionRow
        label={labels.any}
        selected={filters.has.length === 0}
        onClick={() => onUpdateFilters({ has: [] })}
        variant="checkbox"
      />
      {hasOptions.map(opt => (
        <FilterOptionRow
          key={opt.value}
          label={opt.label}
          selected={filters.has.includes(opt.value)}
          onClick={() => onUpdateFilters({ has: withToggle(filters.has)(opt.value) })}
          variant="checkbox"
        />
      ))}
    </Box>
  );
}

function LimitScreen({
  filters,
  labels,
  onUpdateFilters,
}: FilterScreenContentProps): React.ReactElement {
  const parseNum = (v: string): number | null => {
    const n = Number(v);
    return v.trim() && Number.isFinite(n) ? n : null;
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="body2" fontWeight={500} color="text.secondary">
        {labels.limit}
      </Typography>
      <input
        inputMode="numeric"
        value={filters.limit !== null ? String(filters.limit) : ''}
        onChange={e => onUpdateFilters({ limit: parseNum(e.target.value) })}
        placeholder="0"
        style={INPUT_STYLE}
      />
    </Box>
  );
}

function CurrencyScreen({
  filters,
  labels,
  currencyOptions,
  onUpdateFilters,
}: FilterScreenContentProps): React.ReactElement {
  const emptyBox = (
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
  if (currencyOptions.length === 0) {
    return emptyBox;
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
          onClick={() => onUpdateFilters({ currencies: withToggle(filters.currencies)(currency) })}
          variant="checkbox"
        />
      ))}
    </Box>
  );
}

type ScreenFc = React.FC<FilterScreenContentProps>;

const SCREEN_MAP: Record<string, ScreenFc> = {
  type: TypeScreen,
  status: StatusScreen,
  date: DateScreen,
  from: FromToScreen,
  to: FromToScreen,
  keywords: KeywordsScreen,
  amount: AmountScreen,
  approved: BooleanScreen,
  billable: BooleanScreen,
  exported: BooleanScreen,
  paid: BooleanScreen,
  groupBy: GroupByScreen,
  has: HasScreen,
  limit: LimitScreen,
  currency: CurrencyScreen,
};

export function FilterScreenContent(props: FilterScreenContentProps): React.ReactElement | null {
  const Screen = SCREEN_MAP[props.screen];
  return Screen ? <Screen {...props} /> : null;
}
