'use client';

import { Box, IconButton, Modal, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { gmailReceiptsApi } from '@/app/lib/api';
import { tokens } from '@/lib/theme-tokens';

interface ReceiptPreviewModalProps {
  receiptId: string;
  onClose: () => void;
}

interface ReceiptPreviewAttachment {
  filename: string;
  mimeType: string;
  data: string;
}

interface ReceiptPreviewResponse {
  attachmentData?: ReceiptPreviewAttachment[];
  emailBody?: string;
  snippet?: string;
}

// eslint-disable-next-line max-lines-per-function
export function ReceiptPreviewModal({
  receiptId,
  onClose,
}: ReceiptPreviewModalProps): React.JSX.Element {
  const t = useIntlayer('receiptPreviewModal');
  const [preview, setPreview] = useState<ReceiptPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    let active = true;

    const loadPreview = async (): Promise<void> => {
      await (async () => {
        setLoading(true);
        const response = await gmailReceiptsApi.getReceiptPreview(receiptId);
        if (active) {
          setPreview(response.data);
        }
      })()
        .catch(async error => {
          console.error('Failed to load preview', error);
          if (active) {
            setPreview(null);
          }
        })
        .finally(async () => {
          if (active) {
            setLoading(false);
          }
        });
    };

    void loadPreview();

    return () => {
      active = false;
    };
  }, [receiptId]);

  const handleZoomIn = (): void => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = (): void => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  // eslint-disable-next-line max-lines-per-function, complexity
  const renderPreviewContent = (): React.JSX.Element => {
    if (loading) {
      return (
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
        >
          <Typography style={{ color: 'var(--muted-foreground)' }}>{t.loading}</Typography>
        </Box>
      );
    }

    if (!preview) {
      return (
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
        >
          <Typography style={{ color: 'var(--muted-foreground)' }}>{t.loadFailed}</Typography>
        </Box>
      );
    }

    const attachments = preview.attachmentData ?? [];
    if (attachments.length > 0) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* eslint-disable-next-line max-lines-per-function, max-params */}
          {attachments.map((attachment, idx) => {
            const isPdf = attachment.mimeType === 'application/pdf';
            const isImage = attachment.mimeType?.startsWith('image/');
            const base64Data = attachment.data.replace(/-/g, '+').replace(/_/g, '/');
            const dataUrl = `data:${attachment.mimeType};base64,${base64Data}`;

            return (
              <Box
                key={`${attachment.filename}-${idx}`}
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid var(--border-color)',
                  borderRadius: tokens.radius.lg,
                }}
              >
                <Box
                  sx={{
                    p: 1.5,
                    borderBottom: '1px solid var(--border-color)',
                    bgcolor: 'var(--muted)',
                  }}
                >
                  <Typography style={{ fontSize: 14, fontWeight: 500 }}>
                    {attachment.filename}
                  </Typography>
                </Box>
                <Box sx={{ p: 2 }}>
                  {isPdf ? (
                    <iframe
                      src={dataUrl}
                      style={{
                        width: '100%',
                        height: 600,
                        border: '1px solid var(--border-color)',
                        borderRadius: tokens.radius.md,
                      }}
                      title={attachment.filename}
                    />
                  ) : isImage ? (
                    <img
                      src={dataUrl}
                      alt={attachment.filename}
                      style={{ maxWidth: '100%', height: 'auto', borderRadius: tokens.radius.md }}
                    />
                  ) : (
                    <Box sx={{ textAlign: 'center', color: 'var(--muted-foreground)', py: 4 }}>
                      <Typography>{t.unsupportedType}</Typography>
                      <Typography style={{ fontSize: 14, marginTop: 8 }}>
                        {attachment.mimeType}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      );
    }

    if (preview.emailBody) {
      return (
        <Box
          sx={{
            bgcolor: 'background.paper',
            border: '1px solid var(--border-color)',
            borderRadius: tokens.radius.lg,
            overflow: 'hidden',
          }}
        >
          <iframe
            title={t.emailPreview.value}
            style={{ width: '100%', height: 600, border: 'none' }}
            sandbox="allow-same-origin"
            srcDoc={preview.emailBody}
          />
        </Box>
      );
    }

    return (
      <Box sx={{ textAlign: 'center', color: 'var(--muted-foreground)', py: 4 }}>
        <Typography>{t.noPreview}</Typography>
        {preview.snippet ? (
          <Typography style={{ marginTop: 8, fontSize: 14 }}>{preview.snippet}</Typography>
        ) : null}
      </Box>
    );
  };

  // Modal traps focus inside, closes on Escape and restores focus on unmount.
  return (
    <Modal open onClose={onClose} hideBackdrop>
      <Box tabIndex={-1} sx={{ outline: 'none' }}>
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.75)',
            zIndex: 50,
          }}
          aria-hidden="true"
          onClick={onClose}
        />
        <Box
          role="dialog"
          aria-modal="true"
          aria-label={t.title.value}
          sx={{
            position: 'fixed',
            inset: 16,
            bgcolor: 'background.paper',
            borderRadius: tokens.radius.xl,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <Typography style={{ fontSize: 18, fontWeight: 700 }}>{t.title}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                size="small"
                onClick={handleZoomOut}
                title={t.zoomOut.value}
                sx={{ borderRadius: tokens.radius.sm }}
              >
                <ZoomOut style={{ width: 20, height: 20 }} />
              </IconButton>
              <Typography style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                {zoom}%
              </Typography>
              <IconButton
                size="small"
                onClick={handleZoomIn}
                title={t.zoomIn.value}
                sx={{ borderRadius: tokens.radius.sm }}
              >
                <ZoomIn style={{ width: 20, height: 20 }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={onClose}
                title={t.close.value}
                sx={{ ml: 2, borderRadius: tokens.radius.sm }}
              >
                <X style={{ width: 20, height: 20 }} />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}>
              {renderPreviewContent()}
            </div>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}
