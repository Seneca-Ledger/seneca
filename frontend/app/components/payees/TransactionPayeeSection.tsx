'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  CategoryPickerField,
  type CategoryPickerFieldProps,
} from '@/app/components/categories/CategoryPickerField';
import { Pencil } from '@/app/components/icons';
import { Select } from '@/app/components/ui/select';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { PayeeRecord } from '@/app/lib/contracts';
import { localizeStatementCategoryName } from '@/app/lib/statement-categories';
import { offerAction } from './offer-action-toast';
import { PayeePicker } from './PayeePicker';
import type { Payee, PayeeMode, PayeeRef } from './types';
import {
  useMergePayees,
  usePayee,
  useRecheckPayeeVat,
  useSetTransactionPayee,
  useUpdatePayee,
} from './usePayees';

type SupplyType = '' | 'goods' | 'services';

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
      ? 'var(--money-up)'
      : payee.vatIdStatus === 'invalid'
        ? 'var(--money-down)'
        : 'var(--text-muted)';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Typography
        variant="caption"
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
 * The row's payee in the transaction drawer: change it for this row, and for
 * the payee itself how it is categorised (learn, always one category, never),
 * its name (a name another payee has merges the two) and its VAT details.
 */
export function TransactionPayeeSection({
  transactionId,
  payee: initial,
  counterpartyName,
  categories,
  transactionCategoryId,
}: {
  transactionId: string;
  payee: PayeeRef | null;
  counterpartyName: string;
  categories: CategoryPickerFieldProps['categories'];
  transactionCategoryId: string | null;
}) {
  const t = useIntlayer('payees');
  const { locale } = useLocale();
  const [current, setCurrent] = useState<PayeeRef | null>(initial);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pickingAlways, setPickingAlways] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [vatEditing, setVatEditing] = useState<{
    countryCode: string;
    vatId: string;
    supplyType: SupplyType;
  } | null>(null);

  const { data: payee } = usePayee(current?.id ?? null);
  const setPayee = useSetTransactionPayee();
  const updatePayee = useUpdatePayee();
  const mergePayees = useMergePayees();
  const recheckVat = useRecheckPayeeVat();
  const busy =
    setPayee.isPending || updatePayee.isPending || mergePayees.isPending || recheckVat.isPending;

  const save = (
    body: {
      name?: string;
      mode?: PayeeMode;
      categoryId?: string | null;
      countryCode?: string | null;
      vatId?: string | null;
      supplyType?: 'goods' | 'services' | null;
    },
    announce: (updated: PayeeRecord) => void = () => toast.success(t.saved.value),
  ) => {
    if (!current) return Promise.resolve(false);
    const source = current.id;
    return updatePayee
      .mutateAsync({ id: source, ...body })
      .then(updated => {
        announce(updated);
        if (updated.name !== current.name) setCurrent({ id: updated.id, name: updated.name });
        return true;
      })
      .catch((error: unknown) => {
        const existing = takenBy(error);
        if (existing && body.name) {
          const name = body.name;
          offerAction({
            message: t.nameTaken.value,
            applyLabel: t.merge.value,
            dismissLabel: t.cancel.value,
            onApply: () => merge(existing, source, name),
          });
        } else {
          toast.error(getApiErrorMessage(error, t.failed.value));
        }
        return false;
      });
  };

  /** Says what VIES made of the number just saved or checked. */
  const announceVatCheck = (updated: PayeeRecord) => {
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

  const merge = (targetId: string, sourceId: string, targetName: string) => {
    void mergePayees
      .mutateAsync({ targetId, sourceIds: [sourceId] })
      .then(() => {
        toast.success(t.merged.value);
        setRenaming(null);
        setCurrent({ id: targetId, name: targetName });
      })
      .catch((error: unknown) => toast.error(getApiErrorMessage(error, t.failed.value)));
  };

  const changeMode = (mode: string) => {
    if (mode !== 'always') {
      setPickingAlways(false);
      void save({ mode: mode as PayeeMode });
      return;
    }
    // "Always" needs its category: start from what the payee or this row files as.
    const categoryId =
      payee?.category?.id ?? payee?.defaultCategory?.id ?? transactionCategoryId ?? null;
    if (categoryId) void save({ mode: 'always', categoryId });
    else setPickingAlways(true);
  };

  const filesAs = payee?.defaultCategory
    ? fill(t.filesAs.value, {
        category: localizeStatementCategoryName(payee.defaultCategory.name, locale),
      })
    : t.noDefault.value;

  return (
    <Box data-testid="transaction-payee" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span className="seneca-tx-detail__field-label">{t.payee.value}</span>

      {renaming === null ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          <Typography
            variant="body2"
            noWrap
            title={current?.name}
            sx={{
              fontWeight: 500,
            }}
          >
            {current?.name ?? '—'}
          </Typography>
          <IconButton
            size="small"
            aria-label={t.changePayee.value}
            title={t.changePayee.value}
            disabled={busy}
            onClick={event => setAnchor(event.currentTarget)}
            sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}
          >
            <Pencil size={14} />
          </IconButton>
        </Box>
      ) : (
        <Box
          component="form"
          sx={{ display: 'flex', gap: 1, alignItems: 'center' }}
          onSubmit={event => {
            event.preventDefault();
            const value = renaming.trim();
            if (!value || value === current?.name) {
              setRenaming(null);
              return;
            }
            void save({ name: value }).then(ok => ok && setRenaming(null));
          }}
        >
          <TextField
            size="small"
            autoFocus
            value={renaming}
            onChange={event => setRenaming(event.target.value)}
            sx={{ flex: 1 }}
            slotProps={{
              htmlInput: { 'aria-label': t.rename.value, maxLength: 200 },
            }}
          />
          <Button type="submit" size="small" variant="contained" disabled={busy}>
            {t.save.value}
          </Button>
          <Button size="small" onClick={() => setRenaming(null)}>
            {t.cancel.value}
          </Button>
        </Box>
      )}

      {payee && (
        <>
          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
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

          <Select
            size="small"
            value={pickingAlways ? 'always' : payee.mode}
            disabled={busy}
            aria-label={t.modeLabel.value}
            onChange={changeMode}
            options={[
              { value: 'auto', label: t.modeAuto.value },
              { value: 'always', label: t.modeAlways.value },
              { value: 'never', label: t.modeNever.value },
            ]}
          />
          {(payee.mode === 'always' || pickingAlways) && (
            <CategoryPickerField
              size="small"
              value={payee.mode === 'always' ? (payee.category?.id ?? '') : ''}
              disabled={busy}
              ariaLabel={t.pickCategory.value}
              categories={categories}
              placeholder={t.pickCategory.value}
              onChange={value => {
                if (!value) return;
                void save({ mode: 'always', categoryId: value }).then(
                  ok => ok && setPickingAlways(false),
                );
              }}
            />
          )}
          <Typography variant="caption" sx={{ color: 'var(--text-muted)' }}>
            {t.hint.value}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              disabled={busy}
              onClick={() => setRenaming(renaming === null ? payee.name : null)}
            >
              {t.rename.value}
            </Button>
            <Button
              size="small"
              onClick={() =>
                setVatEditing(
                  vatEditing
                    ? null
                    : {
                        countryCode: payee.countryCode ?? '',
                        vatId: payee.vatId ?? '',
                        supplyType: payee.supplyType ?? '',
                      },
                )
              }
            >
              {t.vatDetails.value}
            </Button>
          </Box>

          {vatEditing && (
            <Box
              component="form"
              data-testid="payee-vat-form"
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}
              onSubmit={event => {
                event.preventDefault();
                const countryCode = vatEditing.countryCode.trim().toUpperCase();
                if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
                  toast.error(t.countryCodeInvalid.value);
                  return;
                }
                void save(
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
                sx={{ width: 90 }}
                slotProps={{
                  htmlInput: { maxLength: 2, style: { textTransform: 'uppercase' } },
                }}
              />
              <TextField
                size="small"
                label={t.vatId.value}
                value={vatEditing.vatId}
                onChange={event => setVatEditing({ ...vatEditing, vatId: event.target.value })}
                sx={{ flex: 1, minWidth: 140 }}
                slotProps={{
                  htmlInput: { maxLength: 32 },
                }}
              />
              <Select
                size="small"
                value={vatEditing.supplyType}
                displayEmpty
                aria-label={t.supplyTypeLabel.value}
                onChange={value =>
                  setVatEditing({ ...vatEditing, supplyType: value as SupplyType })
                }
                options={[
                  { value: '', label: t.supplyTypeUnset.value },
                  { value: 'goods', label: t.supplyGoods.value },
                  { value: 'services', label: t.supplyServices.value },
                ]}
                sx={{ flexBasis: '100%' }}
              />
              <Typography variant="caption" sx={{ color: 'var(--text-muted)', flexBasis: '100%' }}>
                {t.vatHint.value}
              </Typography>
              <Button type="submit" size="small" variant="contained" disabled={busy}>
                {t.save.value}
              </Button>
              <Button size="small" onClick={() => setVatEditing(null)}>
                {t.cancel.value}
              </Button>
            </Box>
          )}
        </>
      )}

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        disableAutoFocus
      >
        <Box sx={{ p: 2 }}>
          <PayeePicker
            current={current}
            disabled={busy}
            onPick={(choice, name) => {
              setAnchor(null);
              void setPayee
                .mutateAsync({ transactionId, choice })
                .then(result => {
                  setCurrent(result.payee);
                  setVatEditing(null);
                  setPickingAlways(false);
                  toast.success(fill(t.remembered.value, { raw: counterpartyName, payee: name }));
                })
                .catch((error: unknown) => toast.error(getApiErrorMessage(error, t.failed.value)));
            }}
          />
        </Box>
      </Popover>
    </Box>
  );
}
