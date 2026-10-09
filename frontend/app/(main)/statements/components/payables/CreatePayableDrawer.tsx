/* eslint-disable max-lines */
'use client';

import MuiButton from '@mui/material/Button';
import React, { useEffect, useMemo, useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { ChevronLeft } from '@/app/components/icons';
import { CurrencyDrawer } from '@/app/components/receipts/components/CurrencyDrawer';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { FORM_CONTROL_SX, Input } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { useCurrencyPickerState } from '@/app/hooks/useCurrencyPickerState';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import type {
  CreatePayableInput,
  Payable,
  PayableSource,
  PayableStatus,
  UpdatePayableInput,
} from '@/app/lib/payables-api';

interface CreatePayableDrawerProps {
  open: boolean;
  payable?: Payable | null;
  initialValues?: CreatePayableInput | null;
  /** Currency preselected for new entries; the workspace currency. */
  defaultCurrency?: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (payload: CreatePayableInput | UpdatePayableInput) => Promise<void>;
  labels: {
    createTitle: string;
    editTitle: string;
    vendor: string;
    amount: string;
    currency: string;
    dueDate: string;
    source: string;
    status: string;
    comment: string;
    save: string;
    saving: string;
    cancel: string;
    sourceOptions: Record<PayableSource, string>;
    /** `partially_paid` is derived from the payments, so it is never offered here. */
    statusOptions: Record<Exclude<PayableStatus, 'partially_paid'>, string>;
  };
}

interface PayableFormState {
  vendor: string;
  amount: string;
  currency: string;
  dueDate: string;
  source: PayableSource;
  status: PayableStatus;
  comment: string;
}

const createEmptyState = (defaultCurrency: string): PayableFormState => ({
  vendor: '',
  amount: '',
  currency: defaultCurrency,
  dueDate: '',
  source: 'manual',
  status: 'to_pay',
  comment: '',
});

const toFormState = (
  payable: Payable | null | undefined,
  initialValues: CreatePayableInput | null | undefined,
  defaultCurrency: string,
): PayableFormState => {
  if (!(payable || initialValues)) {
    return createEmptyState(defaultCurrency);
  }

  if (!payable && initialValues) {
    return {
      vendor: initialValues.vendor || '',
      amount: String(initialValues.amount ?? ''),
      currency: initialValues.currency || defaultCurrency,
      dueDate: initialValues.dueDate ? initialValues.dueDate.slice(0, 10) : '',
      source: initialValues.source || 'manual',
      status: initialValues.status || 'to_pay',
      comment: initialValues.comment || '',
    };
  }

  return {
    vendor: payable?.vendor || '',
    amount: String(payable?.amount ?? ''),
    currency: payable?.currency || defaultCurrency,
    dueDate: payable?.dueDate ? payable.dueDate.slice(0, 10) : '',
    source: payable?.source || 'manual',
    status: payable?.status || 'to_pay',
    comment: payable?.comment || '',
  };
};

// eslint-disable-next-line max-lines-per-function, complexity
export function CreatePayableDrawer({
  open,
  payable,
  initialValues,
  defaultCurrency = FALLBACK_CURRENCY,
  saving,
  onClose,
  onSubmit,
  labels,
}: CreatePayableDrawerProps): React.JSX.Element {
  const [form, setForm] = useState<PayableFormState>(() =>
    toFormState(payable, initialValues, defaultCurrency),
  );
  const currencyPicker = useCurrencyPickerState(form.currency || defaultCurrency);
  const {
    currencyDrawerOpen,
    setCurrencyDrawerOpen,
    currencySearch,
    setCurrencySearch,
    selectedCurrencyItem,
    selectedMatchesSearch,
    currencyQuery,
    recentCurrencyItems,
    allCurrencyItems,
    pushRecentCurrency,
  } = currencyPicker;

  useEffect(() => {
    if (!open) {
      setCurrencyDrawerOpen(false);
      setCurrencySearch('');
      return;
    }
    setForm(toFormState(payable, initialValues, defaultCurrency));
  }, [defaultCurrency, initialValues, open, payable, setCurrencyDrawerOpen, setCurrencySearch]);

  const canSubmit = useMemo(() => form.vendor.trim().length > 0 && Number(form.amount) > 0, [form]);

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }

    await onSubmit({
      vendor: form.vendor.trim(),
      amount: Number(form.amount),
      currency: form.currency.trim().toUpperCase() || defaultCurrency,
      dueDate: form.dueDate || undefined,
      source: form.source,
      status: form.status,
      comment: form.comment.trim() || undefined,
    });
  };

  const handleSelectCurrency = (code: string): void => {
    setForm(prev => ({ ...prev, currency: code }));
    pushRecentCurrency(code);
  };

  return (
    <>
      <DrawerShell
        isOpen={open}
        onClose={onClose}
        position="right"
        width="lg"
        showCloseButton={false}
        sx={{
          maxWidth: '100%',
          borderLeft: 0,
          bgcolor: 'background.paper',
          '@media (min-width:600px)': { maxWidth: 512 },
        }}
        title={
          <div className="lumio-payable-drawer__title-wrap">
            <button
              type="button"
              onClick={onClose}
              className="lumio-payable-drawer__back-btn"
              aria-label={labels.cancel}
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>
              {payable ? labels.editTitle : labels.createTitle}
            </span>
          </div>
        }
      >
        <div className="lumio-payable-drawer__body">
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="lumio-payable-drawer__field-group">
              <label className="lumio-payable-drawer__field-label" htmlFor="payable-vendor">
                {labels.vendor}
              </label>
              <Input
                id="payable-vendor"
                value={form.vendor}
                onChange={event => setForm(prev => ({ ...prev, vendor: event.target.value }))}
              />
            </div>

            <div className="lumio-payable-drawer__2col">
              <div className="lumio-payable-drawer__field-group">
                <label className="lumio-payable-drawer__field-label" htmlFor="payable-amount">
                  {labels.amount}
                </label>
                <Input
                  id="payable-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={event => setForm(prev => ({ ...prev, amount: event.target.value }))}
                />
              </div>
              <div className="lumio-payable-drawer__field-group">
                <label className="lumio-payable-drawer__field-label" htmlFor="payable-currency">
                  {labels.currency}
                </label>
                <button
                  id="payable-currency"
                  type="button"
                  className="lumio-payable-drawer__currency-trigger"
                  onClick={() => setCurrencyDrawerOpen(true)}
                  aria-label={labels.currency}
                >
                  {form.currency}
                </button>
              </div>
            </div>

            <div className="lumio-payable-drawer__2col">
              <div className="lumio-payable-drawer__field-group">
                <label className="lumio-payable-drawer__field-label" htmlFor="payable-due-date">
                  {labels.dueDate}
                </label>
                <CustomDatePicker
                  id="payable-due-date"
                  large
                  value={form.dueDate || null}
                  onChange={value => setForm(prev => ({ ...prev, dueDate: value }))}
                />
              </div>
              <div className="lumio-payable-drawer__field-group">
                <label className="lumio-payable-drawer__field-label" htmlFor="payable-source">
                  {labels.source}
                </label>
                <Select
                  fullWidth
                  id="payable-source"
                  sx={FORM_CONTROL_SX}
                  value={form.source}
                  onChange={value => setForm(prev => ({ ...prev, source: value as PayableSource }))}
                  options={Object.entries(labels.sourceOptions).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </div>
            </div>

            <div className="lumio-payable-drawer__field-group">
              <label className="lumio-payable-drawer__field-label" htmlFor="payable-status">
                {labels.status}
              </label>
              <Select
                fullWidth
                id="payable-status"
                sx={FORM_CONTROL_SX}
                value={form.status}
                onChange={value => setForm(prev => ({ ...prev, status: value as PayableStatus }))}
                options={Object.entries(labels.statusOptions).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </div>

            <div className="lumio-payable-drawer__field-group">
              <label className="lumio-payable-drawer__field-label" htmlFor="payable-comment">
                {labels.comment}
              </label>
              <textarea
                id="payable-comment"
                value={form.comment}
                onChange={event => setForm(prev => ({ ...prev, comment: event.target.value }))}
                className="lumio-payable-drawer__textarea"
              />
            </div>
          </div>

          <div className="lumio-payable-drawer__footer">
            <MuiButton variant="outlined" sx={{ flex: 1 }} onClick={onClose}>
              {labels.cancel}
            </MuiButton>
            <MuiButton
              variant="contained"
              sx={{ flex: 1 }}
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || saving}
            >
              {saving ? labels.saving : labels.save}
            </MuiButton>
          </div>
        </div>
      </DrawerShell>

      <CurrencyDrawer
        isOpen={open && currencyDrawerOpen}
        onClose={() => setCurrencyDrawerOpen(false)}
        currencySearch={currencySearch}
        setCurrencySearch={setCurrencySearch}
        selectedCurrencyItem={selectedCurrencyItem}
        selectedMatchesSearch={selectedMatchesSearch}
        currencyQuery={currencyQuery}
        recentCurrencyItems={recentCurrencyItems}
        allCurrencyItems={allCurrencyItems}
        handleSelectCurrency={handleSelectCurrency}
        zIndex={1400}
      />
    </>
  );
}
