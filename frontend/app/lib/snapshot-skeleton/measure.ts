// Walks a rendered block and records where its visual pieces sit: lines of
// text, images and icons, filled controls and chips, and outlined cards.
// Geometry only — the content itself (text, numbers, links, colours) is
// read to find the pieces but never stored.
import {
  MAX_BOXES,
  type SkeletonBox,
  type SkeletonBoxKind,
  type SkeletonSnapshot,
  WIDTH_SCALE,
} from './snapshot';

/** Elements looked at per capture; a long page stops here instead of stalling. */
const MAX_ELEMENTS = 4000;
/** A boxed element this small is a chip, badge or bar, drawn filled. */
const CHIP_MAX_HEIGHT = 44;
const CHIP_MAX_WIDTH = 240;
const THIN_HEIGHT = 12;
/** Text fragments this close vertically belong to the same line. */
const SAME_LINE_PX = 3;

const MEDIA = new Set(['IMG', 'SVG', 'CANVAS', 'VIDEO', 'PICTURE', 'IFRAME']);
const FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const IGNORED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'BR']);
const SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const;

interface Walk {
  left: number;
  top: number;
  width: number;
  maxY: number;
  boxes: SkeletonBox[];
  visited: number;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const isTransparent = (color: string | undefined): boolean =>
  !color ||
  color === 'transparent' ||
  /,\s*0(\.0+)?\)$/.test(color) ||
  /\/\s*0(\.0+)?\)$/.test(color);

const hasFullBorder = (style: CSSStyleDeclaration): boolean =>
  SIDES.every(side => {
    const lineStyle = style[`border${side}Style` as const];
    return (
      Number.parseFloat(style[`border${side}Width` as const]) > 0 &&
      Boolean(lineStyle) &&
      lineStyle !== 'none' &&
      lineStyle !== 'hidden' &&
      !isTransparent(style[`border${side}Color` as const])
    );
  });

const hasShadow = (style: CSSStyleDeclaration): boolean =>
  Boolean(style.boxShadow) && style.boxShadow !== 'none';

function radiusOf(style: CSSStyleDeclaration, rect: Rect): number {
  // The longhand when set; the shorthand where only it is filled in (jsdom).
  const corner = style.borderTopLeftRadius;
  const value = Number.parseFloat(corner) > 0 ? corner : style.borderRadius;
  if (!value) {
    return 0;
  }
  const amount = Number.parseFloat(value) || 0;
  return value.trim().endsWith('%') ? (amount * Math.min(rect.width, rect.height)) / 100 : amount;
}

const isRound = (rect: Rect, radius: number): boolean =>
  Math.abs(rect.width - rect.height) <= 2 && radius >= Math.min(rect.width, rect.height) / 2 - 1;

function push(walk: Walk, kind: SkeletonBoxKind, rect: Rect, radius = 0): void {
  if (walk.boxes.length >= MAX_BOXES) {
    return;
  }
  const x0 = Math.max(0, rect.left - walk.left);
  const x1 = Math.min(walk.width, rect.left + rect.width - walk.left);
  const y0 = Math.max(0, rect.top - walk.top);
  const y1 = Math.min(walk.maxY, rect.top + rect.height - walk.top);
  if (x1 - x0 < 1 || y1 - y0 < 1) {
    return;
  }
  const x = Math.round((x0 / walk.width) * WIDTH_SCALE);
  const w = Math.max(
    1,
    Math.min(WIDTH_SCALE - x, Math.round(((x1 - x0) / walk.width) * WIDTH_SCALE)),
  );
  const h = Math.max(1, Math.round(y1 - y0));
  const r = Math.round(Math.max(0, Math.min(radius, h / 2, (x1 - x0) / 2)));
  walk.boxes.push({ k: kind, x, y: Math.round(y0), w, h, r });
}

function pushText(walk: Walk, node: Text): void {
  const range = document.createRange();
  range.selectNodeContents(node);
  const lines: Array<{ left: number; top: number; right: number; bottom: number }> = [];
  for (const rect of Array.from(range.getClientRects?.() ?? [])) {
    if (rect.width < 1 || rect.height < 1) {
      continue;
    }
    const line = lines.find(item => Math.abs(item.top - rect.top) < SAME_LINE_PX);
    if (line) {
      line.left = Math.min(line.left, rect.left);
      line.right = Math.max(line.right, rect.right);
      line.bottom = Math.max(line.bottom, rect.bottom);
    } else {
      lines.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
    }
  }
  range.detach?.();
  for (const line of lines) {
    push(walk, 'text', {
      left: line.left,
      top: line.top,
      width: line.right - line.left,
      height: line.bottom - line.top,
    });
  }
}

const isHidden = (style: CSSStyleDeclaration): boolean =>
  style.display === 'none' ||
  style.visibility === 'hidden' ||
  style.visibility === 'collapse' ||
  style.opacity === '0' ||
  style.position === 'fixed';

const isOutside = (walk: Walk, rect: DOMRect): boolean =>
  rect.top - walk.top >= walk.maxY ||
  rect.bottom <= walk.top ||
  rect.right <= walk.left ||
  rect.left >= walk.left + walk.width;

function walkChildren(walk: Walk, el: Element, background: string | null): void {
  for (const child of Array.from(el.childNodes)) {
    if (walk.boxes.length >= MAX_BOXES) {
      return;
    }
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent?.trim()) {
        pushText(walk, child as Text);
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      walkElement(walk, child as Element, background);
    }
  }
}

function walkElement(walk: Walk, el: Element, parentBackground: string | null): void {
  if (walk.boxes.length >= MAX_BOXES || walk.visited >= MAX_ELEMENTS) {
    return;
  }
  walk.visited += 1;
  const tag = el.tagName.toUpperCase();
  if (IGNORED.has(tag)) {
    return;
  }
  const style = getComputedStyle(el);
  if (isHidden(style)) {
    return;
  }
  if (style.display === 'contents') {
    walkChildren(walk, el, parentBackground);
    return;
  }
  const rect = el.getBoundingClientRect();
  if (isOutside(walk, rect)) {
    return;
  }
  const sized = rect.width >= 2 && rect.height >= 2;
  const radius = radiusOf(style, rect);
  const roundOrBlock: SkeletonBoxKind = isRound(rect, radius) ? 'circle' : 'block';

  if (MEDIA.has(tag)) {
    if (sized) {
      push(walk, roundOrBlock, rect, radius);
    }
    return;
  }
  const background = isTransparent(style.backgroundColor) ? null : style.backgroundColor;
  const boxed =
    sized &&
    ((background !== null && background !== parentBackground) ||
      hasFullBorder(style) ||
      hasShadow(style));
  const isControl = tag === 'BUTTON' || FIELDS.has(tag) || el.getAttribute('role') === 'button';

  if (boxed) {
    const small =
      rect.height <= CHIP_MAX_HEIGHT &&
      (rect.width <= CHIP_MAX_WIDTH || rect.height <= THIN_HEIGHT);
    if (isControl || small) {
      push(walk, roundOrBlock, rect, radius);
      return;
    }
    push(walk, 'frame', rect, radius);
  } else if (FIELDS.has(tag)) {
    return;
  } else if (
    sized &&
    style.backgroundImage &&
    style.backgroundImage !== 'none' &&
    !el.childElementCount
  ) {
    push(walk, roundOrBlock, rect, radius);
    return;
  }
  walkChildren(walk, el, background ?? parentBackground);
}

function backgroundBehind(el: Element): string | null {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    if (!isTransparent(color)) {
      return color;
    }
  }
  return null;
}

/** Marks a skeleton on screen (SkeletonBoxes); its shapes are not content. */
const LOADING_SKELETON = '.seneca-snapshot-skeleton';

/**
 * The skeleton of what `container` shows now, or null when nothing is visible
 * or a block inside it is still loading (its own skeleton would be recorded
 * as content; the next change after it loads measures again).
 */
export function measureSkeleton(container: HTMLElement): SkeletonSnapshot | null {
  if (container.querySelector(LOADING_SKELETON)) {
    return null;
  }
  const rect = container.getBoundingClientRect();
  const viewport = window.innerHeight || 800;
  const maxY = Math.min(rect.height, viewport * 2);
  if (rect.width < 1 || maxY < 1) {
    return null;
  }
  const walk: Walk = {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    maxY,
    boxes: [],
    visited: 0,
  };
  walkChildren(walk, container, backgroundBehind(container));
  return walk.boxes.length > 0 ? { h: Math.round(maxY), boxes: walk.boxes } : null;
}
