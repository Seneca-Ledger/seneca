'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { MultiSelect } from '@/app/components/ui/multi-select';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useLocale } from '@/app/i18n';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { resolveLocaleTag } from '@/app/lib/user-format';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import type { SourcePreview } from '../hooks/useSourcePreview';
import type { TableCategory } from '../hooks/useTablesList';
import { DIRECTION_OPTIONS, type SourceDef, type SourceFilters, TYPE_OPTIONS } from '../sources';

export interface SourceFilterPanelLabels {
  filters: Record<
    | 'title'
    | 'dateFrom'
    | 'dateTo'
    | 'categories'
    | 'categoriesEmpty'
    | 'type'
    | 'currency'
    | 'currencyPlaceholder'
    | 'statements'
    | 'statementsEmpty'
    | 'status'
    | 'direction'
    | 'dueFrom'
    | 'dueTo'
    | 'any'
    | 'selected',
    string
  >;
  /** Translated enum values: income, expense, payable, to_pay, draft… */
  options: Record<string, string>;
  preview: Record<
    | 'title'
    | 'count'
    | 'countOf'
    | 'sample'
    | 'loading'
    | 'empty'
    | 'overwriteNote'
    | 'failed'
    | 'resetFilters'
    | 'sourceLine'
    | 'allTime'
    | 'existing'
    | 'openExisting',
    string
  >;
}

interface StatementOption {
  id: string;
  fileName: string;
  statementDateFrom?: string | null;
  statementDateTo?: string | null;
}

const SAMPLE_ROWS = 5;
const STATEMENTS_LIMIT = 50;
/** Values shown through the translated option labels rather than as stored. */
const ENUM_FIELDS = new Set(['status', 'frequency', 'direction', 'periodType']);

const statementLabel = (statement: StatementOption): string => {
  const period = [statement.statementDateFrom, statement.statementDateTo]
    .filter(Boolean)
    .join(' – ');
  return period ? `${statement.fileName} · ${period}` : statement.fileName;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="lumio-ct__field">
      <span className="lumio-ct__label">{label}</span>
      {children}
    </div>
  );
}

function OptionSelect({
  label,
  value,
  values,
  anyLabel,
  optionLabels,
  onChange,
}: {
  label: string;
  value: string;
  values: readonly string[];
  anyLabel: string;
  optionLabels: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Select
        size="small"
        value={value}
        inputProps={{ 'aria-label': label }}
        onChange={onChange}
        options={[
          { value: '', label: anyLabel },
          ...values.map(item => ({ value: item, label: optionLabels[item] ?? item })),
        ]}
      />
    </Field>
  );
}

/** Stored cell values as the rest of the app shows them: "Sep 1, 2024", "−€650.00". */
export function formatPreviewCell(
  value: string | number | boolean | null | undefined,
  column: { field: string; type: string },
  row: Record<string, string | number | boolean | null>,
  locale: string,
  optionLabels: Record<string, string>,
): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (column.type === 'date' && typeof value === 'string') {
    return formatStoredDateWithOptions(
      value,
      { day: 'numeric', month: 'short', year: 'numeric' },
      locale,
    );
  }
  if (typeof value === 'number' && (column.type === 'currency' || column.type === 'number')) {
    const currency = typeof row.currency === 'string' ? row.currency : '';
    const money = column.type === 'currency';
    const text = new Intl.NumberFormat(locale, {
      ...(money && /^[A-Za-z]{3}$/.test(currency)
        ? { style: 'currency', currency: currency.toUpperCase() }
        : {}),
      minimumFractionDigits: money ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(value);
    return text.replace('-', '−');
  }
  if (typeof value === 'string' && ENUM_FIELDS.has(column.field)) {
    return optionLabels[value] ?? value;
  }
  return String(value);
}

interface SourceFilterFieldsProps {
  source: SourceDef;
  filters: SourceFilters;
  onChange: (patch: Partial<SourceFilters>) => void;
  categories: TableCategory[];
  /** Currency codes across the whole source, for the currency select. */
  currencies: readonly string[];
  labels: SourceFilterPanelLabels;
}

/** The chosen source's filters, as plain fields of one look. */
export function SourceFilterFields(props: SourceFilterFieldsProps) {
  const { source, filters, onChange, categories, currencies, labels } = props;
  const workspaceId = useWorkspaceId();
  const wantsStatements = source.filterFields.includes('statements');
  const statementsQuery = useQuery({
    queryKey: [...queryKeys.customTables(workspaceId), 'source-statements'],
    queryFn: async ({ signal }) =>
      apiQueryDecoded({
        url: '/statements',
        params: { page: 1, limit: STATEMENTS_LIMIT } satisfies ContractInput<'StatementsQuery'>,
        signal,
        contract: 'StatementList',
      }),
    enabled: wantsStatements && Boolean(workspaceId),
  });
  const has = (field: SourceDef['filterFields'][number]) => source.filterFields.includes(field);
  if (!source.filterFields.length) {
    return null;
  }
  const currencyValues = [
    ...new Set([...currencies, ...(filters.currency ? [filters.currency] : [])]),
  ];

  return (
    <section className="lumio-ct__source-section">
      <div className="lumio-ct__section-head">
        <h3 className="lumio-ct__section-title">{labels.filters.title}</h3>
        {has('dateRange') && (filters.dateFrom || filters.dateTo) ? (
          <button
            type="button"
            className="lumio-ct__text-button"
            onClick={() => onChange({ dateFrom: '', dateTo: '' })}
          >
            {labels.preview.allTime}
          </button>
        ) : null}
      </div>
      <div className="lumio-ct__source-filters">
        {has('dateRange') ? (
          <>
            <Field label={labels.filters.dateFrom}>
              <CustomDatePicker
                compact
                value={filters.dateFrom}
                onChange={dateFrom => onChange({ dateFrom })}
                maxDate={filters.dateTo || undefined}
              />
            </Field>
            <Field label={labels.filters.dateTo}>
              <CustomDatePicker
                compact
                value={filters.dateTo}
                onChange={dateTo => onChange({ dateTo })}
                minDate={filters.dateFrom || undefined}
              />
            </Field>
          </>
        ) : null}
        {has('dueRange') ? (
          <>
            <Field label={labels.filters.dueFrom}>
              <CustomDatePicker
                compact
                value={filters.dueDateFrom}
                onChange={dueDateFrom => onChange({ dueDateFrom })}
                maxDate={filters.dueDateTo || undefined}
              />
            </Field>
            <Field label={labels.filters.dueTo}>
              <CustomDatePicker
                compact
                value={filters.dueDateTo}
                onChange={dueDateTo => onChange({ dueDateTo })}
                minDate={filters.dueDateFrom || undefined}
              />
            </Field>
          </>
        ) : null}
        {has('type') ? (
          <OptionSelect
            label={labels.filters.type}
            value={filters.type}
            values={TYPE_OPTIONS}
            anyLabel={labels.filters.any}
            optionLabels={labels.options}
            onChange={type => onChange({ type })}
          />
        ) : null}
        {has('direction') ? (
          <OptionSelect
            label={labels.filters.direction}
            value={filters.direction}
            values={DIRECTION_OPTIONS}
            anyLabel={labels.filters.any}
            optionLabels={labels.options}
            onChange={direction => onChange({ direction })}
          />
        ) : null}
        {has('status') && source.statusOptions ? (
          <OptionSelect
            label={labels.filters.status}
            value={filters.status}
            values={source.statusOptions}
            anyLabel={labels.filters.any}
            optionLabels={labels.options}
            onChange={status => onChange({ status })}
          />
        ) : null}
        {has('currency') ? (
          <OptionSelect
            label={labels.filters.currency}
            value={filters.currency}
            values={currencyValues}
            anyLabel={labels.filters.any}
            optionLabels={{}}
            onChange={currency => onChange({ currency })}
          />
        ) : null}
        {has('categories') ? (
          <Field label={labels.filters.categories}>
            <MultiSelect
              aria-label={labels.filters.categories}
              value={filters.categoryIds}
              options={categories.map(category => ({
                value: category.id,
                label: category.name,
              }))}
              placeholder={categories.length ? labels.filters.any : labels.filters.categoriesEmpty}
              selectedLabel={labels.filters.selected}
              disabled={!categories.length}
              onChange={categoryIds => onChange({ categoryIds })}
            />
          </Field>
        ) : null}
        {wantsStatements ? (
          <Field label={labels.filters.statements}>
            <MultiSelect
              aria-label={labels.filters.statements}
              value={filters.statementIds}
              options={(statementsQuery.data ?? []).map(statement => ({
                value: statement.id,
                label: statementLabel(statement),
              }))}
              placeholder={
                statementsQuery.data?.length === 0
                  ? labels.filters.statementsEmpty
                  : labels.filters.any
              }
              selectedLabel={labels.filters.selected}
              disabled={!statementsQuery.data?.length}
              onChange={statementIds => onChange({ statementIds })}
            />
          </Field>
        ) : null}
      </div>
    </section>
  );
}

function PreviewSample({
  preview,
  fields,
  labels,
}: {
  preview: SourcePreview;
  fields: string[];
  labels: SourceFilterPanelLabels;
}) {
  const { locale } = useLocale();
  const tag = resolveLocaleTag(locale);
  const columns = fields
    .map(field => preview.columns.find(column => column.field === field))
    .filter((column): column is SourcePreview['columns'][number] => Boolean(column));
  const numeric = (type: string) => type === 'currency' || type === 'number';
  const colClass = (column: SourcePreview['columns'][number]): string | undefined => {
    if (column.type === 'date') return 'lumio-ct__preview-col--date';
    if (numeric(column.type)) return 'lumio-ct__preview-col--money';
    if (ENUM_FIELDS.has(column.field)) return 'lumio-ct__preview-col--enum';
    return undefined;
  };
  const rows = preview.rows.slice(0, SAMPLE_ROWS);
  return (
    <>
      <table className="lumio-ct__preview-table">
        <colgroup>
          {columns.map(column => (
            <col key={column.field} className={colClass(column)} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map(column => (
              <th
                key={column.field}
                className={numeric(column.type) ? 'lumio-ct__preview-cell--numeric' : undefined}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${index}-${String(row[columns[0]?.field ?? ''] ?? '')}`}>
              {columns.map(column => {
                const text = formatPreviewCell(row[column.field], column, row, tag, labels.options);
                return (
                  <td
                    key={column.field}
                    title={text}
                    className={numeric(column.type) ? 'lumio-ct__preview-cell--numeric' : undefined}
                  >
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="lumio-ct__preview-caption">
        {labels.preview.sample
          .replace('{{shown}}', String(rows.length))
          .replace('{{count}}', String(preview.count))}
      </p>
    </>
  );
}

interface SourcePreviewPanelProps {
  source: SourceDef;
  sourceName: string;
  preview: SourcePreview | null;
  /** Rows of the source without filters; null while unknown or when no filter is set. */
  total: number | null;
  loading: boolean;
  error: boolean;
  /** A table already filled from this source, which this one would duplicate. */
  existing: { id: string; name: string } | null;
  onResetFilters: (() => void) | null;
  labels: SourceFilterPanelLabels;
}

/**
 * What will be created, beside the filters so it changes as they do: the
 * source and its column count, the row count, what a refresh rewrites, and a
 * few rows formatted as the table will show them.
 */
export function SourcePreviewPanel(props: SourcePreviewPanelProps) {
  const { source, sourceName, preview, total, loading, error, existing, onResetFilters, labels } =
    props;
  const count = preview?.count ?? 0;

  let countText: string;
  if (error) {
    countText = labels.preview.failed;
  } else if (!preview && loading) {
    countText = labels.preview.loading;
  } else if (!preview || count === 0) {
    countText = labels.preview.empty;
  } else if (total !== null && total !== count) {
    countText = labels.preview.countOf
      .replace('{{count}}', String(count))
      .replace('{{total}}', String(total));
  } else {
    countText = labels.preview.count.replace('{{count}}', String(count));
  }

  return (
    <section className="lumio-ct__preview-pane" aria-label={labels.preview.title}>
      <p className="lumio-ct__preview-source">
        {labels.preview.sourceLine
          .replace('{{name}}', sourceName)
          .replace('{{count}}', String(source.columnFields.length))}
      </p>
      {existing ? (
        <p className="lumio-ct__preview-existing">
          <span className="lumio-ct__preview-dot" aria-hidden="true" />
          <span>
            {labels.preview.existing.replace('{{name}}', existing.name)}{' '}
            <Link href={`/custom-tables/${existing.id}`}>{labels.preview.openExisting}</Link>
          </span>
        </p>
      ) : null}
      <div className="lumio-ct__preview-head">
        <span
          className="lumio-ct__preview-count"
          aria-live="polite"
          aria-busy={loading}
          data-loading={loading || undefined}
        >
          {countText}
        </span>
        {onResetFilters ? (
          <button type="button" className="lumio-ct__text-button" onClick={onResetFilters}>
            {labels.preview.resetFilters}
          </button>
        ) : null}
      </div>
      <p className="lumio-ct__preview-note">{labels.preview.overwriteNote}</p>
      {preview && count > 0 ? (
        <PreviewSample preview={preview} fields={source.previewFields} labels={labels} />
      ) : null}
    </section>
  );
}
