'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useTheme } from 'next-themes';
import type React from 'react';
import { useMemo, useState } from 'react';
import { AnalyticsPeriodContext } from '@/app/(main)/statements/components/analytics/flow/analytics-period';
import { FromFilterDropdown } from '@/app/(main)/statements/components/filters/FromFilterDropdown';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { DashboardCard } from '@/app/components/dashboard/ui';
import { ChevronDown, type LucideIcon } from '@/app/components/icons';
import { useWorkspaceMembers } from '@/app/components/transactions/hooks/useWorkspaceMembers';
import { OwnerFilterDropdown } from '@/app/components/transactions/OwnerFilterDropdown';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { LazyECharts } from '@/app/components/ui/lazy-echarts';
import {
  fillTemplateNodes,
  PRIVATE_CLASS,
  PrivateAmount,
} from '@/app/components/ui/private-amount';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { blobOf } from '@/app/lib/blob-of';
import { ArrowLeftRight, Scale, TrayArrowDown, WalletArrowUp } from '@/app/lib/category-line-icons';
import { formatMoney } from '@/app/lib/format-money';
import { usePrivacyMode } from '@/app/lib/privacy-mode';
import { useCategoryName } from '@/app/lib/use-category-name';
import { PERIOD_PRESETS, presetRangeValues } from '../report-period-presets';
import { CashFlowTab } from './CashFlowTab';
import { CashFlowTreemap } from './CashFlowTreemap';
import { buildCashFlowSankey } from './cash-flow.chart';
import { useCashFlowMap } from './useCashFlowMap';

type Text = (key: string, fallback: string) => string;

/** Header actions as words: no frames competing with the period tabs. */
const QUIET_BUTTON_SX = {
  color: 'var(--text-muted)',
  fontWeight: 500,
  textTransform: 'none',
  '&:hover': { color: 'var(--foreground)', bgcolor: 'var(--surface-soft)' },
} as const;

/** A change in spending, in grey: more spending is not an alarm. */
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
  if (Math.round(delta * 100) === 0) return <span>—</span>;
  return (
    <PrivateAmount>
      {delta > 0 ? '+' : '−'}
      {formatAmount(Math.abs(delta))}
    </PrivateAmount>
  );
}

type CashFlowData = NonNullable<ReturnType<typeof useCashFlowMap>['data']>;

/**
 * The categories as numbers: amounts right-aligned in tabular figures, the
 * earlier period named by its dates, the change in grey.
 */
function CategoryTable({
  data,
  previousLabel,
  text,
  formatTile,
}: {
  data: CashFlowData;
  previousLabel: string;
  text: Text;
  formatTile: (value: number) => string;
}): React.JSX.Element {
  const categoryName = useCategoryName();
  const compare = data.previous !== null;
  const row = (
    key: string,
    name: string,
    amount: number,
    previous: number | null,
    child: boolean,
  ) => (
    <tr key={key}>
      <td style={child ? { paddingLeft: 24, color: 'var(--text-muted)' } : { fontWeight: 500 }}>
        {name}
      </td>
      <td className={`num ${PRIVATE_CLASS}`}>{formatTile(amount)}</td>
      {compare && <td className={`num muted ${PRIVATE_CLASS}`}>{formatTile(previous ?? 0)}</td>}
      {compare && (
        <td className="num muted">
          <Delta amount={amount} previous={previous} formatAmount={formatTile} />
        </td>
      )}
    </tr>
  );
  return (
    <Box
      component="table"
      sx={{
        width: '100%',
        borderCollapse: 'collapse',
        '& th': {
          textAlign: 'left',
          py: 1,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-muted)',
        },
        '& td': { py: 1, borderTop: 1, borderColor: 'divider', fontSize: 14 },
        '& .num': { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 },
        '& .muted': { color: 'var(--text-muted)', fontWeight: 400 },
      }}
    >
      <thead>
        <tr>
          <th>{text('cfCategory', 'Category')}</th>
          <th className="num">{text('cfThisPeriod', 'This period')}</th>
          {compare && <th className="num">{previousLabel}</th>}
          {compare && <th className="num">{text('cfChange', 'Change')}</th>}
        </tr>
      </thead>
      <tbody>
        {data.expense.categories.flatMap(category => [
          row(
            category.id,
            categoryName(category.name),
            category.amount,
            category.previousAmount,
            false,
          ),
          ...category.children.map(child =>
            row(
              `${category.id}:${child.id}`,
              categoryName(child.name),
              child.amount,
              child.previousAmount,
              true,
            ),
          ),
        ])}
      </tbody>
    </Box>
  );
}

/** "Aug" for a whole month (with the year when it is not this one), else "Jul 2 – Aug 1". */
export function periodLabel(from: string, to: string, locale: string): string {
  const start = new Date(`${from.slice(0, 10)}T00:00:00`);
  const end = new Date(`${to.slice(0, 10)}T00:00:00`);
  const lastOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const thisYear = start.getFullYear() === new Date().getFullYear();
  if (
    start.getDate() === 1 &&
    end.getFullYear() === start.getFullYear() &&
    end.getMonth() === start.getMonth() &&
    end.getDate() === lastOfMonth
  ) {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      ...(thisYear ? {} : { year: 'numeric' }),
    }).format(start);
  }
  // Built from two plain dates, not Intl's formatRange: Node and the browser
  // space that one differently, and the server's text must match the client's.
  const sameYear = end.getFullYear() === start.getFullYear();
  const withYear = !(thisYear && sameYear);
  const day = (date: Date, year: boolean) =>
    new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      ...(year ? { year: 'numeric' } : {}),
    }).format(date);
  if (start.getTime() === end.getTime()) {
    return day(start, withYear);
  }
  return `${day(start, withYear && !sameYear)} – ${day(end, withYear)}`;
}

/**
 * One figure of the period: label, the amount in whole units (cents in the
 * tooltip), and what it was in the period before — named, not "before". The
 * figure stays ink: spending is not an error. Only Net carries its change, small,
 * terracotta when it fell and sage when it rose. Zero against zero says so in
 * words instead of comparing nothing with nothing. The icon is the dashboard
 * tile's: faint, behind the text, saying what the figure is.
 */
function CashFlowTile({
  label,
  icon: Icon,
  value,
  previous,
  nothing,
  showDelta,
  previousLabel,
  vsTemplate,
  formatWhole,
  formatAmount,
}: {
  label: string;
  icon: LucideIcon;
  value: number;
  previous: number | null;
  nothing: string | null;
  showDelta: boolean;
  previousLabel: string;
  vsTemplate: string;
  formatWhole: (value: number) => string;
  formatAmount: (value: number) => string;
}): React.JSX.Element {
  const bothZero = value === 0 && (previous === null || previous === 0);
  const delta = previous === null ? 0 : value - previous;
  let caption: React.ReactNode = null;
  if (bothZero) {
    // Nothing either time: say so where there are words for it, else stay quiet.
    caption = nothing;
  } else if (previous !== null && previousLabel) {
    caption = (
      <>
        {fillTemplateNodes(vsTemplate.replace('{{period}}', previousLabel), {
          amount: formatWhole(previous),
        })}
        {showDelta && Math.round(delta) !== 0 ? (
          <Box
            component="span"
            className={PRIVATE_CLASS}
            sx={{ ml: 0.75, color: delta < 0 ? 'var(--money-down)' : 'var(--money-up)' }}
          >
            {delta > 0 ? '+' : '−'}
            {formatWhole(Math.abs(delta))}
          </Box>
        ) : null}
      </>
    );
  }
  return (
    <Box
      sx={{
        position: 'relative',
        // Its own stacking context and clip, so the icon sits under the text.
        overflow: 'hidden',
        isolation: 'isolate',
        p: '22px',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Icon className="seneca-dashboard__stat-icon" aria-hidden="true" />
      <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>{label}</Typography>
      <Typography
        sx={{
          mt: 0.5,
          fontSize: 30,
          fontWeight: 500,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--foreground)',
        }}
      >
        <PrivateAmount title={formatAmount(value)}>{formatWhole(value)}</PrivateAmount>
      </Typography>
      {caption ? (
        <Typography sx={{ mt: 0.75, fontSize: 14, color: 'var(--text-muted)' }}>
          {caption}
        </Typography>
      ) : null}
    </Box>
  );
}

export function CashFlowView({ focusId = null }: { focusId?: string | null }): React.JSX.Element {
  const t = useIntlayer('reportsPage');
  const labels = t.labels as Record<string, { value?: string } | undefined>;
  const text: Text = (key, fallback) => labels[key]?.value ?? fallback;
  const { locale } = useLocale();
  const categoryName = useCategoryName();
  const { resolvedTheme } = useTheme();
  const { data, isPending, isFetching, error, filters, update, exportUrl } = useCashFlowMap();
  const members = useWorkspaceMembers();
  const [preset, setPreset] = useState<string>(PERIOD_PRESETS[0].labelKey);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [optionsAnchor, setOptionsAnchor] = useState<HTMLElement | null>(null);
  const [categoriesView, setCategoriesView] = useState<'map' | 'table'>('map');
  const [draftCategories, setDraftCategories] = useState<string[]>([]);

  const currency = data?.currency ?? 'KZT';
  const formatAmount = (value: number) => formatMoney(value, currency, locale);
  // Whole units from 100 up, where cents are noise; below that rounding would lie
  // ($0.78 is not "$1"). The exact amount is in the tooltip either way.
  const formatWhole = (value: number) =>
    formatMoney(value, currency, locale, {
      fractionDigits: Math.abs(value) >= 100 || Number.isInteger(value) ? 0 : 2,
    }).replace('-', '−');
  const currentLabel = periodLabel(filters.from, filters.to, locale);
  const analyticsPeriod = useMemo(
    () => ({ from: filters.from, to: filters.to, label: currentLabel }),
    [filters.from, filters.to, currentLabel],
  );
  const previousLabel = data?.previousPeriod
    ? periodLabel(data.previousPeriod.from, data.previousPeriod.to, locale)
    : '';
  const isMobile = useIsMobile();
  const privacy = usePrivacyMode();
  const option = useMemo(
    () =>
      data
        ? buildCashFlowSankey(data, resolvedTheme, formatAmount, isMobile, categoryName, privacy)
        : null,
    // formatAmount is rebuilt every render; the chart only needs to follow the data and theme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, resolvedTheme, currency, locale, isMobile, categoryName, privacy],
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
      const response = await apiClient.get(exportUrl, { responseType: 'blob' });
      const url = URL.createObjectURL(blobOf(response));
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
    // minmax(0, 1fr): an implicit column grows to its widest child, and the charts'
    // canvases keep the pixel width they were drawn at, so opening the sidebar
    // pushed the page sideways instead of narrowing the charts.
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 3 }}>
      {/* One period for the whole tab: text tabs, the range in words under them,
          dates only for Custom; the switches live in Options, export is a link. */}
      <Box sx={{ display: 'grid', gap: 1 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <TextTabs
            value={preset}
            ariaLabel={text('cfPeriod', 'Period')}
            onChange={value => {
              setPreset(value);
              const next = PERIOD_PRESETS.find(item => item.labelKey === value);
              if (next) {
                const [from, to] = presetRangeValues(next);
                update({ from, to });
              }
            }}
            options={[
              ...PERIOD_PRESETS.map(item => ({
                value: item.labelKey,
                label: text(item.labelKey, item.fallback),
              })),
              { value: 'custom', label: text('cfCustomPeriod', 'Custom') },
            ]}
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            {roots.length > 0 && (
              <FromFilterDropdown
                open={filtersOpen}
                onOpenChange={openFilters}
                options={roots.map(category => ({
                  id: category.id,
                  label: categoryName(category.name),
                }))}
                values={draftCategories}
                onChange={setDraftCategories}
                onApply={applyCategories}
                onReset={() => {
                  update({ categories: [] });
                  setFiltersOpen(false);
                }}
                trigger={
                  <Button
                    size="small"
                    variant="text"
                    endIcon={<ChevronDown size={14} />}
                    sx={QUIET_BUTTON_SX}
                  >
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
            <Button
              size="small"
              variant="text"
              endIcon={<ChevronDown size={14} />}
              sx={QUIET_BUTTON_SX}
              aria-haspopup="menu"
              onClick={event => setOptionsAnchor(event.currentTarget)}
            >
              {text('cfOptions', 'Options')}
            </Button>
            <Menu
              anchorEl={optionsAnchor}
              open={optionsAnchor !== null}
              onClose={() => setOptionsAnchor(null)}
            >
              <MenuItem onClick={() => update({ compare: !filters.compare })}>
                <Checkbox size="small" checked={filters.compare} sx={{ p: 0.5, mr: 1 }} />
                {text('cfCompare', 'Compare with the period before')}
              </MenuItem>
              <MenuItem onClick={() => update({ includeTransfers: !filters.includeTransfers })}>
                <Checkbox size="small" checked={filters.includeTransfers} sx={{ p: 0.5, mr: 1 }} />
                {text('cfIncludeTransfers', 'Include transfers and investments')}
              </MenuItem>
            </Menu>
            <Button
              size="small"
              variant="text"
              disabled={!data || exporting}
              onClick={exportCsv}
              sx={QUIET_BUTTON_SX}
            >
              {text('cfExportCsv', 'Export CSV')}
            </Button>
          </Box>
        </Box>
        {preset === 'custom' ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, maxWidth: 420 }}>
            <Box sx={{ flex: '1 1 180px' }}>
              <CustomDatePicker
                compact
                value={filters.from}
                onChange={value => update({ from: value })}
                maxDate={filters.to || undefined}
              />
            </Box>
            <Box sx={{ flex: '1 1 180px' }}>
              <CustomDatePicker
                compact
                value={filters.to}
                onChange={value => update({ to: value })}
                minDate={filters.from || undefined}
              />
            </Box>
          </Box>
        ) : null}
        <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {currentLabel}
          {filters.compare && previousLabel
            ? ` · ${text('cfComparedWith', 'compared with {{period}}').replace('{{period}}', previousLabel)}`
            : ''}
        </Typography>
      </Box>

      {isPending && <Skeleton variant="rounded" height={440} />}
      {error && (
        <Typography color="error" sx={{ py: 2, textAlign: 'center' }}>
          {text('cfError', 'Could not load the cash-flow map')}
        </Typography>
      )}

      {data && (
        <Box
          data-tour-shot="reports-flow"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 3,
            opacity: isFetching ? 0.6 : 1,
            transition: 'opacity 150ms',
          }}
        >
          {/* Narrow tiles from the left: a 30px figure fills one; three full-width cards left it lost. */}
          <Box
            sx={{
              display: 'grid',
              // A phone fits one tile per row; a fixed-width tile there left a ragged gap on the right.
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(auto-fill, minmax(240px, 320px))',
              },
              gap: 2,
            }}
          >
            {[
              {
                key: 'cfIncome',
                fallback: 'Income',
                icon: TrayArrowDown,
                value: data.income.total,
                previous: data.previous?.income,
                nothing: text('cfNoIncome', 'No income recorded'),
              },
              {
                key: 'cfSpending',
                fallback: 'Spending',
                icon: WalletArrowUp,
                value: data.expense.total,
                previous: data.previous?.expense,
                nothing: text('cfNoSpending', 'No spending recorded'),
              },
              {
                key: 'cfNet',
                fallback: 'Net',
                icon: Scale,
                value: data.net,
                previous: data.previous?.net,
                nothing: null,
                showDelta: true,
              },
              ...(data.includeTransfers
                ? [
                    {
                      key: 'cfTransfers',
                      fallback: 'Transfers & investments',
                      icon: ArrowLeftRight,
                      value: data.transfers,
                      previous: undefined,
                      nothing: null,
                    },
                  ]
                : []),
            ].map(item => (
              <CashFlowTile
                key={item.key}
                label={text(item.key, item.fallback)}
                icon={item.icon}
                value={item.value}
                previous={item.previous ?? null}
                nothing={item.nothing}
                showDelta={'showDelta' in item && item.showDelta === true}
                previousLabel={previousLabel}
                vsTemplate={text('cfVsPeriod', 'vs {{amount}} in {{period}}')}
                formatWhole={formatWhole}
                formatAmount={formatAmount}
              />
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

          {/* One card for the categories: the map by size, or the same numbers as a table. */}
          <DashboardCard
            title={text('cfComparisonTitle', 'By category')}
            subtitle={
              categoriesView === 'map' && data.treemap.length > 1
                ? text('cfTreemapHint', 'Click a category to see its subcategories')
                : undefined
            }
            action={
              data.treemap.length > 1 ? (
                <TextTabs
                  value={categoriesView}
                  onChange={setCategoriesView}
                  ariaLabel={text('cfComparisonTitle', 'By category')}
                  options={[
                    { value: 'map', label: text('cfViewMap', 'Map') },
                    { value: 'table', label: text('cfViewTable', 'Table') },
                  ]}
                />
              ) : undefined
            }
          >
            {data.treemap.length === 0 ? (
              <EmptyState
                illustration="cash-bundle"
                description={text('cfEmpty', 'No money moved in this period')}
                compact
              />
            ) : categoriesView === 'map' && data.treemap.length > 1 ? (
              <CashFlowTreemap items={data.treemap} formatAmount={formatAmount} />
            ) : (
              <CategoryTable
                data={data}
                previousLabel={previousLabel || text('cfPreviousPeriod', 'Period before')}
                text={text}
                formatTile={formatWhole}
              />
            )}
          </DashboardCard>
        </Box>
      )}

      {/* The leaderboards follow the same period; with nothing moved, the card above already says so. */}
      {data && (data.income.total !== 0 || data.expense.total !== 0) ? (
        <AnalyticsPeriodContext.Provider value={analyticsPeriod}>
          <CashFlowTab focusId={focusId} />
        </AnalyticsPeriodContext.Provider>
      ) : null}
    </Box>
  );
}
