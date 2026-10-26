'use client';

import { Box, Button, Link as MuiLink, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import {
  apiQueryDecoded,
  type ContractInput,
  type ContractType,
  checkContract,
} from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type OfficialRatesCheck = ContractType<'OfficialRatesCheck'>;
export type RateDifference = OfficialRatesCheck['differences'][number];
type DifferenceKind = RateDifference['kind'];

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

/** TEDB's category ids (FOODSTUFFS, BOOKS…) read as plain words. */
function categoryWords(categories: string[]): string {
  return categories.map(category => category.toLowerCase().replace(/_/g, ' ')).join(', ');
}

/**
 * The workspace's VAT rates against the ones its member state reports to the
 * European Commission. A difference is applied, or ignored, by the user;
 * nothing changes on its own.
 */
export function OfficialRatesPanel(): React.ReactElement | null {
  const t = useIntlayer('workspaceOfficialRates');
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [showIgnored, setShowIgnored] = useState(false);
  const queryKey = queryKeys.taxOfficialRates(workspaceId);

  const check = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/tax/settings/official-rates',
        signal,
        contract: 'OfficialRatesCheck',
      }),
    enabled: Boolean(workspaceId),
  });

  const settle = (result: OfficialRatesCheck) => queryClient.setQueryData(queryKey, result);

  const refresh = useMutation({
    mutationFn: () =>
      apiClient
        .post('/tax/settings/official-rates/refresh', {})
        .then(response =>
          checkContract(
            'OfficialRatesCheck',
            response.data,
            '/tax/settings/official-rates/refresh',
          ),
        ),
    onSuccess: settle,
    onError: error => toast.error(getApiErrorMessage(error, t.failed.value)),
  });

  const apply = useMutation({
    mutationFn: (key: string) =>
      apiClient
        .post('/tax/settings/official-rates/apply', {
          key,
        } satisfies ContractInput<'ApplyOfficialRateBody'>)
        .then(response =>
          checkContract('OfficialRatesCheck', response.data, '/tax/settings/official-rates/apply'),
        ),
    onSuccess: result => {
      settle(result);
      toast.success(t.applied.value);
      // New rates change what rows are assessed at.
      void queryClient.invalidateQueries({ queryKey: ['tax-return', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['tax-year', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.taxSettings(workspaceId) });
    },
    onError: error => toast.error(getApiErrorMessage(error, t.failed.value)),
  });

  const dismiss = useMutation({
    mutationFn: (body: ContractInput<'DismissOfficialRateBody'>) =>
      apiClient
        .put('/tax/settings/official-rates/dismissed', body)
        .then(response =>
          checkContract(
            'OfficialRatesCheck',
            response.data,
            '/tax/settings/official-rates/dismissed',
          ),
        ),
    onSuccess: settle,
    onError: error => toast.error(getApiErrorMessage(error, t.failed.value)),
  });

  const data = check.data;
  if (!data?.supported) {
    return null;
  }
  const busy = refresh.isPending || apply.isPending || dismiss.isPending;
  const day = (value: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(`${value.slice(0, 10)}T00:00:00Z`),
    );

  const describe = (item: RateDifference): string => {
    // One template with the date in it, one without for a start TEDB does not show.
    const templates: Record<DifferenceKind, [string, string]> = {
      standard_changed: [t.standardChangedFrom.value, t.standardDiffers.value],
      reduced_missing: [t.reducedMissingFrom.value, t.reducedMissing.value],
      reduced_unlisted: [t.reducedUnlisted.value, t.reducedUnlisted.value],
    };
    const [dated, undated] = templates[item.kind];
    const params = {
      official: item.official ?? '',
      ours: item.ours ?? '',
      categories: item.categories.length > 0 ? ` (${categoryWords(item.categories)})` : '',
    };
    return item.from ? fill(dated, { ...params, date: day(item.from) }) : fill(undated, params);
  };

  const applyLabel = (item: RateDifference): string =>
    item.kind === 'standard_changed' && item.from
      ? fill(t.applyFrom.value, { date: day(item.from) })
      : t.addRate.value;

  return (
    <Box data-attention="tax:official-rates" data-testid="official-rates">
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
        {t.title.value}
      </Typography>
      <Typography sx={{ mt: 0.5, mb: 1.5, fontSize: 13, color: 'text.secondary', maxWidth: 560 }}>
        {fill(t.description.value, { country: data.country ?? '' })}
      </Typography>

      {data.fetchedAt === null ? (
        <Typography sx={{ fontSize: 13, color: 'warning.main' }}>{t.unreachable.value}</Typography>
      ) : data.differences.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: 'success.main' }}>{t.matches.value}</Typography>
      ) : (
        <Stack spacing={1} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {data.differences.map(item => (
            <Box
              component="li"
              key={item.key}
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 1,
                py: 1,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <Typography sx={{ fontSize: 13, flex: '1 1 260px', minWidth: 0 }}>
                {describe(item)}
              </Typography>
              {item.canApply ? (
                <Button
                  size="small"
                  variant="contained"
                  disabled={busy}
                  onClick={() => apply.mutate(item.key)}
                >
                  {applyLabel(item)}
                </Button>
              ) : null}
              <Button
                size="small"
                disabled={busy}
                onClick={() => dismiss.mutate({ key: item.key, dismissed: true })}
              >
                {t.ignore.value}
              </Button>
            </Box>
          ))}
        </Stack>
      )}

      <Stack
        direction="row"
        sx={{ mt: 1.25, flexWrap: 'wrap', gap: 1.5, alignItems: 'center', fontSize: 12 }}
      >
        {data.fetchedAt ? (
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {fill(t.checkedAt.value, { date: day(data.fetchedAt) })}
          </Typography>
        ) : null}
        <MuiLink
          href={data.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ fontSize: 12 }}
        >
          {t.source.value}
        </MuiLink>
        <Button size="small" disabled={busy} onClick={() => refresh.mutate()}>
          {refresh.isPending ? t.checking.value : t.checkNow.value}
        </Button>
        {data.dismissed.length > 0 ? (
          <Button size="small" onClick={() => setShowIgnored(value => !value)}>
            {fill(showIgnored ? t.hideIgnored.value : t.showIgnored.value, {
              count: data.dismissed.length,
            })}
          </Button>
        ) : null}
      </Stack>

      {showIgnored && data.dismissed.length > 0 ? (
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {data.dismissed.map(item => (
            <Box key={item.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', flex: 1, minWidth: 0 }}>
                {describe(item)}
              </Typography>
              <Button
                size="small"
                disabled={busy}
                onClick={() => dismiss.mutate({ key: item.key, dismissed: false })}
              >
                {t.restore.value}
              </Button>
            </Box>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}
