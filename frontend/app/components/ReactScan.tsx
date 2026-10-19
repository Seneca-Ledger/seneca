'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    /** Render counts per component name since the last reset. */
    __reactScanCounts?: Map<string, number>;
    __reactScanReset?: () => void;
  }
}

type FiberType = { displayName?: string; name?: string; type?: FiberType; render?: FiberType };

const fiberName = (type: FiberType | string | null | undefined): string => {
  if (!type) return 'anonymous';
  if (typeof type === 'string') return type;
  return (
    type.displayName ?? type.name ?? fiberName(type.type) ?? fiberName(type.render) ?? 'anonymous'
  );
};

/**
 * Dev-only render profiler. The dynamic import sits inside a NODE_ENV branch
 * so the production webpack build never resolves `react-scan` (its ESM entry
 * does not compile under webpack; Turbopack in dev handles it fine).
 */
export function ReactScan(): null {
  useEffect(() => {
    // Must stay an `if` block (not an early return): webpack only drops the
    // dynamic import when it sits inside a statically-false branch.
    if (process.env.NODE_ENV === 'development') {
      const counts = new Map<string, number>();
      window.__reactScanCounts = counts;
      window.__reactScanReset = () => counts.clear();
      void import('react-scan').then(({ scan }) => {
        scan({
          // Scanning draws a flashing outline overlay on every re-rendered
          // component (there is no separate toggle for the outlines alone),
          // which fires on essentially every click. Leave it off by default;
          // flip to true for a one-off re-render audit.
          enabled: false,
          showToolbar: false,
          // Exposed so automated checks can read per-component render counts.
          onRender: fiber => {
            const name = fiberName(fiber.type as FiberType);
            counts.set(name, (counts.get(name) ?? 0) + 1);
          },
        });
      });
    }
  }, []);
  return null;
}
