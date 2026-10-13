'use client';

import type React from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { CurrencyDrawer } from '@/app/components/receipts/components/CurrencyDrawer';
import { FORM_CONTROL_SX, Input } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { useCurrencyPickerState } from '@/app/hooks/useCurrencyPickerState';
import { useIntlayer } from '@/app/i18n';
import type { InvoiceRecurrenceInterval } from '@/app/lib/invoices-api';
import type { InvoiceForm } from '../useInvoiceForm';
import { WizardField } from '../WizardChrome';

/** The optional fields, each with a line on when it matters. */
export function ExtrasStep({ form }: { form: InvoiceForm }): React.ReactElement {
  const t = useIntlayer('invoiceWizard');
  const page = useIntlayer('invoicesPage');
  const einvoice = useIntlayer('einvoiceFields');
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
  } = useCurrencyPickerState(form.currency);

  const handleSelectCurrency = (code: string): void => {
    form.setCurrency(code);
    pushRecentCurrency(code);
  };

  return (
    <>
      <div className="lumio-payable-drawer__2col">
        <WizardField
          label={page.detail.currency.value}
          htmlFor="invoice-currency"
          hint={t.extras.currencyHint.value}
        >
          <button
            id="invoice-currency"
            type="button"
            className="lumio-payable-drawer__currency-trigger"
            onClick={() => setCurrencyDrawerOpen(true)}
          >
            {form.currency}
          </button>
        </WizardField>
        <WizardField
          label={page.detail.recurring.value}
          htmlFor="invoice-recurrence"
          hint={t.extras.recurringHint.value}
        >
          <Select
            fullWidth
            id="invoice-recurrence"
            sx={FORM_CONTROL_SX}
            value={form.recurrenceInterval || 'none'}
            onChange={next =>
              form.setRecurrenceInterval(next === 'none' ? '' : (next as InvoiceRecurrenceInterval))
            }
            options={[
              { value: 'none', label: t.extras.recurrenceNone.value },
              { value: 'weekly', label: page.detail.recurrenceInterval.weekly.value },
              { value: 'monthly', label: page.detail.recurrenceInterval.monthly.value },
              { value: 'quarterly', label: page.detail.recurrenceInterval.quarterly.value },
              { value: 'yearly', label: page.detail.recurrenceInterval.yearly.value },
            ]}
          />
        </WizardField>
      </div>

      <CustomDatePicker
        large
        label={einvoice.deliveryDate.value}
        value={form.deliveryDate}
        onChange={form.setDeliveryDate}
        helperText={t.extras.deliveryHint.value}
      />

      <WizardField
        label={einvoice.buyerReference.value}
        htmlFor="invoice-buyer-reference"
        hint={t.extras.buyerReferenceHint.value}
      >
        <Input
          id="invoice-buyer-reference"
          value={form.buyerReference}
          placeholder={einvoice.buyerReferencePlaceholder.value}
          onChange={event => form.setBuyerReference(event.target.value)}
        />
      </WizardField>

      <WizardField
        label={page.detail.notes.value}
        htmlFor="invoice-notes"
        hint={t.extras.notesHint.value}
      >
        <textarea
          id="invoice-notes"
          className="lumio-payable-drawer__textarea"
          value={form.notes}
          onChange={event => form.setNotes(event.target.value)}
        />
      </WizardField>

      <CurrencyDrawer
        isOpen={currencyDrawerOpen}
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
