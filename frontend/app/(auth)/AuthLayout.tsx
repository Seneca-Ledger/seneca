'use client';

import { Box, Grid } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  sideContent: ReactNode;
  topRightAction?: ReactNode;
}

// eslint-disable-next-line max-lines-per-function, @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types
export default function AuthLayout({ children, sideContent, topRightAction }: AuthLayoutProps) {
  return (
    <Grid container sx={{ minHeight: '100vh', overflow: 'hidden' }}>
      {/* Left Side - Form */}
      <Grid
        size={{ xs: 12, md: 6 }}
        className="lumio-auth-form-panel"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          // The CSS variable, not the MUI palette: next-themes sets the theme
          // class on <html> in a blocking script before the first paint, while
          // the MUI theme is built light until Providers flips `mounted` after
          // its first effect. Reading the palette here painted this panel white
          // for a frame on every load in dark mode.
          bgcolor: 'var(--card-bg)',
          color: 'var(--foreground)',
          p: 6,
          position: 'relative',
          zIndex: 20,
        }}
      >
        {topRightAction ? (
          <Box sx={{ position: 'absolute', top: 0, right: 0, p: 2, zIndex: 40 }}>
            {topRightAction}
          </Box>
        ) : null}

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          style={{ width: '100%', maxWidth: '400px' }}
        >
          {children}
        </motion.div>
      </Grid>

      {/* Right side — the hero over the layout's grid-and-glow backdrop */}
      <Grid
        size={{ xs: 0, md: 6 }}
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          // Make transparent to show parent layout background
          background: 'transparent',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          p: 4,
        }}
      >
        {/* Content Overlay */}
        <Box sx={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '600px' }}>
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {sideContent}
            </motion.div>
          </AnimatePresence>
        </Box>
      </Grid>
    </Grid>
  );
}
