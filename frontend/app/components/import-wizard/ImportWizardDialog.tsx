'use client';

import MuiButton from '@mui/material/Button';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  pickDefaultSheet,
  readTabularWorkbook,
  sheetToTextRows,
  type TabularWorkbook,
} from '@/app/(main)/custom-tables/[id]/utils/tabularFileReader';
import { buildSourceColumnTitles } from '@/app/(main)/custom-tables/labels';
import { Checkbox } from '@/app/components/ui/checkbox';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { Select } from '@/app/components/ui/select';
import { Spinner } from '@/app/components/ui/spinner';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { resolveCurrencyCode } from '@/app/lib/format-money';
import { formatDate } from '@/app/lib/user-format';
import {
  createTableFromImport,
  IMPORT_TARGETS,
  type ImportRunResult,
  type ImportSuggestion,
  type ImportTarget,
  runEntityImport,
  suggestImport,
  TARGET_FIELDS,
  undoEntityImport,
} from './import-wizard-api';
import {
  assignRole,
  fillTemplate,
  firstExample,
  mappingFromSuggestion,
  missingRequiredFields,
  openAsTableFilters,
  type PreparedSheet,
  prepareSheet,
  problemRows,
  roleByColumn,
} from './import-wizard-utils';

const IGNORE = '__ignore__';
const DRY_RUN_DEBOUNCE_MS = 400;
const MAX_PROBLEM_ROWS = 8;

export interface ImportWizardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** A file picked by the user; read here, all sheets offered. */
  file?: File | null;
  /** Rows already read elsewhere (custom-tables import dialog). */
  rows?: string[][] | null;
  fileName?: string | null;
  /** When the wizard is opened from a section page the target is not a choice. */
  fixedTarget?: ImportTarget;
  onImported?: (result: ImportRunResult) => void;
}

type Step = 'reading' | 'mapping' | 'result';

/**
 * Spreadsheet → app records. One dialog: pick a sheet, confirm the target and
 * the column roles (pre-filled by the server), see what a dry run would do,
 * import, then undo or open the rows as a table.
 */
export function ImportWizardDialog(props: ImportWizardDialogProps): React.JSX.Element {
  const { isOpen, onClose, file, rows: presetRows, fileName, fixedTarget, onImported } = props;
  const t = useIntlayer('importWizard');
  const tables = useIntlayer('customTablesPage');
  const { locale } = useLocale();
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const workspaceCurrency = resolveCurrencyCode(currentWorkspace?.currency, 'USD');

  const [step, setStep] = useState<Step>('reading');
  const [workbook, setWorkbook] = useState<TabularWorkbook | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [sheet, setSheet] = useState<PreparedSheet | null>(null);
  const [suggestion, setSuggestion] = useState<ImportSuggestion | null>(null);
  const [target, setTarget] = useState<ImportTarget>(fixedTarget ?? 'transactions');
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [currency, setCurrency] = useState(workspaceCurrency);
  const [categorize, setCategorize] = useState(true);
  const [dryRun, setDryRun] = useState<ImportRunResult | null>(null);
  const [dryRunPending, setDryRunPending] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportRunResult | null>(null);
  const [undone, setUndone] = useState(false);
  const [openingTable, setOpeningTable] = useState(false);
  const requestVersion = useRef(0);

  const targetLabel = useCallback((kind: ImportTarget | 'table') => t.targets[kind].value, [t]);
  const fieldLabel = useCallback(
    (key: string) => (t.fields as Record<string, { value: string }>)[key]?.value ?? key,
    [t],
  );

  const loadRows = useCallback(
    async (rawRows: string[][]) => {
      const version = ++requestVersion.current;
      const prepared = prepareSheet(rawRows);
      if (!prepared.rows.length) {
        toast.error(t.errors.noRows.value);
        onClose();
        return;
      }
      setSheet(prepared);
      let next: ImportSuggestion | null = null;
      try {
        next = await suggestImport(prepared.headers, prepared.samples);
      } catch {
        // The heuristics live on the server; without them the user maps by hand.
      }
      if (version !== requestVersion.current) {
        return;
      }
      setSuggestion(next);
      const suggested = next && next.target !== 'table' ? next.target : null;
      const chosen = fixedTarget ?? suggested ?? 'transactions';
      setTarget(chosen);
      setMapping(
        next && (fixedTarget ? next.target === fixedTarget : true)
          ? mappingFromSuggestion(next)
          : {},
      );
      setStep('mapping');
    },
    [fixedTarget, onClose, t],
  );

  // Reset and read whenever the dialog opens with a new file or row set.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setStep('reading');
    setWorkbook(null);
    setSheet(null);
    setSuggestion(null);
    setDryRun(null);
    setResult(null);
    setUndone(false);
    setCurrency(workspaceCurrency);
    setCategorize(true);
    if (presetRows) {
      void loadRows(presetRows);
      return;
    }
    if (!file) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const book = await readTabularWorkbook(file);
        if (cancelled) {
          return;
        }
        const index = pickDefaultSheet(book);
        setWorkbook(book);
        setSheetIndex(index);
        await loadRows(sheetToTextRows(book.sheets[index]));
      } catch {
        if (!cancelled) {
          toast.error(t.errors.readFailed.value);
          onClose();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Reading depends only on what was handed in; labels and currency are stable per open.
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-read only when the input changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, file, presetRows]);

  const selectSheet = (index: number) => {
    if (!workbook) {
      return;
    }
    setSheetIndex(index);
    setDryRun(null);
    void loadRows(sheetToTextRows(workbook.sheets[index]));
  };

  const changeTarget = (next: ImportTarget) => {
    setTarget(next);
    setMapping(suggestion && suggestion.target === next ? mappingFromSuggestion(suggestion) : {});
  };

  const missing = useMemo(() => missingRequiredFields(target, mapping), [target, mapping]);

  // A dry run after every mapping change shows what the import would do before it does it.
  useEffect(() => {
    if (step !== 'mapping' || !sheet || missing.length) {
      setDryRun(null);
      return;
    }
    const version = ++requestVersion.current;
    setDryRunPending(true);
    const timer = setTimeout(async () => {
      try {
        const preview = await runEntityImport({
          target,
          mapping,
          rows: sheet.rows,
          fileName: fileName ?? file?.name,
          dryRun: true,
          options: { currency, categorize },
        });
        if (version === requestVersion.current) {
          setDryRun(preview);
        }
      } catch {
        if (version === requestVersion.current) {
          setDryRun(null);
        }
      } finally {
        if (version === requestVersion.current) {
          setDryRunPending(false);
        }
      }
    }, DRY_RUN_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [step, sheet, target, mapping, missing.length, currency, categorize, fileName, file]);

  const runImport = async () => {
    if (!sheet || missing.length) {
      return;
    }
    setRunning(true);
    try {
      const imported = await runEntityImport({
        target,
        mapping,
        rows: sheet.rows,
        fileName: fileName ?? file?.name,
        options: { currency, categorize },
      });
      setResult(imported);
      setStep('result');
      onImported?.(imported);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t.errors.importFailed.value));
    } finally {
      setRunning(false);
    }
  };

  const undo = async () => {
    if (!result?.batchId) {
      return;
    }
    setRunning(true);
    try {
      await undoEntityImport(result.batchId);
      setUndone(true);
      toast.success(t.result.undone.value);
      onImported?.({ ...result, counts: { created: 0, updated: 0, skipped: 0, errors: 0 } });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t.errors.undoFailed.value));
    } finally {
      setRunning(false);
    }
  };

  const openAsTable = async () => {
    if (!result?.createdIds.length) {
      return;
    }
    setOpeningTable(true);
    try {
      const tableId = await createTableFromImport({
        kind: result.target,
        filters: openAsTableFilters(result.target, result.createdIds),
        name: fillTemplate(t.result.tableName.value, {
          target: targetLabel(result.target),
          date: formatDate(new Date(), { locale }),
        }),
        currency,
        columnTitles: buildSourceColumnTitles(tables),
      });
      if (tableId) {
        onClose();
        router.push(`/custom-tables/${tableId}`);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, t.errors.tableFailed.value));
    } finally {
      setOpeningTable(false);
    }
  };

  const roleOf = roleByColumn(mapping);
  const counts = (source: ImportRunResult | null, template: string) =>
    source ? fillTemplate(template, { ...source.counts }) : '';
  const reasonText = (reason: string | undefined) => {
    if (reason === 'duplicate' || reason === 'unchanged') {
      return t.reasons[reason].value;
    }
    return fillTemplate(t.reasons.invalid.value, { field: fieldLabel(reason ?? '') });
  };

  const renderProblems = (source: ImportRunResult | null) => {
    const problems = source ? problemRows(source.rows) : [];
    if (!problems.length) {
      return null;
    }
    return (
      <div className="lumio-iw__problems">
        <p className="lumio-iw__label">{t.issuesTitle}</p>
        <ul>
          {problems.slice(0, MAX_PROBLEM_ROWS).map(row => (
            <li key={row.index}>
              <span className="lumio-iw__row-no">
                {fillTemplate(t.rowLabel.value, { row: row.index + 1 })}
              </span>
              <span>{reasonText(row.reason)}</span>
            </li>
          ))}
          {problems.length > MAX_PROBLEM_ROWS && <li>…</li>}
        </ul>
      </div>
    );
  };

  const footer =
    step === 'result' ? (
      <ModalFooter>
        <MuiButton type="button" variant="outlined" color="inherit" onClick={onClose}>
          {t.actions.close}
        </MuiButton>
        {!undone && result?.batchId && (
          <MuiButton
            type="button"
            variant="outlined"
            color="inherit"
            onClick={() => void undo()}
            disabled={running}
          >
            {t.actions.undo}
          </MuiButton>
        )}
        {!undone && result?.createdIds.length ? (
          <MuiButton
            type="button"
            variant="contained"
            onClick={() => void openAsTable()}
            disabled={openingTable}
          >
            {t.actions.openAsTable}
          </MuiButton>
        ) : null}
      </ModalFooter>
    ) : (
      <ModalFooter
        onCancel={onClose}
        cancelText={t.actions.cancel.value}
        onConfirm={() => void runImport()}
        confirmText={t.actions.run.value}
        isConfirmLoading={running}
        isConfirmDisabled={step !== 'mapping' || missing.length > 0 || running}
      />
    );

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title={t.title} size="lg" footer={footer}>
      <div className="lumio-iw" data-testid="import-wizard">
        {step === 'reading' && (
          <div className="lumio-iw__loading">
            <Spinner size={20} />
          </div>
        )}

        {step === 'mapping' && sheet && (
          <>
            <div className="lumio-iw__controls">
              {workbook && workbook.sheets.length > 1 && (
                <div className="lumio-iw__control">
                  <span className="lumio-iw__label">{t.sheet}</span>
                  <Select
                    size="small"
                    value={String(sheetIndex)}
                    onChange={value => selectSheet(Number(value))}
                    options={workbook.sheets.map((item, index) => ({
                      value: String(index),
                      label: item.name,
                    }))}
                  />
                </div>
              )}
              <div className="lumio-iw__control">
                <span className="lumio-iw__label">{t.target}</span>
                <Select
                  size="small"
                  value={target}
                  disabled={Boolean(fixedTarget)}
                  onChange={value => changeTarget(value as ImportTarget)}
                  options={IMPORT_TARGETS.map(kind => ({ value: kind, label: targetLabel(kind) }))}
                  data-testid="import-wizard-target"
                />
              </div>
              <label className="lumio-iw__control">
                <span className="lumio-iw__label">{t.currencyLabel}</span>
                <input
                  className="lumio-iw__input"
                  value={currency}
                  maxLength={3}
                  onChange={event => setCurrency(event.target.value.toUpperCase())}
                />
              </label>
            </div>

            {suggestion && !fixedTarget && (
              <p className="lumio-iw__hint">
                {suggestion.target === 'table'
                  ? t.suggestionTable
                  : fillTemplate(t.suggestion.value, { target: targetLabel(suggestion.target) })}
              </p>
            )}

            <p className="lumio-iw__label">
              {t.mappingTitle} · {fillTemplate(t.rowsTotal.value, { count: sheet.rows.length })}
            </p>
            <table className="lumio-iw__table">
              <thead>
                <tr>
                  <th>{t.columnHeader}</th>
                  <th>{t.roleHeader}</th>
                </tr>
              </thead>
              <tbody>
                {sheet.headers.map((header, index) => {
                  const example = firstExample(sheet.samples, index);
                  const current = roleOf.get(index) ?? IGNORE;
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: sheet columns are positional
                    <tr key={`${index}-${header}`}>
                      <td>
                        <div className="lumio-iw__header">{header || `#${index + 1}`}</div>
                        {example && <div className="lumio-iw__example">{example}</div>}
                      </td>
                      <td>
                        <Select
                          size="small"
                          fullWidth
                          value={current}
                          onChange={value =>
                            setMapping(prev =>
                              assignRole(prev, index, value === IGNORE ? null : value),
                            )
                          }
                          options={[
                            { value: IGNORE, label: t.ignore.value },
                            ...TARGET_FIELDS[target].map(field => ({
                              value: field.key,
                              label: field.required
                                ? `${fieldLabel(field.key)} · ${t.required.value}`
                                : fieldLabel(field.key),
                            })),
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {target === 'transactions' && (
              <div className="lumio-iw__check">
                <Checkbox checked={categorize} onCheckedChange={setCategorize} />
                <span>{t.categorize}</span>
              </div>
            )}

            {missing.length > 0 ? (
              <p className="lumio-iw__hint lumio-iw__hint--warning">
                {missing.map(fieldLabel).join(', ')} · {t.required}
              </p>
            ) : (
              <p className="lumio-iw__hint" data-testid="import-wizard-dry-run">
                {dryRunPending && !dryRun ? (
                  <Spinner size={14} />
                ) : (
                  counts(dryRun, t.dryRunSummary.value)
                )}
              </p>
            )}
            {renderProblems(dryRun)}
          </>
        )}

        {step === 'result' && result && (
          <div className="lumio-iw__result" data-testid="import-wizard-result">
            <p className="lumio-iw__result-title">{undone ? t.result.undone : t.result.title}</p>
            {!undone && <p className="lumio-iw__hint">{counts(result, t.resultSummary.value)}</p>}
            {!undone && renderProblems(result)}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
