'use client';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  MenuItem,
  Select,
  Skeleton,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';

import { Pencil, Trash2 } from '@/app/components/icons';
import { ImportFromFileButton } from '@/app/components/import-wizard/ImportFromFileButton';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { VendorIcon } from '@/app/components/VendorIcon';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { resolveLocaleTag } from '@/app/lib/user-format';
import {
  formatStoredDateWithOptions,
  readStoredFormatPreferences,
} from '@/app/lib/user-format-store';
import type {
  SubscriptionChargeCalendar,
  SubscriptionFormData,
  SubscriptionItem,
  SubscriptionSummary,
  SubscriptionWorkspaceMember,
} from '../hooks/useSubscriptionsPage';
import { RISK_LABELS, STATUS_LABELS, SubscriptionCard } from './SubscriptionCard';
import { SubscriptionDetailsDrawer } from './SubscriptionDetailsDrawer';
import { SubscriptionFormDrawer } from './SubscriptionFormDrawer';
import { filterSubscriptions } from './subscription-filter.utils';

// Its own chunk: the matrix only renders for workspaces with enough
// subscriptions to need it.
const LazyChargeCalendar = dynamic(
  () => import('./SubscriptionChargeCalendar').then(module => module.SubscriptionChargeCalendar),
  { ssr: false, loading: () => <Skeleton variant="rounded" width="100%" height={220} /> },
);

// A workspace needs a handful of subscriptions before a matrix says more than
// the table already does.
const CALENDAR_MIN_SUBSCRIPTIONS = 5;

interface SubscriptionsContentProps {
  subscriptions: SubscriptionItem[];
  summary: SubscriptionSummary;
  chargeCalendar: SubscriptionChargeCalendar;
  workspaceCurrency: string;
  workspaceMembers: SubscriptionWorkspaceMember[];
  isPending: boolean;
  isFetching: boolean;
  error: string | null;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  dialogOpen: boolean;
  editingSubscription: SubscriptionItem | null;
  formData: SubscriptionFormData;
  setFormData: (data: SubscriptionFormData) => void;
  saving: boolean;
  openCreate: () => void;
  invalidate: () => Promise<void>;
  openEdit: (subscription: SubscriptionItem) => void;
  closeDialog: () => void;
  handleSave: () => void;
  handleDelete: (id: string) => void;
  handleConfirm: (id: string) => void;
  handleDismiss: (id: string) => void;
  assignOwner: (id: string, ownerId: string) => Promise<void>;
  recordDecision: (
    id: string,
    decision: 'keep' | 'review' | 'cancelled' | 'price_reduced',
    values?: { note?: string; reviewAt?: string; realizedAnnualSavings?: number },
  ) => Promise<void>;
  recordUsage?: (id: string) => Promise<void>;
  createSinkingFund?: (id: string) => Promise<void>;
  duplicateIds?: Set<string>;
}

function SubscriptionRowSkeleton(): React.JSX.Element {
  return (
    <tr>
      <td>
        <Skeleton variant="text" width={140} height={20} />
        <Skeleton variant="text" width={70} height={16} />
      </td>
      <td>
        <Skeleton variant="text" width={80} height={20} />
      </td>
      <td>
        <Skeleton variant="text" width={70} height={20} />
      </td>
      <td>
        <Skeleton variant="text" width={100} height={20} />
      </td>
      <td>
        <Skeleton variant="text" width={60} height={20} />
      </td>
      <td>
        <Skeleton variant="text" width={70} height={20} />
      </td>
    </tr>
  );
}

function SubscriptionCardSkeleton(): React.JSX.Element {
  return (
    <Card variant="outlined">
      <CardContent sx={{ pb: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}
        >
          <Box>
            <Skeleton variant="text" width={120} height={22} />
            <Skeleton variant="text" width={90} height={26} />
          </Box>
          <Skeleton variant="rounded" width={60} height={22} />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
          <Skeleton variant="text" width={80} height={18} />
          <Skeleton variant="text" width={70} height={18} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Skeleton variant="circular" width={28} height={28} />
          <Skeleton variant="circular" width={28} height={28} />
        </Box>
      </CardContent>
    </Card>
  );
}

const formatAmount = (amount: number, currency: string) =>
  `${new Intl.NumberFormat(resolveLocaleTag(readStoredFormatPreferences().locale), { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
const formatMonthLabel = (month: string) =>
  formatStoredDateWithOptions(`${month}-01`, { month: 'short', year: '2-digit' });
const formatDate = (date: string | null) =>
  date ? formatStoredDateWithOptions(date, { day: 'numeric', month: 'short' }) : '—';

export function SubscriptionsContent(props: SubscriptionsContentProps) {
  const t = useIntlayer('subscriptionsPage');
  const [search, setSearch] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [category, setCategory] = useState('');
  const [riskStatus, setRiskStatus] = useState('');
  const [selected, setSelected] = useState<SubscriptionItem | null>(null);
  const [view, setView] = useState<'list' | 'matrix'>('list');
  const visibleSubscriptions = useMemo(
    () =>
      filterSubscriptions(props.subscriptions, {
        search,
        ownerId,
        categoryId: category,
        riskStatus,
      }),
    [props.subscriptions, search, ownerId, category, riskStatus],
  );
  const categories = useMemo(
    () => [
      ...new Set(
        props.subscriptions
          .map(item => item.category?.name)
          .filter((name): name is string => Boolean(name)),
      ),
    ],
    [props.subscriptions],
  );

  const monthLabels = useMemo(
    () => props.chargeCalendar.months.map(month => formatMonthLabel(month)),
    [props.chargeCalendar.months],
  );
  const showCalendar =
    !props.isPending &&
    props.summary.activeCount >= CALENDAR_MIN_SUBSCRIPTIONS &&
    props.chargeCalendar.rows.length > 0;
  const matrixView = showCalendar && view === 'matrix';
  // The toolbar filters both views, so the matrix keeps only visible
  // subscriptions and totals what is left.
  const visibleCalendar = useMemo(() => {
    const visibleIds = new Set(visibleSubscriptions.map(item => item.id));
    const rows = props.chargeCalendar.rows.filter(row => visibleIds.has(row.subscriptionId));
    return {
      ...props.chargeCalendar,
      rows,
      monthTotals: props.chargeCalendar.months.map((_, index) =>
        rows.reduce((sum, row) => sum + (row.amounts[index] ?? 0), 0),
      ),
    };
  }, [props.chargeCalendar, visibleSubscriptions]);

  return (
    <Box
      sx={{
        px: { xs: 2, md: 3 },
        pt: 'var(--lumio-page-top, 16px)',
        pb: { xs: 2, md: 3 },
        flex: 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 3,
        }}
      >
        {/* The MuiTabs root itself gets a negative margin from the theme's
            scrollable-tabs focus-ring override, which cancels an sx margin
            set directly on it — so the spacing lives on this row instead. */}
        <Tabs
          value={props.statusFilter}
          onChange={(_, value) => props.setStatusFilter(value)}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab value="all" label={t.tabAll.value} />
          <Tab value="detected" label={t.tabDetected.value} />
          <Tab value="active" label={t.tabActive.value} />
          <Tab value="paused" label={t.tabPaused.value} />
          <Tab value="cancelled" label={t.tabCancelled.value} />
        </Tabs>
        <Box sx={{ display: 'flex', gap: 1.5, ml: 'auto', flexShrink: 0 }}>
          <ImportFromFileButton
            target="subscriptions"
            onImported={() => void props.invalidate()}
            renderTrigger={(open, label) => (
              <Button variant="outlined" onClick={open}>
                {label}
              </Button>
            )}
          />
          <Button
            variant="outlined"
            onClick={() => {
              void apiClient
                .get<Blob>('/subscriptions/business-report', {
                  params: { format: 'csv' },
                  responseType: 'blob',
                })
                .then(response => {
                  const url = URL.createObjectURL(response.data);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'business-subscriptions.csv';
                  link.click();
                  URL.revokeObjectURL(url);
                });
            }}
          >
            {t.businessReport}
          </Button>
          <Button variant="contained" onClick={props.openCreate}>
            {t.addSubscription}
          </Button>
        </Box>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 2,
          mb: 3,
        }}
      >
        {[
          {
            label: t.kpiMonthlyCost.value,
            value: formatAmount(props.summary.totalMonthlyCost, props.workspaceCurrency),
          },
          { label: t.kpiForecast.value, value: String(props.summary.upcoming30DaysCount) },
          {
            label: t.kpiPriceChanges.value,
            // The yearly effect is the number people actually ask for.
            value: props.summary.priceChangeYearlyEffect
              ? `${props.summary.priceChangeCount} · ${t.yearlyEffect.value.replace(
                  '{{amount}}',
                  formatAmount(props.summary.priceChangeYearlyEffect, props.workspaceCurrency),
                )}`
              : String(props.summary.priceChangeCount),
            // Only a count that needs attention gets a colour.
            accent: props.summary.priceChangeCount > 0 ? 'warning.main' : undefined,
          },
          {
            label: t.kpiDuplicates.value,
            value: String(props.summary.duplicateCount ?? 0),
            accent: props.summary.duplicateCount ? 'warning.main' : undefined,
          },
          {
            label: t.kpiReviewsOverdue.value,
            value: String(props.summary.overdueReviewCount),
            accent: props.summary.overdueReviewCount > 0 ? 'error.main' : undefined,
          },
          {
            label: t.realizedAnnualSavings.value,
            value: formatAmount(props.summary.realizedAnnualSavings, props.workspaceCurrency),
          },
        ].map(({ label, value, accent }) => (
          <Card key={label} variant="outlined">
            <CardContent sx={{ py: 1.75, '&:last-child': { pb: 1.75 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {label}
              </Typography>
              <Typography
                sx={{
                  mt: 0.5,
                  fontSize: 26,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  fontVariantNumeric: 'tabular-nums',
                  color: accent ?? 'text.primary',
                }}
              >
                {value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.5,
          mb: 2,
        }}
      >
        <TextField
          size="small"
          label={t.searchLabel.value}
          value={search}
          onChange={event => setSearch(event.target.value)}
          sx={{ width: { xs: '100%', md: 280 } }}
        />
        <Select
          size="small"
          displayEmpty
          value={ownerId}
          sx={{ minWidth: 160, flex: { xs: '1 1 140px', md: '0 0 auto' } }}
          onChange={event => setOwnerId(event.target.value)}
        >
          <MenuItem value="">{t.allOwners}</MenuItem>
          {props.workspaceMembers.map(member => (
            <MenuItem key={member.id} value={member.id}>
              {member.name || member.email || member.id}
            </MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          displayEmpty
          value={category}
          sx={{ minWidth: 160, flex: { xs: '1 1 140px', md: '0 0 auto' } }}
          onChange={event => setCategory(event.target.value)}
        >
          <MenuItem value="">{t.allCategories}</MenuItem>
          {categories.map(name => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          displayEmpty
          value={riskStatus}
          sx={{ minWidth: 160, flex: { xs: '1 1 140px', md: '0 0 auto' } }}
          onChange={event => setRiskStatus(event.target.value)}
        >
          <MenuItem value="">{t.allRisks}</MenuItem>
          <MenuItem value="price_changed">{t.riskPriceChanged}</MenuItem>
          <MenuItem value="date_shifted">{t.riskDateShifted}</MenuItem>
          <MenuItem value="missing_charge">{t.riskMissingCharge}</MenuItem>
        </Select>
        {showCalendar && (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_event, next: 'list' | 'matrix' | null) => next && setView(next)}
            aria-label={t.viewToggleLabel.value}
            sx={{ ml: { md: 'auto' } }}
          >
            <ToggleButton value="list" sx={{ px: 1.5, textTransform: 'none' }}>
              {t.viewList}
            </ToggleButton>
            <ToggleButton value="matrix" sx={{ px: 1.5, textTransform: 'none' }}>
              {t.upcomingCharges}
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Box>
      {props.isPending ? (
        <>
          <Box
            sx={{
              display: { xs: 'none', md: 'block' },
              overflowX: 'auto',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              // A CSS variable, not the theme colour: it turns translucent over a content background.
              bgcolor: 'var(--card-bg)',
            }}
          >
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                '& th': { textAlign: 'left', p: 1.5, color: 'text.secondary', fontSize: 12 },
                '& td': { p: 1.5, borderTop: 1, borderColor: 'divider' },
              }}
            >
              <thead>
                <tr>
                  <th>{t.colVendor}</th>
                  <th>{t.colSpend}</th>
                  <th>{t.colNextCharge}</th>
                  <th>{t.colOwner}</th>
                  <th>{t.colRisk}</th>
                  <th>{t.colReview}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                  <SubscriptionRowSkeleton key={index} />
                ))}
              </tbody>
            </Box>
          </Box>
          <Box sx={{ display: { xs: 'grid', md: 'none' }, gridTemplateColumns: '1fr', gap: 1.5 }}>
            {Array.from({ length: 4 }).map((_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <SubscriptionCardSkeleton key={index} />
            ))}
          </Box>
        </>
      ) : props.error ? (
        <Typography color="error" sx={{ py: 4, textAlign: 'center' }}>
          {props.error}
        </Typography>
      ) : visibleSubscriptions.length === 0 || (matrixView && visibleCalendar.rows.length === 0) ? (
        <EmptyState
          illustration="subscriptions"
          description={t.emptyFiltered}
          action={
            <Button variant="outlined" onClick={props.openCreate}>
              {t.addSubscription}
            </Button>
          }
        />
      ) : matrixView ? (
        <LazyChargeCalendar
          calendar={visibleCalendar}
          monthLabels={monthLabels}
          formatAmount={amount =>
            formatAmount(amount, props.chargeCalendar.currency ?? props.workspaceCurrency)
          }
          renderVendor={row => (
            <VendorIcon vendorName={row.vendorName} vendorDomain={row.vendorDomain} size={18} />
          )}
        />
      ) : (
        // Фоновое обновление после действия в строке не гасит список скелетоном.
        <Box sx={{ opacity: props.isFetching ? 0.6 : 1, transition: 'opacity 150ms ease' }}>
          <Box
            sx={{
              display: { xs: 'none', md: 'block' },
              overflowX: 'auto',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              // A CSS variable, not the theme colour: it turns translucent over a content background.
              bgcolor: 'var(--card-bg)',
            }}
          >
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                '& th': { textAlign: 'left', p: 1.5, color: 'text.secondary', fontSize: 12 },
                '& td': { p: 1.5, borderTop: 1, borderColor: 'divider' },
                '& tbody tr': { cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } },
              }}
            >
              <thead>
                <tr>
                  <th>{t.colVendor}</th>
                  <th>{t.colSpend}</th>
                  <th>{t.colNextCharge}</th>
                  <th>{t.colOwner}</th>
                  <th>{t.colRisk}</th>
                  <th>{t.colReview}</th>
                  <th aria-label={t.colActions.value} />
                </tr>
              </thead>
              <tbody>
                {visibleSubscriptions.map(subscription => (
                  <tr
                    key={subscription.id}
                    data-attention={`subscription:${subscription.id}`}
                    onClick={() => setSelected(subscription)}
                  >
                    <td>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <VendorIcon
                          vendorName={subscription.vendorName}
                          vendorDomain={subscription.vendorDomain}
                        />
                        <Box>
                          <Typography fontWeight={600}>{subscription.vendorName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t[STATUS_LABELS[subscription.status]]}
                            {props.duplicateIds?.has(subscription.id) && <> · {t.duplicateChip}</>}
                          </Typography>
                        </Box>
                      </Box>
                    </td>
                    <td>{formatAmount(subscription.amount, subscription.currency)}</td>
                    <td>{formatDate(subscription.nextChargeDate)}</td>
                    <td>{subscription.owner?.name || subscription.owner?.email || t.unassigned}</td>
                    <td>
                      {subscription.riskStatus === 'none'
                        ? '—'
                        : t[RISK_LABELS[subscription.riskStatus]]}
                    </td>
                    <td>{formatDate(subscription.reviewAt)}</td>
                    <td onClick={event => event.stopPropagation()}>
                      <IconButton size="small" onClick={() => props.openEdit(subscription)}>
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => props.handleDelete(subscription.id)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </Box>
          <Box sx={{ display: { xs: 'grid', md: 'none' }, gridTemplateColumns: '1fr', gap: 1.5 }}>
            {visibleSubscriptions.map(subscription => (
              <SubscriptionCard
                key={subscription.id}
                subscription={subscription}
                onEdit={() => props.openEdit(subscription)}
                onDelete={() => props.handleDelete(subscription.id)}
                onConfirm={() => props.handleConfirm(subscription.id)}
                onDismiss={() => props.handleDismiss(subscription.id)}
                onUse={props.recordUsage && (() => props.recordUsage?.(subscription.id))}
                onSinkingFund={
                  props.createSinkingFund && (() => props.createSinkingFund?.(subscription.id))
                }
                duplicate={props.duplicateIds?.has(subscription.id)}
              />
            ))}
          </Box>
        </Box>
      )}
      <SubscriptionDetailsDrawer
        subscription={selected}
        members={props.workspaceMembers}
        onClose={() => setSelected(null)}
        onAssignOwner={props.assignOwner}
        onDecision={props.recordDecision}
      />
      <SubscriptionFormDrawer
        open={props.dialogOpen}
        formData={props.formData}
        setFormData={props.setFormData}
        saving={props.saving}
        isEditing={Boolean(props.editingSubscription)}
        onSave={props.handleSave}
        onClose={props.closeDialog}
      />
    </Box>
  );
}
