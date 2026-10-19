'use client';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, isValid, parseISO } from 'date-fns';
import { FilterActions } from '@/app/(main)/statements/components/filters/FilterActions';
import { FilterDropdown } from '@/app/(main)/statements/components/filters/FilterDropdown';
import { FilterOptionRow } from '@/app/(main)/statements/components/filters/FilterOptionRow';
import { ChevronRight } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { ActiveRouteFilter } from './ActiveRouteFilter';
import type {
  StatementFilterDate,
  StatementFilterDateMode,
  StatementFilterDatePreset,
} from './statement-filters';

type DatePresetOption = {
  value: StatementFilterDatePreset;
  label: string;
};

type DateModeOption = {
  value: StatementFilterDateMode;
  label: string;
};

type DateFilterDropdownProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: DatePresetOption[];
  modes: DateModeOption[];
  value: StatementFilterDate | null;
  onChange: (value: StatementFilterDate | null) => void;
  onApply: () => void;
  onReset: () => void;
  trigger: React.ReactNode;
  applyLabel: string;
  resetLabel: string;
  routeFilterLabel?: string | null;
  onResetRouteFilter?: () => void;
};

const ensureDate = (value?: StatementFilterDate | null): StatementFilterDate => ({
  preset: value?.preset,
  mode: value?.mode,
  date: value?.date,
  dateTo: value?.dateTo,
});

const resolveFallbackDate = () => new Date().toISOString().slice(0, 10);

const toDateObj = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
};

const toIsoDate = (date: Date | null): string =>
  date && isValid(date) ? format(date, 'yyyy-MM-dd') : resolveFallbackDate();

export function DateFilterDropdown({
  open,
  onOpenChange,
  presets,
  modes,
  value,
  onChange,
  onApply,
  onReset,
  trigger,
  applyLabel,
  resetLabel,
  routeFilterLabel,
  onResetRouteFilter,
}: DateFilterDropdownProps) {
  const t = useIntlayer('statementFilterControls');
  const current = ensureDate(value);

  const startValue: Date | null = toDateObj(current.date);
  const endValue: Date | null = toDateObj(current.dateTo) ?? startValue;

  return (
    <FilterDropdown open={open} onOpenChange={onOpenChange} trigger={trigger}>
      {routeFilterLabel && onResetRouteFilter ? (
        <div style={{ marginBottom: 12 }}>
          <ActiveRouteFilter
            label={routeFilterLabel}
            resetLabel={resetLabel}
            onReset={onResetRouteFilter}
          />
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {presets.map(option => (
            <FilterOptionRow
              key={option.value}
              label={option.label}
              selected={current.preset === option.value}
              onClick={() => onChange({ preset: option.value })}
              variant="radio"
            />
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {modes.map(option => {
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    onChange(
                      option.value === 'on'
                        ? {
                            mode: option.value,
                            date: current.date ?? resolveFallbackDate(),
                            dateTo: current.dateTo || current.date || resolveFallbackDate(),
                          }
                        : {
                            mode: option.value,
                            date: current.date ?? resolveFallbackDate(),
                            dateTo: current.dateTo,
                          },
                    )
                  }
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: tokens.radius.md,
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--muted)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'none';
                  }}
                >
                  <span>{option.label}</span>
                  <ChevronRight size={20} style={{ color: 'var(--muted-foreground)' }} />
                </button>
              );
            })}
          </div>

          {current.mode && (
            <div
              data-testid="date-range-picker"
              style={{
                marginTop: 12,
                border: '1px solid var(--border-color)',
                background: 'rgba(249,250,251,0.6)',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <DatePicker
                label={t.startDate.value}
                value={startValue}
                onChange={(newVal: Date | null) => {
                  const dateStr = toIsoDate(newVal);
                  if (current.mode === 'before') {
                    onChange({ mode: current.mode, date: dateStr });
                  } else {
                    onChange({
                      mode: current.mode,
                      date: dateStr,
                      dateTo: current.mode === 'on' ? toIsoDate(endValue) : current.dateTo,
                    });
                  }
                }}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
              {current.mode === 'on' && (
                <DatePicker
                  label={t.endDate.value}
                  value={endValue}
                  onChange={(newVal: Date | null) => {
                    const dateStr = toIsoDate(newVal);
                    onChange({
                      mode: current.mode,
                      date: current.date ?? resolveFallbackDate(),
                      dateTo: dateStr,
                    });
                  }}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <FilterActions
        onReset={onReset}
        onApply={onApply}
        applyLabel={applyLabel}
        resetLabel={resetLabel}
      />
    </FilterDropdown>
  );
}
