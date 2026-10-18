'use client';

import { useLayoutEffect, useState } from 'react';
import { measureSidebarSpot, NO_SPOT, type SidebarSpot } from './sidebar-spot';

/**
 * Where the sidebar item of `path` is on screen, measured before paint and again on
 * every resize (which is also when the sidebar shows or hides).
 */
export function useSidebarSpot(path: string | undefined): SidebarSpot {
  const [spot, setSpot] = useState<SidebarSpot>(NO_SPOT);
  useLayoutEffect(() => {
    if (!path) {
      return undefined;
    }
    const update = (): void => setSpot(measureSidebarSpot(path));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [path]);
  return spot;
}
