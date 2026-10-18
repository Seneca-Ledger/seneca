/** A box in viewport coordinates, as getBoundingClientRect gives it. */
export interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface SidebarSpot {
  /** The sidebar item of the page on show, padded for its ring; null while the sidebar is hidden. */
  item: SpotRect | null;
  /** How far the sidebar reaches in from its edge of the window, so the guide can sit beside it. */
  inset: number;
  viewport: { width: number; height: number };
}

export const NO_SPOT: SidebarSpot = { item: null, inset: 0, viewport: { width: 0, height: 0 } };

// The ring sits just outside the item: its padding plus the item's own 12px corners.
const SPOT_PADDING = 3;
export const SPOT_RADIUS = 12 + SPOT_PADDING;

/** Sidebar.tsx marks every nav item with its path. */
export function navItemSelector(path: string): string {
  return `[data-nav-path="${path}"]`;
}

function padded(rect: DOMRect): SpotRect {
  return {
    top: rect.top - SPOT_PADDING,
    left: rect.left - SPOT_PADDING,
    width: rect.width + SPOT_PADDING * 2,
    height: rect.height + SPOT_PADDING * 2,
  };
}

/** The item and its box, unless the sidebar is hidden (display: none measures as an empty box). */
function shownItem(path: string, doc: Document): { item: Element; rect: DOMRect } | null {
  const item = doc.querySelector(navItemSelector(path));
  if (!item) {
    return null;
  }
  const rect = item.getBoundingClientRect();
  return rect.width && rect.height ? { item, rect } : null;
}

export function measureSidebarSpot(path: string, doc: Document = document): SidebarSpot {
  const shown = shownItem(path, doc);
  if (!shown) {
    return NO_SPOT;
  }
  const { item, rect } = shown;
  const sidebar = item.closest('aside')?.getBoundingClientRect() ?? rect;
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const rtl = doc.documentElement.dir === 'rtl';
  return {
    item: padded(rect),
    inset: rtl ? viewport.width - sidebar.left : sidebar.right,
    viewport,
  };
}

/**
 * The backdrop's outline with a rounded hole over the item (even-odd fill), so the
 * item shows undimmed while the rest of the page stays behind the backdrop.
 */
export function spotlightClipPath(spot: SidebarSpot): string | undefined {
  if (!spot.item) {
    return undefined;
  }
  const { top: y, left: x, width: w, height: h } = spot.item;
  const r = Math.min(SPOT_RADIUS, w / 2, h / 2);
  const arc = `A${r} ${r} 0 0 1`;
  const hole =
    `M${x + r} ${y}H${x + w - r}${arc} ${x + w} ${y + r}V${y + h - r}${arc} ${x + w - r} ${y + h}` +
    `H${x + r}${arc} ${x} ${y + h - r}V${y + r}${arc} ${x + r} ${y}Z`;
  const { width, height } = spot.viewport;
  return `path(evenodd, "M0 0H${width}V${height}H0Z${hole}")`;
}
