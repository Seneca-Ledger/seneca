'use client';

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { blobOf } from '@/app/lib/blob-of';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { tokens } from '@/lib/theme-tokens';
import { TaxThresholdCard } from './TaxThresholdCard';
import {
  exportFileName,
  formatMoney,
  netDirection,
  type PeriodPreset,
  periodFor,
  saveBlob,
} from './tax-return.helpers';
import { UstvaCard } from './UstvaCard';

const QUARTER_PRESETS = [
  { key: 'thisQuarter', label: 'presetThisQuarter' },
  { key: 'lastQuarter', label: 'presetLastQuarter' },
  { key: 'thisYear', label: 'presetThisYear' },
] as const satisfies ReadonlyArray<{ key: PeriodPreset; label: string }>;

// A monthly filer files months; the quarter buttons would offer a period it never files.
const MONTH_PRESETS = [
  { key: 'thisMonth', label: 'presetThisMonth' },
  { key: 'lastMonth', label: 'presetLastMonth' },
  { key: 'thisYear', label: 'presetThisYear' },
] as const satisfies ReadonlyArray<{ key: PeriodPreset; label: string }>;

const DIRECTION_LABEL: Record<
  string,
  'directionOutput' | 'directionInput' | 'directionReverseCharge'
> = {
  output: 'directionOutput',
  input: 'directionInput',
  reverse_charge: 'directionReverseCharge',
};

function Figure({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}): React.ReactElement {
  return (
    <Box sx={{ flex: { xs: '1 1 140px', md: '0 0 auto' }, minWidth: { md: 160 } }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
      <Typography
        sx={{ fontSize: emphasis ? 22 : 18, fontWeight: 600, color: 'text.primary', mt: 0.25 }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/**
 * The period return: what is owed, what it was built from, and filing it.
 *
 * Filing is irreversible in the sense that matters — it locks every
 * transaction it reports — so the button says what it will do and the
 * reopen path is offered explicitly rather than implied.
 */
export function TaxReturnView(): React.ReactElement {
  const t = useIntlayer('taxReturnView');
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(() => periodFor('thisQuarter'));
  const filing = useQuery({
    queryKey: queryKeys.taxVatFiling(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/tax/settings/vat-filing', signal, contract: 'VatFilingSettings' }),
    enabled: Boolean(workspaceId),
  });
  const deadlines = useQuery({
    queryKey: queryKeys.taxDeadlines(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/tax/deadlines', signal, contract: 'TaxDeadlineList' }),
    enabled: Boolean(workspaceId),
  });
  const presets = filing.data?.frequency === 'monthly' ? MONTH_PRESETS : QUARTER_PRESETS;
  // A return filed outside Lumio: stop the reminders, lock nothing.
  const filedElsewhere = useMutation({
    mutationFn: async (periodEnd: string) => {
      await apiClient.put('/tax/deadlines/filed-elsewhere', {
        kind: 'vat_return',
        periodEnd,
        filed: true,
      } satisfies ContractInput<'FiledElsewhereBody'>);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.taxDeadlines(workspaceId) }),
  });
  // The returns that matter now: the next one due and any missed one.
  const vatDeadlines = (deadlines.data ?? []).filter(
    item => item.kind === 'vat_return' && !item.done && item.daysLeft >= -60,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryKey = queryKeys.taxReturn({ workspaceId, ...period });

  const returnQuery = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const query = `periodStart=${period.periodStart}&periodEnd=${period.periodEnd}`;
      const [record, totals] = await Promise.all([
        apiQueryDecoded({
          url: `/tax/returns/period?${query}`,
          signal,
          contract: 'TaxReturnRecord',
        }),
        apiQueryDecoded({
          url: `/tax/returns/preview?${query}`,
          signal,
          contract: 'TaxReturnPreview',
        }),
      ]);
      return { record, totals };
    },
    // Смена периода не должна стирать цифры: прошлый отчёт виден до прихода
    // нового, но только внутри того же воркспейса.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
    enabled: Boolean(workspaceId),
  });

  const record = returnQuery.data?.record ?? null;
  const totals = returnQuery.data?.totals ?? null;

  const actMutation = useMutation({
    mutationFn: async (action: 'file' | 'reopen') => {
      await apiClient.post(
        `/tax/returns/${action}`,
        period satisfies ContractInput<'TaxReturnPeriodBody'>,
      );
    },
    onSuccess: () => setError(null),
    // The server says why a filing was refused (rows without an exchange rate,
    // say); that beats a generic line.
    onError: (caught, action) =>
      setError(
        getApiErrorMessage(caught, action === 'file' ? t.fileFailed.value : t.reopenFailed.value),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      // Filing or reopening changes which returns are still due.
      void queryClient.invalidateQueries({ queryKey: queryKeys.taxDeadlines(workspaceId) });
    },
  });

  const act = async (action: 'file' | 'reopen') => {
    actMutation.mutate(action);
  };

  const download = async (format: 'pdf' | 'xlsx' | 'csv') => {
    setBusy(true);
    setError(null);

    await (async () => {
      const response = await apiClient.get(
        `/tax/returns/export?periodStart=${period.periodStart}&periodEnd=${period.periodEnd}&format=${format}`,
        { responseType: 'blob' },
      );
      saveBlob(blobOf(response), exportFileName(period.periodStart, period.periodEnd, format));
    })()
      .catch(async () => {
        setError(t.exportFailed.value.replace('{format}', format.toUpperCase()));
      })
      .finally(async () => {
        setBusy(false);
      });
  };

  const isFiled = record?.status === 'filed';
  const currency = totals?.currency ?? record?.currency ?? '';

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
        {presets.map(preset => (
          <Button
            key={preset.key}
            size="small"
            variant="outlined"
            onClick={() => setPeriod(periodFor(preset.key))}
            sx={{ borderRadius: tokens.radius.md, textTransform: 'none' }}
          >
            {t[preset.label]}
          </Button>
        ))}
        <Box sx={{ flex: { xs: '1 1 140px', sm: '0 0 180px' } }}>
          <CustomDatePicker
            label={t.from.value}
            value={period.periodStart}
            onChange={periodStart => setPeriod(p => ({ ...p, periodStart }))}
          />
        </Box>
        <Box sx={{ flex: { xs: '1 1 140px', sm: '0 0 180px' } }}>
          <CustomDatePicker
            label={t.to.value}
            value={period.periodEnd}
            onChange={periodEnd => setPeriod(p => ({ ...p, periodEnd }))}
          />
        </Box>
      </Stack>

      {error || returnQuery.isError ? (
        <Alert severity="error">{error ?? t.buildFailed}</Alert>
      ) : null}

      <TaxThresholdCard />

      {vatDeadlines.length > 0 ? (
        <Stack spacing={1} data-testid="vat-deadlines">
          {vatDeadlines.map(item => (
            <Alert
              key={item.periodEnd}
              severity={item.daysLeft < 0 ? 'error' : item.daysLeft <= 7 ? 'warning' : 'info'}
              action={
                <Stack direction="row" spacing={0.5}>
                  <Button
                    size="small"
                    onClick={() =>
                      setPeriod({ periodStart: item.periodStart, periodEnd: item.periodEnd })
                    }
                    sx={{ textTransform: 'none' }}
                  >
                    {t.openPeriod.value}
                  </Button>
                  <Button
                    size="small"
                    disabled={filedElsewhere.isPending}
                    onClick={() => filedElsewhere.mutate(item.periodEnd)}
                    sx={{ textTransform: 'none' }}
                  >
                    {t.filedElsewhere.value}
                  </Button>
                </Stack>
              }
            >
              {(item.daysLeft < 0 ? t.deadlineOverdue : t.deadlineDue).value
                .replace('{returnName}', item.returnName)
                .replace('{periodStart}', item.periodStart)
                .replace('{periodEnd}', item.periodEnd)
                .replace('{dueDate}', item.dueDate)}
            </Alert>
          ))}
          {vatDeadlines[0].checkedAt ? (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {t.deadlinesBasis.value.replace('{checkedAt}', vatDeadlines[0].checkedAt)}
            </Typography>
          ) : null}
        </Stack>
      ) : null}

      {returnQuery.isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        // Фоновая перезагрузка после смены периода или подачи только приглушает.
        <Box
          sx={{
            opacity: returnQuery.isFetching ? 0.6 : 1,
            transition: 'opacity 150ms ease',
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
          }}
        >
          <Stack
            direction="row"
            sx={{
              flexWrap: 'wrap',
              columnGap: 3,
              rowGap: 2,
              borderRadius: tokens.radius.lg,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              p: { xs: 2, sm: 3 },
            }}
          >
            <Figure
              label={t.outputTax.value}
              value={formatMoney(totals?.outputTax ?? 0, currency)}
            />
            <Figure label={t.inputTax.value} value={formatMoney(totals?.inputTax ?? 0, currency)} />
            <Figure
              label={
                netDirection(totals?.netPayable ?? 0) === 'refund'
                  ? t.reclaimable.value
                  : t.payable.value
              }
              value={formatMoney(Math.abs(Number(totals?.netPayable ?? 0)), currency)}
              emphasis
            />
            <Box
              sx={{
                ml: { md: 'auto' },
                width: { xs: '100%', md: 'auto' },
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Chip
                size="small"
                label={isFiled ? t.statusFiled.value : t.statusDraft.value}
                color={isFiled ? 'success' : 'default'}
              />
              <Button
                variant="outlined"
                disabled={busy || actMutation.isPending}
                onClick={() => download('pdf')}
                sx={{ borderRadius: tokens.radius.md, textTransform: 'none', fontWeight: 600 }}
              >
                PDF
              </Button>
              <Button
                variant="outlined"
                disabled={busy || actMutation.isPending}
                onClick={() => download('xlsx')}
                sx={{ borderRadius: tokens.radius.md, textTransform: 'none', fontWeight: 600 }}
              >
                XLSX
              </Button>
              <Button
                variant="outlined"
                disabled={busy || actMutation.isPending}
                onClick={() => download('csv')}
                sx={{ borderRadius: tokens.radius.md, textTransform: 'none', fontWeight: 600 }}
              >
                CSV
              </Button>
              <Button
                variant={isFiled ? 'outlined' : 'contained'}
                disabled={busy || actMutation.isPending}
                onClick={() => act(isFiled ? 'reopen' : 'file')}
                sx={{
                  borderRadius: tokens.radius.md,
                  textTransform: 'none',
                  fontWeight: 600,
                  flex: { xs: '1 1 auto', md: '0 0 auto' },
                }}
              >
                {isFiled ? t.reopenPeriod : t.fileAndLock}
              </Button>
            </Box>
          </Stack>

          {isFiled ? <Alert severity="info">{t.filedNotice}</Alert> : null}

          <UstvaCard period={period} lines={totals?.lines ?? []} />

          {!isFiled && totals?.missingRates && totals.missingRates.length > 0 ? (
            <Alert severity="warning">
              {t.missingRates.value
                .replace('{count}', String(totals.missingRates.length))
                .replace(
                  '{currencies}',
                  [...new Set(totals.missingRates.map(row => row.currency))].join(', '),
                )}
            </Alert>
          ) : null}

          {totals && totals.lines.length > 0 ? (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t.colDate}</TableCell>
                    <TableCell>{t.colCounterparty}</TableCell>
                    <TableCell>{t.colKind}</TableCell>
                    <TableCell align="right">{t.colTax}</TableCell>
                    <TableCell align="right">{t.colRate}</TableCell>
                    <TableCell align="right">
                      {t.colInCurrency.value.replace('{currency}', currency)}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {totals.lines.map(line => (
                    <TableRow key={line.transactionId}>
                      <TableCell>{line.date}</TableCell>
                      <TableCell>{line.counterparty}</TableCell>
                      <TableCell>
                        {DIRECTION_LABEL[line.direction]
                          ? t[DIRECTION_LABEL[line.direction]]
                          : line.direction}
                      </TableCell>
                      <TableCell align="right">
                        {formatMoney(line.taxAmount, line.currency)}
                      </TableCell>
                      <TableCell align="right">
                        {line.exchangeRate === 1 ? '—' : line.exchangeRate}
                      </TableCell>
                      <TableCell align="right">
                        {formatMoney(line.taxAmountConverted, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          ) : (
            <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{t.noLines}</Typography>
          )}
        </Box>
      )}

      <Typography
        sx={{
          fontSize: 12,
          lineHeight: 1.6,
          color: 'text.secondary',
          borderTop: '1px solid',
          borderColor: 'divider',
          pt: 1.5,
        }}
      >
        {t.disclaimer}
      </Typography>
    </Stack>
  );
}
