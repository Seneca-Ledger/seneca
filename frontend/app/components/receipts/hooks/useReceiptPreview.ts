'use client';

import { useEffect, useState } from 'react';
import { apiBaseUrl, type ReceiptRecord } from '@/app/lib/api';
import { getWorkspaceHeaders } from '@/app/lib/workspace-headers';

interface UseReceiptPreviewParams {
  isOpen: boolean;
  receipt: ReceiptRecord | null;
}

const revokeAndNull = (currentUrl: string | null): null => {
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  return null;
};

const hasPreviewableAttachment = (receipt: ReceiptRecord): boolean => {
  const mimeType = receipt.metadata?.attachments?.[0]?.mimeType;
  if (mimeType === undefined) return false;
  return mimeType !== 'application/pdf';
};

const fetchPreviewObjectUrl = async (receiptId: string): Promise<string | null> => {
  const response = await fetch(`${apiBaseUrl}/receipts/${receiptId}/file`, {
    method: 'GET',
    headers: getWorkspaceHeaders(),
    credentials: 'include',
  });
  if (!response.ok) return null;
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export function useReceiptPreview({ isOpen, receipt }: UseReceiptPreviewParams): string | null {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const previewable = isOpen && receipt && hasPreviewableAttachment(receipt);
    if (!previewable) {
      setPreviewUrl(revokeAndNull);
      return;
    }
    const receiptId = receipt.id;
    let active = true;
    let objectUrl: string | null = null;
    void fetchPreviewObjectUrl(receiptId).then(url => {
      objectUrl = url;
      if (active && url) setPreviewUrl(() => url);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, receipt]);

  return previewUrl;
}
