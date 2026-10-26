'use client';

import { useEffect, useState } from 'react';
import type { SearchResultDocument } from './use-palette-sections';

/** Longer than a typed space, short enough to feel like holding rather than waiting. */
export const HOLD_PREVIEW_MS = 300;

type Hold = {
  document: SearchResultDocument;
  /** The field the press came from, so a tap types its space where the caret is. */
  input: HTMLInputElement;
  open: boolean;
};

/**
 * Holding Space over a result with a file shows that file until Space is let go,
 * like a click on a thumbnail in the Documents list. A quick tap still types a
 * space: it is held back on press and typed on release.
 */
export function useHoldPreview(
  document: SearchResultDocument | null,
  onType: (value: string) => void,
): {
  onKeyDown: (event: React.KeyboardEvent) => boolean;
  previewing: SearchResultDocument | null;
  closePreview: () => void;
} {
  const [hold, setHold] = useState<Hold | null>(null);
  const pressed = hold !== null && !hold.open;

  useEffect(() => {
    if (!pressed) {
      return;
    }
    const timer = setTimeout(
      () => setHold(held => held && { ...held, open: true }),
      HOLD_PREVIEW_MS,
    );
    return () => clearTimeout(timer);
  }, [pressed]);

  useEffect(() => {
    if (!hold) {
      return;
    }
    const release = (event: KeyboardEvent): void => {
      if (event.code !== 'Space') {
        return;
      }
      if (!hold.open) {
        typeSpace(hold.input, onType);
      }
      setHold(null);
    };
    // A release outside the window never arrives; leaving it ends the hold.
    const cancel = (): void => setHold(null);
    window.addEventListener('keyup', release);
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('keyup', release);
      window.removeEventListener('blur', cancel);
    };
  }, [hold, onType]);

  const onKeyDown = (event: React.KeyboardEvent): boolean => {
    if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }
    // The key repeats while held; none of the repeats may type.
    if (hold) {
      event.preventDefault();
      return true;
    }
    if (!(document && event.currentTarget instanceof HTMLInputElement)) {
      return false;
    }
    event.preventDefault();
    setHold({ document, input: event.currentTarget, open: false });
    return true;
  };

  return {
    onKeyDown,
    previewing: hold?.open ? hold.document : null,
    closePreview: () => setHold(null),
  };
}

function typeSpace(input: HTMLInputElement, onType: (value: string) => void): void {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  onType(`${input.value.slice(0, start)} ${input.value.slice(end)}`);
  // React writes the new value after this, which puts the caret at the end.
  requestAnimationFrame(() => input.setSelectionRange(start + 1, start + 1));
}
