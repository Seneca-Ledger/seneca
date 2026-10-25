'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { ChevronDown, ChevronRight } from '@/app/components/icons';
import { PRIVATE_CLASS, PrivateAmount } from '@/app/components/ui/private-amount';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { localizeBalanceAccountName } from '@/app/lib/balance-account-names';
import type { BalanceAccountNode } from '@/app/lib/contracts';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { formatMoney } from '@/app/lib/format-money';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { tokens } from '@/lib/theme-tokens';
import apiClient from '../../../lib/api';
import { blobOf } from '../../../lib/blob-of';

type BalanceExportFormat = 'excel' | 'pdf';

/** Reports are written in Russian, English or Kazakh; any other interface language gets English. */
const reportLocaleOf = (locale: string): 'ru' | 'en' | 'kk' =>
  locale === 'ru' || locale === 'kk' ? locale : 'en';

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
    // A group with nothing in it starts collapsed; the user's own choice wins on refresh.
    if (account.isExpandable || account.children.length > 0) {
      result[account.id] = account.amount !== 0;
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

// Banner-free notice: a soft strip with an ochre dot, no frame and no icon.
function WarningNote({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Box
      role="alert"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        borderRadius: tokens.radius.md,
        bgcolor: 'var(--surface-soft)',
        px: 2,
        py: 1,
        fontSize: 14,
        color: 'var(--text-muted)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--attention)',
          flexShrink: 0,
        }}
      />
      <span>{children}</span>
    </Box>
  );
}

// "III. Cash": the article numeral stays, small and grey, in front of the name.
const ARTICLE_PREFIX = /^([IVXLC]+\.)\s+(.*)$/;

// Text buttons for the toolbar: no frame, no fill.
const textButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: 'none',
  background: 'none',
  padding: '6px 8px',
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--text-muted)',
  cursor: 'pointer',
  borderRadius: tokens.radius.md,
};

function BalanceSheet(): React.JSX.Element {
  const t = useIntlayer('reportsPage');
  const { locale } = useLocale();
  const labels = t.labels as Record<string, { value?: string } | undefined>;
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
        // The report speaks three languages; any other UI locale gets English.
        params: {
          ...(effectiveDate ? { date: effectiveDate } : {}),
          locale: reportLocaleOf(locale),
        } satisfies ContractInput<'BalanceQuery'>,
        signal,
        contract: 'BalanceSheetResponse',
      }),
    // Смена даты и сохранение баланса перезагружают отчёт; таблица держится на
    // экране до прихода новых цифр, но только внутри того же воркспейса.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
    enabled: Boolean(workspaceId),
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

  // Whole units on group and total lines, cents on the lines under them.
  const formatCurrency = useCallback(
    (value: number, fractionDigits = 2) =>
      formatMoney(value, currencyCode, locale, { fractionDigits }),
    [locale, currencyCode],
  );
  // A zero is a dash: most lines of a fresh workspace are empty.
  const formatAmount = useCallback(
    (value: number, fractionDigits = 2) =>
      value === 0 ? '—' : formatCurrency(value, fractionDigits),
    [formatCurrency],
  );

  const saveSnapshot = useCallback(
    async (accountId: string): Promise<void> => {
      const rawValue = editableValues[accountId];
      if (rawValue === undefined) return;

      const normalized = rawValue.replace(',', '.').trim();
      // An emptied field is the dash for zero.
      const parsed = normalized === '' ? 0 : Number.parseFloat(normalized);
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

        const blob = new Blob([blobOf(response)], {
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
  function renderAccount(account: BalanceAccountNode, level = 0): React.JSX.Element {
    const hasChildren = account.children.length > 0;
    const isExpanded = expanded[account.id] ?? true;
    const canToggle = account.isExpandable || hasChildren;
    const isSection = level === 0;
    const name = localizeBalanceAccountName(account.name, locale);
    const article = ARTICLE_PREFIX.exec(name);

    return (
      <Box
        key={account.id}
        // Hairlines only between the top-level groups.
        sx={
          isSection
            ? { borderBottom: '1px solid var(--border)', '&:last-child': { borderBottom: 'none' } }
            : undefined
        }
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            py: isSection ? 1.25 : 0.75,
          }}
        >
          <Box sx={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 1 }}>
            {/* One chevron column for every level; only the label steps in. */}
            {canToggle ? (
              <button
                type="button"
                aria-label={name}
                aria-expanded={isExpanded}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
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
                paddingLeft: level * 16,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: isSection ? 15 : 14,
                fontWeight: isSection ? 500 : 400,
                color: isSection ? 'var(--foreground)' : 'var(--text-muted)',
              }}
            >
              {article ? (
                <>
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>
                    {article[1]}
                  </span>{' '}
                  {article[2]}
                </>
              ) : (
                name
              )}
            </span>
          </Box>

          <Box sx={{ flexShrink: 0 }}>
            {account.isEditable ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <input
                  type="number"
                  step="0.01"
                  placeholder="—"
                  style={{
                    width: 112,
                    border: 'none',
                    borderRadius: 0,
                    background: 'transparent',
                    padding: '4px 0',
                    textAlign: 'right',
                    fontFamily: 'inherit',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 14,
                    color: 'var(--foreground)',
                  }}
                  value={
                    (editableValues[account.id] ?? '0.00') === '0.00'
                      ? ''
                      : editableValues[account.id]
                  }
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
                  aria-label={name}
                />
                {savingAccountId === account.id && (
                  <CircularProgress size={16} sx={{ color: 'var(--primary)' }} />
                )}
              </Box>
            ) : (
              <span
                className={PRIVATE_CLASS}
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: isSection ? 15 : 14,
                  fontWeight: isSection ? 500 : 400,
                  color: isSection ? 'var(--foreground)' : 'var(--text-muted)',
                }}
              >
                {formatAmount(account.amount, isSection ? 0 : 2)}
              </span>
            )}
          </Box>
        </Box>

        {hasChildren && isExpanded && (
          <Box>
            {account.children
              .sort((a, b) => a.position - b.position)
              .map(child => renderAccount(child, level + 1))}
          </Box>
        )}
      </Box>
    );
  }

  const balanceWarning = useMemo(() => {
    if (!sheet || sheet.isBalanced) return null;
    return (
      <>
        {text('balanceDifference', 'Balance difference')}:{' '}
        <PrivateAmount>{formatCurrency(sheet.difference, 0)}</PrivateAmount>
      </>
    );
  }, [formatCurrency, sheet, text]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} data-tour-id="reports-balance">
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
        <Typography
          component="h1"
          sx={{ fontSize: 22, fontWeight: 500, color: 'var(--foreground)' }}
        >
          {text('balanceSheetTitle', 'Balance sheet')}
        </Typography>
        {/* The currency is named once, here, not on every line. */}
        <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>{currencyCode}</Typography>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { md: 'center' },
          justifyContent: { md: 'space-between' },
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <Select
            variant="standard"
            disableUnderline
            sx={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}
            value={filterMode}
            onChange={value => setFilterMode(value as 'now' | 'date')}
            options={[
              { value: 'now', label: text('asOfNow', 'As of now') },
              { value: 'date', label: text('asOfDate', 'As of date') },
            ]}
          />

          {filterMode === 'date' && (
            <Box sx={{ minWidth: 180 }}>
              <CustomDatePicker
                label={text('asOfDate', 'As of date')}
                value={selectedDate}
                onChange={setSelectedDate}
              />
            </Box>
          )}

          <button type="button" onClick={loadSheet} style={textButtonStyle}>
            {text('refresh', 'Refresh')}
          </button>
        </Box>

        <Box sx={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setExportMenuOpen(open => !open)}
            disabled={!!exportingFormat}
            style={{ ...textButtonStyle, color: 'var(--foreground)' }}
          >
            {exportingFormat && <CircularProgress size={16} sx={{ color: 'inherit' }} />}
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
              {(['excel', 'pdf'] as const).map(format => (
                <button
                  key={format}
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
                  onClick={() => void downloadExport(format)}
                >
                  {format === 'excel' ? text('exportExcel', 'Excel') : text('exportPdf', 'PDF')}
                </button>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {saveHint && (
        <Typography variant="caption" sx={{ display: 'block', color: 'var(--text-muted)' }}>
          {saveHint}
        </Typography>
      )}

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
          {(
            [
              {
                key: 'assets',
                title: text('assets', 'Assets'),
                side: sheet.assets,
              },
              {
                key: 'liabilities',
                title: text('liabilities', 'Liabilities'),
                side: sheet.liabilities,
              },
            ] as const
          ).map(({ key, title, side }) => (
            <Box
              key={key}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
                bgcolor: 'var(--card)',
                p: 2,
              }}
            >
              <Typography sx={{ mb: 1, fontSize: 15, fontWeight: 500, color: 'var(--foreground)' }}>
                {title}
              </Typography>
              <Box sx={{ flexGrow: 1 }}>
                {side.sections
                  .sort((a, b) => a.position - b.position)
                  .map(section => renderAccount(section))}
              </Box>
              {/* Both columns end on a total line, so the two sides can be read against each other. */}
              <Box
                sx={{
                  mt: 1,
                  pt: 1.5,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  borderTop: '1px solid var(--border)',
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--foreground)',
                }}
              >
                <PrivateAmount>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(side.total, 0)}
                  </span>
                </PrivateAmount>
              </Box>
            </Box>
          ))}
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
