'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import type { SpotRect } from './sidebar-spot';
import { sidebarRingSx } from './welcome-tutorial.styles';

/**
 * A sage ring around the sidebar item of the page on show. It is fixed to the window
 * and rendered inside the dialog, so it is drawn above the backdrop; it takes no clicks.
 */
export function SidebarRing({ rect }: { rect: SpotRect }): React.JSX.Element {
  return (
    <Box
      aria-hidden
      data-testid="guide-sidebar-ring"
      sx={sidebarRingSx}
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
    />
  );
}
