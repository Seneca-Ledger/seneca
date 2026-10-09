'use client';

import { Popover } from '@mui/material';
import { useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { Filter, X } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { Select } from '@/app/components/ui/select';
import { type ActiveFilter, NO_VALUE_OPS, operatorsForColumn } from '../hooks/useRowFilters';
import type { CustomTableColumn, RowFilter, RowFilterOp } from '../utils/types';

export interface FilterBarLabels {
  filter: string;
  column: string;
  operator: string;
  value: string;
  from: string;
  to: string;
  apply: string;
  clearAll: string;
  removeFilter: string;
  yes: string;
  no: string;
  operators: Record<RowFilterOp, string>;
}

interface FilterBarProps {
  columns: CustomTableColumn[];
  filters: ActiveFilter[];
  onAdd: (filter: RowFilter) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  labels: FilterBarLabels;
}

const describeValue = (filter: ActiveFilter, labels: FilterBarLabels): string => {
  if (NO_VALUE_OPS.has(filter.op)) {
    return '';
  }
  if (Array.isArray(filter.value)) {
    return ` ${filter.value.join(' – ')}`;
  }
  if (typeof filter.value === 'boolean') {
    return ` ${filter.value ? labels.yes : labels.no}`;
  }
  return ` ${String(filter.value ?? '')}`;
};

const inputType = (column: CustomTableColumn | undefined): string =>
  column?.type === 'date'
    ? 'date'
    : column && ['number', 'currency', 'formula'].includes(column.type)
      ? 'number'
      : 'text';

function FilterForm({
  columns,
  onAdd,
  labels,
  close,
}: Pick<FilterBarProps, 'columns' | 'onAdd' | 'labels'> & { close: () => void }) {
  const [columnKey, setColumnKey] = useState(columns[0]?.key ?? '');
  const column = columns.find(c => c.key === columnKey);
  const ops = column ? operatorsForColumn(column) : [];
  const [op, setOp] = useState<RowFilterOp>(ops[0] ?? 'contains');
  const [value, setValue] = useState('');
  const [valueTo, setValueTo] = useState('');
  const currentOp = ops.includes(op) ? op : ops[0];
  const needsValue = currentOp ? !NO_VALUE_OPS.has(currentOp) : false;
  const type = inputType(column);

  const submit = () => {
    if (!(column && currentOp)) {
      return;
    }
    let parsed: unknown;
    if (!needsValue) {
      parsed = undefined;
    } else if (column.type === 'boolean') {
      parsed = value === 'true';
    } else if (currentOp === 'between') {
      parsed = [
        type === 'number' ? Number(value) : value,
        type === 'number' ? Number(valueTo) : valueTo,
      ];
    } else {
      parsed = type === 'number' ? Number(value) : value;
    }
    onAdd({ col: column.key, op: currentOp, value: parsed });
    close();
  };

  return (
    <form
      className="lumio-ct__filter-form"
      onSubmit={event => {
        event.preventDefault();
        submit();
      }}
    >
      <Select
        size="small"
        inputProps={{ 'aria-label': labels.column }}
        value={columnKey}
        onChange={next => {
          setColumnKey(next);
          const nextColumn = columns.find(c => c.key === next);
          setOp(nextColumn ? operatorsForColumn(nextColumn)[0] : 'contains');
        }}
        options={columns.map(c => ({ value: c.key, label: c.title }))}
      />
      <Select
        size="small"
        inputProps={{ 'aria-label': labels.operator }}
        value={currentOp ?? ''}
        onChange={next => setOp(next as RowFilterOp)}
        options={ops.map(item => ({ value: item, label: labels.operators[item] }))}
      />
      {needsValue && column?.type === 'boolean' ? (
        <Select
          size="small"
          inputProps={{ 'aria-label': labels.value }}
          value={value || 'true'}
          onChange={setValue}
          options={[
            { value: 'true', label: labels.yes },
            { value: 'false', label: labels.no },
          ]}
        />
      ) : null}
      {needsValue && column?.type !== 'boolean' ? (
        type === 'date' ? (
          <CustomDatePicker
            label={currentOp === 'between' ? labels.from : labels.value}
            value={value || null}
            onChange={setValue}
          />
        ) : (
          <input
            className="lumio-ct__filter-input"
            type={type}
            aria-label={currentOp === 'between' ? labels.from : labels.value}
            value={value}
            onChange={event => setValue(event.target.value)}
          />
        )
      ) : null}
      {needsValue && currentOp === 'between' ? (
        type === 'date' ? (
          <CustomDatePicker label={labels.to} value={valueTo || null} onChange={setValueTo} />
        ) : (
          <input
            className="lumio-ct__filter-input"
            type={type}
            aria-label={labels.to}
            value={valueTo}
            onChange={event => setValueTo(event.target.value)}
          />
        )
      ) : null}
      <Button type="submit" size="sm">
        {labels.apply}
      </Button>
    </form>
  );
}

/** Active filter chips plus the "add filter" popover. */
export function FilterBar({ columns, filters, onAdd, onRemove, onClear, labels }: FilterBarProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const titleFor = (key: string) => columns.find(c => c.key === key)?.title ?? key;
  return (
    <div className="lumio-ct__filters">
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={event => setAnchor(event.currentTarget)}
      >
        <Filter size={14} aria-hidden />
        {labels.filter}
        {filters.length ? <span className="lumio-grid__menu-count">{filters.length}</span> : null}
      </Button>
      {filters.map(filter => (
        <span key={filter.id} className="lumio-ct__filter-chip">
          {titleFor(filter.col)} {labels.operators[filter.op].toLowerCase()}
          {describeValue(filter, labels)}
          <button
            type="button"
            className="lumio-ct__filter-chip-remove"
            aria-label={`${labels.removeFilter}: ${titleFor(filter.col)}`}
            onClick={() => onRemove(filter.id)}
          >
            <X size={12} aria-hidden />
          </button>
        </span>
      ))}
      {filters.length > 1 ? (
        <Button variant="ghost" size="sm" type="button" onClick={onClear}>
          {labels.clearAll}
        </Button>
      ) : null}
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {anchor ? (
          <FilterForm
            columns={columns}
            onAdd={onAdd}
            labels={labels}
            close={() => setAnchor(null)}
          />
        ) : null}
      </Popover>
    </div>
  );
}
