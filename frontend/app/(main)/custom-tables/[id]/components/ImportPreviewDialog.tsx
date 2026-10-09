'use client';

import { Checkbox } from '@/app/components/ui/checkbox';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { Select } from '@/app/components/ui/select';
import { Spinner } from '@/app/components/ui/spinner';
import type { UsePasteImportReturn } from '../hooks/usePasteImport';
import { configForType, fieldForType } from '../utils/importTypes';
import type {
  PasteColumnMapping,
  PasteMappingSelection,
  PastePreviewData,
} from '../utils/pasteTypes';
import type { ColumnType, CustomTableColumn } from '../utils/types';

export interface ImportPreviewLabels {
  title: string;
  useHeaders: string;
  ignore: string;
  newColumn: string;
  newColumnTitle: string;
  newColumnType: string;
  sheet: string;
  rowsSummary: string;
  extraRows: string;
  errors: string;
  issuesKept: string;
  requiredUnmapped: string;
  requiredBlank: string;
  totalsExcluded: string;
  applyTotals: string;
  optionsCount: string;
  formulasSummary: string;
  formulaCarried: string;
  formulaSkipped: string;
  progress: string;
  add: string;
  cancel: string;
  source: string;
  target: string;
}

interface ImportPreviewDialogProps {
  paste: UsePasteImportReturn;
  columns: CustomTableColumn[];
  labels: ImportPreviewLabels;
  /** Названия типов колонок из диалога колонки, чтобы не переводить дважды. */
  typeLabels: Record<string, string>;
  /** Подсказка «похоже на подписки — разнести по приложению?» от страницы. */
  banner?: React.ReactNode;
}

const fill = (template: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)), template);

const NEW = '__new__';
const IGNORE = '__ignore__';

const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || String(value).trim() === '';

/**
 * The server rejects the whole batch when a required column of the table is
 * left empty, so say so before the upload: which column, and how many rows.
 */
function findRequiredProblems(
  columns: CustomTableColumn[],
  preview: PastePreviewData,
): Array<{ title: string; blank: number; unmapped: boolean }> {
  return columns
    .filter(col => col.isRequired)
    .map(col => {
      const mapped = preview.columns.some(
        c => c.mode === 'existing' && c.columnKey === col.key && c.sourceIndex !== null,
      );
      const blank = mapped ? preview.dataRows.filter(row => isBlank(row[col.key])).length : 0;
      return { title: col.title, blank, unmapped: !mapped };
    })
    .filter(item => item.unmapped || item.blank > 0);
}

/** Типы, которые импорт умеет заполнить из текста; формулы и связи задаются потом руками. */
const IMPORT_TYPES: ColumnType[] = ['text', 'number', 'currency', 'date', 'boolean', 'select'];

const selectionValue = (mapping: PasteColumnMapping): string =>
  mapping.mode === 'new' ? NEW : (mapping.columnKey ?? IGNORE);

/** Короткая подпись к угаданным настройкам: код валюты, процент, число вариантов. */
const configChip = (mapping: PasteColumnMapping, optionsCountLabel: string): string | null => {
  const config = mapping.newConfig;
  if (!config) {
    return null;
  }
  if (mapping.newType === 'formula' && config.expression) {
    return 'ƒ';
  }
  if (mapping.newType === 'currency' && config.currency) {
    return config.currency;
  }
  if (mapping.newType === 'number' && config.format === 'percent') {
    return '%';
  }
  if (mapping.newType === 'select' && Array.isArray(config.options)) {
    return fill(optionsCountLabel, { count: config.options.length });
  }
  return null;
};

function MappingRow({
  mapping,
  columns,
  onChange,
  labels,
  typeLabels,
}: {
  mapping: PasteColumnMapping;
  columns: CustomTableColumn[];
  onChange: (selection: PasteMappingSelection) => void;
  labels: ImportPreviewLabels;
  typeLabels: Record<string, string>;
}) {
  const sourceIndex = mapping.sourceIndex;
  if (sourceIndex === null) {
    return null;
  }
  const value = selectionValue(mapping);
  const asNew = (patch: Partial<PasteMappingSelection>): PasteMappingSelection => ({
    mode: 'new',
    newTitle: mapping.newTitle ?? mapping.label,
    newType: mapping.newType,
    newConfig: mapping.newConfig,
    field: mapping.field,
    ...patch,
  });
  const chip = configChip(mapping, labels.optionsCount);
  const formula = mapping.formula;
  const formulaTitle = formula
    ? formula.expression && mapping.newType === 'formula'
      ? fill(labels.formulaCarried, {}).replace('{{expression}}', formula.expression)
      : fill(labels.formulaSkipped, {}).replace('{{reason}}', formula.reason ?? formula.excel)
    : undefined;
  const typeOptions = IMPORT_TYPES.concat(mapping.newConfig?.expression ? ['formula'] : []);
  return (
    <li className="lumio-ct__map-row">
      <span className="lumio-ct__map-source" title={mapping.label}>
        {mapping.label}
      </span>
      <Select
        size="small"
        inputProps={{ 'aria-label': `${labels.target}: ${mapping.label}` }}
        value={value}
        onChange={next => {
          if (next === IGNORE) {
            onChange({ mode: 'ignore' });
          } else if (next === NEW) {
            onChange(asNew({}));
          } else {
            onChange({ mode: 'existing', columnKey: next });
          }
        }}
        options={[
          { value: IGNORE, label: labels.ignore },
          { value: NEW, label: labels.newColumn },
          ...columns.map(column => ({ value: column.key, label: column.title })),
        ]}
      />
      {mapping.mode === 'new' ? (
        <>
          <input
            className="lumio-ct__input lumio-ct__input--compact"
            aria-label={labels.newColumnTitle}
            placeholder={labels.newColumnTitle}
            defaultValue={mapping.newTitle ?? ''}
            onBlur={event => onChange(asNew({ newTitle: event.target.value }))}
          />
          <span className="lumio-ct__map-type">
            <Select
              size="small"
              inputProps={{ 'aria-label': `${labels.newColumnType}: ${mapping.label}` }}
              value={mapping.newType ?? 'text'}
              onChange={next => {
                const type = next as ColumnType;
                onChange(
                  asNew({
                    newType: type,
                    newConfig: configForType(type, mapping.newConfig),
                    field: fieldForType(type),
                  }),
                );
              }}
              options={typeOptions.map(type => ({ value: type, label: typeLabels[type] ?? type }))}
            />
            {chip ? (
              <span className="lumio-ct__map-chip" title={formulaTitle}>
                {chip}
              </span>
            ) : null}
            {formula && !(formula.expression && mapping.newType === 'formula') ? (
              <span className="lumio-ct__map-chip lumio-ct__map-chip--warning" title={formulaTitle}>
                ⚠ ƒ
              </span>
            ) : null}
          </span>
        </>
      ) : null}
    </li>
  );
}

/** Maps the columns of a pasted/imported sheet onto the table before insert. */
export function ImportPreviewDialog({
  paste,
  columns,
  labels,
  typeLabels,
  banner,
}: ImportPreviewDialogProps) {
  const { pastePreview: preview, pasteParsing, pasteApplying, pasteProgress } = paste;
  const issueCount = preview ? Object.values(preview.errors).reduce((a, b) => a + b, 0) : 0;
  const requiredProblems = preview ? findRequiredProblems(columns, preview) : [];
  const canAdd = Boolean(
    preview?.dataRows.length && !paste.hasMissingPasteColumnTitles && !requiredProblems.length,
  );
  const visibleColumns = preview?.columns.filter(c => c.sourceIndex !== null) ?? [];
  const confirmText = pasteProgress
    ? fill(labels.progress, { done: pasteProgress.done, total: pasteProgress.total })
    : fill(labels.add, { count: preview?.dataRows.length ?? 0 });

  return (
    <ModalShell
      isOpen={paste.pastePreviewOpen}
      onClose={paste.resetPastePreview}
      size="lg"
      title={labels.title}
      footer={
        <ModalFooter
          onCancel={paste.resetPastePreview}
          onConfirm={() => void paste.handlePasteAdd()}
          cancelText={labels.cancel}
          confirmText={confirmText}
          isConfirmLoading={pasteApplying}
          isConfirmDisabled={!canAdd || pasteParsing}
        />
      }
    >
      {pasteParsing || !preview ? (
        <div className="lumio-ct__center">
          <Spinner size={24} />
        </div>
      ) : (
        <div className="lumio-ct__import">
          <div className="lumio-ct__import-controls">
            {paste.pasteSheets.length ? (
              <Select
                size="small"
                inputProps={{ 'aria-label': labels.sheet }}
                value={String(paste.pasteSheetIndex)}
                onChange={next => paste.selectSheet(Number(next))}
                options={paste.pasteSheets.map(sheet => ({
                  value: String(sheet.index),
                  label: `${sheet.name} · ${sheet.rows}`,
                }))}
              />
            ) : null}
            {preview.hasHeadersToggle ? (
              <Checkbox
                label={labels.useHeaders}
                checked={paste.pasteUseHeaders}
                onCheckedChange={paste.handlePasteHeadersToggle}
              />
            ) : null}
            {preview.totals.excludedRows ? (
              <Checkbox
                label={`${fill(labels.totalsExcluded, { count: preview.totals.excludedRows })} · ${labels.applyTotals}`}
                checked={paste.pasteApplyTotals}
                onCheckedChange={paste.setPasteApplyTotals}
              />
            ) : null}
          </div>
          <div className="lumio-ct__map-head">
            <span>{labels.source}</span>
            <span>{labels.target}</span>
            <span>{labels.newColumnTitle}</span>
            <span>{labels.newColumnType}</span>
          </div>
          <ul className="lumio-ct__map">
            {preview.columns.map(mapping => (
              <MappingRow
                key={mapping.sourceIndex ?? mapping.columnKey ?? mapping.label}
                mapping={mapping}
                columns={columns}
                onChange={selection => {
                  if (mapping.sourceIndex !== null) {
                    paste.handlePasteMappingChange(mapping.sourceIndex, selection);
                  }
                }}
                labels={labels}
                typeLabels={typeLabels}
              />
            ))}
          </ul>
          <p className="lumio-ct__hint">
            {fill(labels.rowsSummary, {
              shown: preview.previewRows.length,
              total: preview.totalRows,
            })}
            {preview.extraRowsCount
              ? ` ${fill(labels.extraRows, { count: preview.extraRowsCount })}`
              : ''}
          </p>
          {banner}
          {requiredProblems.map(item => (
            <p key={item.title} className="lumio-ct__hint lumio-ct__hint--warning">
              {item.unmapped
                ? fill(labels.requiredUnmapped, { column: item.title })
                : fill(labels.requiredBlank, { column: item.title, count: item.blank })}
            </p>
          ))}
          {issueCount ? (
            <p className="lumio-ct__hint lumio-ct__hint--warning">
              {fill(labels.issuesKept, { count: issueCount })}
            </p>
          ) : null}
          {preview.formulas.total ? (
            <p className="lumio-ct__hint">
              {fill(labels.formulasSummary, {
                done: preview.formulas.carried,
                total: preview.formulas.total,
              })}
            </p>
          ) : null}
          <div className="lumio-ct__preview-scroll">
            <table className="lumio-ct__preview">
              <thead>
                <tr>
                  {visibleColumns.map(column => (
                    <th key={column.sourceIndex}>
                      {column.mode === 'new' ? column.newTitle || column.label : column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.previewRows.map(row => (
                  <tr key={row.id}>
                    {row.cells.map((cell, index) => (
                      <td
                        key={`${row.id}:${cell.sourceIndex ?? index}`}
                        className={cell.error ? 'lumio-ct__preview-warning' : undefined}
                      >
                        {cell.sourceIndex === null ? (
                          cell.value
                        ) : (
                          <input
                            className="lumio-ct__preview-input"
                            value={cell.value}
                            aria-label={`${row.rowIndex + 1}:${cell.sourceIndex}`}
                            onChange={event =>
                              paste.handlePasteCellChange(
                                row.rowIndex,
                                cell.sourceIndex as number,
                                event.target.value,
                              )
                            }
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
