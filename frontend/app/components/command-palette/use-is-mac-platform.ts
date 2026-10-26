'use client';

import { useEffect, useState } from 'react';

/**
 * Read after mount: the server has no platform, and guessing one would make the
 * first client render disagree with the markup.
 */
export function useIsMacPlatform(): boolean {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform));
  }, []);
  return isMac;
}
