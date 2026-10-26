'use client';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, isValid, parseISO } from 'date-fns';
import React from 'react';
import { FilterDropdown } from '@/app/(main)/statements/components/filters/FilterDropdown';
import { StatementsToolbarButton } from '@/app/(main)/statements/components/StatementsToolbarButton';
import { ChevronDown, SlidersHorizontal, X } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { Select } from '@/app/components/ui/select';
import { useTags } from '@/app/hooks/useTags';
import { useIntlayer } from '@/app/i18n';
import type { PayableSource, PayableStatus } from '@/app/lib/payables-api';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import type { PayablesFiltersState } from './payables-utils';

const toDate = (s: string): Date | null => {
  if (!s) {
    return null;
  }
  const d = parseISO(s);
  return isValid(d) ? d : null;
};
const toStr = (d: Date | null): string => (d && isValid(d) ? format(d, 'yyyy-MM-dd') : '');

interface PayableFiltersBarProps {
  value: PayablesFiltersState;
  onChange: (next: PayablesFiltersState) => void;
  onReset: () => void;
  labels: {
    status: string;
    source: string;
    dueFrom: string;
    dueTo: string;
    reset: string;
    allStatuses: string;
    allSources: string;
    allTags: string;
    statusOptions: Record<PayableStatus, string>;
    sourceOptions: Record<PayableSource, string>;
  };
}

/**
 * Payable filters as two toolbar buttons, the way the Submit page carries its
 * own: the due-date range behind Date, everything else behind Filters.
 */
// eslint-disable-next-line max-lines-per-function
function PayableFiltersBar({
  value,
  onChange,
  onReset,
  labels,
}: PayableFiltersBarProps): React.JSX.Element {
  const t = useIntlayer('statementsPage');
  const tagsText = useIntlayer('tagsPage');
  const { data: tags = [] } = useTags();
  const [dateOpen, setDateOpen] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const dateLabel = resolveLabel(getNestedValue(t, ['filters', 'date']), 'Date');
  const filtersLabel = resolveLabel(getNestedValue(t, ['filters', 'filters']), 'Filters');

  const update = <K extends keyof PayablesFiltersState>(
    key: K,
    nextValue: PayablesFiltersState[K],
  ): void => {
    onChange({ ...value, [key]: nextValue });
  };

  const hasDate = Boolean(value.dueDateFrom || value.dueDateTo);
  const activeCount =
    (value.status === 'all' ? 0 : 1) + (value.source === 'all' ? 0 : 1) + (value.tagId ? 1 : 0);

  return (
    <>
      <FilterDropdown
        open={dateOpen}
        onOpenChange={setDateOpen}
        align="end"
        trigger={
          <StatementsToolbarButton>
            {hasDate ? `${dateLabel} (1)` : dateLabel}
            <ChevronDown size={14} />
          </StatementsToolbarButton>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DatePicker
            label={labels.dueFrom}
            value={toDate(value.dueDateFrom)}
            onChange={(d: Date | null) => update('dueDateFrom', toStr(d))}
            slotProps={{ textField: { size: 'small', fullWidth: true } as never }}
          />
          <DatePicker
            label={labels.dueTo}
            value={toDate(value.dueDateTo)}
            onChange={(d: Date | null) => update('dueDateTo', toStr(d))}
            slotProps={{ textField: { size: 'small', fullWidth: true } as never }}
          />
        </div>
      </FilterDropdown>

      <FilterDropdown
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        align="end"
        trigger={
          <StatementsToolbarButton>
            <SlidersHorizontal size={14} />
            {activeCount > 0 ? `${filtersLabel} (${activeCount})` : filtersLabel}
          </StatementsToolbarButton>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Select
            fullWidth
            size="small"
            value={value.status}
            onChange={next => update('status', next as PayableStatus | 'all')}
            inputProps={{ 'aria-label': labels.status }}
            options={[
              { value: 'all', label: labels.allStatuses },
              ...Object.entries(labels.statusOptions).map(([optionValue, optionLabel]) => ({
                value: optionValue,
                label: optionLabel,
              })),
            ]}
          />

          <Select
            fullWidth
            size="small"
            value={value.source}
            onChange={next => update('source', next as PayableSource | 'all')}
            inputProps={{ 'aria-label': labels.source }}
            options={[
              { value: 'all', label: labels.allSources },
              ...Object.entries(labels.sourceOptions).map(([optionValue, optionLabel]) => ({
                value: optionValue,
                label: optionLabel,
              })),
            ]}
          />

          {/* Only once there is a tag to pick, or one is still chosen. */}
          {(tags.length > 0 || value.tagId) && (
            <Select
              fullWidth
              size="small"
              value={value.tagId || 'all'}
              onChange={next => update('tagId', next === 'all' ? '' : next)}
              inputProps={{ 'aria-label': tagsText.title.value }}
              options={[
                { value: 'all', label: labels.allTags },
                ...[...tags]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(tag => ({ value: tag.id, label: tag.name })),
              ]}
            />
          )}

          <Button
            variant="ghost"
            onClick={() => {
              onReset();
              setFiltersOpen(false);
            }}
          >
            <X size={16} />
            {labels.reset}
          </Button>
        </div>
      </FilterDropdown>
    </>
  );
}

export default PayableFiltersBar;
