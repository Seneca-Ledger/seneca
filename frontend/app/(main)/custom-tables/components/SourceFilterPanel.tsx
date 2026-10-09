'use client';

import { useQuery } from '@tanstack/react-query';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { MultiSelect } from '@/app/components/ui/multi-select';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
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
  preview: Record<'title' | 'count' | 'loading' | 'empty' | 'overwriteNote' | 'failed', string>;
}

interface StatementOption {
  id: string;
  fileName: string;
  statementDateFrom?: string | null;
  statementDateTo?: string | null;
}

interface SourceFilterPanelProps {
  source: SourceDef;
  filters: SourceFilters;
  onChange: (patch: Partial<SourceFilters>) => void;
  categories: TableCategory[];
  preview: SourcePreview | null;
  previewLoading: boolean;
  previewError: boolean;
  labels: SourceFilterPanelLabels;
}

const SAMPLE_ROWS = 4;
const STATEMENTS_LIMIT = 50;
const NUMERIC_TYPES = new Set(['number', 'currency']);

const readItems = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  const items = (payload as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
};

const statementLabel = (statement: StatementOption): string => {
  const period = [statement.statementDateFrom, statement.statementDateTo]
    .filter(Boolean)
    .join(' – ');
  return period ? `${statement.fileName} · ${period}` : statement.fileName;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="lumio-ct__field">
      <span className="lumio-ct__label lumio-ct__label--quiet">{label}</span>
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

const formatCell = (value: string | number | boolean | null, numeric: boolean): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (numeric && typeof value === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
};

function PreviewSample({ preview }: { preview: SourcePreview }) {
  const numericFields = new Set(
    preview.columns.filter(column => NUMERIC_TYPES.has(column.type)).map(column => column.field),
  );
  const cellClass = (field: string) =>
    numericFields.has(field) ? 'lumio-ct__preview-cell--numeric' : undefined;
  return (
    <div className="lumio-ct__preview-scroll">
      <table className="lumio-ct__preview-table">
        <thead>
          <tr>
            {preview.columns.map(column => (
              <th key={column.field} className={cellClass(column.field)}>
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.slice(0, SAMPLE_ROWS).map((row, index) => (
            <tr key={`${index}-${String(row[preview.columns[0]?.field ?? ''] ?? '')}`}>
              {preview.columns.map(column => (
                <td key={column.field} className={cellClass(column.field)}>
                  {formatCell(row[column.field], numericFields.has(column.field))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Filters of the chosen app source plus a live row count and a short sample. */
export function SourceFilterPanel(props: SourceFilterPanelProps) {
  const { source, filters, onChange, categories, preview, previewLoading, previewError, labels } =
    props;
  const workspaceId = useWorkspaceId();
  const wantsStatements = source.filterFields.includes('statements');
  const statementsQuery = useQuery({
    queryKey: [...queryKeys.customTables(workspaceId), 'source-statements'],
    queryFn: async ({ signal }) =>
      readItems<StatementOption>(
        await apiQuery<unknown>({
          url: '/statements',
          params: { page: 1, limit: STATEMENTS_LIMIT },
          signal,
        }),
      ),
    enabled: wantsStatements && Boolean(workspaceId),
  });
  const has = (field: SourceDef['filterFields'][number]) => source.filterFields.includes(field);

  let previewText: string;
  if (previewError) {
    previewText = labels.preview.failed;
  } else if (!preview && previewLoading) {
    previewText = labels.preview.loading;
  } else if (!preview || preview.count === 0) {
    previewText = labels.preview.empty;
  } else {
    previewText = labels.preview.count.replace('{{count}}', String(preview.count));
  }

  return (
    <div className="lumio-ct__source-panel">
      {source.filterFields.length ? (
        <section className="lumio-ct__source-section">
          <h3 className="lumio-ct__section-title">{labels.filters.title}</h3>
          <div className="lumio-ct__source-filters">
            {has('dateRange') ? (
              <>
                <Field label={labels.filters.dateFrom}>
                  <CustomDatePicker
                    value={filters.dateFrom}
                    onChange={dateFrom => onChange({ dateFrom })}
                    maxDate={filters.dateTo || undefined}
                  />
                </Field>
                <Field label={labels.filters.dateTo}>
                  <CustomDatePicker
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
                    value={filters.dueDateFrom}
                    onChange={dueDateFrom => onChange({ dueDateFrom })}
                    maxDate={filters.dueDateTo || undefined}
                  />
                </Field>
                <Field label={labels.filters.dueTo}>
                  <CustomDatePicker
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
              <Field label={labels.filters.currency}>
                <input
                  className="lumio-ct__input"
                  value={filters.currency}
                  maxLength={3}
                  aria-label={labels.filters.currency}
                  placeholder={labels.filters.currencyPlaceholder}
                  onChange={event => onChange({ currency: event.target.value.toUpperCase() })}
                />
              </Field>
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
                  placeholder={
                    categories.length ? labels.filters.any : labels.filters.categoriesEmpty
                  }
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
      ) : null}
      <section className="lumio-ct__source-section">
        <div className="lumio-ct__section-head">
          <h3 className="lumio-ct__section-title">{labels.preview.title}</h3>
          <span className="lumio-ct__preview-count" aria-live="polite" aria-busy={previewLoading}>
            {previewText}
          </span>
        </div>
        {preview && preview.count > 0 ? <PreviewSample preview={preview} /> : null}
        <p className="lumio-ct__preview-note">{labels.preview.overwriteNote}</p>
      </section>
    </div>
  );
}
