'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import apiClient, { gmailReceiptsApi } from '@/app/lib/api';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { isLowConfidenceDocument, normalizeReceiptLineItems } from '@/app/lib/financial-document';
import type { AuditEvent } from '@/lib/api/audit';
import { fetchEntityHistory } from '@/lib/api/audit';

export interface GmailReceipt {
  id: string;
  subject: string;
  sender: string;
  receivedAt: string;
  status: string;
  gmailMessageId: string;
  parsedData?: {
    amount?: number;
    currency?: string;
    vendor?: string;
    date?: string;
    tax?: number;
    category?: string;
    categoryId?: string;
    confidence?: number;
    validationIssues?: string[];
    lineItems?: Array<{ description: string; amount: number }>;
    transactionType?: 'income' | 'expense' | 'transfer' | 'unknown';
  };
  metadata?: {
    snippet?: string;
    attachments?: Array<{ filename: string; size: number }>;
    potentialDuplicates?: string[];
  };
  isDuplicate: boolean;
  duplicateOfId?: string;
}

export interface ReceiptCategoryOption {
  id: string;
  name: string;
  isEnabled?: boolean;
}

export interface EditableLineItem {
  id: string;
  description: string;
  amount: number;
}

export interface EditableReceiptData {
  amount?: number;
  currency?: string;
  vendor?: string;
  date?: string;
  tax?: number;
  category?: string;
  categoryId?: string;
  lineItems: EditableLineItem[];
}

const createLineItemId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `line-${Math.random().toString(36).slice(2, 10)}`;

export const parseAmountValue = (value?: number | string | null): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
};

export const isIdEmpty = (id?: string | null): boolean =>
  !id || id === 'null' || id === 'undefined' || id === '0' || id === '';

export const buildGmailMessageLink = (gmailMessageId?: string | null): string | null => {
  if (!gmailMessageId) {
    return null;
  }
  return `https://mail.google.com/mail/u/0/#inbox/${gmailMessageId}`;
};

export interface UseGmailReceiptDataReturn {
  receipt: GmailReceipt | null;
  potentialDuplicates: GmailReceipt[];
  categories: ReceiptCategoryOption[];
  loading: boolean;
  editedData: EditableReceiptData;
  setEditedData: React.Dispatch<React.SetStateAction<EditableReceiptData>>;
  historyEvents: AuditEvent[];
  historyLoading: boolean;
  selectedHistoryEvent: AuditEvent | null;
  setSelectedHistoryEvent: (event: AuditEvent | null) => void;
  historyDrawerOpen: boolean;
  setHistoryDrawerOpen: (open: boolean) => void;
  selectedCategoryId: string;
  selectedCategory: ReceiptCategoryOption | undefined;
  hasCategory: boolean;
  hasDisabledCategory: boolean;
  enabledCategories: ReceiptCategoryOption[];
  currency: string;
  lineItemsTotal: number;
  amount: number;
  confidencePercent: number | null;
  warningCount: number;
  isLowConfidence: boolean;
  transactionType: string;
  income: number;
  expense: number;
  lineItems: EditableLineItem[];
  canSubmit: boolean;
  readinessSeverity: 'success' | 'warning' | 'error';
  readinessInlineText: string;
  gmailMessageLink: string | null;
  hasCategoryIssues: boolean;
  loadData: () => Promise<void>;
  setReceipt: React.Dispatch<React.SetStateAction<GmailReceipt | null>>;
  setPotentialDuplicates: React.Dispatch<React.SetStateAction<GmailReceipt[]>>;
}

export function useGmailReceiptData({
  receiptId,
}: {
  receiptId: string;
}): UseGmailReceiptDataReturn {
  const t = useIntlayer('gmailReceiptPage');
  const loadFailedText = t.toasts.loadFailed.value;
  const [receipt, setReceipt] = useState<GmailReceipt | null>(null);
  const [potentialDuplicates, setPotentialDuplicates] = useState<GmailReceipt[]>([]);
  const [categories, setCategories] = useState<ReceiptCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editedData, setEditedData] = useState<EditableReceiptData>({ lineItems: [] });
  const [historyEvents, setHistoryEvents] = useState<AuditEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryEvent, setSelectedHistoryEvent] = useState<AuditEvent | null>(null);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  const loadData = useCallback(async (): Promise<void> => {
    await (async () => {
      setLoading(true);
      const [receiptResponse, categoriesResponse] = await Promise.all([
        gmailReceiptsApi.getReceipt(receiptId),
        apiClient.get('/categories'),
      ]);

      const nextReceipt = receiptResponse.data.receipt as GmailReceipt;
      const parsedAmount = parseAmountValue(nextReceipt.parsedData?.amount ?? null) ?? 0;
      const nextLineItems = normalizeReceiptLineItems(nextReceipt.parsedData);
      const lineItemsSum = nextLineItems.reduce((sum, item) => sum + item.amount, 0);
      const lineItemsMismatch =
        parsedAmount > 0 &&
        nextLineItems.length > 0 &&
        Math.abs(lineItemsSum - parsedAmount) > 0.01;
      const editableLineItems =
        nextLineItems.length > 0 && !lineItemsMismatch
          ? nextLineItems.map(item => ({ id: createLineItemId(), ...item }))
          : [
              {
                id: createLineItemId(),
                description: nextReceipt.parsedData?.vendor || '',
                amount: parsedAmount,
              },
            ];

      setReceipt(nextReceipt);
      setPotentialDuplicates(receiptResponse.data.potentialDuplicates || []);
      setCategories(categoriesResponse.data || []);
      setEditedData({
        amount: parsedAmount || undefined,
        currency: nextReceipt.parsedData?.currency || FALLBACK_CURRENCY,
        vendor: nextReceipt.parsedData?.vendor || '',
        date: nextReceipt.parsedData?.date || '',
        tax: nextReceipt.parsedData?.tax,
        category: nextReceipt.parsedData?.category,
        categoryId: nextReceipt.parsedData?.categoryId,
        lineItems: editableLineItems,
      });
    })()
      .catch(async error => {
        console.error('Failed to load receipt details', error);
        toast.error(loadFailedText);
      })
      .finally(async () => {
        setLoading(false);
      });
  }, [receiptId, loadFailedText]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!receiptId) {
      return;
    }
    setHistoryLoading(true);
    fetchEntityHistory('receipt', receiptId)
      .then(events => setHistoryEvents(events || []))
      .catch(error => {
        console.error('Failed to load receipt history', error);
        setHistoryEvents([]);
      })
      .finally(() => setHistoryLoading(false));
  }, [receiptId]);

  const selectedCategoryId = editedData.categoryId || receipt?.parsedData?.categoryId || '';
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const hasCategory = !isIdEmpty(selectedCategoryId);
  const hasDisabledCategory = selectedCategory?.isEnabled === false;
  const hasCategoryIssues = !hasCategory || hasDisabledCategory;

  const currency = editedData.currency || receipt?.parsedData?.currency || FALLBACK_CURRENCY;
  const lineItemsTotal = editedData.lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const amount =
    editedData.lineItems.length > 0
      ? lineItemsTotal
      : (parseAmountValue(editedData.amount ?? receipt?.parsedData?.amount ?? null) ?? 0);

  const confidence = receipt?.parsedData?.confidence;
  const confidencePercent =
    typeof confidence === 'number' ? Math.round(Math.min(1, Math.max(0, confidence)) * 100) : null;
  const warningCount = (receipt?.parsedData?.validationIssues || []).length;
  const isLowConfidence = isLowConfidenceDocument(confidence ?? null);
  const transactionType = receipt?.parsedData?.transactionType || 'expense';
  const income = transactionType === 'income' ? amount : 0;
  const expense = transactionType === 'income' ? 0 : amount;
  const lineItems = editedData.lineItems;
  const canSubmit = amount > 0;

  const readinessSeverity: 'success' | 'warning' | 'error' = hasCategoryIssues
    ? 'error'
    : isLowConfidence || warningCount > 0
      ? 'warning'
      : 'success';

  const r = t.readiness;
  const readinessDetails = useMemo(() => {
    const segments: string[] = [];
    if (!hasCategory) {
      segments.push(r.noCategory.value);
    }
    if (hasDisabledCategory) {
      segments.push(r.categoryDisabled.value);
    }
    if (isLowConfidence) {
      segments.push(r.lowConfidence.value.replace('{percent}', String(confidencePercent)));
    }
    if (warningCount > 0) {
      segments.push(r.warnings.value.replace('{count}', String(warningCount)));
    }
    if (lineItems.length === 0) {
      segments.push(r.noLineItems.value);
    }
    return segments;
  }, [
    hasCategory,
    hasDisabledCategory,
    isLowConfidence,
    confidencePercent,
    warningCount,
    lineItems.length,
    r,
  ]);

  const readinessTitle =
    readinessSeverity === 'error'
      ? r.titleError.value
      : readinessSeverity === 'warning'
        ? r.titleWarning.value
        : r.titleReady.value;

  const readinessMessage =
    readinessDetails.length > 0 ? readinessDetails.join(' · ') : r.allGood.value;

  const readinessInlineText = `${readinessTitle}: ${readinessMessage}`;
  const enabledCategories = categories.filter(c => c.isEnabled !== false);
  const gmailMessageLink = receipt ? buildGmailMessageLink(receipt.gmailMessageId) : null;

  return {
    receipt,
    potentialDuplicates,
    categories,
    loading,
    editedData,
    setEditedData,
    historyEvents,
    historyLoading,
    selectedHistoryEvent,
    setSelectedHistoryEvent,
    historyDrawerOpen,
    setHistoryDrawerOpen,
    selectedCategoryId,
    selectedCategory,
    hasCategory,
    hasDisabledCategory,
    enabledCategories,
    currency,
    lineItemsTotal,
    amount,
    confidencePercent,
    warningCount,
    isLowConfidence,
    transactionType,
    income,
    expense,
    lineItems,
    canSubmit,
    readinessSeverity,
    readinessInlineText,
    gmailMessageLink,
    hasCategoryIssues,
    loadData,
    setReceipt,
    setPotentialDuplicates,
  };
}
