'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useTheme } from 'next-themes';
import type React from 'react';
import { useMemo, useState } from 'react';
import { FromFilterDropdown } from '@/app/(main)/statements/components/filters/FromFilterDropdown';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { DashboardCard } from '@/app/components/dashboard/ui';
import { ChevronDown } from '@/app/components/icons';
import { useWorkspaceMembers } from '@/app/components/transactions/hooks/useWorkspaceMembers';
import { OwnerFilterDropdown } from '@/app/components/transactions/OwnerFilterDropdown';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { LazyECharts } from '@/app/components/ui/lazy-echarts';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { formatMoney } from '@/app/lib/format-money';
import { PERIOD_PRESETS, presetRangeValues } from '../report-period-presets';
import { CashFlowTreemap } from './CashFlowTreemap';
import { buildCashFlowSankey } from './cash-flow.chart';
import { useCashFlowMap } from './useCashFlowMap';

type Text = (key: string, fallback: string) => string;

function Delta({
  amount,
  previous,
  formatAmount,
}: {
  amount: number;
  previous: number | null;
  formatAmount: (value: number) => string;
}): React.JSX.Element | null {
  if (previous === null) return null;
  const delta = amount - previous;
  if (delta === 0) return <span>—</span>;
  // More spending reads as danger, less as success.
  return (
    <Typography
      component="span"
      variant="body2"
      sx={{ color: delta > 0 ? 'error.main' : 'success.main' }}
    >
      {delta > 0 ? '+' : '−'}
      {formatAmount(Math.abs(delta))}
    </Typography>
  );
}

export function CashFlowView(): React.JSX.Element {
  const t = useIntlayer('reportsPage');
  const labels = t.labels as Record<string, { value?: string } | undefined>;
  const text: Text = (key, fallback) => labels[key]?.value ?? fallback;
  const { locale } = useLocale();
  const { resolvedTheme } = useTheme();
  const { data, isPending, isFetching, error, filters, update, exportUrl } = useCashFlowMap();
  const members = useWorkspaceMembers();
  const [preset, setPreset] = useState<string>(PERIOD_PRESETS[0].labelKey);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftCategories, setDraftCategories] = useState<string[]>([]);

  const currency = data?.currency ?? 'KZT';
  const formatAmount = (value: number) => formatMoney(value, currency, locale);
  const option = useMemo(
    () => (data ? buildCashFlowSankey(data, resolvedTheme, formatAmount) : null),
    // formatAmount is rebuilt every render; the chart only needs to follow the data and theme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, resolvedTheme, currency, locale],
  );
  const roots = (data?.availableCategories ?? []).filter(category => !category.parentId);
  const allSelected = filters.categories.length === 0;

  const openFilters = (open: boolean) => {
    // The draft lists every ticked root; the applied filter uses [] for "all".
    if (open) {
      setDraftCategories(
        allSelected
          ? roots.map(category => category.id)
          : filters.categories.filter(id => id !== '__none__'),
      );
    }
    setFiltersOpen(open);
  };

  const applyCategories = () => {
    // Every root ticked is the same as no filter at all; none ticked filters everything out.
    if (draftCategories.length === roots.length) update({ categories: [] });
    else if (draftCategories.length === 0) update({ categories: ['__none__'] });
    else update({ categories: draftCategories });
    setFiltersOpen(false);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const response = await apiClient.get<string>(exportUrl, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as unknown as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cash-flow-${filters.from}-${filters.to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <Select
          size="small"
          value={preset}
          onChange={event => {
            const next = PERIOD_PRESETS.find(item => item.labelKey === event.target.value);
            setPreset(event.target.value);
            if (next) {
              const [from, to] = presetRangeValues(next);
              update({ from, to });
            }
          }}
          inputProps={{ 'aria-label': text('cfPeriod', 'Period') }}
        >
          {PERIOD_PRESETS.map(item => (
            <MenuItem key={item.labelKey} value={item.labelKey}>
              {text(item.labelKey, item.fallback)}
            </MenuItem>
          ))}
          <MenuItem value="custom">{text('cfCustomPeriod', 'Custom')}</MenuItem>
        </Select>
        <CustomDatePicker
          label={text('cfFrom', 'From')}
          value={filters.from}
          onChange={value => {
            setPreset('custom');
            update({ from: value });
          }}
        />
        <CustomDatePicker
          label={text('cfTo', 'To')}
          value={filters.to}
          onChange={value => {
            setPreset('custom');
            update({ to: value });
          }}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={filters.compare}
              onChange={event => update({ compare: event.target.checked })}
            />
          }
          label={text('cfCompare', 'Compare with the period before')}
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={filters.includeTransfers}
              onChange={event => update({ includeTransfers: event.target.checked })}
            />
          }
          label={text('cfIncludeTransfers', 'Include transfers and investments')}
        />
        {roots.length > 0 && (
          <FromFilterDropdown
            open={filtersOpen}
            onOpenChange={openFilters}
            options={roots.map(category => ({ id: category.id, label: category.name }))}
            values={draftCategories}
            onChange={setDraftCategories}
            onApply={applyCategories}
            onReset={() => {
              update({ categories: [] });
              setFiltersOpen(false);
            }}
            trigger={
              <Button size="small" variant="outlined" endIcon={<ChevronDown size={14} />}>
                {text('cfFilters', 'Filters')}
                {allSelected
                  ? ''
                  : ` (${filters.categories.filter(id => id !== '__none__').length})`}
              </Button>
            }
            applyLabel={text('cfApply', 'Apply')}
            resetLabel={text('cfReset', 'Reset')}
          />
        )}
        <OwnerFilterDropdown
          members={members}
          value={filters.owner}
          onChange={owner => update({ owner })}
        />
        <Button size="small" variant="outlined" disabled={!data || exporting} onClick={exportCsv}>
          {text('cfExportCsv', 'Export CSV')}
        </Button>
      </Box>

      {isPending && <Skeleton variant="rounded" height={440} />}
      {error && (
        <Typography color="error" sx={{ py: 2, textAlign: 'center' }}>
          {text('cfError', 'Could not load the cash-flow map')}
        </Typography>
      )}

      {data && (
        <Box
          sx={{
            display: 'grid',
            gap: 3,
            opacity: isFetching ? 0.6 : 1,
            transition: 'opacity 150ms',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 2,
            }}
          >
            {[
              {
                key: 'cfIncome',
                fallback: 'Income',
                value: data.income.total,
                previous: data.previous?.income,
              },
              {
                key: 'cfSpending',
                fallback: 'Spending',
                value: data.expense.total,
                previous: data.previous?.expense,
              },
              { key: 'cfNet', fallback: 'Net', value: data.net, previous: data.previous?.net },
              ...(data.includeTransfers
                ? [
                    {
                      key: 'cfTransfers',
                      fallback: 'Transfers & investments',
                      value: data.transfers,
                      previous: undefined,
                    },
                  ]
                : []),
            ].map(item => (
              <Box
                key={item.key}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 2,
                  bgcolor: 'background.paper',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {text(item.key, item.fallback)}
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {formatAmount(item.value)}
                </Typography>
                {item.previous !== undefined && item.previous !== null && (
                  <Typography variant="caption" color="text.secondary">
                    {text('cfPrevious', 'before')}: {formatAmount(item.previous)}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>

          <DashboardCard title={text('cfSankeyTitle', 'Where the money went')}>
            {data.sankey.links.length > 0 && option ? (
              <LazyECharts option={option} style={{ height: 440, width: '100%' }} notMerge />
            ) : (
              <EmptyState
                illustration="cash-bundle"
                description={text('cfEmpty', 'No money moved in this period')}
                compact
              />
            )}
          </DashboardCard>

          <DashboardCard
            title={text('cfTreemapTitle', 'Spending by size')}
            subtitle={text('cfTreemapHint', 'Click a category to see its subcategories')}
          >
            {data.treemap.length > 0 ? (
              <CashFlowTreemap items={data.treemap} formatAmount={formatAmount} />
            ) : (
              <EmptyState
                illustration="cash-bundle"
                description={text('cfEmpty', 'No money moved in this period')}
                compact
              />
            )}
          </DashboardCard>

          <DashboardCard title={text('cfComparisonTitle', 'By category')}>
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                '& th': { textAlign: 'left', py: 0.75, color: 'text.secondary', fontSize: 12 },
                '& td': { py: 0.75, borderTop: 1, borderColor: 'divider', fontSize: 14 },
              }}
            >
              <thead>
                <tr>
                  <th>{text('cfCategory', 'Category')}</th>
                  <th>{text('cfThisPeriod', 'This period')}</th>
                  {data.previous && <th>{text('cfPreviousPeriod', 'Period before')}</th>}
                  {data.previous && <th>{text('cfChange', 'Change')}</th>}
                </tr>
              </thead>
              <tbody>
                {data.expense.categories.flatMap(category => [
                  <tr key={category.id}>
                    <td>
                      <strong>{category.name}</strong>
                    </td>
                    <td>{formatAmount(category.amount)}</td>
                    {data.previous && <td>{formatAmount(category.previousAmount ?? 0)}</td>}
                    {data.previous && (
                      <td>
                        <Delta
                          amount={category.amount}
                          previous={category.previousAmount}
                          formatAmount={formatAmount}
                        />
                      </td>
                    )}
                  </tr>,
                  ...category.children.map(child => (
                    <tr key={`${category.id}:${child.id}`}>
                      <td style={{ paddingLeft: 24 }}>{child.name}</td>
                      <td>{formatAmount(child.amount)}</td>
                      {data.previous && <td>{formatAmount(child.previousAmount ?? 0)}</td>}
                      {data.previous && (
                        <td>
                          <Delta
                            amount={child.amount}
                            previous={child.previousAmount}
                            formatAmount={formatAmount}
                          />
                        </td>
                      )}
                    </tr>
                  )),
                ])}
              </tbody>
            </Box>
          </DashboardCard>
        </Box>
      )}
    </Box>
  );
}
