'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import { gmailReceiptsApi } from '@/app/lib/api';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { getQueryClient } from '@/app/lib/query-client';
import type {
  EditableReceiptData,
  GmailReceipt,
  ReceiptCategoryOption,
} from './useGmailReceiptData';
import { parseAmountValue } from './useGmailReceiptData';

export interface UseGmailReceiptActionsProps {
  receiptId: string;
  receipt: GmailReceipt | null;
  editedData: EditableReceiptData;
  categories: ReceiptCategoryOption[];
  setReceipt: React.Dispatch<React.SetStateAction<GmailReceipt | null>>;
  setPotentialDuplicates: React.Dispatch<React.SetStateAction<GmailReceipt[]>>;
  setEditedData: React.Dispatch<React.SetStateAction<EditableReceiptData>>;
}

export interface UseGmailReceiptActionsReturn {
  saving: boolean;
  submitting: boolean;
  exporting: boolean;
  categorySaving: boolean;
  payableDrawerOpen: boolean;
  setPayableDrawerOpen: (open: boolean) => void;
  categoryDrawerOpen: boolean;
  setCategoryDrawerOpen: (open: boolean) => void;
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  handleSaveChanges: () => Promise<void>;
  handleSubmitDocument: () => Promise<void>;
  handleCategorySelect: (categoryId: string) => Promise<void>;
  handleExportToGmailDraft: () => Promise<void>;
  handleExportToXlsx: () => Promise<void>;
  handleMarkDuplicate: (originalId: string) => Promise<void>;
  handleUnmarkDuplicate: () => Promise<void>;
  handleCreatePayable: () => Promise<void>;
}

export function useGmailReceiptActions({
  receiptId,
  receipt,
  editedData,
  categories,
  setReceipt,
  setPotentialDuplicates,
  setEditedData,
}: UseGmailReceiptActionsProps): UseGmailReceiptActionsReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useIntlayer('gmailReceiptPage');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [payableDrawerOpen, setPayableDrawerOpen] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const refreshReceipt = async (): Promise<void> => {
    const response = await gmailReceiptsApi.getReceipt(receiptId);
    setReceipt(response.data.receipt);
    setPotentialDuplicates(response.data.potentialDuplicates || []);
  };

  const handleSaveChanges = async (): Promise<void> => {
    await (async () => {
      setSaving(true);
      const normalizedLineItems = editedData.lineItems
        .filter(item => Number.isFinite(item.amount))
        .map(item => ({ description: item.description, amount: item.amount }));
      const lineItemsTotal = normalizedLineItems.reduce((sum, item) => sum + item.amount, 0);

      await gmailReceiptsApi.updateReceiptParsedData(receiptId, {
        ...editedData,
        amount: normalizedLineItems.length > 0 ? lineItemsTotal : editedData.amount,
        lineItems: normalizedLineItems,
      });
      toast.success(t.toasts.receiptUpdated.value);
      await refreshReceipt();
    })()
      .catch(async error => {
        console.error('Failed to save receipt changes', error);
        toast.error(t.toasts.saveFailed.value);
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const handleSubmitDocument = async (): Promise<void> => {
    if (!receipt) {
      return;
    }
    const amount = parseAmountValue(editedData.amount ?? receipt.parsedData?.amount ?? null);
    if (amount === null || amount <= 0) {
      toast.error(t.toasts.amountRequired.value);
      return;
    }

    await (async () => {
      setSubmitting(true);
      await gmailReceiptsApi.approveReceipt(receipt.id, {
        description: editedData.vendor || receipt.parsedData?.vendor || receipt.subject,
        amount,
        currency: editedData.currency || receipt.parsedData?.currency || FALLBACK_CURRENCY,
        date: editedData.date || receipt.parsedData?.date || receipt.receivedAt,
      });
      toast.success(t.toasts.submitted.value);
      // It leaves the Review queue; both lists are cached for 30s.
      const queryClient = getQueryClient();
      void queryClient.invalidateQueries({ queryKey: ['gmail-receipts'] });
      void queryClient.invalidateQueries({ queryKey: ['statements'] });
      void queryClient.invalidateQueries({ queryKey: ['review-inbox'] });
      router.push(searchParams.get('from') === 'review' ? '/review' : '/statements/submit');
    })()
      .catch(async error => {
        console.error('Failed to submit receipt', error);
        toast.error(t.toasts.submitFailed.value);
      })
      .finally(async () => {
        setSubmitting(false);
      });
  };

  const handleCategorySelect = async (categoryId: string): Promise<void> => {
    if (!receipt || categorySaving) {
      return;
    }

    const selected = categories.find(c => c.id === categoryId);

    await (async () => {
      setCategorySaving(true);
      await gmailReceiptsApi.updateReceiptParsedData(receipt.id, {
        categoryId: categoryId || null,
        category: selected?.name || null,
      });

      setEditedData(prev => ({
        ...prev,
        categoryId: categoryId || undefined,
        category: selected?.name,
      }));

      setReceipt(prev =>
        prev
          ? {
              ...prev,
              parsedData: {
                ...prev.parsedData,
                categoryId: categoryId || undefined,
                category: selected?.name,
              },
            }
          : prev,
      );

      setCategoryDrawerOpen(false);
      toast.success(t.toasts.categoryUpdated.value);
    })()
      .catch(async error => {
        console.error('Failed to update category', error);
        toast.error(t.toasts.categoryUpdateFailed.value);
      })
      .finally(async () => {
        setCategorySaving(false);
      });
  };

  const handleExportToGmailDraft = async (): Promise<void> => {
    await (async () => {
      setExporting(true);
      const response = await gmailReceiptsApi.exportReceiptToDraft(receiptId);
      const url = response.data?.data?.url;
      if (url) {
        window.open(url, '_blank');
      }
      toast.success(t.toasts.draftCreated.value);
    })()
      .catch(async error => {
        console.error('Failed to create Gmail draft', error);
        toast.error(t.toasts.draftFailed.value);
      })
      .finally(async () => {
        setExporting(false);
      });
  };

  const handleExportToXlsx = async (): Promise<void> => {
    await (async () => {
      setExporting(true);
      const response = await gmailReceiptsApi.exportReceiptsToXlsx([receiptId]);
      if (response.data?.url) {
        window.open(response.data.url, '_blank');
      }
      toast.success(t.toasts.exportedToExcel.value);
    })()
      .catch(async error => {
        console.error('Failed to export receipt', error);
        toast.error(t.toasts.exportFailed.value);
      })
      .finally(async () => {
        setExporting(false);
      });
  };

  const handleMarkDuplicate = async (originalId: string): Promise<void> => {
    await (async () => {
      await gmailReceiptsApi.markDuplicate(receiptId, originalId);
      toast.success(t.toasts.markedDuplicate.value);
      await refreshReceipt();
    })().catch(async error => {
      console.error('Failed to mark duplicate', error);
      toast.error(t.toasts.markDuplicateFailed.value);
    });
  };

  const handleUnmarkDuplicate = async (): Promise<void> => {
    await (async () => {
      await gmailReceiptsApi.unmarkDuplicate(receiptId);
      toast.success(t.toasts.duplicateRemoved.value);
      await refreshReceipt();
    })().catch(async error => {
      console.error('Failed to unmark duplicate', error);
      toast.error(t.toasts.unmarkFailed.value);
    });
  };

  const handleCreatePayable = async (): Promise<void> => {
    toast.success(t.toasts.payableReady.value);
    router.push('/statements/pay');
  };

  return {
    saving,
    submitting,
    exporting,
    categorySaving,
    payableDrawerOpen,
    setPayableDrawerOpen,
    categoryDrawerOpen,
    setCategoryDrawerOpen,
    showPreview,
    setShowPreview,
    handleSaveChanges,
    handleSubmitDocument,
    handleCategorySelect,
    handleExportToGmailDraft,
    handleExportToXlsx,
    handleMarkDuplicate,
    handleUnmarkDuplicate,
    handleCreatePayable,
  };
}
