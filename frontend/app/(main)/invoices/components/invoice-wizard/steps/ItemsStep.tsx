'use client';

import type React from 'react';
import { useState } from 'react';
import { Plus, Trash2 } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { LineAdjustmentInput, UnitSelect } from '../../XRechnungFields';
import { type InvoiceForm, lineAmount } from '../useInvoiceForm';
import { WizardField, WizardTotals } from '../WizardChrome';

/** The lines of the invoice, one card each, with the amount worked out as you type. */
export function ItemsStep({ form }: { form: InvoiceForm }): React.ReactElement {
  const t = useIntlayer('invoiceWizard');
  const page = useIntlayer('invoicesPage');
  const einvoice = useIntlayer('einvoiceFields');
  const { locale } = useLocale();
  // Lines whose discount field was opened; a line that already has one shows it anyway.
  const [discountOpen, setDiscountOpen] = useState<Set<number>>(new Set());
  const { lineItems, currency } = form;

  const handleRemove = (index: number): void => {
    form.removeLine(index);
    // Indexes shift after a removal; fall back to showing only lines that have a discount.
    setDiscountOpen(new Set());
  };

  const unitLabels: Record<string, string> = {
    C62: einvoice.unitPiece.value,
    HUR: einvoice.unitHour.value,
    DAY: einvoice.unitDay.value,
    MON: einvoice.unitMonth.value,
    LS: einvoice.unitLumpSum.value,
    KGM: einvoice.unitKilogram.value,
  };
  const money = (value: number) => formatMoney(value, currency, locale);

  return (
    <>
      {lineItems.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id before saving
        <section key={index} className="seneca-invoice-wizard__line">
          <div className="seneca-invoice-wizard__line-head">
            <span>{t.items.line.value.replace('{n}', String(index + 1))}</span>
            {lineItems.length > 1 ? (
              <Button
                size="icon"
                variant="ghost"
                aria-label={page.actions.delete.value}
                onClick={() => handleRemove(index)}
              >
                <Trash2 size={16} />
              </Button>
            ) : null}
          </div>

          <WizardField label={page.detail.description.value} htmlFor={`invoice-line-${index}`}>
            <Input
              id={`invoice-line-${index}`}
              value={line.description}
              placeholder={t.items.descriptionPlaceholder.value}
              onChange={event => form.updateLine(index, { description: event.target.value })}
            />
          </WizardField>

          {/* One row, one height: Qty | Unit | Unit price, bottoms aligned. */}
          <div className="seneca-invoice-wizard__qty-row">
            <WizardField label={page.detail.quantity.value} htmlFor={`invoice-qty-${index}`}>
              <Input
                id={`invoice-qty-${index}`}
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                className="seneca-invoice-wizard__number"
                value={String(line.quantity)}
                onChange={event => form.updateLine(index, { quantity: Number(event.target.value) })}
              />
            </WizardField>
            <WizardField label={einvoice.unit.value}>
              <UnitSelect
                value={line.unitCode || 'C62'}
                onChange={unitCode => form.updateLine(index, { unitCode })}
              />
            </WizardField>
            <WizardField label={page.detail.unitPrice.value} htmlFor={`invoice-price-${index}`}>
              <Input
                id={`invoice-price-${index}`}
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="seneca-invoice-wizard__number"
                startAdornment={
                  <span className="seneca-invoice-wizard__currency">
                    {currencySymbol(currency, locale)}
                  </span>
                }
                value={String(line.unitPrice)}
                onChange={event =>
                  form.updateLine(index, { unitPrice: Number(event.target.value) })
                }
              />
            </WizardField>
          </div>

          {discountOpen.has(index) || line.adjustmentPercent ? (
            <WizardField label={einvoice.lineAdjustment.value} hint={t.items.discountHint.value}>
              <LineAdjustmentInput
                value={line.adjustmentPercent}
                onChange={adjustmentPercent => form.updateLine(index, { adjustmentPercent })}
              />
            </WizardField>
          ) : (
            <button
              type="button"
              className="seneca-invoice-wizard__link"
              onClick={() => setDiscountOpen(current => new Set(current).add(index))}
            >
              {t.items.discount.value}
            </button>
          )}

          {/* How the amount comes about, then the amount: "2 × €80 / hour   €160". */}
          <div className="seneca-invoice-wizard__line-amount">
            <span>
              {line.quantity} × {money(line.unitPrice)} /{' '}
              {unitLabels[line.unitCode || 'C62'] ?? line.unitCode}
            </span>
            <span className="seneca-invoice-wizard__line-sum">{money(lineAmount(line))}</span>
          </div>
        </section>
      ))}

      <div className="seneca-invoice-wizard__row-actions">
        <button type="button" className="seneca-invoice-wizard__link" onClick={form.addLine}>
          <Plus size={16} aria-hidden />
          {t.items.addLine.value}
        </button>
      </div>

      {/* A late fee belongs to the invoice, not to a line: it sits with the totals. */}
      <WizardTotals form={form} />
      {form.clientId ? (
        <div className="seneca-invoice-wizard__totals-actions">
          <button
            type="button"
            className="seneca-invoice-wizard__link"
            onClick={() => void form.addLateFee()}
          >
            {page.detail.lateFeeAdd.value}
          </button>
        </div>
      ) : null}
    </>
  );
}

/** "€" for EUR in this locale: the price field's prefix. */
function currencySymbol(currency: string, locale: string): string {
  try {
    return (
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
      })
        .formatToParts(0)
        .find(part => part.type === 'currency')?.value ?? currency
    );
  } catch {
    return currency;
  }
}
