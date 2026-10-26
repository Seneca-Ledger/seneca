import type { StorageTag } from '@/app/lib/contracts';
import type {
  CreatePayableInput,
  Payable,
  PayableSource,
  PayableStatus,
} from '@/app/lib/payables-api';

/** What the payable drawer's fields hold, and how a bill or a prefill fills them. */
export interface PayableFormState {
  vendor: string;
  amount: string;
  currency: string;
  dueDate: string;
  source: PayableSource;
  status: PayableStatus;
  comment: string;
  tags: StorageTag[];
}

export const createEmptyState = (defaultCurrency: string): PayableFormState => ({
  vendor: '',
  amount: '',
  currency: defaultCurrency,
  dueDate: '',
  source: 'manual',
  status: 'to_pay',
  comment: '',
  tags: [],
});

export const toFormState = (
  payable: Payable | null | undefined,
  initialValues: CreatePayableInput | null | undefined,
  defaultCurrency: string,
): PayableFormState => {
  if (!(payable || initialValues)) {
    return createEmptyState(defaultCurrency);
  }

  if (!payable && initialValues) {
    return {
      vendor: initialValues.vendor || '',
      amount: String(initialValues.amount ?? ''),
      currency: initialValues.currency || defaultCurrency,
      dueDate: initialValues.dueDate ? initialValues.dueDate.slice(0, 10) : '',
      source: initialValues.source || 'manual',
      status: initialValues.status || 'to_pay',
      comment: initialValues.comment || '',
      tags: [],
    };
  }

  return {
    vendor: payable?.vendor || '',
    amount: String(payable?.amount ?? ''),
    currency: payable?.currency || defaultCurrency,
    dueDate: payable?.dueDate ? payable.dueDate.slice(0, 10) : '',
    source: payable?.source || 'manual',
    status: payable?.status || 'to_pay',
    comment: payable?.comment || '',
    tags: [...(payable?.tags ?? [])],
  };
};
