'use client';

import { Box, Typography } from '@mui/material';
import MuiButton from '@mui/material/Button';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, ImageUp } from '@/app/components/icons';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { receiptsApi } from '@/app/lib/api';
import { useCamera } from './hooks/useCamera';

export interface ReceiptCameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptured?: () => void;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function
export function ReceiptCameraCapture({ isOpen, onClose, onCaptured }: ReceiptCameraCaptureProps) {
  const { videoRef, startCamera, capturePhoto, stopCamera, error, isCameraAvailable } = useCamera();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    void startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleBlobUpload = async (blob: Blob) => {
    setSubmitting(true);

    await (async () => {
      const file = new File([blob], 'receipt-scan.jpg', { type: blob.type || 'image/jpeg' });
      await receiptsApi.scanReceipt(file);
      toast.success('Receipt scan uploaded.');
      onCaptured?.();
      onClose();
    })()
      .catch(async () => {
        toast.error('Failed to upload receipt scan.');
      })
      .finally(async () => {
        setSubmitting(false);
      });
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleCapture = async () => {
    const blob = await capturePhoto();

    if (!blob) {
      toast.error('Capture failed. Try again.');
      return;
    }

    await handleBlobUpload(blob);
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Scan receipt" size="lg">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box
          sx={{ overflow: 'hidden', border: '1px solid var(--border-color)', bgcolor: '#020617' }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{ aspectRatio: '4/3', width: '100%', objectFit: 'cover', display: 'block' }}
          />
        </Box>

        {error ? (
          <Box
            sx={{
              border: '1px solid var(--color-warning-soft-border)',
              bgcolor: 'var(--color-warning-soft-bg)',
              px: 2,
              py: 1.5,
            }}
          >
            <Typography
              style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-warning-soft-text)' }}
            >
              Use your camera or choose a photo instead.
            </Typography>
            <Typography
              style={{ fontSize: 14, color: 'var(--color-warning-soft-text)', marginTop: 4 }}
            >
              {error}
            </Typography>
          </Box>
        ) : null}

        {!isCameraAvailable ? (
          <Box
            component="label"
            sx={{
              display: 'flex',
              cursor: 'pointer',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              border: '1px solid #cbd5e1',
              px: 2,
              py: 1.5,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
            }}
          >
            <ImageUp style={{ width: 16, height: 16 }} />
            Choose photo
            <input
              type="file"
              style={{ display: 'none' }}
              accept="image/*"
              capture="environment"
              aria-label="Upload receipt photo"
              onChange={async event => {
                const file = event.target.files?.[0];
                if (file) {
                  await handleBlobUpload(file);
                }
              }}
            />
          </Box>
        ) : null}

        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <MuiButton
            variant="contained"
            sx={{ minWidth: 176 }}
            onClick={() => {
              void handleCapture();
            }}
            disabled={submitting}
            aria-label="Capture photo"
            startIcon={<Camera size={16} />}
          >
            Capture photo
          </MuiButton>
        </Box>
      </Box>
    </ModalShell>
  );
}
