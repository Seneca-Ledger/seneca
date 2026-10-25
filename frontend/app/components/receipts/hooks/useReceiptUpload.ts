'use client';

import { useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';

export function useReceiptUpload() {
  const t = useIntlayer('receiptCapture');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadReceipts = async (files: File[], language?: string) => {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    if (language && language !== 'auto') {
      formData.append('language', language);
    }

    await (async () => {
      await apiClient.post('/receipts/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: event => {
          const total = event.total ?? 1;
          setProgress(Math.round((event.loaded * 100) / total));
        },
      });
    })()
      .catch(async uploadError => {
        const message = getApiErrorMessage(uploadError, t.uploadFailed.value);
        setError(message);
        throw uploadError;
      })
      .finally(async () => {
        setUploading(false);
        setProgress(0);
      });
  };

  return {
    uploadReceipts,
    uploading,
    progress,
    error,
  };
}
