'use client';

import Box from '@mui/material/Box';
import type React from 'react';

interface BackgroundPreviewCardProps {
  /** The image URL, or null for the flat "no photo" surface. */
  src: string | null;
  name: string;
  description?: string | null;
}

/**
 * The workspace card in miniature, as the list shows it — the cover on top,
 * the name on a plain panel below — so a background is judged in place, not
 * as a loose tile. It follows the current pick.
 */
export function BackgroundPreviewCard({
  src,
  name,
  description,
}: BackgroundPreviewCardProps): React.JSX.Element {
  return (
    <Box
      aria-hidden="true"
      sx={{
        maxWidth: 280,
        mb: 2.5,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        bgcolor: 'var(--card)',
      }}
    >
      <Box
        sx={{
          aspectRatio: '16/9',
          bgcolor: 'var(--icon-badge-bg)',
          backgroundImage: src ? `url(${src})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <Box sx={{ px: 1.5, py: 1 }}>
        <Box
          sx={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </Box>
        {description ? (
          <Box
            sx={{
              fontSize: 12,
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {description}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
