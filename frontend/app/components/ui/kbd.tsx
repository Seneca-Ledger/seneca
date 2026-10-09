'use client';

import Box from '@mui/material/Box';

/** One key cap. Shared by the shortcuts modal and the command palette hints. */
export function Kbd({ children }: { children: string }): React.JSX.Element {
  return (
    <Box
      component="kbd"
      sx={{
        display: 'inline-block',
        px: 1,
        py: 0.25,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'action.hover',
        fontFamily: 'monospace',
        fontSize: '0.8rem',
        fontWeight: 600,
        minWidth: 24,
        textAlign: 'center',
      }}
    >
      {children}
    </Box>
  );
}
