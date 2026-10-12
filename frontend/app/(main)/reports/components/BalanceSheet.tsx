/* eslint-disable max-lines */
'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCcw,
} from '@/app/components/icons';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { BalanceAccountNode } from '@/app/lib/contracts';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { tokens } from '@/lib/theme-tokens';
import apiClient from '../../../lib/api';

type BalanceExportFormat = 'excel' | 'pdf';

/** Reports are written in Russian, English or Kazakh; any other interface language gets English. */
const reportLocaleOf = (locale: string): 'ru' | 'en' | 'kk' =>
  locale === 'ru' || locale === 'kk' ? locale : 'en';

const resolveLocale = (locale: string): string => {
  if (locale === 'ru') return 'ru-RU';
  if (locale === 'kk') return 'kk-KZ';
  return 'en-US';
};

const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const collectEditableValues = (
  accounts: BalanceAccountNode[],
  result: Record<string, string>,
): void => {
  for (const account of accounts) {
    if (account.isEditable) {
      result[account.id] = account.amount.toFixed(2);
    }
    if (account.children.length > 0) {
      collectEditableValues(account.children, result);
    }
  }
};

const collectExpandableDefaults = (
  accounts: BalanceAccountNode[],
  result: Record<string, boolean>,
): void => {
  for (const account of accounts) {
    if (account.isExpandable || account.children.length > 0) {
      result[account.id] = true;
    }
    if (account.children.length > 0) {
      collectExpandableDefaults(account.children, result);
    }
  }
};

const parseContentDispositionFileName = (contentDisposition?: string): string | null => {
  if (!contentDisposition) return null;

  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const asciiMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
  if (asciiMatch?.[1]) {
    return asciiMatch[1];
  }

  return null;
};

// Суммы в дереве баланса — моноширинные цифры без фона, чтобы колонка читалась ровно.
const AMOUNT_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// Нейтральное предупреждение: плашка карточки с янтарной полосой слева вместо жёлтой заливки.
function WarningNote({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Box
      role="alert"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        border: '1px solid var(--border)',
        borderLeft: '4px solid var(--ff-dash-warning)',
        borderRadius: tokens.radius.md,
        bgcolor: 'var(--card)',
        px: 2,
        py: 1.25,
        fontSize: 14,
        color: 'var(--muted-foreground)',
      }}
    >
      <AlertTriangle size={18} style={{ color: 'var(--ff-dash-warning)', flexShrink: 0 }} />
      <span>{children}</span>
    </Box>
  );
}

// eslint-disable-next-line max-lines-per-function, complexity
function BalanceSheet(): React.JSX.Element {
  const t = useIntlayer('reportsPage');
  const { locale } = useLocale();
  const labels = t.labels as Record<string, { value?: string } | undefined>;
  // eslint-disable-next-line max-params
  const text = (key: string, fallback: string): string => labels[key]?.value ?? fallback;

  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
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

  const sheetQuery = useQuery({
    queryKey: queryKeys.balanceSheet({ workspaceId, date: effectiveDate ?? null, locale }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/reports/balance/sheet',
        params: { ...(effectiveDate ? { date: effectiveDate } : {}), locale },
        signal,
        contract: 'BalanceSheetResponse',
      }),
    // Смена даты и сохранение баланса перезагружают отчёт; таблица держится на
    // экране до прихода новых цифр, но только внутри того же воркспейса.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
  });

  const sheet = sheetQuery.data ?? null;

  const loadSheet = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: ['balance-sheet', workspaceId] });
  }, [queryClient, workspaceId]);

  // Значения в полях и раскрытые секции выводятся из пришедшего отчёта:
  // редактируемые суммы перезаписываются целиком, раскрытые секции сохраняют
  // выбор пользователя для тех id, которые есть и в новом отчёте.
  useEffect(() => {
    if (!sheetQuery.data) return;
    const payload = sheetQuery.data;

    const nextEditableValues: Record<string, string> = {};
    collectEditableValues(payload.assets.sections, nextEditableValues);
    collectEditableValues(payload.liabilities.sections, nextEditableValues);
    setEditableValues(nextEditableValues);

    setExpanded(prevExpanded => {
      const defaults: Record<string, boolean> = {};
      collectExpandableDefaults(payload.assets.sections, defaults);
      collectExpandableDefaults(payload.liabilities.sections, defaults);

      const merged = { ...defaults };
      for (const [id, isOpen] of Object.entries(prevExpanded)) {
        if (id in merged) {
          merged[id] = isOpen;
        }
      }
      return merged;
    });
  }, [sheetQuery.data]);

  const currencyCode = sheet?.currency || FALLBACK_CURRENCY;

  const formatCurrency = useCallback(
    (value: number) =>
      new Intl.NumberFormat(resolveLocale(locale), {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
      }).format(value),
    [locale, currencyCode],
  );

  const saveSnapshot = useCallback(
    async (accountId: string): Promise<void> => {
      const rawValue = editableValues[accountId];
      if (rawValue === undefined) return;

      const normalized = rawValue.replace(',', '.').trim();
      const parsed = Number.parseFloat(normalized);
      if (!Number.isFinite(parsed)) {
        setSaveHint(t.errors.loadReport.value);
        return;
      }

      setSavingAccountId(accountId);
      setSaveHint(text('savingBalance', 'Saving...'));
      setError(null);

      await (async () => {
        await apiClient.put('/reports/balance/snapshot', {
          accountId,
          amount: parsed,
          date: effectiveDate,
          currency: sheet?.currency || FALLBACK_CURRENCY,
        } satisfies ContractInput<'UpdateBalanceSnapshotBody'>);

        setSaveHint(text('balanceSaved', 'Balance saved'));
        loadSheet();
      })()
        .catch(async (err: unknown) => {
          setError(getApiErrorMessage(err, t.errors.loadReport.value));
          setSaveHint('');
        })
        .finally(async () => {
          setSavingAccountId(null);
        });
    },
    [editableValues, effectiveDate, loadSheet, sheet?.currency, t, text],
  );

  const downloadExport = useCallback(
    // eslint-disable-next-line max-lines-per-function
    async (format: BalanceExportFormat): Promise<void> => {
      setExportingFormat(format);
      setExportMenuOpen(false);
      setError(null);

      await (async () => {
        // Goes through the shared template endpoint so the export is recorded
        // in report history, like every other report. A balance sheet is a
        // snapshot, so both ends of the period are the same date.
        const snapshotDate = effectiveDate || sheet?.date || toDateInputValue(new Date());
        const response = await apiClient.post(
          '/reports/generate',
          {
            templateId: 'balance-sheet',
            dateFrom: snapshotDate,
            dateTo: snapshotDate,
            format,
            locale: reportLocaleOf(locale),
          } satisfies ContractInput<'GenerateReportBody'>,
          { responseType: 'blob' },
        );

        const fallbackName = `balance-sheet-${sheet?.date || toDateInputValue(new Date())}.${
          format === 'excel' ? 'xlsx' : 'pdf'
        }`;
        const fileName =
          parseContentDispositionFileName(response.headers['content-disposition']) || fallbackName;

        const blob = new Blob([response.data], {
          type:
            (response.headers['content-type'] as string | undefined) || 'application/octet-stream',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })()
        .catch(async (err: unknown) => {
          setError(getApiErrorMessage(err, t.errors.loadReport.value));
        })
        .finally(async () => {
          setExportingFormat(null);
        });
    },
    [effectiveDate, locale, sheet?.date, t.errors.loadReport.value],
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpanded(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  // A hoisted function rather than a self-referencing useCallback: React
  // Compiler cannot compile a callback that calls itself before declaration.
  // eslint-disable-next-line max-lines-per-function, max-params, complexity
  function renderAccount(account: BalanceAccountNode, level = 0): React.JSX.Element {
    const hasChildren = account.children.length > 0;
    const isExpanded = expanded[account.id] ?? true;
    const canToggle = account.isExpandable || hasChildren;
    const isSection = level === 0;

    return (
      <Box
        key={account.id}
        sx={{ borderBottom: '1px solid var(--border)', '&:last-child': { borderBottom: 'none' } }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            py: 1.5,
          }}
        >
          <Box
            sx={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 1 }}
            style={{ paddingLeft: `${level * 20}px` }}
          >
            {canToggle ? (
              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted-foreground)',
                  flexShrink: 0,
                }}
                onClick={() => toggleExpanded(account.id)}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              <span style={{ width: 20, height: 20, flexShrink: 0, display: 'inline-block' }} />
            )}

            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: isSection ? 16 : 14,
                fontWeight: isSection ? 600 : 400,
                color: isSection ? 'var(--foreground)' : 'var(--muted-foreground)',
              }}
            >
              {account.name}
            </span>
          </Box>

          <Box sx={{ flexShrink: 0 }}>
            {account.isEditable ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <input
                  type="number"
                  step="0.01"
                  style={{
                    width: 112,
                    border: 'none',
                    borderRadius: 0,
                    background: 'transparent',
                    padding: '4px 0',
                    textAlign: 'right',
                    fontFamily: AMOUNT_FONT,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 14,
                    color: 'var(--foreground)',
                  }}
                  value={editableValues[account.id] ?? '0.00'}
                  onChange={event =>
                    setEditableValues(prev => ({
                      ...prev,
                      [account.id]: event.target.value,
                    }))
                  }
                  onBlur={() => saveSnapshot(account.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                  disabled={savingAccountId === account.id}
                  aria-label={account.name}
                />
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted-foreground)' }}>
                  {currencyCode}
                </span>
                {savingAccountId === account.id && (
                  <CircularProgress size={16} sx={{ color: 'var(--primary)' }} />
                )}
              </Box>
            ) : (
              <span
                style={{
                  fontFamily: AMOUNT_FONT,
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 14,
                  fontWeight: isSection ? 600 : 400,
                  color: isSection ? 'var(--foreground)' : 'var(--muted-foreground)',
                }}
              >
                {formatCurrency(account.amount)}
              </span>
            )}
          </Box>
        </Box>

        {hasChildren && isExpanded && (
          <Box>
            {account.children
              // eslint-disable-next-line max-params
              .sort((a, b) => a.position - b.position)
              .map(child => renderAccount(child, level + 1))}
          </Box>
        )}
      </Box>
    );
  }

  const balanceWarning = useMemo(() => {
    if (!sheet || sheet.isBalanced) return null;
    return `${text('balanceDifference', 'Balance difference')}: ${formatCurrency(sheet.difference)}`;
  }, [formatCurrency, sheet, text]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} data-tour-id="reports-balance">
      <Box
        sx={{
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
          bgcolor: 'var(--card)',
          p: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { md: 'center' },
            justifyContent: { md: 'space-between' },
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.md,
                bgcolor: 'var(--card)',
                px: 1.5,
                py: 1,
                fontSize: 14,
                color: 'var(--foreground)',
              }}
            >
              <CalendarDays size={16} style={{ color: 'var(--muted-foreground)' }} />
              <Select
                variant="standard"
                disableUnderline
                sx={{ fontSize: 14, color: 'var(--foreground)' }}
                value={filterMode}
                onChange={value => setFilterMode(value as 'now' | 'date')}
                options={[
                  { value: 'now', label: text('asOfNow', 'As of now') },
                  { value: 'date', label: text('asOfDate', 'As of date') },
                ]}
              />
            </Box>

            {filterMode === 'date' && (
              <Box sx={{ minWidth: 180 }}>
                <CustomDatePicker
                  label={text('asOfDate', 'As of date')}
                  value={selectedDate}
                  onChange={setSelectedDate}
                />
              </Box>
            )}

            <button
              type="button"
              onClick={loadSheet}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                padding: '8px 12px',
                fontSize: 14,
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                borderRadius: tokens.radius.md,
              }}
            >
              <RefreshCcw size={16} />
              {text('refresh', 'Refresh')}
            </button>
          </Box>

          <Box sx={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setExportMenuOpen(open => !open)}
              disabled={!!exportingFormat}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                padding: '8px 12px',
                fontSize: 14,
                color: 'var(--foreground)',
                cursor: 'pointer',
                borderRadius: tokens.radius.md,
              }}
            >
              {exportingFormat ? (
                <CircularProgress size={16} sx={{ color: 'inherit' }} />
              ) : (
                <Download size={16} />
              )}
              {text('exportBalance', 'Export balance')}
            </button>

            {exportMenuOpen && (
              <Box
                sx={{
                  position: 'absolute',
                  right: 0,
                  zIndex: 10,
                  mt: 0.5,
                  width: 144,
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.md,
                  bgcolor: 'var(--card)',
                  p: 0.5,
                  boxShadow: 1,
                }}
              >
                <button
                  type="button"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: 14,
                    color: 'var(--foreground)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => void downloadExport('excel')}
                >
                  {text('exportExcel', 'Excel')}
                </button>
                <button
                  type="button"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: 14,
                    color: 'var(--foreground)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => void downloadExport('pdf')}
                >
                  {text('exportPdf', 'PDF')}
                </button>
              </Box>
            )}
          </Box>
        </Box>

        {saveHint && (
          <Typography
            variant="caption"
            sx={{ mt: 1, display: 'block', color: 'var(--muted-foreground)' }}
          >
            {saveHint}
          </Typography>
        )}
      </Box>

      {(error || sheetQuery.isError) && (
        <Alert severity="error">
          {error ?? getApiErrorMessage(sheetQuery.error, t.errors.loadReport.value)}
        </Alert>
      )}

      {balanceWarning && <WarningNote>{balanceWarning}</WarningNote>}

      {sheet?.missingRates && sheet.missingRates.length > 0 && (
        <WarningNote>
          {`${text('missingRates', 'No exchange rate, left out of the totals')}: ${sheet.missingRates.join(', ')}`}
        </WarningNote>
      )}

      {sheetQuery.isPending ? (
        <Box
          sx={{
            border: '1px solid var(--border)',
            bgcolor: 'var(--card)',
            px: 2,
            py: 5,
            display: 'flex',
            borderRadius: tokens.radius.lg,
            justifyContent: 'center',
          }}
        >
          <CircularProgress size={24} />
        </Box>
      ) : sheet ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, 1fr)' },
            gap: 2,
            // Сохранение баланса и смена даты перезагружают отчёт в фоне.
            opacity: sheetQuery.isFetching ? 0.6 : 1,
            transition: 'opacity 150ms ease',
          }}
        >
          <Box
            sx={{
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.lg,
              bgcolor: 'var(--card)',
              p: 2,
            }}
          >
            <Box
              sx={{
                mb: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="h6" fontWeight={600} sx={{ color: 'var(--foreground)' }}>
                {text('assets', 'Assets')} {formatCurrency(sheet.assets.total)}
              </Typography>
            </Box>
            <Box>
              {sheet.assets.sections
                // eslint-disable-next-line max-params
                .sort((a, b) => a.position - b.position)
                .map(section => renderAccount(section))}
            </Box>
          </Box>

          <Box
            sx={{
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.lg,
              bgcolor: 'var(--card)',
              p: 2,
            }}
          >
            <Box
              sx={{
                mb: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="h6" fontWeight={600} sx={{ color: 'var(--foreground)' }}>
                {text('liabilities', 'Liabilities')} {formatCurrency(sheet.liabilities.total)}
              </Typography>
            </Box>
            <Box>
              {sheet.liabilities.sections
                // eslint-disable-next-line max-params
                .sort((a, b) => a.position - b.position)
                .map(section => renderAccount(section))}
            </Box>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            border: '1px solid var(--border)',
            bgcolor: 'var(--card)',
            px: 2,
            py: 5,
            textAlign: 'center',
            borderRadius: tokens.radius.lg,
          }}
        >
          <Typography variant="body2" sx={{ color: 'var(--muted-foreground)' }}>
            {text('noData', 'No data')}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default BalanceSheet;
