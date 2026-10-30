import { useIntlayer } from '@/app/i18n';
import type { InvoiceStatus } from '@/app/lib/invoices-api';

/**
 * Status names in the UI language. Read one key at a time: indexing an intlayer
 * dictionary with a variable types as `any` and silently loses a missing status.
 */
export function useInvoiceStatusLabels(): Record<InvoiceStatus, string> {
  const t = useIntlayer('invoicesPage');
  return {
    draft: String(t.statusLabels.draft.value),
    sent: String(t.statusLabels.sent.value),
    partially_paid: String(t.statusLabels.partially_paid.value),
    paid: String(t.statusLabels.paid.value),
    overdue: String(t.statusLabels.overdue.value),
    void: String(t.statusLabels.void.value),
  };
}
