'use client';

import { visuallyHidden } from '@mui/utils';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import type { InvoiceForm } from './useInvoiceForm';

/** "Step 2 of 6" and a row of hairline segments, as on the onboarding, without its logo. */
export function WizardProgress({
  current,
  labels,
  progressLabel,
}: {
  current: number;
  labels: string[];
  progressLabel: string;
}): React.ReactElement {
  return (
    <div className="lumio-invoice-wizard__progress">
      {/* "Step 2 of 6 · Items": the number and the name of the step. */}
      <span className="lumio-invoice-wizard__progress-label">
        {progressLabel}
        {labels[current] ? ` · ${labels[current]}` : ''}
      </span>
      <ol className="lumio-invoice-wizard__segments">
        {labels.map((label, index) => (
          <li
            key={label}
            aria-current={index === current ? 'step' : undefined}
            className={
              index <= current
                ? 'lumio-invoice-wizard__segment lumio-invoice-wizard__segment--done'
                : 'lumio-invoice-wizard__segment'
            }
          >
            <span style={visuallyHidden}>{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The question a step asks and what it means in plain words. It takes focus
 * when the step appears, so keyboard and screen-reader users land on the new
 * question instead of on the Continue button.
 */
export function WizardHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}): React.ReactElement {
  const ref = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="lumio-invoice-wizard__heading">
      <h2 ref={ref} tabIndex={-1}>
        {title}
      </h2>
      <p>{subtitle}</p>
    </div>
  );
}

/** A label, the control, and one line on what the field is for. */
export function WizardField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="lumio-payable-drawer__field-group">
      {htmlFor ? (
        <label className="lumio-payable-drawer__field-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="lumio-payable-drawer__field-label">{label}</span>
      )}
      {children}
      {hint ? <p className="lumio-invoice-wizard__hint">{hint}</p> : null}
    </div>
  );
}

/** Subtotal, tax and total of the invoice as it stands. */
export function WizardTotals({ form }: { form: InvoiceForm }): React.ReactElement {
  const t = useIntlayer('invoicesPage');
  const { locale } = useLocale();
  const { totals, currency } = form;
  // "Tax (19%)" when every line carries the same rate: a bare "Tax" says nothing on an invoice.
  const lineRates = new Set(form.lineItems.map(line => line.taxRateId || ''));
  const onlyRate =
    lineRates.size === 1
      ? form.taxRates.find(rate => rate.id === [...lineRates][0])?.rate
      : undefined;
  return (
    <dl className="lumio-invoice-wizard__totals">
      <div>
        <dt>{t.detail.subtotal.value}</dt>
        <dd>{formatMoney(totals.subtotal, currency, locale)}</dd>
      </div>
      <div>
        <dt>
          {t.detail.tax.value}
          {onlyRate !== undefined ? ` (${onlyRate}%)` : ''}
        </dt>
        <dd>{formatMoney(totals.taxTotal, currency, locale)}</dd>
      </div>
      <div className="lumio-invoice-wizard__total">
        <dt>{t.columns.total.value}</dt>
        <dd>{formatMoney(totals.total, currency, locale)}</dd>
      </div>
    </dl>
  );
}
