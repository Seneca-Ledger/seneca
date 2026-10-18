/** What the hints read from the live page. Kept apart so tests can stand in for it. */

function isShown(element: HTMLElement): boolean {
  if (!element.isConnected || element.closest('[aria-hidden="true"], [inert]')) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }
  return window.getComputedStyle(element).visibility !== 'hidden';
}

/** The first element matching `selector` that the person can see, if any. */
export function findVisibleAnchor(selector: string): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    if (isShown(element)) {
      return element;
    }
  }
  return null;
}

// MUI renders a modal root only while a dialog, drawer, menu or popover is open
// (or keeps it with this class when closed).
const MUI_MODAL = '.MuiModal-root:not(.MuiModal-hidden)';
// Hand-made dialogs; some stay in the DOM while hidden, so only rendered ones count.
const MODAL_DIALOG = '[role="dialog"][aria-modal="true"], [role="alertdialog"], dialog[open]';

/**
 * Something modal covers the page: a hint never opens over it, and waits for it
 * to close. A guided tour (driver.js) counts too.
 */
export function isPageCovered(): boolean {
  if (document.querySelector(MUI_MODAL) || document.body.classList.contains('driver-active')) {
    return true;
  }
  return Array.from(document.querySelectorAll(MODAL_DIALOG)).some(
    element => element.getClientRects().length > 0,
  );
}
