import type { MouseEvent } from 'react';

/**
 * Click handler for the dimmed layer around a dialog: closes only when the dim area itself is
 * clicked, not when a click inside the dialog bubbles up. Keyboard users close with Escape.
 */
export function closeOnBackdropClick(
  onClose: () => void,
): (event: MouseEvent<HTMLElement>) => void {
  return event => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };
}
