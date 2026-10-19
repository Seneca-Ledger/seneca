'use client';

import { Stack, Typography } from '@mui/material';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';

/**
 * Standing reminder on every step, deliberately without a close button: the
 * accuracy caveat has to stay next to the figures it qualifies. A disclaimer,
 * not an alarm: one quiet grey line, no triangle and no coloured rule. A step
 * with notes of its own (the draft) passes them as `notes` to sit under it.
 */
export function AccuracyBanner({ notes = [] }: { notes?: React.ReactNode[] }): React.ReactElement {
  const t = useIntlayer('taxDeclarationPage');

  return (
    <Stack role="note" spacing={0.5}>
      <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.bannerAccuracy}</Typography>
      {notes.map((note, index) => (
        // Notes are plain text lines in a fixed order; nothing reorders them.
        // biome-ignore lint/suspicious/noArrayIndexKey: static list, see above
        <Typography key={index} sx={{ fontSize: 13, color: 'text.primary' }}>
          {note}
        </Typography>
      ))}
    </Stack>
  );
}
