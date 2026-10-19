'use client';
import { Box, Chip, Paper, Typography } from '@mui/material';

import { Camera, FileImage, FileText, Mail, UploadCloud } from '@/app/components/icons';
import { NotesBadge } from '@/app/components/notes/NotesBadge';
import type { ReceiptRecord } from '@/app/lib/api';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';

const statusColorMap: Record<string, { bgcolor: string; color: string }> = {
  approved: { bgcolor: '#dcfce7', color: '#166534' },
  needs_review: { bgcolor: '#fef9c3', color: '#854d0e' },
  failed: { bgcolor: 'var(--color-error-soft-bg)', color: 'var(--destructive)' },
  parsed: { bgcolor: 'var(--color-info-soft-border)', color: '#1e40af' },
  new: { bgcolor: 'var(--muted)', color: 'var(--foreground)' },
  draft: { bgcolor: 'var(--muted)', color: 'var(--foreground)' },
  reviewed: { bgcolor: 'var(--color-info-soft-border)', color: '#1e40af' },
  rejected: { bgcolor: 'var(--color-error-soft-bg)', color: 'var(--destructive)' },
};

type ReceiptStatusKey = keyof typeof statusColorMap;

function formatAmount(amount?: number, currency?: string) {
  if (!Number.isFinite(amount)) {
    return 'Amount pending';
  }

  return (
    new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount ?? 0) + (currency ? ` ${currency}` : '')
  );
}

function getSourceIcon(source: string) {
  switch (source) {
    case 'scan':
      return <Camera style={{ width: 16, height: 16 }} />;
    case 'gmail':
      return <Mail style={{ width: 16, height: 16 }} />;
    case 'upload':
      return <UploadCloud style={{ width: 16, height: 16 }} />;
    default:
      return <FileImage style={{ width: 16, height: 16 }} />;
  }
}

export interface ReceiptCardProps {
  receipt: ReceiptRecord;
  onOpen?: (receipt: ReceiptRecord) => void;
}

export function ReceiptCard({ receipt, onOpen }: ReceiptCardProps) {
  const attachment = receipt.metadata?.attachments?.[0];
  const isPdf = attachment?.mimeType === 'application/pdf';
  const statusColors = statusColorMap[receipt.status as ReceiptStatusKey] ?? statusColorMap.draft;

  return (
    <Box
      component="button"
      type="button"
      onClick={() => onOpen?.(receipt)}
      aria-label={`Open receipt ${receipt.parsedData?.vendor || 'Unknown vendor'}`}
      sx={{
        width: '100%',
        cursor: 'pointer',
        textAlign: 'left',
        background: 'none',
        border: 'none',
        p: 0,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          height: '100%',
          border: '1px solid var(--border-color)',
          borderRadius: tokens.radius.lg,
          '&:hover': { borderColor: 'var(--border-color)' },
          transition: 'border-color 0.15s',
        }}
      >
        <Box sx={{ p: 2.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ bgcolor: 'var(--muted)', p: 1.5, color: 'var(--text-secondary)' }}>
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
                  {receipt.parsedData?.vendor || 'Unknown vendor'}
                </Typography>
                <Typography
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 14,
                    color: 'var(--muted-foreground)',
                  }}
                >
                  {receipt.subject}
                  <NotesBadge entityId={receipt.id} />
                </Typography>
              </Box>
            </Box>
            <Chip
              label={receipt.status}
              size="small"
              sx={{
                borderRadius: tokens.radius.full,
                fontSize: 12,
                bgcolor: statusColors.bgcolor,
                color: statusColors.color,
              }}
            />
          </Box>

          <Box
            sx={{
              mt: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 14,
              color: 'var(--muted-foreground)',
            }}
          >
            <span>{formatStoredDate(receipt.receivedAt)}</span>
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                bgcolor: 'var(--muted)',
                px: 1.25,
                py: 0.5,
                color: 'var(--text-secondary)',
              }}
            >
              {getSourceIcon(receipt.source)}
              {receipt.source}
            </Box>
          </Box>

          <Typography
            style={{ marginTop: 16, fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}
          >
            {formatAmount(receipt.parsedData?.amount, receipt.parsedData?.currency)}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
