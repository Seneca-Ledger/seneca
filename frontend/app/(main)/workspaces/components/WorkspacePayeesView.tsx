'use client';

import { alpha, Box, Button, Skeleton, TextField, type Theme, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Search as SearchIcon } from '@/app/components/icons';
import { offerAction } from '@/app/components/payees/offer-action-toast';
import type { Payee, PayeeMode } from '@/app/components/payees/types';
import {
  useMergePayees,
  usePayeesList,
  useRecheckPayeeVat,
  useUpdatePayee,
} from '@/app/components/payees/usePayees';
import type { Category } from '@/app/components/transactions/types';
import { Checkbox } from '@/app/components/ui/checkbox';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { AppPagination } from '@/app/components/ui/pagination';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import { tokens } from '@/lib/theme-tokens';

const PAGE_SIZE = 50;
const CATEGORIES_STALE_TIME = 5 * 60 * 1000;
const ROW_SKELETON_KEYS = ['row-0', 'row-1', 'row-2', 'row-3', 'row-4', 'row-5'];

const HAIRLINE = (theme: Theme): string => alpha(theme.palette.text.primary, 0.06);

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

/** The payee id a 409 on rename points at: the payee that already has the name. */
function takenBy(error: unknown): string | null {
  const data = (error as { response?: { status?: number; data?: unknown } })?.response;
  if (data?.status !== 409) return null;
  const body = JSON.stringify(data.data ?? {});
  return /"payeeId":"([0-9a-f-]{36})"/.exec(body)?.[1] ?? null;
}

/** What VIES last said about the payee's VAT number, with a way to ask again. */
function VatIdStatusLine({
  payee,
  busy,
  onRecheck,
}: {
  payee: Payee;
  busy: boolean;
  onRecheck: () => void;
}) {
  const t = useIntlayer('payees');
  if (!(payee.vatId && payee.vatIdCheckedAt)) {
    return null;
  }
  const text =
    payee.vatIdStatus === 'valid'
      ? payee.vatIdName
        ? fill(t.vatValidNamed.value, { name: payee.vatIdName })
        : t.vatValid.value
      : payee.vatIdStatus === 'invalid'
        ? t.vatInvalid.value
        : t.vatUnchecked.value;
  const color =
    payee.vatIdStatus === 'valid'
      ? 'success.main'
      : payee.vatIdStatus === 'invalid'
        ? 'error.main'
        : 'text.secondary';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Typography
        variant="caption"
        noWrap
        data-testid="payee-vat-status"
        sx={{ color }}
        title={payee.vatIdName ?? undefined}
      >
        {text}
      </Typography>
      {payee.vatIdStatus !== 'valid' ? (
        <Button
          size="small"
          disabled={busy}
          onClick={onRecheck}
          sx={{ minWidth: 0, py: 0, fontSize: 12 }}
        >
          {t.vatRecheck.value}
        </Button>
      ) : null}
    </Box>
  );
}

/**
 * YNAB's "Manage Payees": every payee with what it files as, how it is
 * categorised (learn, always one category, never), renaming, and merging the
 * duplicates a bank's changing descriptors leave behind.
 */
export default function WorkspacePayeesView() {
  const t = useIntlayer('payees');
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [mergeTarget, setMergeTarget] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [vatEditing, setVatEditing] = useState<{
    id: string;
    countryCode: string;
    vatId: string;
    supplyType: '' | 'goods' | 'services';
  } | null>(null);

  const { data, isPending } = usePayeesList(deferredSearch, PAGE_SIZE, page);
  const payees = data?.data ?? [];
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) => apiQuery<Category[]>({ url: '/categories', signal }),
    staleTime: CATEGORIES_STALE_TIME,
    enabled: Boolean(workspaceId),
  });
  const updatePayee = useUpdatePayee();
  const mergePayees = useMergePayees();
  const recheckVat = useRecheckPayeeVat();
  const busy = updatePayee.isPending || mergePayees.isPending || recheckVat.isPending;

  const categoryOptions = useMemo(
    () =>
      (categoriesQuery.data ?? [])
        .filter(category => category.isEnabled !== false)
        .map(category => ({ value: category.id, label: getCategoryDisplayName(category, locale) })),
    [categoriesQuery.data, locale],
  );
  const modeOptions = [
    { value: 'auto', label: t.modeAuto.value },
    { value: 'always', label: t.modeAlways.value },
    { value: 'never', label: t.modeNever.value },
  ];
  const selectedPayees = payees.filter(payee => selected.has(payee.id));

  const save = (
    id: string,
    body: {
      name?: string;
      mode?: PayeeMode;
      categoryId?: string | null;
      countryCode?: string | null;
      vatId?: string | null;
      supplyType?: 'goods' | 'services' | null;
    },
    announce: (updated: Payee) => void = () => toast.success(t.saved.value),
  ) =>
    updatePayee
      .mutateAsync({ id, ...body })
      .then(updated => {
        announce(updated);
        return true;
      })
      .catch((error: unknown) => {
        const existing = takenBy(error);
        if (existing) {
          offerAction({
            message: t.nameTaken.value,
            applyLabel: t.merge.value,
            dismissLabel: t.cancel.value,
            onApply: () => merge(existing, [id]),
          });
        } else {
          toast.error(getApiErrorMessage(error, t.failed.value));
        }
        return false;
      });

  /** Says what VIES made of the number just saved or checked. */
  const announceVatCheck = (updated: Payee) => {
    if (!(updated.vatId && updated.vatIdCheckedAt)) {
      toast.success(t.saved.value);
    } else if (updated.vatIdStatus === 'valid') {
      toast.success(t.vatSavedValid.value);
    } else if (updated.vatIdStatus === 'invalid') {
      toast.error(t.vatSavedInvalid.value);
    } else {
      toast(t.vatSavedUnchecked.value);
    }
  };

  const merge = (targetId: string, sourceIds: string[]) => {
    void mergePayees
      .mutateAsync({ targetId, sourceIds })
      .then(() => {
        toast.success(t.merged.value);
        setSelected(new Set());
        setMergeTarget('');
      })
      .catch((error: unknown) => toast.error(getApiErrorMessage(error, t.failed.value)));
  };

  const changeMode = (payee: Payee, mode: string) => {
    if (mode === 'always') {
      // "Always" needs its category: start from what the payee files as now.
      const categoryId =
        payee.category?.id ?? payee.defaultCategory?.id ?? categoryOptions[0]?.value;
      if (categoryId) void save(payee.id, { mode: 'always', categoryId });
      return;
    }
    void save(payee.id, { mode: mode as PayeeMode });
  };

  const toggle = (id: string) =>
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderRow = (payee: Payee) => {
    const isRenaming = renaming?.id === payee.id;
    const filesAs = payee.defaultCategory
      ? fill(t.filesAs.value, { category: payee.defaultCategory.name })
      : t.noDefault.value;
    return (
      <Box
        key={payee.id}
        data-testid="payee-row"
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: { xs: 'wrap', md: 'nowrap' },
          gap: 1.5,
          px: 1.5,
          py: 1.25,
          borderBottom: '1px solid',
          borderColor: HAIRLINE,
        }}
      >
        <Checkbox
          checked={selected.has(payee.id)}
          onCheckedChange={() => toggle(payee.id)}
          aria-label={payee.name}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {isRenaming ? (
            <Box
              component="form"
              sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
              onSubmit={event => {
                event.preventDefault();
                const value = renaming.value.trim();
                if (!value || value === payee.name) {
                  setRenaming(null);
                  return;
                }
                void save(payee.id, { name: value }).then(ok => ok && setRenaming(null));
              }}
            >
              <TextField
                size="small"
                autoFocus
                value={renaming.value}
                onChange={event => setRenaming({ id: payee.id, value: event.target.value })}
                inputProps={{ 'aria-label': t.rename.value, maxLength: 200 }}
                sx={{ flex: 1 }}
              />
              <Button type="submit" size="small" variant="contained" disabled={busy}>
                {t.save.value}
              </Button>
              <Button size="small" onClick={() => setRenaming(null)}>
                {t.cancel.value}
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap title={payee.name}>
                {payee.name}
              </Typography>
              <Button
                size="small"
                aria-label={t.rename.value}
                title={t.rename.value}
                onClick={() => setRenaming({ id: payee.id, value: payee.name })}
                sx={{ minWidth: 0, p: 0.5, opacity: 0.6, '&:hover': { opacity: 1 } }}
              >
                <Pencil size={14} />
              </Button>
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {filesAs} · {fill(t.transactionsCount.value, { count: payee.transactionCount })}
            {payee.countryCode || payee.vatId
              ? ` · ${[payee.countryCode, payee.vatId].filter(Boolean).join(' ')}`
              : ''}
          </Typography>
          <VatIdStatusLine
            payee={payee}
            busy={busy}
            onRecheck={() =>
              void recheckVat
                .mutateAsync(payee.id)
                .then(announceVatCheck)
                .catch((error: unknown) => toast.error(getApiErrorMessage(error, t.failed.value)))
            }
          />
          {vatEditing?.id === payee.id && (
            <Box
              component="form"
              data-testid="payee-vat-form"
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mt: 1 }}
              onSubmit={event => {
                event.preventDefault();
                const countryCode = vatEditing.countryCode.trim().toUpperCase();
                if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
                  toast.error(t.countryCodeInvalid.value);
                  return;
                }
                void save(
                  payee.id,
                  {
                    countryCode: countryCode || null,
                    vatId: vatEditing.vatId.trim() || null,
                    supplyType: vatEditing.supplyType || null,
                  },
                  announceVatCheck,
                ).then(ok => ok && setVatEditing(null));
              }}
            >
              <TextField
                size="small"
                autoFocus
                label={t.countryCode.value}
                value={vatEditing.countryCode}
                onChange={event =>
                  setVatEditing({ ...vatEditing, countryCode: event.target.value })
                }
                inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }}
                sx={{ width: 110 }}
              />
              <TextField
                size="small"
                label={t.vatId.value}
                value={vatEditing.vatId}
                onChange={event => setVatEditing({ ...vatEditing, vatId: event.target.value })}
                inputProps={{ maxLength: 32 }}
                sx={{ width: 200 }}
              />
              <Select
                size="small"
                value={vatEditing.supplyType}
                displayEmpty
                aria-label={t.supplyTypeLabel.value}
                onChange={value =>
                  setVatEditing({
                    ...vatEditing,
                    supplyType: value as '' | 'goods' | 'services',
                  })
                }
                options={[
                  { value: '', label: t.supplyTypeUnset.value },
                  { value: 'goods', label: t.supplyGoods.value },
                  { value: 'services', label: t.supplyServices.value },
                ]}
                sx={{ minWidth: 170 }}
              />
              <Button type="submit" size="small" variant="contained" disabled={busy}>
                {t.save.value}
              </Button>
              <Button size="small" onClick={() => setVatEditing(null)}>
                {t.cancel.value}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ flexBasis: '100%' }}>
                {t.vatHint.value}
              </Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            size="small"
            onClick={() =>
              setVatEditing(
                vatEditing?.id === payee.id
                  ? null
                  : {
                      id: payee.id,
                      countryCode: payee.countryCode ?? '',
                      vatId: payee.vatId ?? '',
                      supplyType: payee.supplyType ?? '',
                    },
              )
            }
          >
            {t.vatDetails.value}
          </Button>
          <Select
            size="small"
            value={payee.mode}
            disabled={busy}
            aria-label={t.modeLabel.value}
            onChange={value => changeMode(payee, value)}
            options={modeOptions}
            sx={{ minWidth: 190 }}
          />
          {payee.mode === 'always' && (
            <Select
              size="small"
              value={payee.category?.id ?? ''}
              disabled={busy}
              aria-label={t.pickCategory.value}
              onChange={value => void save(payee.id, { mode: 'always', categoryId: value })}
              options={categoryOptions}
              sx={{ minWidth: 180 }}
            />
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, py: 4, maxWidth: 1120 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography sx={{ fontSize: 12, color: 'var(--muted-foreground)', maxWidth: 640 }}>
            {t.hint.value}
          </Typography>
          <Box sx={{ position: 'relative', width: { xs: '100%', sm: 260 } }}>
            <SearchIcon
              size={16}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted-foreground)',
              }}
            />
            <input
              type="text"
              value={search}
              onChange={event => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t.searchPlaceholder.value}
              aria-label={t.searchPlaceholder.value}
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                background: 'transparent',
                padding: '8px 12px 8px 36px',
                fontSize: 14,
                fontFamily: 'inherit',
                color: 'var(--foreground)',
                borderRadius: tokens.radius.sm,
                boxSizing: 'border-box',
              }}
            />
          </Box>
        </Box>

        {selectedPayees.length > 1 && (
          <Box
            data-testid="payees-merge-bar"
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
          >
            <Typography variant="body2" sx={{ color: 'var(--muted-foreground)', mr: 1 }}>
              {fill(t.selected.value, { count: selectedPayees.length })}
            </Typography>
            <Select
              size="small"
              value={mergeTarget}
              aria-label={t.mergeInto.value}
              displayEmpty
              onChange={setMergeTarget}
              options={[
                { value: '', label: t.mergeInto.value, disabled: true },
                ...selectedPayees.map(payee => ({ value: payee.id, label: payee.name })),
              ]}
              sx={{ minWidth: 220 }}
            />
            <Button
              variant="contained"
              size="small"
              disabled={busy || !mergeTarget}
              onClick={() =>
                merge(
                  mergeTarget,
                  selectedPayees.map(payee => payee.id).filter(id => id !== mergeTarget),
                )
              }
            >
              {t.merge.value}
            </Button>
          </Box>
        )}

        <Box>
          {isPending ? (
            ROW_SKELETON_KEYS.map(key => (
              <Skeleton key={key} variant="rounded" height={44} sx={{ mb: 1 }} />
            ))
          ) : payees.length === 0 ? (
            <EmptyState illustration="no-data" title={t.empty.value} compact />
          ) : (
            payees.map(renderRow)
          )}
        </Box>

        {data && data.total > PAGE_SIZE && (
          <AppPagination
            page={page}
            total={Math.ceil(data.total / PAGE_SIZE)}
            onChange={next => {
              setPage(next);
              setSelected(new Set());
            }}
          />
        )}
      </Box>
    </Box>
  );
}
