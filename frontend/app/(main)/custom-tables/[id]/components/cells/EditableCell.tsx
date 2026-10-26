'use client';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, isValid, parseISO } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { usePrivacyMode } from '@/app/lib/privacy-mode';
import { resolvePickerFormat } from '@/app/lib/user-format';
import { useUserFormat } from '@/app/lib/user-format-store';
import { parseLocalizedNumber } from '../../utils/numberFormat';
import { normalizeSelectOptions } from '../../utils/selectOptions';
import type {
  CustomTableCellValue,
  CustomTableColumn,
  CustomTableGridRow,
} from '../../utils/types';
import { CategoryCellEditor } from './CategoryCellEditor';
import { CurrencyCodeEditor } from './CurrencyCodeEditor';
import {
  EMPTY_CELL,
  formatCellText,
  isCategoryColumn,
  isCurrencyCodeColumn,
  isEditableColumn,
  isNumericColumn,
  isReadOnlySourceCell,
  selectedOptions,
} from './formatCell';
import { MultiSelectEditor, OptionChip, SelectEditor } from './SelectEditors';

export type UpdateCellFn = (
  rowId: string,
  columnKey: string,
  value: CustomTableCellValue,
) => Promise<void>;

export interface CellLabels {
  yes: string;
  no: string;
  clear: string;
  edit: string;
  /** Hint on cells that show a value the app keeps itself. */
  readOnlySource: string;
}

export interface EditableCellProps {
  column: CustomTableColumn;
  row: CustomTableGridRow;
  fallbackCurrency: string;
  missingRequired: boolean;
  onUpdate: UpdateCellFn;
  labels: CellLabels;
  /** The source of a table filled from app data: its cells write back to the records. */
  sourceKind?: string | null;
}

type EditorProps = EditableCellProps & { done: () => void };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toDateInput = (value: CustomTableCellValue): string => {
  if (typeof value !== 'string' || !value) {
    return '';
  }
  if (DATE_RE.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};

const saveQuietly = (promise: Promise<void>) =>
  promise.catch(error => console.error('Cell update failed:', error));

/** Text and number cells: Enter or blur saves, Escape reverts. */
function TextEditor({ column, row, onUpdate, done }: EditorProps) {
  const raw = row.data?.[column.key] ?? null;
  const initial = raw === null ? '' : String(raw);
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const numeric = isNumericColumn(column);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = async () => {
    const trimmed = value.trim();
    const next: CustomTableCellValue =
      trimmed === '' ? null : numeric ? parseLocalizedNumber(trimmed) : value;
    const unparsable = numeric && trimmed !== '' && next === null;
    if (!unparsable && next !== raw) {
      await saveQuietly(onUpdate(row.id, column.key, next));
    }
    done();
  };

  return (
    <input
      ref={inputRef}
      className={`seneca-ct__cell-input${numeric ? ' seneca-ct__cell-input--numeric' : ''}`}
      value={value}
      inputMode={numeric ? 'decimal' : undefined}
      onChange={event => setValue(event.target.value)}
      onBlur={() => void commit()}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          void commit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          done();
        }
      }}
    />
  );
}

/** Date cells: the app calendar opens at once; picking a day saves, closing it ends editing. */
function DateEditor({ column, row, onUpdate, done }: EditorProps) {
  const initial = toDateInput(row.data?.[column.key] ?? null);
  const { preferences } = useUserFormat();
  const commit = (date: Date | null) => {
    const next = date && isValid(date) ? format(date, 'yyyy-MM-dd') : null;
    if (next !== (initial || null)) {
      void saveQuietly(onUpdate(row.id, column.key, next));
    }
  };
  return (
    <DatePicker
      open
      value={initial ? parseISO(initial) : null}
      format={resolvePickerFormat(preferences)}
      onAccept={commit}
      onClose={done}
      slotProps={{
        textField: {
          autoFocus: true,
          fullWidth: true,
          size: 'small',
          variant: 'standard',
          className: 'seneca-ct__cell-input',
          slotProps: { input: { disableUnderline: true } },
        },
        actionBar: { actions: ['clear', 'today'] },
      }}
    />
  );
}

function OptionsEditor({ column, row, onUpdate, labels, done }: EditorProps) {
  const options = normalizeSelectOptions(column.config);
  const value = row.data?.[column.key] ?? null;
  if (column.type === 'multi_select') {
    return (
      <MultiSelectEditor
        options={options}
        value={Array.isArray(value) ? value : []}
        onChange={next => void saveQuietly(onUpdate(row.id, column.key, next.length ? next : null))}
        onClose={done}
      />
    );
  }
  return (
    <SelectEditor
      options={options}
      value={typeof value === 'string' ? value : null}
      clearLabel={labels.clear}
      onChange={next => void saveQuietly(onUpdate(row.id, column.key, next))}
      onClose={done}
    />
  );
}

function CellDisplay({ column, row, fallbackCurrency, labels }: EditableCellProps) {
  const privacy = usePrivacyMode();
  if (column.type === 'select' || column.type === 'multi_select') {
    const options = selectedOptions(column, row.data?.[column.key] ?? null);
    if (options.length) {
      return (
        <span className="seneca-ct__chips">
          {options.map(option => (
            <OptionChip key={option.value} option={option} />
          ))}
        </span>
      );
    }
  }
  const text = formatCellText(column, row, fallbackCurrency, labels);
  const empty = text === EMPTY_CELL;
  // An amount is hidden in privacy mode, and so is the tooltip that repeats it.
  const hidden = column.type === 'currency' && !empty;
  return (
    <span
      className={`seneca-ct__cell-text${empty ? ' seneca-ct__cell-text--empty' : ''}${
        hidden ? ` ${PRIVATE_CLASS}` : ''
      }`}
      title={hidden && privacy ? undefined : text}
    >
      {text}
    </span>
  );
}

const cellClassName = (
  column: CustomTableColumn,
  missingRequired: boolean,
  editable: boolean,
  issue: boolean,
) =>
  `seneca-ct__cell${editable ? ' seneca-ct__cell--editable' : ''}${
    missingRequired ? ' seneca-ct__cell--required' : ''
  }${issue ? ' seneca-ct__cell--issue' : ''}${
    isNumericColumn(column) ? ' seneca-ct__cell--numeric' : ''
  }`;

/**
 * One cell component for every column type. Read-only types (formula,
 * relation, ai) never enter edit mode: their values come from the server.
 * Neither do cells of app record fields the app keeps itself.
 */
export function EditableCell(props: EditableCellProps) {
  const { column, row, missingRequired, onUpdate, labels, sourceKind } = props;
  const [editing, setEditing] = useState(false);
  const lockedBySource = isReadOnlySourceCell(column, row, sourceKind);
  const editable = isEditableColumn(column) && !lockedBySource;
  const issue = Boolean(row.styles?.[column.key]?.importIssue);
  const className = cellClassName(column, missingRequired, editable, issue);

  if (column.type === 'boolean') {
    return (
      <div className={className}>
        <Checkbox
          aria-label={column.title}
          checked={row.data?.[column.key] === true}
          disabled={lockedBySource}
          onCheckedChange={next => void saveQuietly(onUpdate(row.id, column.key, next))}
        />
      </div>
    );
  }

  if (editing) {
    const done = () => setEditing(false);
    if (column.type === 'select' || column.type === 'multi_select') {
      return <OptionsEditor {...props} done={done} />;
    }
    if (isCategoryColumn(column)) {
      return (
        <div className={className}>
          <CellDisplay {...props} />
          <CategoryCellEditor
            value={row.data?.[column.key] ?? null}
            clearLabel={labels.clear}
            onChange={name => void saveQuietly(onUpdate(row.id, column.key, name))}
            onClose={done}
          />
        </div>
      );
    }
    if (isCurrencyCodeColumn(column)) {
      // The cell keeps its value on show while the drawer is open beside the grid.
      return (
        <div className={className}>
          <CellDisplay {...props} />
          <CurrencyCodeEditor
            value={row.data?.[column.key] ?? null}
            clearLabel={labels.clear}
            onChange={code => void saveQuietly(onUpdate(row.id, column.key, code))}
            onClose={done}
          />
        </div>
      );
    }
    return column.type === 'date' ? (
      <DateEditor {...props} done={done} />
    ) : (
      <TextEditor {...props} done={done} />
    );
  }

  if (!editable) {
    return (
      <div className={className} title={lockedBySource ? labels.readOnlySource : undefined}>
        <CellDisplay {...props} />
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`${className} seneca-ct__cell-button`}
      aria-label={`${labels.edit}: ${column.title}`}
      onClick={() => setEditing(true)}
    >
      <CellDisplay {...props} />
    </button>
  );
}
