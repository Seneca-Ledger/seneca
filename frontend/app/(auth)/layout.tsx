'use client';

import { Box } from '@mui/material';

/**
 * Backdrop of every auth page: a faint 32px grid and one soft emerald glow over
 * an off-white (day) or near-black green (night) — `.lumio-auth-backdrop` in
 * _auth.scss. Pure CSS: nothing animates, nothing to load.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types
export default function AuthRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lumio-auth-backdrop">
      <Box sx={{ position: 'relative', zIndex: 10 }}>{children}</Box>
    </div>
  );
}
