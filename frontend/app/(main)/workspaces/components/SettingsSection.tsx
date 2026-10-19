'use client';

import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type React from 'react';

/**
 * One flat settings group: title and a line of context on the left (about a
 * third), the controls on the right. Groups are separated by a hairline and
 * whitespace instead of each sitting in its own card. Stacks on small screens.
 */
export function SettingsSection({
  title,
  description,
  children,
  tone = 'default',
  tourId,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** `danger` colours the title for irreversible actions. */
  tone?: 'default' | 'danger';
  tourId?: string;
}): React.ReactElement {
  return (
    <Box
      component="section"
      data-tour-id={tourId}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 3fr) minmax(0, 7fr)' },
        columnGap: 5,
        rowGap: 2,
        py: 3.5,
        borderTop: '1px solid',
        borderColor: theme => alpha(theme.palette.text.primary, 0.06),
      }}
    >
      <Box>
        <Typography
          component="h2"
          sx={{
            fontSize: 15,
            fontWeight: 600,
            color: tone === 'danger' ? 'error.main' : 'text.primary',
          }}
        >
          {title}
        </Typography>
        {description ? (
          <Typography sx={{ mt: 0.5, fontSize: 13, lineHeight: 1.5, color: 'text.secondary' }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}
