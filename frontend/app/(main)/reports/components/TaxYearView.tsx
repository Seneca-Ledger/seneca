'use client';

import {
  Alert,
  Box,
  Button,
  Checkbox,
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
import { CategoryIconBadge } from '@/app/components/dashboard/CategoryIconBadge';
import { ChevronDown, ChevronRight } from '@/app/components/icons';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { blobOf } from '@/app/lib/blob-of';
import type { CategoryItem } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { tokens } from '@/lib/theme-tokens';
import { DatevExportCard } from './DatevExportCard';
import { TaxThresholdCard } from './TaxThresholdCard';
import { saveBlob } from './tax-return.helpers';

type Category = CategoryItem;

const YEARS_BACK = 6;
/** The documents count gives way first on a phone, so the totals stay in view. */
const NARROW_HIDDEN = { display: { xs: 'none', sm: 'table-cell' } } as const;

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

/**
 * One money format for the whole page: "$0", "−$20.04" — the symbol first, a
 * typographic minus, cents only when there are any.
 */
export function taxMoney(value: number, currency: string, locale: string): string {
  const whole = Math.round(value * 100) % 100 === 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    })
      .format(value === 0 ? 0 : value)
      .replace('-', '−');
  } catch {
    return `${value.toFixed(whole ? 0 : 2)} ${currency}`;
  }
}

const SECTION_TITLE_SX = { fontSize: 15, fontWeight: 500, color: 'text.primary' } as const;
const HINT_SX = { fontSize: 14, color: 'var(--text-muted)', maxWidth: 680 } as const;

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ flex: { xs: '1 1 140px', md: '0 0 auto' }, minWidth: { md: 170 } }}>
      <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>{label}</Typography>
      <Typography
        sx={{
          mt: 0.5,
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
          color: 'text.primary',
        }}
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
  const { locale } = useLocale();
  const money = (value: number, code: string) => taxMoney(value, code, locale);
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
        saveBlob(blobOf(response), `tax-pack_${year}${scope === 'all' ? '_all' : ''}.zip`),
      )
      .catch(error => toast.error(getApiErrorMessage(error, t.downloadError.value)))
      .finally(() => setDownloading(null));
  };

  const rootCategories = (categories.data ?? [])
    .filter(category => !category.parentId && category.isEnabled !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
  const selectedCount = rootCategories.filter(category => category.taxRelevant).length;
  const data = report.data;
  const currency = data?.currency ?? reserve.data?.currency ?? '';
  const reserveData = reserve.data;
  const reserveConfigured = Boolean(reserveData && (reserveData.vat || reserveData.incomeTax));

  return (
    <Stack spacing={3}>
      {/* The year, and what the page is for on its own line under it. */}
      <Stack spacing={1}>
        <Select
          size="small"
          value={String(year)}
          aria-label={t.yearLabel.value}
          onChange={value => setYear(Number(value))}
          options={Array.from({ length: YEARS_BACK }, (_, index) => {
            const value = thisYear - index;
            return { value: String(value), label: String(value) };
          })}
          sx={{ minWidth: 120, alignSelf: 'flex-start' }}
        />
        <Typography sx={HINT_SX}>{t.intro.value}</Typography>
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
        <Typography sx={{ ...SECTION_TITLE_SX, mb: 2 }}>
          {fill(t.reserveTitle.value, { year: thisYear })}
        </Typography>
        {reserve.isPending ? (
          <CircularProgress size={20} />
        ) : reserveData && reserveConfigured ? (
          <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 3, rowGap: 2 }}>
            <Figure
              label={t.reserveTotal.value}
              value={money(reserveData.total, reserveData.currency)}
            />
            {reserveData.vat ? (
              // Paid more VAT than collected: that is money back, said in words, not a bare minus.
              <Figure
                label={reserveData.vat.net < 0 ? t.reserveVatReclaim.value : t.reserveVat.value}
                value={money(Math.abs(reserveData.vat.net), reserveData.currency)}
              />
            ) : null}
            {reserveData.incomeTax ? (
              <Figure
                label={fill(t.reserveIncomeTax.value, { percent: reserveData.incomeTax.percent })}
                value={money(reserveData.incomeTax.amount, reserveData.currency)}
              />
            ) : null}
            {/* Subtracted from the total, so a minus — but never on a zero. */}
            <Figure
              label={fill(t.reservePaid.value, { count: reserveData.payments.count })}
              value={money(-reserveData.payments.amount, reserveData.currency)}
            />
          </Stack>
        ) : (
          <Typography sx={HINT_SX}>
            {t.reserveNotSet.value}{' '}
            <Link href="/workspaces" style={{ color: 'var(--primary)' }}>
              {t.reserveSetUp.value}
            </Link>
          </Typography>
        )}
        {reserveData && reserveConfigured ? (
          <Typography sx={{ ...HINT_SX, mt: 2 }}>{t.reserveExplain.value}</Typography>
        ) : null}
        {reserveData && reserveData.missingRateCurrencies.length > 0 ? (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {fill(t.missingRates.value, {
              currencies: reserveData.missingRateCurrencies.join(', '),
            })}
          </Alert>
        ) : null}
      </Box>

      {/* Which categories matter: a plain yes/no list, grouped, with a count by the title. */}
      <Box>
        <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={SECTION_TITLE_SX}>{t.categoriesTitle.value}</Typography>
          <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {fill(t.selectedCount.value, { count: selectedCount })}
          </Typography>
        </Stack>
        <Typography sx={{ ...HINT_SX, mt: 0.5, mb: 2 }}>{t.categoriesHint.value}</Typography>
        {(['expense', 'income'] as const).map(type => {
          const group = rootCategories.filter(category => category.type === type);
          if (group.length === 0) {
            return null;
          }
          const groupLabel = type === 'expense' ? t.groupExpenses.value : t.income.value;
          return (
            <Box key={type} role="group" aria-label={groupLabel} sx={{ mb: 2.5 }}>
              <Typography
                sx={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', mb: 0.5 }}
              >
                {groupLabel}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(3, minmax(0, 1fr))',
                  },
                  columnGap: 3,
                  maxWidth: 900,
                }}
              >
                {group.map(category => (
                  <Box
                    key={category.id}
                    component="label"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 0.5,
                      fontSize: 14,
                      color: 'text.primary',
                      cursor: toggleCategory.isPending ? 'default' : 'pointer',
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={Boolean(category.taxRelevant)}
                      disabled={toggleCategory.isPending}
                      onChange={() => toggleCategory.mutate(category)}
                      // A thin outlined box: the app's blank one is a #f5f5f5 fill that
                      // vanishes on the warm page, and a darker fill reads as a heavy block.
                      icon={
                        <Box
                          component="span"
                          sx={{
                            width: 18,
                            height: 18,
                            borderRadius: '4px',
                            border: '1.5px solid',
                            borderColor: theme =>
                              theme.palette.mode === 'dark' ? '#5f5a53' : '#cfc9be',
                            bgcolor: 'var(--card)',
                          }}
                        />
                      }
                      sx={{ p: 0.5 }}
                    />
                    {category.name}
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })}
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
                  const visual = categories.data?.find(entry => entry.id === category.categoryId);
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
                              <Box
                                component="span"
                                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
                              >
                                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <CategoryIconBadge
                                  name={category.name}
                                  color={visual?.color}
                                  icon={visual?.icon}
                                  size={22}
                                />
                              </Box>
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
                          {money(category.total, currency)}
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
                                  ? money(row.amount, row.currency)
                                  : money(row.converted, currency)}
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
        ) : selectedCount > 0 ? (
          <Typography sx={HINT_SX}>{fill(t.emptySelected.value, { year })}</Typography>
        ) : null}
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
        <Typography sx={SECTION_TITLE_SX}>{fill(t.packTitle.value, { year })}</Typography>
        <Typography sx={{ ...HINT_SX, mt: 0.5 }}>{t.packDescription.value}</Typography>
        {/* The trust line sits before the action it is about. */}
        <Typography sx={{ ...HINT_SX, mt: 1, mb: 2 }}>{t.packNote.value}</Typography>
        {/* One main action; the full archive is a quieter text link beside it. */}
        <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
          <Button
            variant="contained"
            disabled={downloading !== null}
            onClick={() => void download('relevant')}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            {downloading === 'relevant' ? t.preparing.value : t.downloadRelevant.value}
          </Button>
          <Button
            variant="text"
            disabled={downloading !== null}
            onClick={() => void download('all')}
            sx={{ textTransform: 'none', fontWeight: 500, px: 0.5 }}
          >
            {downloading === 'all' ? t.preparing.value : t.downloadAll.value}
          </Button>
        </Stack>
      </Box>

      <DatevExportCard year={year} />
    </Stack>
  );
}
