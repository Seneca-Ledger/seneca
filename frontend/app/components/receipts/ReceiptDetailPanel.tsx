'use client';
import { Box, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FileImage, FileText } from '@/app/components/icons';
import { NotesPanel } from '@/app/components/notes/NotesPanel';
import { PDFPreviewModal } from '@/app/components/PDFPreviewModal';
import { Button } from '@/app/components/ui/button';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import apiClient, { apiBaseUrl, type ReceiptRecord, receiptsApi } from '@/app/lib/api';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { normalizeReceiptLineItems } from '@/app/lib/financial-document';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { getWorkspaceHeaders } from '@/app/lib/workspace-headers';
import { ReceiptParsedDataForm } from './ReceiptParsedDataForm';
import type {
  EditableReceiptLineItem,
  EditableReceiptParsedData,
  ReceiptCategoryOption,
} from './receipt-types';

export interface ReceiptDetailPanelProps {
  isOpen: boolean;
  receipt: ReceiptRecord | null;
  onClose: () => void;
  onUpdated?: () => void;
}

function buildLineItems(receipt: ReceiptRecord | null): EditableReceiptLineItem[] {
  return normalizeReceiptLineItems(receipt?.parsedData).map((item, index) => ({
    id: `line-${index + 1}`,
    description: item.description,
    amount: item.amount,
  }));
}

function buildInitialForm(receipt: ReceiptRecord | null): EditableReceiptParsedData {
  return {
    vendor: receipt?.parsedData?.vendor ?? '',
    amount: receipt?.parsedData?.amount ?? '',
    currency: receipt?.parsedData?.currency ?? FALLBACK_CURRENCY,
    date: receipt?.parsedData?.date?.split('T')[0] ?? '',
    tax: receipt?.parsedData?.tax ?? '',
    paymentMethod: receipt?.parsedData?.paymentMethod ?? '',
    transactionType: receipt?.parsedData?.transactionType ?? 'expense',
    categoryId: receipt?.parsedData?.categoryId ?? '',
    lineItems: buildLineItems(receipt),
  };
}

function buildParsedDataPayload(formValue: EditableReceiptParsedData) {
  const lineItems = formValue.lineItems
    .filter(item => item.description.trim().length > 0 || Number.isFinite(item.amount))
    .map(item => ({ description: item.description, amount: item.amount }));

  return {
    vendor: formValue.vendor,
    amount: formValue.amount === '' ? undefined : Number(formValue.amount),
    currency: formValue.currency,
    date: formValue.date,
    tax: formValue.tax === '' ? undefined : Number(formValue.tax),
    paymentMethod: formValue.paymentMethod,
    transactionType: formValue.transactionType,
    categoryId: formValue.categoryId || undefined,
    lineItems,
  };
}

export function ReceiptDetailPanel({
  isOpen,
  receipt,
  onClose,
  onUpdated,
}: ReceiptDetailPanelProps) {
  const [categories, setCategories] = useState<ReceiptCategoryOption[]>([]);
  const [formValue, setFormValue] = useState<EditableReceiptParsedData>(buildInitialForm(receipt));
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setFormValue(buildInitialForm(receipt));
  }, [receipt]);

  useEffect(() => {
    if (!(isOpen && receipt)) {
      setPreviewUrl(currentUrl => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return null;
      });
      return;
    }

    const attachment = receipt.metadata?.attachments?.[0];
    if (!attachment || attachment.mimeType === 'application/pdf') {
      setPreviewUrl(currentUrl => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return null;
      });
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    const loadPreview = async () => {
      return await (async () => {
        const response = await fetch(`${apiBaseUrl}/receipts/${receipt.id}/file`, {
          method: 'GET',
          headers: getWorkspaceHeaders(),
          credentials: 'include',
        });

        if (!response.ok) {
          return;
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (active) {
          setPreviewUrl(currentUrl => {
            if (currentUrl) {
              URL.revokeObjectURL(currentUrl);
            }
            return objectUrl;
          });
        }
      })().catch(async () => {
        // ignore preview errors and keep fallback card visible
      });
    };

    void loadPreview();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isOpen, receipt]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let active = true;

    apiClient
      .get('/categories')
      .then(response => {
        if (active) {
          setCategories(response.data ?? []);
        }
      })
      .catch(() => {
        if (active) {
          setCategories([]);
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  const attachment = receipt?.metadata?.attachments?.[0];
  const isPdf = attachment?.mimeType === 'application/pdf';

  const payload = useMemo(() => buildParsedDataPayload(formValue), [formValue]);

  const handleFormChange = (nextValue: EditableReceiptParsedData) => {
    setFormValue(nextValue);
  };

  const handleCurrencyChange = async (nextValue: EditableReceiptParsedData) => {
    if (!receipt) return;

    await (async () => {
      await apiClient.patch(`/receipts/${receipt.id}`, {
        parsedData: buildParsedDataPayload(nextValue),
      });
      onUpdated?.();
    })().catch(async () => {
      toast.error('Failed to save receipt currency.');
    });
  };

  if (!receipt) {
    return null;
  }

  const handleSaveDraft = async () => {
    setSaving(true);

    await (async () => {
      await apiClient.patch(`/receipts/${receipt.id}`, {
        parsedData: payload,
      });
      toast.success('Receipt draft saved.');
      onUpdated?.();
    })()
      .catch(async () => {
        toast.error('Failed to save receipt draft.');
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const handleReject = async () => {
    setSaving(true);

    await (async () => {
      await apiClient.patch(`/receipts/${receipt.id}`, {
        status: 'rejected',
      });
      toast.success('Receipt rejected.');
      onUpdated?.();
      onClose();
    })()
      .catch(async () => {
        toast.error('Failed to reject receipt.');
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const handleApprove = async () => {
    setSaving(true);

    await (async () => {
      await apiClient.patch(`/receipts/${receipt.id}`, {
        parsedData: payload,
      });
      await receiptsApi.approveReceipt(receipt.id);
      toast.success('Receipt approved.');
      onUpdated?.();
      onClose();
    })()
      .catch(async () => {
        toast.error('Failed to approve receipt.');
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  return (
    <DrawerShell isOpen={isOpen} onClose={onClose} title="Receipt details" width="xl">
      <Box
        sx={{
          display: 'grid',
          minHeight: 0,
          flex: 1,
          gap: 3,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(260px, 0.9fr) minmax(0, 1.1fr)' },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ border: '1px solid var(--border-color)', bgcolor: 'var(--muted)', p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ bgcolor: 'background.paper', p: 1.5, color: 'var(--text-secondary)' }}>
                {isPdf ? (
                  <FileText style={{ width: 20, height: 20 }} />
                ) : (
                  <FileImage style={{ width: 20, height: 20 }} />
                )}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                  }}
                >
                  {receipt.subject}
                </Typography>
                <Typography style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
                  {receipt.source}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box
            sx={{
              border: '2px dashed #cbd5e1',
              bgcolor: 'background.paper',
              px: 2.5,
              py: 4,
              textAlign: 'center',
            }}
          >
            {isPdf ? (
              <PDFPreviewModal
                isOpen={true}
                onClose={() => undefined}
                fileId={receipt.id}
                fileName={receipt.subject}
                source="receipt"
              />
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt={receipt.subject}
                style={{ display: 'block', margin: '0 auto', maxHeight: 320, objectFit: 'contain' }}
              />
            ) : (
              <Box>
                <Typography style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
                  Original document preview
                </Typography>
                <Typography
                  style={{ marginTop: 8, fontSize: 14, color: 'var(--muted-foreground)' }}
                >
                  Preparing image preview...
                </Typography>
              </Box>
            )}
          </Box>

          <Box
            sx={{ border: '1px solid var(--border-color)', bgcolor: 'background.paper', p: 2.5 }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                fontSize: 14,
                color: 'var(--text-secondary)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Status
                </Typography>
                <Typography style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
                  {receipt.status}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Received
                </Typography>
                <Typography style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
                  {formatStoredDate(receipt.receivedAt)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Language
                </Typography>
                <Typography style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
                  {receipt.language || 'Auto'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', minHeight: 0, flexDirection: 'column' }}>
          <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
            <ReceiptParsedDataForm
              value={formValue}
              categories={categories}
              onChange={handleFormChange}
              onCurrencyChange={handleCurrencyChange}
            />

            <Box sx={{ mt: 3, borderTop: '1px solid var(--border-color)', pt: 2.5 }}>
              <NotesPanel entityType="receipt" entityId={receipt.id} />
            </Box>
          </Box>

          <Box
            sx={{
              mt: 3,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: { sm: 'flex-end' },
              gap: 1.5,
              borderTop: '1px solid var(--border-color)',
              pt: 2.5,
            }}
          >
            <Button variant="ghost" onClick={handleReject} disabled={saving}>
              Reject receipt
            </Button>
            <Button variant="outline" onClick={handleSaveDraft} disabled={saving}>
              Save draft
            </Button>
            <Button onClick={handleApprove} disabled={saving}>
              Approve receipt
            </Button>
          </Box>
        </Box>
      </Box>
    </DrawerShell>
  );
}
