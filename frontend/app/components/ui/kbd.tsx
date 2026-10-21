'use client';

import Box from '@mui/material/Box';

/**
 * One key cap. Shared by the shortcuts modal and the command palette hints.
 *
 * Drawn after Actual Budget's key icon: a light cap with an ink outline and a
 * hard 1px offset shadow. Dark theme keeps the cap light, so it inverts.
 */
export function Kbd({ children }: { children: string }): React.JSX.Element {
  return (
    <Box
      component="kbd"
      sx={theme => {
        const dark = theme.palette.mode === 'dark';
        const fill = dark ? 'var(--foreground)' : 'var(--card)';
        const ink = dark ? 'var(--background)' : 'var(--foreground)';
        return {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 28,
          minHeight: 28,
          px: 0.75,
          borderRadius: '8px',
          border: '1px solid',
          borderColor: ink,
          bgcolor: fill,
          color: ink,
          boxShadow: `1px 1px 0 0 ${ink}`,
          fontFamily: 'inherit',
          fontSize: '0.8rem',
          fontWeight: 600,
          lineHeight: 1,
          whiteSpace: 'nowrap',
        };
      }}
    >
      {children}
    </Box>
  );
}
