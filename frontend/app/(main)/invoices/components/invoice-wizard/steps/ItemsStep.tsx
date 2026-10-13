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

  return (
    <>
      {lineItems.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id before saving
        <section key={index} className="lumio-invoice-wizard__line">
          <div className="lumio-invoice-wizard__line-head">
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
              onChange={event => form.updateLine(index, { description: event.target.value })}
            />
          </WizardField>

          <div className="lumio-payable-drawer__2col">
            <WizardField label={page.detail.quantity.value} htmlFor={`invoice-qty-${index}`}>
              <Input
                id={`invoice-qty-${index}`}
                type="number"
                min="0"
                step="1"
                value={String(line.quantity)}
                onChange={event => form.updateLine(index, { quantity: Number(event.target.value) })}
              />
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
            <div>
              <Button
                variant="ghost"
                onClick={() => setDiscountOpen(current => new Set(current).add(index))}
              >
                {t.items.discount.value}
              </Button>
            </div>
          )}

          <div className="lumio-invoice-wizard__line-amount">
            <span>{page.detail.amount.value}</span>
            <strong>{formatMoney(lineAmount(line), currency, locale)}</strong>
          </div>
        </section>
      ))}

      <div className="lumio-invoice-wizard__row-actions">
        <Button variant="outline" onClick={form.addLine}>
          <Plus size={16} style={{ marginRight: 6 }} />
          {t.items.addLine.value}
        </Button>
        {form.clientId ? (
          <Button variant="ghost" onClick={() => void form.addLateFee()}>
            {page.detail.lateFeeAdd.value}
          </Button>
        ) : null}
      </div>

      <WizardTotals form={form} />
    </>
  );
}
