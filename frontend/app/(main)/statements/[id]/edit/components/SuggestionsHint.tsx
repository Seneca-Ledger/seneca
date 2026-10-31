'use client';

import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useMarkPageHintsSeen } from '@/app/components/page-hints/useMarkPageHintsSeen';
import { useAuth } from '@/app/hooks/useAuth';

/** The key under `users.page_hints_seen`; raise the version to show it to everyone once more. */
const HINT_KEY = 'statementCategories';
const HINT_VERSION = 1;

export type SuggestionsHintLabels = {
  title: string;
  suggested: string;
  learns: string;
  gaps: string;
  gotIt: string;
};

/**
 * Whether the note on how categories get filled is open: on the first
 * statement a person opens, until they close it, and again whenever they ask.
 * Closed is remembered on the server, so another device does not show it again.
 */
export function useSuggestionsHint(): { open: boolean; show: () => void; close: () => void } {
  const { user } = useAuth();
  const markSeen = useMarkPageHintsSeen();
  const [asked, setAsked] = useState(false);
  // An older cached user without the record must never read as "not seen yet".
  const due =
    user?.pageHintsSeen !== undefined && (user.pageHintsSeen[HINT_KEY] ?? 0) < HINT_VERSION;
  return {
    open: asked || due,
    show: () => setAsked(true),
    close: () => {
      setAsked(false);
      if (due) {
        markSeen(HINT_KEY, HINT_VERSION);
      }
    },
  };
}

/**
 * A first look at a statement shows a column of categories to fill, and that
 * looks like work for every statement to come. This says otherwise, calmly:
 * the dashed ones are suggestions to check, every decision is remembered so
 * the next statements arrive filed, and a row left empty is fine — the bank
 * did not say, and only the person knows what the money was for.
 */
export function SuggestionsHint({
  labels,
  onClose,
}: {
  labels: SuggestionsHintLabels;
  onClose: () => void;
}): React.ReactElement {
  return (
    <Box
      role="note"
      sx={{
        mb: 2,
        p: 2,
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        borderRadius: 1.5,
        bgcolor: 'var(--surface-soft)',
      }}
    >
      <LightbulbOutlined
        aria-hidden
        sx={{ fontSize: 20, color: 'var(--primary)', flexShrink: 0, mt: '2px' }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 500, color: 'var(--foreground)' }}>
          {labels.title}
        </Typography>
        <Box
          component="ul"
          sx={{
            m: 0,
            mt: 0.75,
            pl: 2.25,
            display: 'grid',
            gap: 0.5,
            fontSize: 14,
            color: 'var(--text-muted)',
          }}
        >
          <li>{labels.suggested}</li>
          <li>{labels.learns}</li>
          <li>{labels.gaps}</li>
        </Box>
      </Box>
      <Button
        size="small"
        variant="text"
        onClick={onClose}
        sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 500 }}
      >
        {labels.gotIt}
      </Button>
    </Box>
  );
}
