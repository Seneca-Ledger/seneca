'use client';

import type React from 'react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { ChoiceCards } from '@/app/components/ui/choice-cards';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import type { InvoiceForm } from '../useInvoiceForm';
import { WizardField, WizardTotals } from '../WizardChrome';

type TaxMode = 'exclusive' | 'inclusive';

/** Whether prices carry tax, and at which rate: one for the whole invoice unless asked otherwise. */
export function TaxStep({ form }: { form: InvoiceForm }): React.ReactElement {
  const t = useIntlayer('invoiceWizard');
  const page = useIntlayer('invoicesPage');
  const { lineItems, taxRates } = form;
  // Lines that already differ (a draft saved that way) open in per-line mode.
  const [perLine, setPerLine] = useState(
    () => new Set(lineItems.map(line => line.taxRateId ?? '')).size > 1,
  );

  const rateOptions = [
    { value: 'none', label: page.detail.noTax.value },
    ...taxRates.map(rate => ({ value: rate.id, label: `${rate.name} (${rate.rate}%)` })),
  ];
  const toRateId = (next: string): string | undefined => (next === 'none' ? undefined : next);

  const handleSameRate = (): void => {
    form.setTaxRateForAll(lineItems[0]?.taxRateId);
    setPerLine(false);
  };

  return (
    <>
      <ChoiceCards<TaxMode>
        aria-label={t.tax.title.value}
        value={form.pricesIncludeTax ? 'inclusive' : 'exclusive'}
        onChange={mode => form.setPricesIncludeTax(mode === 'inclusive')}
        options={[
          {
            value: 'exclusive',
            title: t.tax.exclusiveTitle.value,
            description: t.tax.exclusiveDescription.value,
          },
          {
            value: 'inclusive',
            title: t.tax.inclusiveTitle.value,
            description: t.tax.inclusiveDescription.value,
          },
        ]}
      />

      {taxRates.length === 0 ? (
        <p className="seneca-invoice-wizard__note">{t.tax.noRates.value}</p>
      ) : perLine ? (
        <>
          {lineItems.map((line, index) => (
            <WizardField
              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id before saving
              key={index}
              label={line.description || t.items.line.value.replace('{n}', String(index + 1))}
            >
              <Select
                fullWidth
                inputProps={{ 'aria-label': `${page.detail.taxRate.value}: ${index + 1}` }}
                value={line.taxRateId || 'none'}
                onChange={next => form.updateLine(index, { taxRateId: toRateId(next) })}
                options={rateOptions}
              />
            </WizardField>
          ))}
          <div>
            <Button variant="ghost" onClick={handleSameRate}>
              {t.tax.sameRate.value}
            </Button>
          </div>
        </>
      ) : (
        <>
          <WizardField label={page.detail.taxRate.value} hint={t.tax.rateHint.value}>
            <Select
              fullWidth
              inputProps={{ 'aria-label': page.detail.taxRate.value }}
              value={lineItems[0]?.taxRateId || 'none'}
              onChange={next => form.setTaxRateForAll(toRateId(next))}
              options={rateOptions}
            />
          </WizardField>
          {lineItems.length > 1 ? (
            <div>
              <Button variant="ghost" onClick={() => setPerLine(true)}>
                {t.tax.perLine.value}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <WizardTotals form={form} />
    </>
  );
}
