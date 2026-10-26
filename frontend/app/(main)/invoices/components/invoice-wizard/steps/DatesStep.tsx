'use client';

import type React from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { useIntlayer } from '@/app/i18n';
import type { InvoiceForm } from '../useInvoiceForm';

/** When the invoice is issued and by when it has to be paid. */
export function DatesStep({ form }: { form: InvoiceForm }): React.ReactElement {
  const t = useIntlayer('invoiceWizard');
  const page = useIntlayer('invoicesPage');
  const client = form.clients.find(entry => entry.id === form.clientId);
  const dueHint =
    client?.paymentTermsDays != null
      ? `${t.dates.dueHint.value} ${String(t.dates.termsNote.value).replace('{days}', String(client.paymentTermsDays))}`
      : t.dates.dueHint.value;

  return (
    <div className="seneca-payable-drawer__2col">
      <CustomDatePicker
        large
        label={page.columns.issueDate.value}
        value={form.issueDate}
        onChange={form.setIssueDate}
        helperText={t.dates.issueHint.value}
      />
      <CustomDatePicker
        large
        label={page.columns.dueDate.value}
        value={form.dueDate}
        minDate={form.issueDate}
        onChange={form.setDueDate}
        helperText={dueHint}
      />
    </div>
  );
}
