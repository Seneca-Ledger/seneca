'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '@/app/lib/api';
import type { CustomTableColumn } from '../utils/types';

export interface FormulaEditorLabels {
  expression: string;
  expressionHint: string;
  formulaPreview: string;
  formulaNoRows: string;
  formulaChecking: string;
}

interface FormulaEditorProps {
  tableId: string | null;
  /** Key of the column being edited; null when adding. */
  columnKey: string | null;
  columns: CustomTableColumn[];
  /** `table`: a summary over column totals, with no current row. */
  scope?: 'row' | 'table';
  value: string;
  onChange: (next: string) => void;
  labels: FormulaEditorLabels;
}

/** Функции движка; сигнатуры подсказывают порядок аргументов. */
const FUNCTIONS: Array<{ name: string; signature: string }> = [
  { name: 'SUM', signature: 'SUM(a, b, …)' },
  { name: 'AVERAGE', signature: 'AVERAGE(a, b, …)' },
  { name: 'MIN', signature: 'MIN(a, b, …)' },
  { name: 'MAX', signature: 'MAX(a, b, …)' },
  { name: 'COUNT', signature: 'COUNT(a, b, …)' },
  { name: 'COUNTA', signature: 'COUNTA(a, b, …)' },
  { name: 'ROUND', signature: 'ROUND(value, digits)' },
  { name: 'ROUNDUP', signature: 'ROUNDUP(value, digits)' },
  { name: 'ROUNDDOWN', signature: 'ROUNDDOWN(value, digits)' },
  { name: 'ABS', signature: 'ABS(value)' },
  { name: 'IF', signature: 'IF(condition, then, else)' },
  { name: 'IFS', signature: 'IFS(condition1, value1, …)' },
  { name: 'AND', signature: 'AND(a, b, …)' },
  { name: 'OR', signature: 'OR(a, b, …)' },
  { name: 'NOT', signature: 'NOT(condition)' },
  { name: 'IFERROR', signature: 'IFERROR(value, fallback)' },
  { name: 'ISBLANK', signature: 'ISBLANK(value)' },
  { name: 'CONCAT', signature: 'CONCAT(a, b, …)' },
  { name: 'LEN', signature: 'LEN(text)' },
  { name: 'LEFT', signature: 'LEFT(text, count)' },
  { name: 'RIGHT', signature: 'RIGHT(text, count)' },
  { name: 'UPPER', signature: 'UPPER(text)' },
  { name: 'LOWER', signature: 'LOWER(text)' },
  { name: 'TRIM', signature: 'TRIM(text)' },
  { name: 'YEAR', signature: 'YEAR(date)' },
  { name: 'MONTH', signature: 'MONTH(date)' },
  { name: 'DAY', signature: 'DAY(date)' },
  { name: 'TODAY', signature: 'TODAY()' },
  { name: 'DAYS', signature: 'DAYS(end, start)' },
  { name: 'EOMONTH', signature: 'EOMONTH(date, months)' },
];

const PREVIEW_DEBOUNCE_MS = 400;
const MAX_SUGGESTIONS = 8;

type Suggestion = { label: string; insert: string; hint?: string };

interface PreviewResult {
  valid: boolean;
  error: string | null;
  resultType: 'number' | 'text' | 'boolean' | 'date' | null;
  sample: number | string | boolean | null;
}

/** Ключи колонок в формуле показываются как названия: человеку ключи ни о чём. */
const keysToTitles = (expression: string, columns: CustomTableColumn[]): string => {
  const byKey = new Map(columns.map(col => [col.key, col.title]));
  return expression.replace(/\[([^\]]{1,120})\]/g, (match, ref: string) => {
    const title = byKey.get(ref.trim());
    return title ? `[${title}]` : match;
  });
};

const formatSample = (sample: PreviewResult['sample']): string => {
  if (sample === null || sample === undefined) {
    return '—';
  }
  if (typeof sample === 'number') {
    return sample.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  if (typeof sample === 'boolean') {
    return sample ? 'TRUE' : 'FALSE';
  }
  return sample;
};

/** Что подсказать по тексту слева от курсора: колонки после «[», функции после букв. */
function suggestionsFor(
  before: string,
  columns: CustomTableColumn[],
  ownKey: string | null,
): { items: Suggestion[]; replaceFrom: number } {
  const bracket = /\[([^\]]*)$/.exec(before);
  if (bracket) {
    const query = bracket[1].toLowerCase();
    const items = columns
      .filter(col => col.key !== ownKey && col.title.toLowerCase().includes(query))
      .slice(0, MAX_SUGGESTIONS)
      .map(col => ({ label: col.title, insert: `[${col.title}]` }));
    return { items, replaceFrom: before.length - bracket[0].length };
  }
  const word = /([A-Za-z_]{1,20})$/.exec(before);
  if (word) {
    const query = word[1].toUpperCase();
    const items = FUNCTIONS.filter(fn => fn.name.startsWith(query))
      .slice(0, MAX_SUGGESTIONS)
      .map(fn => ({ label: fn.name, insert: `${fn.name}(`, hint: fn.signature }));
    return { items, replaceFrom: before.length - word[0].length };
  }
  return { items: [], replaceFrom: before.length };
}

/**
 * Formula input with column and function autocomplete and a server-side
 * preview on the first row: the engine lives on the backend, so the example
 * and the error text come from the same code that will fill the column.
 */
export function FormulaEditor({
  tableId,
  columnKey,
  columns,
  scope = 'row',
  value,
  onChange,
  labels,
}: FormulaEditorProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [caret, setCaret] = useState(value.length);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [checking, setChecking] = useState(false);

  // Сохранённая формула хранит ключи; редактор один раз переводит их в названия.
  useEffect(() => {
    if (/\[col_[0-9a-f]+\]/.test(value)) {
      onChange(keysToTitles(value, columns));
    }
    // Only on mount: later edits are already title-based.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!(tableId && value.trim())) {
      setPreview(null);
      return;
    }
    setChecking(true);
    const timer = window.setTimeout(() => {
      apiClient
        .post(`/custom-tables/${tableId}/formula-preview`, { expression: value, columnKey, scope })
        .then(response => setPreview((response.data?.data ?? response.data) as PreviewResult))
        .catch(() => setPreview(null))
        .finally(() => setChecking(false));
    }, PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [tableId, columnKey, scope, value]);

  const suggestions = useMemo(
    () => suggestionsFor(value.slice(0, caret), columns, columnKey),
    [value, caret, columns, columnKey],
  );

  const apply = (item: Suggestion) => {
    const next = `${value.slice(0, suggestions.replaceFrom)}${item.insert}${value.slice(caret)}`;
    const nextCaret = suggestions.replaceFrom + item.insert.length;
    onChange(next);
    setCaret(nextCaret);
    setOpen(false);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
    }, 0);
  };

  const showSuggestions = open && suggestions.items.length > 0;

  return (
    <div className="lumio-ct__field lumio-ct__field--wide lumio-ct__formula">
      <span className="lumio-ct__label">{labels.expression}</span>
      <input
        ref={inputRef}
        className="lumio-ct__input lumio-ct__input--mono"
        value={value}
        placeholder={scope === 'table' ? 'SUM([Income]) - SUM([Expense])' : '[Amount] * [Qty]'}
        autoComplete="off"
        onChange={event => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart ?? event.target.value.length);
          setOpen(true);
        }}
        onSelect={event => setCaret((event.target as HTMLInputElement).selectionStart ?? 0)}
        onKeyDown={event => {
          if (event.key === 'Escape' && showSuggestions) {
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === 'Enter' && showSuggestions) {
            event.preventDefault();
            apply(suggestions.items[0]);
          }
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {showSuggestions ? (
        <ul className="lumio-ct__formula-suggest">
          {suggestions.items.map(item => (
            <li key={item.label}>
              <button
                type="button"
                className="lumio-ct__formula-option"
                onMouseDown={event => event.preventDefault()}
                onClick={() => apply(item)}
              >
                <span>{item.label}</span>
                {item.hint ? <span className="lumio-ct__formula-hint">{item.hint}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <span className="lumio-ct__hint">{labels.expressionHint}</span>
      {value.trim() ? (
        <span
          className={`lumio-ct__hint lumio-ct__formula-preview${preview && !preview.valid ? ' lumio-ct__hint--error' : ''}`}
          aria-live="polite"
        >
          {checking && !preview
            ? labels.formulaChecking
            : preview === null
              ? labels.formulaNoRows
              : preview.valid
                ? labels.formulaPreview.replace('{{value}}', formatSample(preview.sample))
                : preview.error}
        </span>
      ) : null}
    </div>
  );
}
