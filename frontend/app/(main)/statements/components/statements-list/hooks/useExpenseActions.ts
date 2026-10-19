'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorStatus } from '@/app/lib/api-error';
import {
  enqueue,
  indexedDbStore,
  isNetworkFailure,
  isOfflineStoreAvailable,
} from '@/app/lib/offline/offline-queue';
import { checkContract } from '@/app/lib/query-fn-schema';
import type { StatementCategoryNode } from '@/app/lib/statement-categories';
import { type ManualExpenseDraft, type TaxRateOption } from '@/app/lib/statement-expense-drawer';
import {
  filterEnabledCategories,
  type StatementCategoryWithEnabled,
} from '../../StatementsListView.utils';
import {
  uploadReceiptScanFiles as runUploadReceiptScanFiles,
  uploadScanDrawerFiles as runUploadScanDrawerFiles,
  uploadStatementFiles as runUploadStatementFiles,
} from '../../statement-upload';

interface UploadLabels {
  pickAtLeastOne: string;
  uploadedProcessing: string;
  uploadFailed: string;
}

interface UseExpenseActionsParams {
  user: unknown;
  uploadLabels: UploadLabels;
  refreshAfterCreate: () => Promise<void>;
}

interface UseExpenseActionsResult {
  manualExpenseCategories: StatementCategoryNode[];
  manualExpenseTaxRates: TaxRateOption[];
  uploadStatementFiles: (
    files: File[],
    allowDuplicates: boolean,
    requireManualCategorySelection?: boolean,
  ) => Promise<void>;
  uploadReceiptScanFiles: (files: File[]) => Promise<void>;
  uploadScanDrawerFiles: (payload: {
    files: File[];
    allowDuplicates: boolean;
    requireManualCategorySelection: boolean;
  }) => Promise<void>;
  handleCreateManualExpense: (payload: {
    draft: ManualExpenseDraft;
    date: string;
    files: File[];
    allowDuplicates: boolean;
  }) => Promise<void>;
}

function buildManualExpenseFormData({
  draft,
  date,
  allowDuplicates,
  files,
  resolvedTaxRateId,
}: {
  draft: ManualExpenseDraft;
  date: string;
  allowDuplicates: boolean;
  files: File[];
  resolvedTaxRateId: string;
}): FormData {
  const fd = new FormData();
  fd.append('amount', draft.amount.trim());
  fd.append('currency', draft.currency.trim());
  fd.append('merchant', draft.merchant.trim());
  fd.append('description', draft.description.trim());
  fd.append('categoryId', draft.categoryId);
  if (resolvedTaxRateId) {
    fd.append('taxRateId', resolvedTaxRateId);
  }
  fd.append('date', date);
  fd.append('allowDuplicates', allowDuplicates ? 'true' : 'false');
  files.forEach(f => {
    fd.append('files', f);
  });
  return fd;
}

class NetworkDownError extends Error {}

async function tryPostToEndpoint(endpoint: string, formData: FormData): Promise<boolean> {
  try {
    await apiClient.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return true;
  } catch (error: unknown) {
    const status = getApiErrorStatus(error);
    if (status === 404 || status === 405) {
      return false;
    }
    if (isNetworkFailure(status)) {
      throw new NetworkDownError('network');
    }
    console.error('Failed to create manual expense:', error);
    throw new Error('Failed to create manual expense');
  }
}

export function useExpenseActions({
  user,
  uploadLabels,
  refreshAfterCreate,
}: UseExpenseActionsParams): UseExpenseActionsResult {
  const [manualExpenseCategories, setManualExpenseCategories] = useState<StatementCategoryNode[]>(
    [],
  );
  const [manualExpenseTaxRates, setManualExpenseTaxRates] = useState<TaxRateOption[]>([]);
  const offlineText = useIntlayer('offlineBanner');

  useEffect(() => {
    if (!user) {
      return;
    }
    const load = async (): Promise<void> => {
      await (async () => {
        const [categoriesRes, taxRatesRes] = await Promise.all([
          apiClient.get('/categories', { params: { type: 'expense' } }),
          apiClient.get('/tax-rates'),
        ]);
        const rawCategories: StatementCategoryWithEnabled[] = await checkContract(
          'CategoryList',
          categoriesRes.data,
          '/categories',
        );
        setManualExpenseCategories(filterEnabledCategories(rawCategories));
        const rawTaxRates = await checkContract('TaxRateList', taxRatesRes.data, '/tax-rates');
        setManualExpenseTaxRates(
          rawTaxRates.map(r => ({
            ...r,
            rate: Number(r.rate || 0),
            isEnabled: r.isEnabled !== false,
          })),
        );
      })().catch(async error => {
        console.error('Failed to load manual expense options:', error);
        setManualExpenseCategories([]);
        setManualExpenseTaxRates([]);
      });
    };
    void load();
  }, [user]);

  const uploadStatementFiles = async (
    files: File[],
    allowDuplicates: boolean,
    requireManualCategorySelection = false,
  ): Promise<void> =>
    runUploadStatementFiles({
      files,
      allowDuplicates,
      requireManualCategorySelection,
      labels: uploadLabels,
      onUploadSuccess: msg => toast.success(msg),
      refreshAfterCreate,
    });

  const uploadReceiptScanFilesAction = async (files: File[]): Promise<void> =>
    runUploadReceiptScanFiles({
      files,
      labels: uploadLabels,
      onUploadSuccess: msg => toast.success(msg),
      refreshAfterCreate,
    });

  const uploadScanDrawerFiles = async (payload: {
    files: File[];
    allowDuplicates: boolean;
    requireManualCategorySelection: boolean;
  }): Promise<void> =>
    runUploadScanDrawerFiles({
      payload,
      labels: uploadLabels,
      onUploadSuccess: msg => toast.success(msg),
      refreshAfterCreate,
    });

  const handleCreateManualExpense = async (payload: {
    draft: ManualExpenseDraft;
    date: string;
    files: File[];
    allowDuplicates: boolean;
  }): Promise<void> => {
    const fallbackTaxRateId = manualExpenseTaxRates.find(r => r.isEnabled && r.isDefault)?.id || '';
    const resolvedTaxRateId = payload.draft.taxRateId || fallbackTaxRateId;
    const formData = buildManualExpenseFormData({
      draft: payload.draft,
      date: payload.date,
      allowDuplicates: payload.allowDuplicates,
      files: payload.files,
      resolvedTaxRateId,
    });

    // No network: keep it on the device and send it when the connection is back.
    const keepOffline = async (): Promise<void> => {
      await enqueue(indexedDbStore, {
        kind: 'manual-expense',
        fields: {
          amount: payload.draft.amount.trim(),
          currency: payload.draft.currency.trim(),
          merchant: payload.draft.merchant.trim(),
          description: payload.draft.description.trim(),
          categoryId: payload.draft.categoryId,
          ...(resolvedTaxRateId ? { taxRateId: resolvedTaxRateId } : {}),
          date: payload.date,
          allowDuplicates: payload.allowDuplicates ? 'true' : 'false',
        },
        files: payload.files,
      });
      toast.success(offlineText.savedOffline.value);
    };
    if (isOfflineStoreAvailable() && typeof navigator !== 'undefined' && !navigator.onLine) {
      await keepOffline();
      return;
    }

    const endpoints = ['/statements/manual-expense', '/expenses/manual', '/expenses'];
    try {
      for (const endpoint of endpoints) {
        const succeeded = await tryPostToEndpoint(endpoint, formData);
        if (succeeded) {
          toast.success('Manual expense created');
          await refreshAfterCreate();
          return;
        }
      }
    } catch (error) {
      if (error instanceof NetworkDownError && isOfflineStoreAvailable()) {
        await keepOffline();
        return;
      }
      throw error;
    }
    throw new Error('Manual expense creation is not available yet');
  };

  return {
    manualExpenseCategories,
    manualExpenseTaxRates,
    uploadStatementFiles,
    uploadReceiptScanFiles: uploadReceiptScanFilesAction,
    uploadScanDrawerFiles,
    handleCreateManualExpense,
  };
}
