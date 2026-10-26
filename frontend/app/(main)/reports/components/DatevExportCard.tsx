'use client';

import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download } from '@/app/components/icons';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { blobOf } from '@/app/lib/blob-of';
import type { DatevSettings } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { useCategoryName } from '@/app/lib/use-category-name';
import { tokens } from '@/lib/theme-tokens';
import { saveBlob } from './tax-return.helpers';

const ACCOUNT = /^[0-9]{1,9}$/;

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

/** The year, or one of its months: DATEV recommends a file per booking period. */
function periodOf(year: number, month: string): { from: string; to: string } {
  if (month === 'year') {
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  const m = Number(month);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${last}` };
}

/**
 * The DATEV booking batch for the user's tax adviser: the adviser and client
 * numbers DATEV matches a file by, which account each category books to, and
 * the file itself. Only offered to a business in Germany or Austria.
 */
export function DatevExportCard({ year }: { year: number }): React.ReactElement | null {
  const t = useIntlayer('datevExport');
  const categoryName = useCategoryName();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState('year');
  const [form, setForm] = useState<{
    chart: DatevSettings['chart'];
    consultant: string;
    client: string;
    bank: string;
  }>({ chart: '03', consultant: '', client: '', bank: '' });
  const [accounts, setAccounts] = useState<Record<string, string>>({});
  const [bankAccounts, setBankAccounts] = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState(false);

  const settings = useQuery({
    queryKey: queryKeys.datevSettings(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/tax/datev/settings', signal, contract: 'DatevSettings' }),
    enabled: Boolean(workspaceId),
  });
  const available = settings.data?.available === true;
  const mapping = useQuery({
    queryKey: queryKeys.datevMapping({ workspaceId, year }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: `/tax/datev/mapping?year=${year}`, signal, contract: 'DatevMapping' }),
    enabled: Boolean(workspaceId) && available,
  });
  const period = periodOf(year, month);
  const preview = useQuery({
    queryKey: queryKeys.datevPreview({ workspaceId, ...period }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/tax/datev/preview?from=${period.from}&to=${period.to}`,
        signal,
        contract: 'DatevPreview',
      }),
    enabled: Boolean(workspaceId) && available,
  });

  useEffect(() => {
    if (settings.data) {
      setForm({
        chart: settings.data.chart,
        consultant: settings.data.consultantNumber ? String(settings.data.consultantNumber) : '',
        client: settings.data.clientNumber ? String(settings.data.clientNumber) : '',
        bank: settings.data.bankAccount,
      });
      setAccounts(settings.data.accounts);
      setBankAccounts(settings.data.bankAccounts ?? {});
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async (body: ContractInput<'SaveDatevSettingsBody'>) => {
      await apiClient.put('/tax/datev/settings', body);
    },
    onSuccess: () => {
      toast.success(t.saved.value);
      void queryClient.invalidateQueries({ queryKey: ['datev', workspaceId] });
    },
    onError: error => toast.error(getApiErrorMessage(error, t.saveError.value)),
  });

  const invalidAccounts = useMemo(
    () =>
      [...Object.values(accounts), ...Object.values(bankAccounts)].some(
        value => value !== '' && !ACCOUNT.test(value),
      ),
    [accounts, bankAccounts],
  );

  if (!available) {
    return null;
  }

  const persist = (overrides: Partial<{ accounts: Record<string, string> }> = {}) => {
    const chosen = Object.fromEntries(
      Object.entries(overrides.accounts ?? accounts).filter(([, value]) => ACCOUNT.test(value)),
    );
    const banks = Object.fromEntries(
      Object.entries(bankAccounts).filter(([, value]) => ACCOUNT.test(value)),
    );
    save.mutate({
      chart: form.chart,
      consultantNumber: form.consultant ? Number(form.consultant) : null,
      clientNumber: form.client ? Number(form.client) : null,
      bankAccount: form.bank && ACCOUNT.test(form.bank) ? form.bank : null,
      // Another chart numbers accounts differently: switching drops the mapping.
      accounts: form.chart === settings.data?.chart ? chosen : {},
      bankAccounts: form.chart === settings.data?.chart ? banks : {},
    });
  };

  const acceptSuggestions = () => {
    const next = { ...accounts };
    for (const row of mapping.data?.categories ?? []) {
      if (!next[row.categoryId] && row.suggestion) {
        next[row.categoryId] = row.suggestion.account;
      }
    }
    setAccounts(next);
    persist({ accounts: next });
  };

  const download = async () => {
    setDownloading(true);
    await apiClient
      .get(`/tax/datev/export?from=${period.from}&to=${period.to}`, { responseType: 'blob' })
      .then(response =>
        saveBlob(
          blobOf(response),
          `EXTF_Buchungsstapel_${period.from.replace(/-/g, '')}_${period.to.replace(/-/g, '')}.csv`,
        ),
      )
      .catch(error => toast.error(getApiErrorMessage(error, t.downloadError.value)))
      .finally(() => setDownloading(false));
  };

  const numbersMissing = (preview.data?.missingSettings.length ?? 0) > 0;
  const months = Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: new Date(Date.UTC(year, index, 1)).toLocaleDateString(undefined, {
      month: 'long',
      timeZone: 'UTC',
    }),
  }));

  return (
    <Box
      data-testid="datev-export"
      sx={{
        borderRadius: tokens.radius.lg,
        border: '1px solid',
        borderColor: 'divider',
        p: { xs: 2, sm: 3 },
      }}
    >
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
        {t.title.value}
      </Typography>
      <Typography sx={{ mt: 0.5, mb: 2, fontSize: 13, color: 'text.secondary', maxWidth: 640 }}>
        {t.description.value}
      </Typography>

      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
        <Select
          size="small"
          value={form.chart}
          aria-label={t.chartLabel.value}
          onChange={value => setForm({ ...form, chart: value === '04' ? '04' : '03' })}
          options={[
            { value: '03', label: 'SKR 03' },
            { value: '04', label: 'SKR 04' },
          ]}
          sx={{ minWidth: 120 }}
        />
        <TextField
          size="small"
          label={t.consultantLabel.value}
          value={form.consultant}
          onChange={event =>
            setForm({ ...form, consultant: event.target.value.replace(/\D/g, '') })
          }
          sx={{ width: 170 }}
          slotProps={{
            htmlInput: { inputMode: 'numeric', maxLength: 7 },
          }}
        />
        <TextField
          size="small"
          label={t.clientLabel.value}
          value={form.client}
          onChange={event => setForm({ ...form, client: event.target.value.replace(/\D/g, '') })}
          sx={{ width: 150 }}
          slotProps={{
            htmlInput: { inputMode: 'numeric', maxLength: 5 },
          }}
        />
        <TextField
          size="small"
          label={t.bankLabel.value}
          value={form.bank}
          onChange={event => setForm({ ...form, bank: event.target.value.replace(/\D/g, '') })}
          sx={{ width: 140 }}
          slotProps={{
            htmlInput: { inputMode: 'numeric', maxLength: 9 },
          }}
        />
        <Button
          variant="outlined"
          size="small"
          disabled={save.isPending || invalidAccounts}
          onClick={() => persist()}
          sx={{ mt: 0.25 }}
        >
          {t.save.value}
        </Button>
      </Stack>
      {form.chart !== settings.data?.chart ? (
        <Typography sx={{ mt: 1, fontSize: 12, color: 'warning.main' }}>
          {t.chartSwitchWarning.value}
        </Typography>
      ) : null}

      <Typography sx={{ mt: 3, fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
        {fill(t.mappingTitle.value, { year })}
      </Typography>
      <Typography sx={{ mt: 0.5, mb: 1, fontSize: 12, color: 'text.secondary', maxWidth: 640 }}>
        {t.mappingHint.value}
      </Typography>
      {(mapping.data?.categories ?? []).some(row => !accounts[row.categoryId] && row.suggestion) ? (
        <Button size="small" onClick={acceptSuggestions} disabled={save.isPending} sx={{ mb: 1 }}>
          {t.acceptSuggestions.value}
        </Button>
      ) : null}
      <Stack spacing={1} data-testid="datev-mapping">
        {(mapping.data?.categories ?? []).map(row => {
          const value = accounts[row.categoryId] ?? '';
          return (
            <Stack
              key={row.categoryId}
              direction="row"
              sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}
            >
              <Typography sx={{ fontSize: 13, flex: '1 1 180px' }}>
                {categoryName(row.name)}{' '}
                <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                  · {fill(t.transactions.value, { count: row.transactionCount })}
                </Typography>
              </Typography>
              <TextField
                size="small"
                value={value}
                placeholder={row.suggestion?.account ?? ''}
                error={value !== '' && !ACCOUNT.test(value)}
                onChange={event =>
                  setAccounts({
                    ...accounts,
                    [row.categoryId]: event.target.value.replace(/\D/g, ''),
                  })
                }
                sx={{ width: 110 }}
                slotProps={{
                  htmlInput: {
                    'aria-label': fill(t.accountFor.value, { name: categoryName(row.name) }),
                    maxLength: 9,
                  },
                }}
              />
              <Typography sx={{ fontSize: 12, color: 'text.secondary', flex: '1 1 200px' }}>
                {row.suggestion ? fill(t.suggestion.value, row.suggestion) : t.noSuggestion.value}
              </Typography>
            </Stack>
          );
        })}
      </Stack>

      {(mapping.data?.bankAccounts ?? []).length > 0 ? (
        <Box sx={{ mt: 3 }} data-testid="datev-banks">
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
            {t.bankAccountsTitle.value}
          </Typography>
          <Typography sx={{ mt: 0.5, mb: 1, fontSize: 12, color: 'text.secondary', maxWidth: 640 }}>
            {t.bankAccountsHint.value}
          </Typography>
          <Stack spacing={1}>
            {(mapping.data?.bankAccounts ?? []).map(bank => (
              <Stack
                key={bank.accountNumber}
                direction="row"
                sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}
              >
                <Typography sx={{ fontSize: 13, flex: '1 1 260px', fontFamily: 'monospace' }}>
                  {bank.accountNumber}{' '}
                  <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
                    · {fill(t.transactions.value, { count: bank.transactionCount })}
                  </Typography>
                </Typography>
                <TextField
                  size="small"
                  value={bankAccounts[bank.accountNumber] ?? ''}
                  placeholder={form.bank}
                  onChange={event =>
                    setBankAccounts({
                      ...bankAccounts,
                      [bank.accountNumber]: event.target.value.replace(/\D/g, ''),
                    })
                  }
                  sx={{ width: 110 }}
                  slotProps={{
                    htmlInput: {
                      'aria-label': fill(t.accountFor.value, { name: bank.accountNumber }),
                      maxLength: 9,
                    },
                  }}
                />
              </Stack>
            ))}
          </Stack>
        </Box>
      ) : null}

      <Stack direction="row" sx={{ mt: 3, flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <Select
          size="small"
          value={month}
          aria-label={t.periodLabel.value}
          onChange={setMonth}
          options={[{ value: 'year', label: fill(t.wholeYear.value, { year }) }, ...months]}
          sx={{ minWidth: 180 }}
        />
        <Button
          variant="contained"
          startIcon={<Download size={16} />}
          disabled={downloading || numbersMissing || !preview.data?.bookings}
          onClick={() => void download()}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {downloading ? t.preparing.value : t.download.value}
        </Button>
      </Stack>

      {preview.data ? (
        <Box sx={{ mt: 1.5 }} data-testid="datev-preview">
          <Typography sx={{ fontSize: 13 }}>
            {fill(t.bookings.value, { count: preview.data.bookings })}
          </Typography>
          {preview.data.converted > 0 ? (
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {fill(t.converted.value, { count: preview.data.converted })}
            </Typography>
          ) : null}
          {numbersMissing ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              {t.numbersMissing.value}
            </Alert>
          ) : null}
          {preview.data.skipped.unmapped.length > 0 ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {fill(t.unmapped.value, {
                categories: preview.data.skipped.unmapped
                  .map(item => `${categoryName(item.name)} (${item.count})`)
                  .join(', '),
              })}
            </Alert>
          ) : null}
          {preview.data.skipped.foreignCurrency + preview.data.skipped.uncategorized > 0 ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {fill(t.leftOut.value, {
                foreign: preview.data.skipped.foreignCurrency,
                uncategorized: preview.data.skipped.uncategorized,
              })}
            </Alert>
          ) : null}
          {preview.data.issues.length > 0 ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {fill(t.issues.value, { count: preview.data.issues.length })}
            </Alert>
          ) : null}
        </Box>
      ) : null}
      <Typography sx={{ mt: 1.5, fontSize: 12, color: 'text.secondary', maxWidth: 640 }}>
        {t.footnote.value}
      </Typography>
    </Box>
  );
}
