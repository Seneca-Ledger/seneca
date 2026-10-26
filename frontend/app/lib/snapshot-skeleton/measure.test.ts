import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { measureSkeleton } from './measure';
import { encodeSnapshot, MAX_BOXES } from './snapshot';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CONTAINER: Box = { x: 100, y: 50, w: 1000, h: 600 };
const textRects = new Map<Node, Box[]>();

const toRect = ({ x, y, w, h }: Box): DOMRect =>
  ({ x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h }) as DOMRect;

/** Places an element at page coordinates, as layout would. */
function place<T extends Element>(el: T, box: Box): T {
  el.getBoundingClientRect = () => toRect(box);
  return el;
}

function element(tag: string, box: Box, style: Partial<CSSStyleDeclaration> = {}): HTMLElement {
  const el = place(document.createElement(tag), box);
  Object.assign(el.style, style);
  return el;
}

/** A text node laid out over the given line boxes. */
function text(content: string, lines: Box[]): Text {
  const node = document.createTextNode(content);
  textRects.set(node, lines);
  return node;
}

function container(...children: Node[]): HTMLElement {
  const root = element('div', CONTAINER);
  root.append(...children);
  document.body.append(root);
  return root;
}

beforeEach(() => {
  vi.spyOn(document, 'createRange').mockImplementation(() => {
    let target: Node | null = null;
    return {
      selectNodeContents: (node: Node) => {
        target = node;
      },
      getClientRects: () => (target ? (textRects.get(target) ?? []).map(toRect) : []),
      detach: () => {},
    } as unknown as Range;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  textRects.clear();
  document.body.innerHTML = '';
});

describe('measureSkeleton', () => {
  it('turns each line of text into a bar relative to the container', () => {
    const p = element('p', { x: 100, y: 60, w: 600, h: 40 });
    p.append(
      text('Wireless buds and a case', [
        { x: 100, y: 60, w: 600, h: 20 },
        { x: 100, y: 80, w: 300, h: 20 },
      ]),
    );

    const snapshot = measureSkeleton(container(p));

    expect(snapshot?.boxes).toEqual([
      { k: 'text', x: 0, y: 10, w: 6000, h: 20, r: 0 },
      { k: 'text', x: 0, y: 30, w: 3000, h: 20, r: 0 },
    ]);
  });

  it('merges pieces of the same line into one bar', () => {
    const p = element('p', { x: 100, y: 60, w: 600, h: 20 });
    p.append(
      text('Member One', [
        { x: 100, y: 60, w: 200, h: 20 },
        { x: 300, y: 61, w: 200, h: 19 },
      ]),
    );

    expect(measureSkeleton(container(p))?.boxes).toEqual([
      { k: 'text', x: 0, y: 10, w: 4000, h: 20, r: 0 },
    ]);
  });

  it('draws images as blocks and round avatars as circles', () => {
    const img = element('img', { x: 600, y: 100, w: 200, h: 100 }, { borderRadius: '8px' });
    const avatar = element('img', { x: 100, y: 250, w: 40, h: 40 }, { borderRadius: '50%' });

    expect(measureSkeleton(container(img, avatar))?.boxes).toEqual([
      { k: 'block', x: 5000, y: 50, w: 2000, h: 100, r: 8 },
      { k: 'circle', x: 0, y: 200, w: 400, h: 40, r: 20 },
    ]);
  });

  it('outlines a card and keeps measuring what is inside it', () => {
    const card = element(
      'section',
      { x: 100, y: 50, w: 500, h: 200 },
      { backgroundColor: 'rgb(255, 255, 255)', borderRadius: '12px' },
    );
    const title = element('h2', { x: 116, y: 66, w: 200, h: 20 });
    title.append(text('Spending', [{ x: 116, y: 66, w: 100, h: 20 }]));
    card.append(title);

    expect(measureSkeleton(container(card))?.boxes).toEqual([
      { k: 'frame', x: 0, y: 0, w: 5000, h: 200, r: 12 },
      { k: 'text', x: 160, y: 16, w: 1000, h: 20, r: 0 },
    ]);
  });

  it('fills chips and buttons without looking inside them', () => {
    const chip = element(
      'span',
      { x: 100, y: 50, w: 80, h: 24 },
      { backgroundColor: 'rgb(244, 241, 235)', borderRadius: '999px' },
    );
    chip.append(text('Groceries', [{ x: 108, y: 52, w: 60, h: 20 }]));
    const button = element(
      'button',
      { x: 900, y: 50, w: 200, h: 36 },
      { border: '1px solid rgb(227, 222, 213)', borderRadius: '8px' },
    );
    button.append(text('Export', [{ x: 950, y: 58, w: 50, h: 20 }]));

    expect(measureSkeleton(container(chip, button))?.boxes).toEqual([
      { k: 'block', x: 0, y: 0, w: 800, h: 24, r: 12 },
      { k: 'block', x: 8000, y: 0, w: 2000, h: 36, r: 8 },
    ]);
  });

  it('keeps no text, numbers, links or class names', () => {
    const link = element('a', { x: 100, y: 60, w: 300, h: 20 });
    link.setAttribute('href', 'https://example.co.il/statement/42');
    link.className = 'acme-secret-class';
    link.append(text('ACME Store - Wireless Buds −1,234.56', [{ x: 100, y: 60, w: 300, h: 20 }]));

    const stored = encodeSnapshot(measureSkeleton(container(link)) ?? { h: 1, boxes: [] });

    expect(stored).not.toMatch(/ACME|Wireless|1,234|example|acme-secret/);
    expect(stored).toMatch(/^[{}[\]",:0-9hb]+$/);
  });

  it('skips what is hidden, empty, fixed or far below the fold', () => {
    const hidden = element('p', { x: 100, y: 60, w: 300, h: 20 }, { display: 'none' });
    hidden.append(text('hidden', [{ x: 100, y: 60, w: 300, h: 20 }]));
    const clear = element('img', { x: 100, y: 60, w: 300, h: 20 }, { opacity: '0' });
    const empty = element('img', { x: 100, y: 60, w: 0, h: 0 });
    const fab = element('button', { x: 900, y: 500, w: 48, h: 48 }, { position: 'fixed' });
    const far = element('img', { x: 100, y: 50 + 2 * window.innerHeight + 10, w: 300, h: 20 });
    const seen = element('img', { x: 100, y: 60, w: 300, h: 20 });

    const snapshot = measureSkeleton(container(hidden, clear, empty, fab, far, seen));

    expect(snapshot?.boxes).toEqual([{ k: 'block', x: 0, y: 10, w: 3000, h: 20, r: 0 }]);
  });

  it('stops at the box cap', () => {
    const images = Array.from({ length: MAX_BOXES + 20 }, (_, index) =>
      element('img', { x: 100, y: 50 + (index % 50) * 10, w: 10, h: 8 }),
    );

    expect(measureSkeleton(container(...images))?.boxes).toHaveLength(MAX_BOXES);
  });

  it('caps the remembered height at two screens', () => {
    const root = container(element('img', { x: 100, y: 60, w: 300, h: 20 }));
    place(root, { ...CONTAINER, h: 9000 });

    expect(measureSkeleton(root)?.h).toBe(2 * window.innerHeight);
  });

  it('waits while a block inside is still showing its own skeleton', () => {
    const loadingBlock = element('div', { x: 100, y: 60, w: 300, h: 200 });
    loadingBlock.className = 'seneca-snapshot-skeleton';
    const img = element('img', { x: 100, y: 300, w: 300, h: 20 });

    expect(measureSkeleton(container(loadingBlock, img))).toBeNull();
  });

  it('returns nothing when there is nothing to draw', () => {
    expect(measureSkeleton(container())).toBeNull();
    const collapsed = container(element('img', { x: 100, y: 60, w: 300, h: 20 }));
    place(collapsed, { ...CONTAINER, w: 0 });
    expect(measureSkeleton(collapsed)).toBeNull();
  });
});
