import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { getApiErrorStatus } from '@/app/lib/api-error';
import type { ManualExpenseDraft } from '@/app/lib/statement-expense-drawer';

export interface ManualExpensePayload {
  draft: ManualExpenseDraft;
  date: string;
  files: File[];
  allowDuplicates: boolean;
}

interface FormDataParams {
  payload: ManualExpensePayload;
  taxRateId: string;
}

export function buildManualExpenseFormData({ payload, taxRateId }: FormDataParams): FormData {
  const formData = new FormData();
  formData.append('amount', payload.draft.amount.trim());
  formData.append('currency', payload.draft.currency.trim());
  formData.append('merchant', payload.draft.merchant.trim());
  formData.append('description', payload.draft.description.trim());
  formData.append('categoryId', payload.draft.categoryId);
  if (taxRateId) {
    formData.append('taxRateId', taxRateId);
  }
  formData.append('date', payload.date);
  formData.append('allowDuplicates', payload.allowDuplicates ? 'true' : 'false');
  payload.files.forEach(file => {
    formData.append('files', file);
  });
  return formData;
}

interface TrySingleEndpointParams {
  endpoint: string;
  formData: FormData;
}

export async function trySingleEndpoint({
  endpoint,
  formData,
}: TrySingleEndpointParams): Promise<'ok' | 'skip' | 'fail'> {
  try {
    await apiClient.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return 'ok';
  } catch (error: unknown) {
    const status = getApiErrorStatus(error);
    if (status === 404 || status === 405) {
      return 'skip';
    }
    console.error('Failed to create manual expense:', error);
    return 'fail';
  }
}

interface SubmitManualExpenseParams {
  payload: ManualExpensePayload;
  taxRateId: string;
  onSuccess: () => Promise<void>;
}

export async function submitManualExpense({
  payload,
  taxRateId,
  onSuccess,
}: SubmitManualExpenseParams): Promise<void> {
  const formData = buildManualExpenseFormData({ payload, taxRateId });
  const endpoints = ['/statements/manual-expense', '/expenses/manual', '/expenses'];
  const results = await Promise.allSettled(
    endpoints.map(endpoint => trySingleEndpoint({ endpoint, formData })),
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value === 'ok') {
      toast.success('Manual expense created');
      await onSuccess();
      return;
    }
    if (result.status === 'fulfilled' && result.value === 'fail') {
      throw new Error('Failed to create manual expense');
    }
  }
  throw new Error('Manual expense creation is not available yet');
}
