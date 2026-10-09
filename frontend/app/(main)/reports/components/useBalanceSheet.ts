import { useCallback, useState } from 'react';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import type { EditableChangeArgs } from './BalanceAccountRow';
import {
  type BalanceExportFormat,
  type BalanceLabels,
  type BalanceSheetResponse,
  buildEditableValues,
  buildExpandableDefaults,
  getLabel,
  parseContentDispositionFileName,
  toDateInputValue,
} from './balance-sheet-utils';

export type UseBalanceSheetReturn = {
  sheet: BalanceSheetResponse | null;
  loading: boolean;
  error: string | null;
  editableValues: Record<string, string>;
  expanded: Record<string, boolean>;
  savingAccountId: string | null;
  saveHint: string;
  exportMenuOpen: boolean;
  exportingFormat: BalanceExportFormat | null;
  filterMode: 'now' | 'date';
  selectedDate: string;
  effectiveDate: string | undefined;
  setFilterMode: (mode: 'now' | 'date') => void;
  setSelectedDate: (date: string) => void;
  setExportMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  loadSheet: (date?: string) => Promise<void>;
  saveSnapshot: (accountId: string) => Promise<void>;
  downloadExport: (format: BalanceExportFormat) => Promise<void>;
  handleEditableChange: (args: EditableChangeArgs) => void;
  handleToggleExpanded: (id: string) => void;
};

type UseBalanceSheetOptions = {
  locale: string;
  labels: BalanceLabels;
  errorMessage: string;
};

const triggerDownload = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const resolveExportFileName = (
  sheet: BalanceSheetResponse | null,
  format: BalanceExportFormat,
  contentDisposition?: string,
): string => {
  const parsed = parseContentDispositionFileName(contentDisposition);
  if (parsed) {
    return parsed;
  }
  const fallbackDate = sheet?.date || toDateInputValue(new Date());
  const ext = format === 'excel' ? 'xlsx' : 'pdf';
  return `balance-sheet-${fallbackDate}.${ext}`;
};

type SheetSetters = {
  setSheet: (s: BalanceSheetResponse) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setEditableValues: (v: Record<string, string>) => void;
  setExpanded: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  setSavingAccountId: (v: string | null) => void;
  setSaveHint: (v: string) => void;
  setExportMenuOpen: (v: boolean) => void;
  setExportingFormat: (v: BalanceExportFormat | null) => void;
};

function useLoadSheet(opts: {
  locale: string;
  errorMessage: string;
  setters: SheetSetters;
}): (date?: string) => Promise<void> {
  const { locale, errorMessage, setters } = opts;
  return useCallback(
    async (date?: string): Promise<void> => {
      setters.setLoading(true);
      setters.setError(null);

      await (async () => {
        const response = await apiClient.get('/reports/balance/sheet', {
          params: { ...(date ? { date } : {}), locale },
        });
        const payload: BalanceSheetResponse = response.data?.data || response.data;
        setters.setSheet(payload);
        setters.setEditableValues({
          ...buildEditableValues(payload.assets.sections),
          ...buildEditableValues(payload.liabilities.sections),
        });
        setters.setExpanded(prev => {
          const merged = {
            ...buildExpandableDefaults(payload.assets.sections),
            ...buildExpandableDefaults(payload.liabilities.sections),
          };
          for (const [id, isOpen] of Object.entries(prev)) {
            if (id in merged) {
              merged[id] = isOpen;
            }
          }
          return merged;
        });
      })()
        .catch(async (err: unknown) => {
          setters.setError(getApiErrorMessage(err, errorMessage));
        })
        .finally(async () => {
          setters.setLoading(false);
        });
    },
    [locale, errorMessage, setters],
  );
}

type SaveSnapshotOpts = {
  editableValues: Record<string, string>;
  effectiveDate: string | undefined;
  sheet: BalanceSheetResponse | null;
  errorMessage: string;
  text: (key: string, fallback: string) => string;
  loadSheet: (date?: string) => Promise<void>;
  setters: Pick<SheetSetters, 'setSavingAccountId' | 'setSaveHint' | 'setError'>;
};

function useSaveSnapshot(opts: SaveSnapshotOpts): (accountId: string) => Promise<void> {
  const { editableValues, effectiveDate, sheet, errorMessage, text, loadSheet, setters } = opts;
  return useCallback(
    async (accountId: string): Promise<void> => {
      const rawValue = editableValues[accountId];
      if (rawValue === undefined) {
        return;
      }
      const parsed = Number.parseFloat(rawValue.replace(',', '.').trim());
      if (!Number.isFinite(parsed)) {
        setters.setSaveHint(errorMessage);
        return;
      }
      setters.setSavingAccountId(accountId);
      setters.setSaveHint(text('savingBalance', 'Saving...'));
      setters.setError(null);

      await (async () => {
        await apiClient.put('/reports/balance/snapshot', {
          accountId,
          amount: parsed,
          date: effectiveDate,
          currency: sheet?.currency || FALLBACK_CURRENCY,
        });
        setters.setSaveHint(text('balanceSaved', 'Balance saved'));
        await loadSheet(effectiveDate);
      })()
        .catch(async (err: unknown) => {
          setters.setError(getApiErrorMessage(err, errorMessage));
          setters.setSaveHint('');
        })
        .finally(async () => {
          setters.setSavingAccountId(null);
        });
    },
    [editableValues, effectiveDate, sheet, errorMessage, text, loadSheet, setters],
  );
}

type DownloadExportOpts = {
  effectiveDate: string | undefined;
  locale: string;
  sheet: BalanceSheetResponse | null;
  errorMessage: string;
  setters: Pick<SheetSetters, 'setExportingFormat' | 'setExportMenuOpen' | 'setError'>;
};

function useDownloadExport(
  opts: DownloadExportOpts,
): (format: BalanceExportFormat) => Promise<void> {
  const { effectiveDate, locale, sheet, errorMessage, setters } = opts;
  return useCallback(
    async (format: BalanceExportFormat): Promise<void> => {
      setters.setExportingFormat(format);
      setters.setExportMenuOpen(false);
      setters.setError(null);

      await (async () => {
        const params = { format, ...(effectiveDate ? { date: effectiveDate } : {}), locale };
        const response = await apiClient.get('/reports/balance/export', {
          params,
          responseType: 'blob',
        });
        const headers = response.headers as Record<string, string>;
        const fileName = resolveExportFileName(sheet, format, headers['content-disposition']);
        const blob = new Blob([response.data], {
          type: headers['content-type'] || 'application/octet-stream',
        });
        triggerDownload(blob, fileName);
      })()
        .catch(async (err: unknown) => {
          setters.setError(getApiErrorMessage(err, errorMessage));
        })
        .finally(async () => {
          setters.setExportingFormat(null);
        });
    },
    [effectiveDate, locale, sheet, errorMessage, setters],
  );
}

export function useBalanceSheet({
  locale,
  labels,
  errorMessage,
}: UseBalanceSheetOptions): UseBalanceSheetReturn {
  const [sheet, setSheet] = useState<BalanceSheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'now' | 'date'>('now');
  const [selectedDate, setSelectedDate] = useState<string>(toDateInputValue(new Date()));
  const [editableValues, setEditableValues] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [savingAccountId, setSavingAccountId] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string>('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<BalanceExportFormat | null>(null);
  const effectiveDate = filterMode === 'date' ? selectedDate : undefined;
  const text = getLabel(labels);
  const setters: SheetSetters = {
    setSheet: setSheet as (s: BalanceSheetResponse) => void,
    setLoading,
    setError,
    setEditableValues,
    setExpanded: setExpanded as (
      fn: (prev: Record<string, boolean>) => Record<string, boolean>,
    ) => void,
    setSavingAccountId,
    setSaveHint,
    setExportMenuOpen: setExportMenuOpen as (v: boolean) => void,
    setExportingFormat,
  };
  const loadSheet = useLoadSheet({ locale, errorMessage, setters });
  const saveSnapshot = useSaveSnapshot({
    editableValues,
    effectiveDate,
    sheet,
    errorMessage,
    text,
    loadSheet,
    setters,
  });
  const downloadExport = useDownloadExport({ effectiveDate, locale, sheet, errorMessage, setters });
  const handleEditableChange = useCallback(({ id, value }: EditableChangeArgs): void => {
    setEditableValues(prev => ({ ...prev, [id]: value }));
  }, []);
  const handleToggleExpanded = useCallback((id: string): void => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);
  return {
    sheet,
    loading,
    error,
    editableValues,
    expanded,
    savingAccountId,
    saveHint,
    exportMenuOpen,
    exportingFormat,
    filterMode,
    selectedDate,
    effectiveDate,
    setFilterMode,
    setSelectedDate,
    setExportMenuOpen: setExportMenuOpen as (open: boolean | ((prev: boolean) => boolean)) => void,
    loadSheet,
    saveSnapshot,
    downloadExport,
    handleEditableChange,
    handleToggleExpanded,
  };
}
