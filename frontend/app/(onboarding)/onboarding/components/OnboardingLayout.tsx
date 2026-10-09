'use client';

import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

interface OnboardingLayoutProps {
  /** Logo and progress, pinned to the top of the form panel. */
  header: ReactNode;
  /** Pinned to the bottom of the form panel. */
  footer?: ReactNode;
  /** Shown over the backdrop on the right from `md` up; nothing below that. */
  aside?: ReactNode;
  children: ReactNode;
}

/**
 * Full-screen split, the sign-in pages' geometry: the questions on a solid
 * panel at the left, the backdrop at the right with a live preview of what
 * the answers change.
 */
export function OnboardingLayout({ header, footer, aside, children }: OnboardingLayoutProps) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
      }}
    >
      <Box
        className="lumio-auth-form-panel"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          minWidth: 0,
          // CSS variables, not the MUI palette: see AuthLayout, the palette is light
          // for a frame before Providers mounts.
          bgcolor: 'var(--card-bg)',
          color: 'var(--foreground)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* One column for everything: header, questions and buttons share the same edges. */}
        <Box sx={{ px: { xs: 2, sm: 6 }, pt: { xs: 2.5, sm: 4 } }}>
          <Box sx={{ width: '100%', maxWidth: 460, mx: 'auto' }}>{header}</Box>
        </Box>

        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            px: { xs: 2, sm: 6 },
            py: { xs: 4, sm: 6 },
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 460, mx: 'auto' }}>{children}</Box>
        </Box>

        {footer ? (
          <Box sx={{ px: { xs: 2, sm: 6 }, pb: { xs: 2.5, sm: 4 } }}>
            <Box sx={{ width: '100%', maxWidth: 460, mx: 'auto' }}>{footer}</Box>
          </Box>
        ) : null}
      </Box>

      <Box
        aria-hidden
        sx={{
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          justifyContent: 'center',
          p: 6,
          minWidth: 0,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420 }}>{aside}</Box>
      </Box>
    </Box>
  );
}
