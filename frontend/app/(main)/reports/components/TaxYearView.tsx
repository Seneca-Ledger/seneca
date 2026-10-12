'use client';

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import type React from 'react';
import { Fragment, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronRight, Download } from '@/app/components/icons';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { CategoryItem } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { tokens } from '@/lib/theme-tokens';
import { DatevExportCard } from './DatevExportCard';
import { TaxThresholdCard } from './TaxThresholdCard';
import { formatMoney, saveBlob } from './tax-return.helpers';

type Category = CategoryItem;

const YEARS_BACK = 6;
/** The documents count gives way first on a phone, so the totals stay in view. */
const NARROW_HIDDEN = { display: { xs: 'none', sm: 'table-cell' } } as const;

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

function Figure({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <Box sx={{ flex: { xs: '1 1 140px', md: '0 0 auto' }, minWidth: { md: 150 } }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
      <Typography
        sx={{ fontSize: emphasis ? 22 : 17, fontWeight: 600, color: 'text.primary', mt: 0.25 }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Everything a person needs at tax time, whatever kind of workspace it is:
 * what to hold back, which spending matters for the return, and one archive
 * with the rows and every receipt behind them.
 */
export function TaxYearView(): React.ReactElement {
  const t = useIntlayer('taxYearView');
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [downloading, setDownloading] = useState<'relevant' | 'all' | null>(null);

  const report = useQuery({
    queryKey: queryKeys.taxYearReport({ workspaceId, year }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: `/tax/year-report?year=${year}`, signal, contract: 'TaxYearReport' }),
    enabled: Boolean(workspaceId),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
  });
  const reserve = useQuery({
    queryKey: queryKeys.taxReserve(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/tax/settings/reserve/amount', signal, contract: 'TaxReserve' }),
    enabled: Boolean(workspaceId),
  });
  const categories = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    enabled: Boolean(workspaceId),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['tax-year', workspaceId] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories(workspaceId) });
  };

  const toggleCategory = useMutation({
    mutationFn: async (category: Category) => {
      await apiClient.put(`/categories/${category.id}`, {
        taxRelevant: !category.taxRelevant,
      } satisfies ContractInput<'UpdateCategoryBody'>);
    },
    onSuccess: refresh,
    onError: error => toast.error(getApiErrorMessage(error, t.saveError.value)),
  });

  const markRow = useMutation({
    mutationFn: async ({ id, taxRelevant }: { id: string; taxRelevant: boolean | null }) => {
      await apiClient.put(`/transactions/${id}`, {
        taxRelevant,
      } satisfies ContractInput<'UpdateTransactionBody'>);
    },
    onSuccess: refresh,
    onError: error => toast.error(getApiErrorMessage(error, t.saveError.value)),
  });

  const download = async (scope: 'relevant' | 'all') => {
    setDownloading(scope);
    await apiClient
      .get(`/tax/pack?from=${year}-01-01&to=${year}-12-31&scope=${scope}`, {
        responseType: 'blob',
      })
      .then(response =>
        saveBlob(response.data as Blob, `tax-pack_${year}${scope === 'all' ? '_all' : ''}.zip`),
      )
      .catch(error => toast.error(getApiErrorMessage(error, t.downloadError.value)))
      .finally(() => setDownloading(null));
  };

  const rootCategories = (categories.data ?? []).filter(
    category => !category.parentId && category.isEnabled !== false,
  );
  const data = report.data;
  const currency = data?.currency ?? reserve.data?.currency ?? '';
  const reserveData = reserve.data;
  const reserveConfigured = Boolean(reserveData && (reserveData.vat || reserveData.incomeTax));

  return (
    <Stack spacing={3}>
      <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        <Select
          size="small"
          value={String(year)}
          aria-label={t.yearLabel.value}
          onChange={value => setYear(Number(value))}
          options={Array.from({ length: YEARS_BACK }, (_, index) => {
            const value = thisYear - index;
            return { value: String(value), label: String(value) };
          })}
          sx={{ minWidth: 120 }}
        />
        <Typography sx={{ fontSize: 13, color: 'text.secondary', maxWidth: 640 }}>
          {t.intro.value}
        </Typography>
      </Stack>

      <TaxThresholdCard />

      {/* What to hold back */}
      <Box
        sx={{
          borderRadius: tokens.radius.lg,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: { xs: 2, sm: 3 },
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', mb: 1.5 }}>
          {fill(t.reserveTitle.value, { year: thisYear })}
        </Typography>
        {reserve.isPending ? (
          <CircularProgress size={20} />
        ) : reserveData && reserveConfigured ? (
          <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 3, rowGap: 2 }}>
            <Figure
              label={t.reserveTotal.value}
              value={formatMoney(reserveData.total, reserveData.currency)}
              emphasis
            />
            {reserveData.vat ? (
              <Figure
                label={t.reserveVat.value}
                value={formatMoney(reserveData.vat.net, reserveData.currency)}
              />
            ) : null}
            {reserveData.incomeTax ? (
              <Figure
                label={fill(t.reserveIncomeTax.value, { percent: reserveData.incomeTax.percent })}
                value={formatMoney(reserveData.incomeTax.amount, reserveData.currency)}
              />
            ) : null}
            <Figure
              label={fill(t.reservePaid.value, { count: reserveData.payments.count })}
              value={`− ${formatMoney(reserveData.payments.amount, reserveData.currency)}`}
            />
          </Stack>
        ) : (
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            {t.reserveNotSet.value}{' '}
            <Link href="/workspaces" style={{ color: 'var(--primary)' }}>
              {t.reserveSetUp.value}
            </Link>
          </Typography>
        )}
        {reserveData && reserveConfigured ? (
          <Typography sx={{ mt: 1.5, fontSize: 12, color: 'text.secondary', maxWidth: 640 }}>
            {t.reserveExplain.value}
          </Typography>
        ) : null}
        {reserveData && reserveData.missingRateCurrencies.length > 0 ? (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {fill(t.missingRates.value, {
              currencies: reserveData.missingRateCurrencies.join(', '),
            })}
          </Alert>
        ) : null}
      </Box>

      {/* Which categories matter */}
      <Box>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
          {t.categoriesTitle.value}
        </Typography>
        <Typography sx={{ mt: 0.5, mb: 1.5, fontSize: 13, color: 'text.secondary', maxWidth: 640 }}>
          {t.categoriesHint.value}
        </Typography>
        <Box
          role="group"
          aria-label={t.categoriesTitle.value}
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
        >
          {rootCategories.map(category => (
            <Chip
              key={category.id}
              label={category.name}
              size="small"
              clickable
              disabled={toggleCategory.isPending}
              color={category.taxRelevant ? 'primary' : 'default'}
              variant={category.taxRelevant ? 'filled' : 'outlined'}
              aria-pressed={Boolean(category.taxRelevant)}
              onClick={() => toggleCategory.mutate(category)}
            />
          ))}
        </Box>
      </Box>

      {/* The year's tax-relevant spending and income */}
      <Box>
        {report.isPending ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : report.isError ? (
          <Alert severity="error">{t.loadError.value}</Alert>
        ) : data && data.rows.length > 0 ? (
          <Box sx={{ overflowX: 'auto', opacity: report.isFetching ? 0.6 : 1 }}>
            <Table size="small" aria-label={t.tableLabel.value}>
              <TableHead>
                <TableRow>
                  <TableCell>{t.colCategory.value}</TableCell>
                  <TableCell align="right">{t.colTransactions.value}</TableCell>
                  <TableCell align="right" sx={NARROW_HIDDEN}>
                    {t.colDocuments.value}
                  </TableCell>
                  <TableCell align="right">{fill(t.colTotal.value, { currency })}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.categories.map(category => {
                  const key = `${category.categoryId ?? 'none'}:${category.type}`;
                  const expanded = open.has(key);
                  const rows = data.rows.filter(
                    row => row.categoryId === category.categoryId && row.type === category.type,
                  );
                  return (
                    <Fragment key={key}>
                      <TableRow hover>
                        <TableCell>
                          <Button
                            size="small"
                            onClick={() =>
                              setOpen(previous => {
                                const next = new Set(previous);
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                return next;
                              })
                            }
                            aria-expanded={expanded}
                            startIcon={
                              expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                            }
                            sx={{ textTransform: 'none', color: 'text.primary', fontWeight: 600 }}
                          >
                            {category.name}
                          </Button>
                          {category.type === 'income' ? (
                            <Chip size="small" label={t.income.value} sx={{ ml: 1 }} />
                          ) : null}
                        </TableCell>
                        <TableCell align="right">{category.count}</TableCell>
                        <TableCell align="right" sx={NARROW_HIDDEN}>
                          {category.documentCount}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatMoney(category.total, currency)}
                        </TableCell>
                      </TableRow>
                      {expanded
                        ? rows.map(row => (
                            <TableRow key={row.id} data-testid="tax-year-row">
                              <TableCell sx={{ pl: 5 }}>
                                <Typography sx={{ fontSize: 13 }}>
                                  {row.date} · {row.counterparty}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <IconButton
                                  size="small"
                                  aria-label={t.excludeRow.value}
                                  title={t.excludeRow.value}
                                  disabled={markRow.isPending}
                                  onClick={() =>
                                    markRow.mutate({
                                      id: row.id,
                                      // A row marked by hand goes back to its
                                      // category; an inherited one is opted out.
                                      taxRelevant: row.markedOnRow ? null : false,
                                    })
                                  }
                                >
                                  ×
                                </IconButton>
                              </TableCell>
                              <TableCell align="right" sx={NARROW_HIDDEN}>
                                {row.documentCount}
                              </TableCell>
                              <TableCell align="right">
                                {row.converted === null
                                  ? formatMoney(row.amount, row.currency)
                                  : formatMoney(row.converted, currency)}
                              </TableCell>
                            </TableRow>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            {data.missingRateCurrencies.length > 0 ? (
              <Alert severity="warning" sx={{ mt: 1.5 }}>
                {fill(t.missingRates.value, { currencies: data.missingRateCurrencies.join(', ') })}
              </Alert>
            ) : null}
          </Box>
        ) : (
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t.empty.value}</Typography>
        )}
      </Box>

      {/* The archive */}
      <Box
        sx={{
          borderRadius: tokens.radius.lg,
          border: '1px solid',
          borderColor: 'divider',
          p: { xs: 2, sm: 3 },
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
          {fill(t.packTitle.value, { year })}
        </Typography>
        <Typography sx={{ mt: 0.5, mb: 1.5, fontSize: 13, color: 'text.secondary', maxWidth: 640 }}>
          {t.packDescription.value}
        </Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<Download size={16} />}
            disabled={downloading !== null}
            onClick={() => void download('relevant')}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {downloading === 'relevant' ? t.preparing.value : t.downloadRelevant.value}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Download size={16} />}
            disabled={downloading !== null}
            onClick={() => void download('all')}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {downloading === 'all' ? t.preparing.value : t.downloadAll.value}
          </Button>
        </Stack>
        <Typography sx={{ mt: 1.5, fontSize: 12, color: 'text.secondary', maxWidth: 640 }}>
          {t.packNote.value}
        </Typography>
      </Box>

      <DatevExportCard year={year} />
    </Stack>
  );
}
