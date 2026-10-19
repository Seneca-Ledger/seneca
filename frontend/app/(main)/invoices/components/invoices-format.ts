import type { BadgeVariant } from '@/app/components/ui/badge';
import type { InvoiceStatus } from '@/app/lib/invoices-api';

export function formatInvoiceDate(value: string | null | undefined, locale = 'en'): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value.length <= 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function getInvoiceStatusVariant(status: InvoiceStatus): BadgeVariant {
  switch (status) {
    case 'paid':
      return 'success';
    case 'partially_paid':
      return 'warning';
    case 'overdue':
      return 'destructive';
    case 'void':
      return 'outline';
    case 'sent':
      return 'info';
    default:
      return 'secondary';
  }
}
