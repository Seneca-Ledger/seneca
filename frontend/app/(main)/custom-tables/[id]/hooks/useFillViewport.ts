'use client';

import { useCallback, useLayoutEffect, useState } from 'react';

/** The grid never shrinks below this, so short windows scroll the page instead. */
const MIN_HEIGHT = 320;
/** The grid's 1px border above and below its scroll area. */
const GRID_BORDERS = 2;

/**
 * Scroll-area height that stretches a grid from where it starts down to the bottom of
 * the window, minus the page's bottom padding. Measured rather than guessed,
 * since the banner, header and a wrapping toolbar above the grid vary.
 *
 * The page scrolls on the document, so the element's top is taken relative to
 * the document. Its own height never moves its top, so the observers below
 * settle after one pass.
 */
export function useFillViewport<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const ref = useCallback((node: T | null) => setElement(node), []);

  useLayoutEffect(() => {
    if (!element) {
      return;
    }
    const page = element.closest<HTMLElement>('.lumio-ct');
    const measure = () => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      const bottom = page ? Number.parseFloat(getComputedStyle(page).paddingBottom) || 0 : 0;
      setHeight(Math.max(MIN_HEIGHT, Math.floor(window.innerHeight - top - bottom - GRID_BORDERS)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [element]);

  return [ref, height] as const;
}
