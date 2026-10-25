'use client';

import { Box, IconButton, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FileImage, FileText, UploadCloud, X } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { FORM_CONTROL_SX, Input } from '@/app/components/ui/input';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { Select } from '@/app/components/ui/select';
import { tokens } from '@/lib/theme-tokens';
import { useReceiptUpload } from './hooks/useReceiptUpload';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'application/pdf',
]);

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'eng', label: 'English' },
  { value: 'deu', label: 'German' },
  { value: 'fra', label: 'French' },
  { value: 'spa', label: 'Spanish' },
  { value: 'rus', label: 'Russian' },
  { value: 'jpn', label: 'Japanese' },
  { value: 'ara', label: 'Arabic' },
];

export interface ReceiptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded?: () => void;
}

export function ReceiptUploadModal({ isOpen, onClose, onUploaded }: ReceiptUploadModalProps) {
  const { uploadReceipts, uploading, progress, error } = useReceiptUpload();
  const [files, setFiles] = useState<File[]>([]);
  const [language, setLanguage] = useState('auto');
  const [localError, setLocalError] = useState<string | null>(null);

  const visibleError = localError ?? error;

  const uploadLabel = useMemo(() => {
    if (files.length === 1) {
      return 'Upload 1 receipt';
    }

    return `Upload ${files.length} receipts`;
  }, [files.length]);

  const resetState = () => {
    setFiles([]);
    setLanguage('auto');
    setLocalError(null);
  };

  const validateAndStoreFiles = (incomingFiles: File[]) => {
    const nextFiles = incomingFiles.slice(0, 5);

    if (nextFiles.some(file => !ACCEPTED_TYPES.has(file.type))) {
      setLocalError('Only JPG, PNG, WEBP, BMP, TIFF, and PDF files are supported.');
      return;
    }

    if (nextFiles.some(file => file.size > MAX_FILE_SIZE)) {
      setLocalError('Each file must be 10 MB or smaller.');
      return;
    }

    setLocalError(null);
    setFiles(nextFiles);
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      setLocalError('Select at least one receipt to upload.');
      return;
    }

    await (async () => {
      await uploadReceipts(files, language);
      toast.success('Receipts uploaded and queued for processing.');
      resetState();
      onClose();
      onUploaded?.();
    })().catch(async () => {
      // handled by hook state
    });
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={() => {
        resetState();
        onClose();
      }}
      title="Upload receipts"
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              resetState();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={uploading || files.length === 0}>
            {uploadLabel}
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box
          sx={{
            border: '1px dashed #cbd5e1',
            bgcolor: 'rgba(248, 250, 252, 0.8)',
          }}
        >
          <Box
            component="label"
            htmlFor="receipt-upload-input"
            sx={{
              display: 'flex',
              cursor: 'pointer',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1.5,
              px: 3,
              py: 5,
              textAlign: 'center',
            }}
          >
            <Box
              sx={{
                borderRadius: tokens.radius.full,
                bgcolor: 'background.paper',
                p: 2,
                color: 'primary.main',
              }}
            >
              <UploadCloud style={{ width: 24, height: 24 }} />
            </Box>
            <Box>
              <Typography style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
                Drop receipt images or PDFs here
              </Typography>
              <Typography style={{ marginTop: 4, fontSize: 14, color: 'var(--muted-foreground)' }}>
                Up to 5 files, 10 MB each. JPG, PNG, WEBP, BMP, TIFF, and PDF supported.
              </Typography>
            </Box>
          </Box>
          <Input
            id="receipt-upload-input"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0,0,0,0)',
              whiteSpace: 'nowrap',
            }}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/bmp,image/tiff,application/pdf,.xml,application/xml,text/xml"
            multiple
            aria-label="Select receipt files"
            onChange={event => {
              validateAndStoreFiles(Array.from(event.target.files ?? []));
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <label
            htmlFor="receipt-language"
            style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}
          >
            OCR language
          </label>
          <Select
            fullWidth
            id="receipt-language"
            inputProps={{ 'aria-label': 'OCR language' }}
            value={language}
            onChange={setLanguage}
            options={LANGUAGE_OPTIONS}
            sx={FORM_CONTROL_SX}
          />
        </Box>

        {visibleError ? (
          <Box
            sx={{
              border: '1px solid #fecaca',
              bgcolor: 'var(--color-error-soft-bg)',
              px: 2,
              py: 1.5,
            }}
          >
            <Typography style={{ fontSize: 14, color: 'var(--destructive)' }}>
              {visibleError}
            </Typography>
          </Box>
        ) : null}

        {uploading ? (
          <Box
            sx={{
              border: '1px solid var(--color-info-soft-border)',
              bgcolor: 'var(--color-info-soft-bg)',
              px: 2,
              py: 1.5,
            }}
          >
            <Typography
              style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-info-soft-text)' }}
            >
              Uploading... {progress}%
            </Typography>
          </Box>
        ) : null}

        {files.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {files.map(file => {
              const isPdf = file.type === 'application/pdf';
              return (
                <Box
                  key={`${file.name}-${file.size}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid var(--border-color)',
                    bgcolor: 'background.paper',
                    px: 2,
                    py: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        borderRadius: tokens.radius.full,
                        bgcolor: 'var(--muted)',
                        p: 1,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {isPdf ? (
                        <FileText style={{ width: 16, height: 16 }} />
                      ) : (
                        <FileImage style={{ width: 16, height: 16 }} />
                      )}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 14,
                          fontWeight: 500,
                          color: 'var(--foreground)',
                        }}
                      >
                        {file.name}
                      </Typography>
                      <Typography style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </Typography>
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => {
                      setFiles(currentFiles =>
                        currentFiles.filter(currentFile => currentFile !== file),
                      );
                    }}
                    sx={{
                      color: 'var(--muted-foreground)',
                      '&:hover': { bgcolor: 'var(--muted)', color: 'var(--text-secondary)' },
                      borderRadius: tokens.radius.md,
                    }}
                  >
                    <X style={{ width: 16, height: 16 }} />
                  </IconButton>
                </Box>
              );
            })}
          </Box>
        ) : null}
      </Box>
    </ModalShell>
  );
}
