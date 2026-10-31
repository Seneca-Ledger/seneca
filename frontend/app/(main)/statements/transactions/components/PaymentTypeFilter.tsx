'use client';

import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { FILTER_PAYMENT_TYPES, type FilterPaymentType } from '../all-transactions';

/** Narrows the table to the rows paid one way; the pies and month counts stay whole. */
export function PaymentTypeFilter({
  value,
  onChange,
}: {
  value: FilterPaymentType | undefined;
  onChange: (next: FilterPaymentType | undefined) => void;
}): React.JSX.Element {
  const t = useIntlayer('allTransactionsPage');
  const types = useIntlayer('paymentTypes');
  return (
    <Select
      size="small"
      value={value ?? ''}
      inputProps={{ 'aria-label': t.paymentType.value }}
      onChange={next => onChange(FILTER_PAYMENT_TYPES.find(type => type === next))}
      options={[
        { value: '', label: t.allPaymentTypes.value },
        ...FILTER_PAYMENT_TYPES.map(type => ({ value: type, label: types[type].value })),
      ]}
    />
  );
}
