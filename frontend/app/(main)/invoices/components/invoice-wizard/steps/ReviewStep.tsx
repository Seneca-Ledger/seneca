'use client';

import type React from 'react';
import { Button } from '@/app/components/ui/button';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { formatInvoiceDate } from '../../invoices-format';
import { type InvoiceForm, lineAmount } from '../useInvoiceForm';
import { WizardTotals } from '../WizardChrome';

export type ReviewSection = 'client' | 'items' | 'tax' | 'dates' | 'extras';

function ReviewRow({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="lumio-invoice-wizard__review-row">
      <div className="lumio-invoice-wizard__review-head">
        <h3>{title}</h3>
        <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`${editLabel}: ${title}`}>
          {editLabel}
        </Button>
      </div>
      <div className="lumio-invoice-wizard__review-body">{children}</div>
    </section>
  );
}

/** Everything the steps collected, each part one click away from its step. */
export function ReviewStep({
  form,
  onEdit,
}: {
  form: InvoiceForm;
  onEdit: (section: ReviewSection) => void;
}): React.ReactElement {
  const t = useIntlayer('invoiceWizard');
  const page = useIntlayer('invoicesPage');
  const einvoice = useIntlayer('einvoiceFields');
  const { locale } = useLocale();
  const { currency } = form;
  const editLabel = t.edit.value;

  const client = form.clients.find(entry => entry.id === form.clientId);
  const rateLabel = (taxRateId?: string): string => {
    const rate = form.taxRates.find(entry => entry.id === taxRateId);
    return rate ? `${rate.name} (${rate.rate}%)` : page.detail.noTax.value;
  };
  const rateLabels = [...new Set(form.lineItems.map(line => rateLabel(line.taxRateId)))];
  const recurrenceLabels: Record<string, string> = {
    weekly: page.detail.recurrenceInterval.weekly.value,
    monthly: page.detail.recurrenceInterval.monthly.value,
    quarterly: page.detail.recurrenceInterval.quarterly.value,
    yearly: page.detail.recurrenceInterval.yearly.value,
  };

  return (
    <>
      <ReviewRow
        title={page.detail.client.value}
        editLabel={editLabel}
        onEdit={() => onEdit('client')}
      >
        {client?.name ?? '—'}
      </ReviewRow>

      <ReviewRow title={t.review.items.value} editLabel={editLabel} onEdit={() => onEdit('items')}>
        <ul className="lumio-invoice-wizard__review-lines">
          {form.lineItems.map((line, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id before saving
            <li key={index}>
              <span>
                {line.description || '—'}{' '}
                <span className="lumio-invoice-wizard__muted">
                  {line.quantity} × {formatMoney(Number(line.unitPrice || 0), currency, locale)}
                  {line.adjustmentPercent
                    ? ` ${line.adjustmentPercent > 0 ? '+' : ''}${line.adjustmentPercent}%`
                    : ''}
                </span>
              </span>
              <span>{formatMoney(lineAmount(line), currency, locale)}</span>
            </li>
          ))}
        </ul>
      </ReviewRow>

      <ReviewRow title={page.detail.tax.value} editLabel={editLabel} onEdit={() => onEdit('tax')}>
        {form.pricesIncludeTax ? t.tax.inclusiveTitle.value : t.tax.exclusiveTitle.value}
        {' · '}
        {rateLabels.join(', ')}
      </ReviewRow>

      <ReviewRow title={t.review.dates.value} editLabel={editLabel} onEdit={() => onEdit('dates')}>
        {formatInvoiceDate(form.issueDate, locale)}
        {' · '}
        {String(t.review.due.value).replace('{date}', formatInvoiceDate(form.dueDate, locale))}
      </ReviewRow>

      <ReviewRow
        title={t.review.extras.value}
        editLabel={editLabel}
        onEdit={() => onEdit('extras')}
      >
        <dl className="lumio-invoice-wizard__review-extras">
          <div>
            <dt>{page.detail.currency.value}</dt>
            <dd>{currency}</dd>
          </div>
          <div>
            <dt>{page.detail.recurring.value}</dt>
            <dd>
              {form.recurrenceInterval
                ? recurrenceLabels[form.recurrenceInterval]
                : t.extras.recurrenceNone.value}
            </dd>
          </div>
          {form.deliveryDate ? (
            <div>
              <dt>{einvoice.deliveryDate.value}</dt>
              <dd>{formatInvoiceDate(form.deliveryDate, locale)}</dd>
            </div>
          ) : null}
          {form.buyerReference.trim() ? (
            <div>
              <dt>{einvoice.buyerReference.value}</dt>
              <dd>{form.buyerReference}</dd>
            </div>
          ) : null}
          {form.notes ? (
            <div>
              <dt>{page.detail.notes.value}</dt>
              <dd className="lumio-invoice-wizard__review-notes">{form.notes}</dd>
            </div>
          ) : null}
        </dl>
      </ReviewRow>

      <WizardTotals form={form} />
    </>
  );
}
