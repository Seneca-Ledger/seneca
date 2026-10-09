'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft } from '@/app/components/icons';
import { CurrencyDrawer } from '@/app/components/receipts/components/CurrencyDrawer';
import { Button } from '@/app/components/ui/button';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { Input } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { useCurrencyPickerState } from '@/app/hooks/useCurrencyPickerState';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import type { Client, CreateClientInput, UpdateClientInput } from '@/app/lib/invoices-api';
import { LOCALE_DISPLAY_ORDER, LOCALE_ENDONYMS } from '@/app/lib/locale';

interface ClientDrawerProps {
  open: boolean;
  client?: Client | null;
  /** Currency preselected for a new client; the workspace currency. */
  defaultCurrency?: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateClientInput | UpdateClientInput) => Promise<void>;
  labels: {
    createTitle: string;
    editTitle: string;
    name: string;
    email: string;
    billingAddress: string;
    taxId: string;
    currency: string;
    locale: string;
    reminders: string;
    paymentTerms: string;
    save: string;
    saving: string;
    cancel: string;
  };
}

/**
 * Languages a document can be written in, each named in itself — the client
 * reads the invoice, not the person filling this form in.
 */
const DOCUMENT_LOCALES = [
  { value: 'default', label: '—' },
  ...LOCALE_DISPLAY_ORDER.map(locale => ({ value: locale, label: LOCALE_ENDONYMS[locale] })),
];

interface ClientFormState {
  name: string;
  email: string;
  billingAddress: string;
  taxId: string;
  currency: string;
  locale: string;
  remindersEnabled: boolean;
  paymentTermsDays: string;
}

const emptyState = (defaultCurrency: string): ClientFormState => ({
  name: '',
  email: '',
  billingAddress: '',
  taxId: '',
  currency: defaultCurrency,
  locale: '',
  remindersEnabled: true,
  paymentTermsDays: '',
});

export function ClientDrawer({
  open,
  client,
  defaultCurrency = FALLBACK_CURRENCY,
  saving,
  onClose,
  onSubmit,
  labels,
}: ClientDrawerProps): React.JSX.Element {
  const [form, setForm] = useState<ClientFormState>(() => emptyState(defaultCurrency));
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
  } = useCurrencyPickerState(form.currency || defaultCurrency);

  useEffect(() => {
    if (!open) {
      setCurrencyDrawerOpen(false);
      setCurrencySearch('');
      return;
    }
    setForm(
      client
        ? {
            name: client.name,
            email: client.email || '',
            billingAddress: client.billingAddress || '',
            taxId: client.taxId || '',
            currency: client.currency || defaultCurrency,
            locale: client.locale || '',
            remindersEnabled: client.remindersEnabled ?? true,
            paymentTermsDays:
              client.paymentTermsDays === null ? '' : String(client.paymentTermsDays),
          }
        : emptyState(defaultCurrency),
    );
  }, [open, client, defaultCurrency, setCurrencyDrawerOpen, setCurrencySearch]);

  const canSubmit = form.name.trim().length > 0;

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    await onSubmit({
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      billingAddress: form.billingAddress.trim() || undefined,
      taxId: form.taxId.trim() || undefined,
      currency: form.currency.trim().toUpperCase() || defaultCurrency,
      locale: form.locale.trim().toLowerCase() || undefined,
      remindersEnabled: form.remindersEnabled,
      paymentTermsDays: form.paymentTermsDays.trim() ? Number(form.paymentTermsDays) : undefined,
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
        width="md"
        showCloseButton={false}
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
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              {client ? labels.editTitle : labels.createTitle}
            </span>
          </div>
        }
      >
        <div className="lumio-payable-drawer__body">
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="lumio-payable-drawer__field-group">
              <label className="lumio-payable-drawer__field-label" htmlFor="client-name">
                {labels.name}
              </label>
              <Input
                id="client-name"
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="lumio-payable-drawer__field-group">
              <label className="lumio-payable-drawer__field-label" htmlFor="client-email">
                {labels.email}
              </label>
              <Input
                id="client-email"
                type="email"
                value={form.email}
                onChange={event => setForm(prev => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="lumio-payable-drawer__2col">
              <div className="lumio-payable-drawer__field-group">
                <label className="lumio-payable-drawer__field-label" htmlFor="client-tax-id">
                  {labels.taxId}
                </label>
                <Input
                  id="client-tax-id"
                  value={form.taxId}
                  onChange={event => setForm(prev => ({ ...prev, taxId: event.target.value }))}
                />
              </div>
              <div className="lumio-payable-drawer__field-group">
                <label className="lumio-payable-drawer__field-label" htmlFor="client-currency">
                  {labels.currency}
                </label>
                <button
                  id="client-currency"
                  type="button"
                  className="lumio-payable-drawer__currency-trigger"
                  onClick={() => setCurrencyDrawerOpen(true)}
                  aria-label={labels.currency}
                >
                  {form.currency}
                </button>
              </div>
            </div>
            <div className="lumio-payable-drawer__field-group">
              <label className="lumio-payable-drawer__field-label" htmlFor="client-terms">
                {labels.paymentTerms}
              </label>
              <Input
                id="client-terms"
                inputMode="numeric"
                value={form.paymentTermsDays}
                onChange={event =>
                  setForm(prev => ({
                    ...prev,
                    paymentTermsDays: event.target.value.replace(/\D/g, ''),
                  }))
                }
              />
            </div>
            <label
              className="lumio-payable-drawer__field-group"
              style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
            >
              {/* Off for the clients who always pay on time. */}
              <input
                type="checkbox"
                checked={form.remindersEnabled}
                onChange={event =>
                  setForm(prev => ({ ...prev, remindersEnabled: event.target.checked }))
                }
              />
              <span className="lumio-payable-drawer__field-label">{labels.reminders}</span>
            </label>
            <div className="lumio-payable-drawer__field-group">
              {/* The language this client's invoices are written in. */}
              <label className="lumio-payable-drawer__field-label" htmlFor="client-locale">
                {labels.locale}
              </label>
              <Select
                fullWidth
                id="client-locale"
                value={form.locale || 'default'}
                onChange={next =>
                  setForm(prev => ({ ...prev, locale: next === 'default' ? '' : String(next) }))
                }
                options={DOCUMENT_LOCALES.map(option => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </div>
            <div className="lumio-payable-drawer__field-group">
              <label className="lumio-payable-drawer__field-label" htmlFor="client-billing-address">
                {labels.billingAddress}
              </label>
              <textarea
                id="client-billing-address"
                className="lumio-payable-drawer__textarea"
                value={form.billingAddress}
                onChange={event =>
                  setForm(prev => ({ ...prev, billingAddress: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="lumio-payable-drawer__footer">
            <Button variant="outline" style={{ flex: 1 }} onClick={onClose}>
              {labels.cancel}
            </Button>
            <Button
              style={{ flex: 1 }}
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || saving}
            >
              {saving ? labels.saving : labels.save}
            </Button>
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
