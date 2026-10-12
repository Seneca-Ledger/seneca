'use client';

import { useEffect, useMemo, useState } from 'react';
import { type ReceiptRecord } from '@/app/lib/api';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { buildInitialForm, buildParsedDataPayload } from '../helpers/receipt-builders';
import type { EditableReceiptParsedData, ReceiptCategoryOption } from '../receipt-types';
import { useReceiptActions } from './useReceiptActions';
import { useReceiptPreview } from './useReceiptPreview';

interface UseReceiptDetailParams {
  isOpen: boolean;
  receipt: ReceiptRecord | null;
  onClose: () => void;
  onUpdated?: () => void;
}

interface UseReceiptDetailReturn {
  categories: ReceiptCategoryOption[];
  formValue: EditableReceiptParsedData;
  saving: boolean;
  previewUrl: string | null;
  handleFormChange: (nextValue: EditableReceiptParsedData) => void;
  handleCurrencyChange: (nextValue: EditableReceiptParsedData) => Promise<void>;
  handleSaveDraft: () => Promise<void>;
  handleReject: () => Promise<void>;
  handleApprove: () => Promise<void>;
}

export function useReceiptDetail({
  isOpen,
  receipt,
  onClose,
  onUpdated,
}: UseReceiptDetailParams): UseReceiptDetailReturn {
  const [categories, setCategories] = useState<ReceiptCategoryOption[]>([]);
  const [formValue, setFormValue] = useState<EditableReceiptParsedData>(buildInitialForm(receipt));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormValue(buildInitialForm(receipt));
  }, [receipt]);

  const previewUrl = useReceiptPreview({ isOpen, receipt });

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    apiQueryDecoded({ url: '/categories', contract: 'CategoryList' })
      .then(categories => {
        if (active) setCategories(categories);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const payload = useMemo(() => buildParsedDataPayload(formValue), [formValue]);

  const handleFormChange = (nextValue: EditableReceiptParsedData): void => {
    setFormValue(nextValue);
  };

  const { handleCurrencyChange, handleSaveDraft, handleReject, handleApprove } = useReceiptActions({
    receipt,
    payload,
    saving,
    setSaving,
    onClose,
    onUpdated,
  });

  return {
    categories,
    formValue,
    saving,
    previewUrl,
    handleFormChange,
    handleCurrencyChange,
    handleSaveDraft,
    handleReject,
    handleApprove,
  };
}
