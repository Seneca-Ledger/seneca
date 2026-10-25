'use client';

import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import apiClient, { type ReceiptRecord, receiptsApi } from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { buildParsedDataPayload } from '../helpers/receipt-builders';
import type { EditableReceiptParsedData } from '../receipt-types';

interface UseReceiptActionsParams {
  receipt: ReceiptRecord | null;
  payload: Record<string, unknown>;
  saving: boolean;
  setSaving: (value: boolean) => void;
  onClose: () => void;
  onUpdated?: () => void;
}

interface UseReceiptActionsReturn {
  handleCurrencyChange: (nextValue: EditableReceiptParsedData) => Promise<void>;
  handleSaveDraft: () => Promise<void>;
  handleReject: () => Promise<void>;
  handleApprove: () => Promise<void>;
}

const patchReceipt = (id: string, data: Record<string, unknown>): Promise<unknown> =>
  apiClient.patch(`/receipts/${id}`, data satisfies ContractInput<'UpdateReceiptBody'>);

const withSaving = async (
  setSaving: (v: boolean) => void,
  fn: () => Promise<void>,
): Promise<void> => {
  setSaving(true);
  try {
    await fn();
  } finally {
    setSaving(false);
  }
};

export function useReceiptActions({
  receipt,
  payload,
  setSaving,
  onClose,
  onUpdated,
}: UseReceiptActionsParams): UseReceiptActionsReturn {
  const t = useIntlayer('receiptReview');
  const handleCurrencyChange = async (nextValue: EditableReceiptParsedData): Promise<void> => {
    if (!receipt) return;
    try {
      await patchReceipt(receipt.id, { parsedData: buildParsedDataPayload(nextValue) });
      onUpdated?.();
    } catch {
      toast.error(t.currencySaveFailed.value);
    }
  };

  const handleSaveDraft = async (): Promise<void> => {
    if (!receipt) return;
    await withSaving(setSaving, async () => {
      await patchReceipt(receipt.id, { parsedData: payload });
      toast.success(t.draftSaved.value);
      onUpdated?.();
    });
  };

  const handleReject = async (): Promise<void> => {
    if (!receipt) return;
    await withSaving(setSaving, async () => {
      await patchReceipt(receipt.id, { status: 'rejected' });
      toast.success(t.rejected.value);
      onUpdated?.();
      onClose();
    });
  };

  const handleApprove = async (): Promise<void> => {
    if (!receipt) return;
    await withSaving(setSaving, async () => {
      await patchReceipt(receipt.id, { parsedData: payload });
      await receiptsApi.approveReceipt(receipt.id);
      toast.success(t.approved.value);
      onUpdated?.();
      onClose();
    });
  };

  return { handleCurrencyChange, handleSaveDraft, handleReject, handleApprove };
}
