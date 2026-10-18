/** Whether something modal covers the page. Kept apart so tests can stand in for it. */
// MUI renders a modal root only while a dialog, drawer, menu or popover is open
// (or keeps it with this class when closed).
const MUI_MODAL = '.MuiModal-root:not(.MuiModal-hidden)';
// Hand-made dialogs; some stay in the DOM while hidden, so only rendered ones count.
const MODAL_DIALOG = '[role="dialog"][aria-modal="true"], [role="alertdialog"], dialog[open]';

/**
 * Something modal covers the page (a guided tour by driver.js counts too): a guide
 * page never opens over it.
 */
export function isPageCovered(): boolean {
  if (document.querySelector(MUI_MODAL) || document.body.classList.contains('driver-active')) {
    return true;
  }
  return Array.from(document.querySelectorAll(MODAL_DIALOG)).some(
    element => element.getClientRects().length > 0,
  );
}
