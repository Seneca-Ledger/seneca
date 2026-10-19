'use client';

import { Box, Typography } from '@mui/material';
import { useTheme } from 'next-themes';
import type { ReceiptRecord } from '@/app/lib/api';
import { tokens } from '@/lib/theme-tokens';

function CenteredMessage({ children }: { children: React.ReactNode }): React.ReactElement {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        minHeight: 388,
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        color: c.ink500,
      }}
    >
      {children}
    </Box>
  );
}

function PdfPreview({ url, subject }: { url: string; subject: string }): React.ReactElement {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  return (
    <iframe
      src={url}
      title={subject}
      style={{
        height: '100%',
        minHeight: 760,
        width: '100%',
        border: `1px solid ${c.ink150}`,
        background: 'var(--card-bg)',
        display: 'block',
      }}
    />
  );
}

function ImagePreview({ url, subject }: { url: string; subject: string }): React.ReactElement {
  return (
    <Box sx={{ display: 'flex', minHeight: '100%', minWidth: '100%', justifyContent: 'center' }}>
      <img
        src={url}
        alt={subject}
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

interface PreviewContentProps {
  previewLoading: boolean;
  previewUrl: string | null;
  previewMimeType: string | null;
  previewError: string | null;
  subject: string;
}

function PreviewContent({
  previewLoading,
  previewUrl,
  previewMimeType,
  previewError,
  subject,
}: PreviewContentProps): React.ReactElement {
  if (previewLoading) {
    return <CenteredMessage>Preparing preview...</CenteredMessage>;
  }
  if (previewError) {
    return <CenteredMessage>{previewError}</CenteredMessage>;
  }
  if (!previewUrl) {
    return <CenteredMessage>Preview unavailable</CenteredMessage>;
  }

  const isPdf = (previewMimeType || '').includes('pdf');
  return isPdf ? (
    <PdfPreview url={previewUrl} subject={subject} />
  ) : (
    <ImagePreview url={previewUrl} subject={subject} />
  );
}

interface ReceiptViewerProps {
  receipt: ReceiptRecord;
  previewLoading: boolean;
  previewUrl: string | null;
  previewMimeType: string | null;
  previewError: string | null;
}

export function ReceiptViewer({
  receipt,
  previewLoading,
  previewUrl,
  previewMimeType,
  previewError,
}: ReceiptViewerProps): React.ReactElement {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  return (
    <Box
      component="section"
      sx={{ display: 'flex', height: '100%', minHeight: 0, flexDirection: 'column' }}
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
          <Typography style={{ fontSize: 14, fontWeight: 600, color: c.ink900 }}>
            Original document
          </Typography>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', bgcolor: c.ink50, p: 2 }}>
          <PreviewContent
            previewLoading={previewLoading}
            previewUrl={previewUrl}
            previewMimeType={previewMimeType}
            previewError={previewError}
            subject={receipt.subject}
          />
        </Box>
      </Box>
    </Box>
  );
}
