'use client';
import { Box, Typography } from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Skeleton from '@mui/material/Skeleton';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft } from '@/app/components/icons';
import { ReceiptLocationSection } from '@/app/components/receipts/location/ReceiptLocationSection';
import { ReceiptParsedDataForm } from '@/app/components/receipts/ReceiptParsedDataForm';
import { ReceiptTransactionMatch } from '@/app/components/receipts/ReceiptTransactionMatch';
import type {
  EditableReceiptLineItem,
  EditableReceiptParsedData,
  ReceiptCategoryOption,
} from '@/app/components/receipts/receipt-types';
import { DetailActionButton } from '@/app/components/ui/detail-action-button';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import apiClient, { apiBaseUrl, type ReceiptRecord, receiptsApi } from '@/app/lib/api';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { normalizeReceiptLineItems } from '@/app/lib/financial-document';
import { getQueryClient } from '@/app/lib/query-client';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { getWorkspaceHeaders } from '@/app/lib/workspace-headers';
import { tokens } from '@/lib/theme-tokens';

type ReceiptExportColumn = {
  /** Row key the column's values are stored under; `title` is the localized header. */
  field: string;
  title: string;
  type: 'text' | 'number' | 'date';
};

type ReceiptExportRow = Record<string, string | number>;

type ReceiptExportColumnLabels = Record<
  'item' | 'vendor' | 'date' | 'amount' | 'currency' | 'source' | 'status',
  string
>;

function buildLineItems(receipt: ReceiptRecord | null): EditableReceiptLineItem[] {
  return normalizeReceiptLineItems(receipt?.parsedData).map((item, index) => ({
    id: `line-${index + 1}`,
    description: item.description,
    amount: item.amount,
  }));
}

function buildReceiptDisplayTitle(receipt: ReceiptRecord, titleTemplate: string): string {
  const vendor = receipt.parsedData?.vendor?.trim();
  if (!vendor) {
    return receipt.subject;
  }
  const date = receipt.parsedData?.date || receipt.receivedAt;
  return titleTemplate.replace('{vendor}', vendor).replace('{date}', formatStoredDate(date));
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

function buildReceiptExportData(
  receipt: ReceiptRecord,
  formValue: EditableReceiptParsedData,
  labels: ReceiptExportColumnLabels,
): {
  columns: ReceiptExportColumn[];
  rows: ReceiptExportRow[];
} {
  const parsedData = buildParsedDataPayload(formValue);
  const columns: ReceiptExportColumn[] = [];
  const baseRow: ReceiptExportRow = {};

  const hasLineItems = parsedData.lineItems.length > 0;

  if (hasLineItems) {
    columns.push({ field: 'Item', title: labels.item, type: 'text' });
  } else if (parsedData.vendor?.trim()) {
    columns.push({ field: 'Vendor', title: labels.vendor, type: 'text' });
    baseRow.Vendor = parsedData.vendor.trim();
  }
  if (parsedData.date?.trim()) {
    columns.push({ field: 'Date', title: labels.date, type: 'date' });
    baseRow.Date = parsedData.date.trim();
  }
  if (typeof parsedData.amount === 'number' && Number.isFinite(parsedData.amount)) {
    columns.push({ field: 'Amount', title: labels.amount, type: 'number' });
    baseRow.Amount = parsedData.amount;
  }
  if (parsedData.currency?.trim()) {
    columns.push({ field: 'Currency', title: labels.currency, type: 'text' });
    baseRow.Currency = parsedData.currency.trim();
  }
  if (receipt.source?.trim()) {
    columns.push({ field: 'Source', title: labels.source, type: 'text' });
    baseRow.Source = receipt.source.trim();
  }
  if (receipt.status?.trim()) {
    columns.push({ field: 'Status', title: labels.status, type: 'text' });
    baseRow.Status = receipt.status.trim();
  }

  if (hasLineItems) {
    return {
      columns,
      rows: parsedData.lineItems.map(item => ({
        Item: item.description,
        Date: baseRow.Date,
        Amount: item.amount,
        Currency: baseRow.Currency,
        Source: baseRow.Source,
        Status: baseRow.Status,
      })),
    };
  }

  return { columns, rows: [baseRow] };
}

type PreviewFetchResult = {
  url: string | null;
  mimeType: string | null;
  error?: string;
};

async function fetchReceiptPreview(receiptId: string): Promise<PreviewFetchResult> {
  try {
    const response = await fetch(`${apiBaseUrl}/receipts/${receiptId}/file`, {
      method: 'GET',
      headers: getWorkspaceHeaders(),
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Preview request failed: ${response.status}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const mimeType = response.headers.get('content-type') || blob.type || null;
    return { url, mimeType };
  } catch (err) {
    console.error('Failed to load receipt preview:', err);
    return { url: null, mimeType: null, error: 'Preview unavailable' };
  }
}

const previewPlaceholderSx = (inkColor: string) => ({
  display: 'flex',
  height: '100%',
  minHeight: 388,
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  color: inkColor,
});

function ReceiptPreviewContent({
  loading,
  error,
  url,
  isPdf,
  title,
  inkColor,
  borderColor,
}: {
  loading: boolean;
  error: string | null;
  url: string | null;
  isPdf: boolean;
  title: string;
  inkColor: string;
  borderColor: string;
}) {
  const t = useIntlayer('receiptDocumentPage');
  if (loading) {
    return <Box sx={previewPlaceholderSx(inkColor)}>{t.preparingPreview}</Box>;
  }
  // `error` is only ever set when the preview fetch failed; show the localized message.
  if (error || !url) {
    return <Box sx={previewPlaceholderSx(inkColor)}>{t.previewUnavailable}</Box>;
  }
  if (isPdf) {
    return (
      <iframe
        src={url}
        title={title}
        style={{
          height: '100%',
          minHeight: 760,
          width: '100%',
          border: `1px solid ${borderColor}`,
          borderRadius: tokens.radius.md,
          background: 'var(--card-bg)',
          display: 'block',
        }}
      />
    );
  }
  return (
    <Box sx={{ display: 'flex', minHeight: '100%', minWidth: '100%', justifyContent: 'center' }}>
      <img
        src={url}
        alt={title}
        style={{
          height: 'auto',
          minHeight: 0,
          width: '180%',
          minWidth: 720,
          maxWidth: 'none',
          objectFit: 'contain',
        }}
      />
    </Box>
  );
}

export default function ReceiptDocumentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const receiptId = params.id;
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const t = useIntlayer('receiptDocumentPage');

  const [receipt, setReceipt] = useState<ReceiptRecord | null>(null);
  const [categories, setCategories] = useState<ReceiptCategoryOption[]>([]);
  const [formValue, setFormValue] = useState<EditableReceiptParsedData>(buildInitialForm(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingToTable, setExportingToTable] = useState(false);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    await (async () => {
      setLoading(true);
      setError(null);

      const [receiptResponse, categoriesResponse] = await Promise.all([
        apiClient.get(`/receipts/${receiptId}`),
        apiClient.get('/categories'),
      ]);

      const nextReceipt = (receiptResponse.data?.data || receiptResponse.data) as ReceiptRecord;
      const nextCategories = (categoriesResponse.data?.data ||
        categoriesResponse.data ||
        []) as ReceiptCategoryOption[];

      setReceipt(nextReceipt);
      setFormValue(buildInitialForm(nextReceipt));
      setCategories(nextCategories);
    })()
      .catch(async loadError => {
        console.error('Failed to load receipt details:', loadError);
        setError(t.loadFailed.value);
        toast.error(t.loadFailed.value);
      })
      .finally(async () => {
        setLoading(false);
      });
  }, [receiptId, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!receipt) {
      setPreviewUrl(currentUrl => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return null;
      });
      setPreviewMimeType(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    const revokeAndSet = (nextUrl: string | null) => {
      setPreviewUrl(currentUrl => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return nextUrl;
      });
    };

    const run = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      const result = await fetchReceiptPreview(receipt.id);
      objectUrl = result.url;
      if (!active) {
        return;
      }
      if (result.error) {
        setPreviewError(result.error);
      }
      revokeAndSet(result.url);
      setPreviewMimeType(result.mimeType);
      setPreviewLoading(false);
    };

    void run();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [receipt]);

  const lastSavedPayloadRef = useRef<string | null>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!receipt) {
      lastSavedPayloadRef.current = null;
      return;
    }

    lastSavedPayloadRef.current = JSON.stringify(buildParsedDataPayload(buildInitialForm(receipt)));
  }, [receipt]);

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  const persistParsedData = useCallback(
    async (nextValue: EditableReceiptParsedData) => {
      if (!receipt) {
        return;
      }

      const nextPayload = buildParsedDataPayload(nextValue);
      const serializedPayload = JSON.stringify(nextPayload);

      if (serializedPayload === lastSavedPayloadRef.current) {
        return;
      }

      await (async () => {
        await apiClient.patch(`/receipts/${receipt.id}`, {
          parsedData: nextPayload,
        });
        lastSavedPayloadRef.current = serializedPayload;
        setReceipt(currentReceipt =>
          currentReceipt
            ? {
                ...currentReceipt,
                parsedData: {
                  ...currentReceipt.parsedData,
                  ...nextPayload,
                },
              }
            : currentReceipt,
        );
      })().catch(async () => {
        toast.error(t.autosaveFailed.value);
      });
    },
    [receipt, t],
  );

  const handleFormChange = useCallback(
    (nextValue: EditableReceiptParsedData) => {
      setFormValue(nextValue);

      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }

      autosaveTimeoutRef.current = setTimeout(() => {
        void persistParsedData(nextValue);
      }, 250);
    },
    [persistParsedData],
  );

  const handleApprove = async (options: { transactionId?: string | null } = {}) => {
    if (!receipt) {
      return;
    }

    setSaving(true);

    await (async () => {
      const currentPayload = buildParsedDataPayload(formValue);
      await apiClient.patch(`/receipts/${receipt.id}`, {
        parsedData: currentPayload,
      });
      lastSavedPayloadRef.current = JSON.stringify(currentPayload);
      await receiptsApi.approveReceipt(receipt.id, options);
      toast.success(t.approved.value);
      // It leaves the Review queue; both lists are cached for 30s.
      const queryClient = getQueryClient();
      void queryClient.invalidateQueries({ queryKey: ['gmail-receipts'] });
      void queryClient.invalidateQueries({ queryKey: ['statements'] });
      void queryClient.invalidateQueries({ queryKey: ['review-inbox'] });
      router.push(searchParams.get('from') === 'review' ? '/review' : '/statements/submit');
    })()
      .catch(async () => {
        toast.error(t.approveFailed.value);
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const handleDownload = async () => {
    if (!receipt) {
      return;
    }

    await (async () => {
      const response = await fetch(`${apiBaseUrl}/receipts/${receipt.id}/file`, {
        method: 'GET',
        headers: getWorkspaceHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Download request failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        receipt.metadata?.attachments?.[0]?.filename || receipt.subject || `${receipt.id}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    })().catch(async downloadError => {
      console.error('Failed to download receipt:', downloadError);
      toast.error(t.downloadFailed.value);
    });
  };

  const handleExportToTable = async () => {
    if (!receipt) {
      toast.error(t.exportUnavailable.value);
      return;
    }

    setExportingToTable(true);

    return await (async () => {
      const exportData = buildReceiptExportData(receipt, formValue, {
        item: t.columns.item.value,
        vendor: t.columns.vendor.value,
        date: t.columns.date.value,
        amount: t.columns.amount.value,
        currency: t.columns.currency.value,
        source: t.columns.source.value,
        status: t.columns.status.value,
      });

      if (!(exportData.columns.length && exportData.rows.length)) {
        toast.error(t.exportNoFields.value);
        return;
      }

      const createTableResponse = await apiClient.post('/custom-tables', {
        name: t.tableName.value.replace('{subject}', receipt.subject).slice(0, 120),
        description: t.tableDescription.value.replace(
          '{date}',
          formatStoredDate(receipt.receivedAt),
        ),
      });

      const createdTable = createTableResponse.data?.data || createTableResponse.data;
      const tableId = createdTable?.id;

      if (!tableId) {
        toast.error('Failed to export to table');
        router.push('/custom-tables');
        return;
      }

      const createdColumns = await Promise.all(
        exportData.columns.map(column =>
          apiClient.post(`/custom-tables/${tableId}/columns`, {
            title: column.title,
            type: column.type,
          }),
        ),
      );

      const columnKeyByField = exportData.columns.reduce<Record<string, string>>(
        (acc, column, index) => {
          const payload = createdColumns[index]?.data?.data || createdColumns[index]?.data;
          const key = payload?.key;
          if (key) {
            acc[column.field] = key;
          }
          return acc;
        },
        {},
      );

      const rows = exportData.rows.map(row => {
        const data = Object.entries(row).reduce<Record<string, string | number>>(
          (acc, [field, value]) => {
            const key = columnKeyByField[field];
            if (key && value !== undefined && value !== '') {
              acc[key] = value;
            }
            return acc;
          },
          {},
        );

        return { data };
      });

      await apiClient.post(`/custom-tables/${tableId}/rows/batch`, {
        rows,
      });

      toast.success(t.exportSuccess.value);
      router.push(`/custom-tables/${tableId}`);
      return;
    })()
      .catch(async () => {
        toast.error('Failed to export to table');
      })
      .finally(async () => {
        setExportingToTable(false);
      });
  };

  if (loading) {
    return (
      <Box
        className="container-shared"
        sx={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          px: { xs: 2, sm: 3, lg: 4 },
          py: 4,
        }}
      >
        <Box sx={{ display: 'flex', width: '100%', flexDirection: 'column', gap: 3 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              borderBottom: `1px solid ${c.ink150}`,
              pb: 3,
              alignItems: { sm: 'center' },
              justifyContent: { sm: 'space-between' },
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Skeleton variant="text" width={60} height={16} />
              <Skeleton variant="text" width={320} height={36} />
              <Skeleton variant="text" width={200} height={18} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Skeleton variant="rounded" width={110} height={36} />
              <Skeleton variant="rounded" width={140} height={36} />
              <Skeleton variant="rounded" width={140} height={36} />
            </Box>
          </Box>

          <Box
            sx={{
              display: 'grid',
              alignItems: 'stretch',
              gap: 3,
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(360px, 0.95fr) minmax(0, 1.05fr)' },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                height: '100%',
                minHeight: 420,
                flexDirection: 'column',
                overflow: 'hidden',
                border: `1px solid ${c.ink150}`,
                bgcolor: 'background.paper',
              }}
            >
              <Box sx={{ borderBottom: `1px solid ${c.ink150}`, px: 2.5, py: 2 }}>
                <Skeleton variant="text" width={140} height={20} />
              </Box>
              <Box sx={{ flex: 1, p: 2 }}>
                <Skeleton
                  variant="rectangular"
                  width="100%"
                  height="100%"
                  sx={{ minHeight: 360 }}
                />
              </Box>
            </Box>

            <Box
              sx={{
                height: '100%',
                border: `1px solid ${c.ink150}`,
                bgcolor: 'background.paper',
                p: 3,
              }}
            >
              <Skeleton variant="text" width={140} height={24} />
              <Skeleton variant="text" width={260} height={18} />
              <Box sx={{ mt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[0, 1, 2, 3, 4].map(idx => (
                  <Skeleton key={idx} variant="rounded" width="100%" height={40} />
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  if (error || !receipt) {
    return (
      <Box
        className="container-shared"
        sx={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          px: { xs: 2, sm: 3, lg: 4 },
          py: 4,
        }}
      >
        <Box
          sx={{
            mb: 2,
            border: `1px solid ${c.dangerSoft}`,
            bgcolor: c.dangerSoft,
            p: 2,
            color: c.danger,
          }}
        >
          {error || t.notFound}
        </Box>
        <Box
          component="button"
          type="button"
          onClick={() => router.back()}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            fontSize: 13,
            fontWeight: 500,
            color: c.ink500,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            p: 0,
            '&:hover': { color: c.ink700 },
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t.back}
        </Box>
      </Box>
    );
  }

  const attachment = receipt.metadata?.attachments?.[0];
  const isPdf = (previewMimeType || attachment?.mimeType || '').includes('pdf');
  const canExportToTable = Boolean(receipt);
  const displayTitle = buildReceiptDisplayTitle(receipt, t.displayTitle.value);

  return (
    <Box
      className="container-shared"
      // On wide screens the page fits the viewport: the document and the form
      // scroll on their own, so the header and Approve stay in view.
      sx={{
        height: '100%',
        overflowY: { xs: 'auto', xl: 'hidden' },
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        px: { xs: 2, sm: 3, lg: 4 },
        py: { xs: 4, xl: 2.5 },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          flexDirection: 'column',
          gap: { xs: 3, xl: 2 },
          flex: { xl: 1 },
          minHeight: { xl: 0 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            borderBottom: `1px solid ${c.ink150}`,
            pb: { xs: 3, xl: 2 },
            flexShrink: 0,
            alignItems: { sm: 'center' },
            justifyContent: { sm: 'space-between' },
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box
              component="button"
              type="button"
              onClick={() => router.back()}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: 13,
                fontWeight: 500,
                color: c.ink500,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                p: 0,
                '&:hover': { color: c.ink700 },
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t.back}
            </Box>
            <Box>
              <Typography
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  color: c.ink500,
                }}
              >
                {t.eyebrow}
              </Typography>
              <Typography
                component="h1"
                style={{
                  marginTop: 4,
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: c.ink900,
                }}
              >
                {displayTitle}
              </Typography>
              {displayTitle !== receipt.subject && (
                <Typography style={{ marginTop: 4, fontSize: 12, color: c.ink500 }}>
                  {receipt.subject}
                </Typography>
              )}
              <Typography style={{ marginTop: 4, fontSize: 13, color: c.ink700 }}>
                {receipt.source} · {formatStoredDate(receipt.receivedAt)}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <DetailActionButton variant="ghost" type="button" onClick={handleDownload}>
              {t.download}
            </DetailActionButton>
            <DetailActionButton
              variant="ghost"
              type="button"
              onClick={() => setExportConfirmOpen(true)}
              disabled={exportingToTable || !canExportToTable}
            >
              {t.exportToTable}
            </DetailActionButton>
            <DetailActionButton
              variant="default"
              type="button"
              onClick={() => void handleApprove()}
              disabled={saving}
            >
              {saving ? <Spinner className="size-[18px] mr-2" /> : null}
              {t.approve}
            </DetailActionButton>
          </Box>
        </Box>

        <ReceiptTransactionMatch
          receipt={receipt}
          saving={saving}
          onApprove={handleApprove}
          onChanged={loadData}
        />

        <Box
          sx={{
            display: 'grid',
            alignItems: 'stretch',
            gap: { xs: 3, xl: 2.5 },
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) minmax(0, 1fr)' },
            gridTemplateRows: { xl: 'minmax(0, 1fr)' },
            flex: { xl: 1 },
            minHeight: { xl: 0 },
          }}
        >
          <Box
            component="section"
            sx={{ display: 'flex', height: '100%', minHeight: 0, flexDirection: 'column' }}
          >
            <Box
              sx={{
                display: 'flex',
                height: '100%',
                minHeight: { xs: 420, xl: 0 },
                flexDirection: 'column',
                overflow: 'hidden',
                border: `1px solid ${c.ink150}`,
                borderRadius: tokens.radius.lg,
                bgcolor: 'background.paper',
              }}
            >
              <Box sx={{ borderBottom: `1px solid ${c.ink150}`, px: 2.5, py: 2 }}>
                <Typography style={{ fontSize: 14, fontWeight: 600, color: c.ink900 }}>
                  {t.originalDocument}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto', bgcolor: c.ink50, p: 2 }}>
                <ReceiptPreviewContent
                  loading={previewLoading}
                  error={previewError}
                  url={previewUrl}
                  isPdf={isPdf}
                  title={receipt.subject}
                  inkColor={c.ink500}
                  borderColor={c.ink150}
                />
              </Box>
            </Box>
          </Box>

          <Box
            component="section"
            sx={{
              height: '100%',
              minHeight: 0,
              overflowY: { xl: 'auto' },
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5,
              // No card: the form sits straight on the page, beside the document.
              px: { xl: 1 },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                borderBottom: `1px solid ${c.ink150}`,
                pb: 1.5,
              }}
            >
              <Box>
                <Typography style={{ fontSize: 16, fontWeight: 600, color: c.ink900 }}>
                  {t.parsedFields}
                </Typography>
                <Typography style={{ marginTop: 2, fontSize: 13, color: c.ink500 }}>
                  {t.parsedFieldsHint}
                </Typography>
              </Box>
            </Box>

            <ReceiptParsedDataForm
              compact
              value={formValue}
              categories={categories}
              onChange={handleFormChange}
            />

            {/* In the form's column, so correcting a place never scrolls the document away. */}
            <ReceiptLocationSection flat receipt={receipt} onReceiptChange={setReceipt} />
          </Box>
        </Box>
      </Box>

      <Dialog
        open={exportConfirmOpen}
        onClose={() => setExportConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 22, fontWeight: 600 }}>{t.confirmExportTitle}</DialogTitle>
        <DialogContent dividers>
          <Typography style={{ fontSize: 16, lineHeight: 2, color: c.ink800 }}>
            {t.confirmExportBody}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 4, py: 3, gap: 1.5 }}>
          <Box
            component="button"
            type="button"
            onClick={() => setExportConfirmOpen(false)}
            sx={{
              border: `1px solid ${c.ink150}`,
              bgcolor: 'background.paper',
              px: 3,
              py: 1.25,
              fontSize: 16,
              fontWeight: 500,
              color: c.ink700,
              cursor: 'pointer',
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
            }}
          >
            {t.cancel}
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => {
              setExportConfirmOpen(false);
              void handleExportToTable();
            }}
            disabled={exportingToTable || !canExportToTable}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'var(--primary-fill)',
              px: 3,
              py: 1.25,
              fontSize: 16,
              fontWeight: 500,
              color: '#fff',
              cursor: 'pointer',
              border: 'none',
              '&:hover': { bgcolor: 'primary.dark' },
              '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
            }}
          >
            {exportingToTable ? <Spinner className="h-4 w-4" /> : null}
            {t.confirmExport}
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
