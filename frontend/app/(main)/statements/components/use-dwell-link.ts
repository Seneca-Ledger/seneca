'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long the pointer has to rest on a link in a row (the category, a tag)
 * before it lights up. Until it does, the link is still part of the row and a
 * click opens the statement — the green sweep is what says "this one goes
 * somewhere else".
 */
const DWELL_MS = 450;

/** A link inside a clickable row that only acts as a link once it is lit. */
export function useDwellLink() {
  const [lit, setLit] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  const lightAfterDwell = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setLit(true), DWELL_MS);
  }, []);

  const unlight = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setLit(false);
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    // Ctrl/cmd/shift-click is the browser's own "open elsewhere"; let it be,
    // and only keep it off the row.
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      event.stopPropagation();
      return;
    }
    if (!lit) {
      // Not lit yet, so the link is still just a cell of the row: swallow the
      // navigation and let the click bubble up and open the statement.
      event.preventDefault();
      return;
    }
    event.stopPropagation();
  };

  return {
    lit,
    linkProps: {
      onClick,
      onMouseEnter: lightAfterDwell,
      onMouseLeave: unlight,
      // Keyboard focus has no pointer crossing the column to ignore, so it
      // lights the link at once and Enter follows it.
      onFocus: () => setLit(true),
      onBlur: unlight,
    },
  };
}
