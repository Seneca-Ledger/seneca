'use client';

import { Box } from '@mui/material';

/**
 * Backdrop of every auth page: a faint 32px grid and one soft emerald glow over
 * an off-white (day) or near-black green (night) — `.seneca-auth-backdrop` in
 * _auth.scss. Pure CSS: nothing animates, nothing to load.
 */
export default function AuthRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="seneca-auth-backdrop">
      <Box sx={{ position: 'relative', zIndex: 10 }}>{children}</Box>
    </div>
  );
}
