import { Box } from '@mui/material';
import type React from 'react';
import { tokens } from '@/lib/theme-tokens';

/** The bordered block every part of the bank-sync panel sits in. */
export function Panel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        bgcolor: 'background.paper',
        p: 2.5,
      }}
    >
      {children}
    </Box>
  );
}
