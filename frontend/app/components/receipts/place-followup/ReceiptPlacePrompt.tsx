'use client';

import { Box, IconButton, Typography } from '@mui/material';
import { MapPin, X } from '@/app/components/icons';
import { DetailActionButton } from '@/app/components/ui/detail-action-button';

export type ReceiptPlacePromptLabels = {
  title: string;
  body: string;
  choose: string;
  close: string;
  dontShowAgain: string;
};

type ReceiptPlacePromptProps = {
  visible: boolean;
  /** Vendor and amount, so the user knows which receipt is meant. */
  summary: string | null;
  labels: ReceiptPlacePromptLabels;
  onChoose: () => void;
  onClose: () => void;
  onDontShowAgain: () => void;
};

/**
 * The toast body. Takes plain strings: react-hot-toast renders it under the
 * Toaster, so it should not rely on page-level providers.
 */
export function ReceiptPlacePrompt({
  visible,
  summary,
  labels,
  onChoose,
  onClose,
  onDontShowAgain,
}: ReceiptPlacePromptProps): React.JSX.Element {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        display: 'flex',
        gap: 1.5,
        border: '1px solid var(--border-color)',
        bgcolor: 'background.paper',
        color: 'var(--foreground)',
        p: 2,
        boxShadow: 3,
        opacity: visible ? 1 : 0,
        transition: 'opacity 150ms ease',
      }}
    >
      <Box sx={{ color: 'primary.main', pt: 0.25 }} aria-hidden="true">
        <MapPin size={20} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography style={{ fontSize: 14, fontWeight: 600 }}>{labels.title}</Typography>
        {summary ? (
          <Typography style={{ marginTop: 2, fontSize: 13, fontWeight: 500 }} noWrap>
            {summary}
          </Typography>
        ) : null}
        <Typography style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>{labels.body}</Typography>
        <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <DetailActionButton variant="default" type="button" onClick={onChoose}>
            {labels.choose}
          </DetailActionButton>
          <DetailActionButton variant="ghost" type="button" onClick={onDontShowAgain}>
            {labels.dontShowAgain}
          </DetailActionButton>
        </Box>
      </Box>
      <IconButton
        type="button"
        size="small"
        aria-label={labels.close}
        onClick={onClose}
        sx={{ alignSelf: 'flex-start', m: -0.5 }}
      >
        <X size={18} />
      </IconButton>
    </Box>
  );
}
