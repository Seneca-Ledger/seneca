'use client';

import { useEffect } from 'react';
import { TITLE_ID } from './welcome-tutorial.styles';

/**
 * Moves focus to the heading of a screen when the screen appears, rather than to the
 * dialog as a whole: a focused heading is what a screen reader announces.
 */
export function useFocusTitleOnMount(): void {
  useEffect(() => {
    document.getElementById(TITLE_ID)?.focus();
  }, []);
}
