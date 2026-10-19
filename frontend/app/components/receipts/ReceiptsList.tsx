'use client';

import { Box, Typography } from '@mui/material';
import { NoteCountsProvider } from '@/app/components/notes/NoteCountsContext';
import type { ReceiptRecord } from '@/app/lib/api';
import { ReceiptCard } from './ReceiptCard';

export interface ReceiptsListProps {
  receipts: ReceiptRecord[];
  isLoading?: boolean;
  onOpenReceipt?: (receipt: ReceiptRecord) => void;
}

const SKELETON_KEYS = [
  'receipt-skeleton-1',
  'receipt-skeleton-2',
  'receipt-skeleton-3',
  'receipt-skeleton-4',
  'receipt-skeleton-5',
  'receipt-skeleton-6',
];

export function ReceiptsList({ receipts, isLoading = false, onOpenReceipt }: ReceiptsListProps) {
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
        }}
      >
        {SKELETON_KEYS.map(key => (
          <Box
            key={key}
            sx={{
              height: 176,
              border: '1px solid var(--border-color)',
              bgcolor: 'var(--muted)',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          />
        ))}
      </Box>
    );
  }

  if (receipts.length === 0) {
    return (
      <Box
        sx={{
          border: '2px dashed #cbd5e1',
          bgcolor: 'var(--muted)',
          px: 3,
          py: 8,
          textAlign: 'center',
        }}
      >
        <Typography style={{ fontSize: 18, fontWeight: 600, color: 'var(--foreground)' }}>
          No receipts yet
        </Typography>
        <Typography style={{ marginTop: 8, fontSize: 14, color: 'var(--muted-foreground)' }}>
          Upload a receipt or scan one with your camera to start reviewing extracted data.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' },
      }}
    >
      <NoteCountsProvider entityType="receipt" entityIds={receipts.map(receipt => receipt.id)}>
        {receipts.map(receipt => (
          <ReceiptCard key={receipt.id} receipt={receipt} onOpen={onOpenReceipt} />
        ))}
      </NoteCountsProvider>
    </Box>
  );
}
