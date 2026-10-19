import type { Components, Theme } from '@mui/material/styles';

/** Marks the paper of a Select's menu, so its items may wrap. */
export const SELECT_MENU_CLASS = 'seneca-select-menu';

/** Below this a field is a chip in a toolbar; its menu may grow past it rather than wrap every option. */
const MIN_PINNED_MENU_WIDTH = 200;

/**
 * The field a Select's menu opened from: the combobox points at the menu's
 * listbox through `aria-controls`, and MUI anchors the menu on its parent.
 */
function fieldOf(paper: HTMLElement): HTMLElement | null {
  const listbox = paper.querySelector('[role="listbox"]');
  if (!listbox?.id) {
    return null;
  }
  const combobox = paper.ownerDocument.querySelector(`[aria-controls="${CSS.escape(listbox.id)}"]`);
  return combobox?.parentElement ?? null;
}

/**
 * MUI gives a Select's menu `min-width` = the field's `clientWidth` and lets it
 * grow with the longest option. Pinning width and max-width, before the popover
 * positions it, keeps the menu exactly under a form field. The width is the
 * field's on screen: side drawers shrink with CSS `zoom` on short screens,
 * where `clientWidth` is the unzoomed one and the menu (portalled outside the
 * drawer, at full scale) came out wider than the field and pushed left.
 */
export function fitMenuToField(node: HTMLElement): void {
  const field = fieldOf(node);
  const fieldWidth = field
    ? field.getBoundingClientRect().width
    : Number.parseFloat(node.style.minWidth);
  if (fieldWidth >= MIN_PINNED_MENU_WIDTH) {
    node.style.minWidth = `${fieldWidth}px`;
    node.style.width = `${fieldWidth}px`;
    node.style.maxWidth = `${fieldWidth}px`;
  }
}

/**
 * Theme defaults for every MUI Select (TextField select and ui/select too): a
 * dropdown opens exactly under its field, as wide as the field. MUI only sets a
 * minimum width, so a long option stretched the menu past the field and out of
 * the side drawer; long options wrap instead.
 */
export const selectMenuComponents: Pick<Components<Theme>, 'MuiSelect' | 'MuiMenuItem'> = {
  MuiSelect: {
    defaultProps: {
      MenuProps: {
        slotProps: {
          paper: { className: SELECT_MENU_CLASS },
          transition: { onEntering: fitMenuToField },
        },
      },
    },
  },
  MuiMenuItem: {
    styleOverrides: {
      root: { [`.${SELECT_MENU_CLASS} &`]: { whiteSpace: 'normal', overflowWrap: 'anywhere' } },
    },
  },
};
