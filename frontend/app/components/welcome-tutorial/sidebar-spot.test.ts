// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { measureSidebarSpot, NO_SPOT, navItemSelector, spotlightClipPath } from './sidebar-spot';

function mountItem(path: string, rect: Partial<DOMRect>): HTMLElement {
  const aside = document.createElement('aside');
  const item = document.createElement('a');
  item.setAttribute('data-nav-path', path);
  aside.append(item);
  document.body.append(aside);
  item.getBoundingClientRect = () => ({ top: 0, left: 0, width: 0, height: 0, ...rect }) as DOMRect;
  aside.getBoundingClientRect = () => ({ left: 0, right: 192 }) as DOMRect;
  return item;
}

describe('sidebar spot', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.dir = '';
  });

  it('finds a nav item by the path the sidebar marks it with', () => {
    const item = mountItem('/net-worth', { width: 10, height: 10 });
    expect(document.querySelector(navItemSelector('/net-worth'))).toBe(item);
    expect(document.querySelector(navItemSelector('/net'))).toBeNull();
  });

  it('pads the item for its ring and reports how far the sidebar reaches', () => {
    mountItem('/budgets', { top: 200, left: 8, width: 176, height: 36 });
    const spot = measureSidebarSpot('/budgets');
    expect(spot.item).toEqual({ top: 197, left: 5, width: 182, height: 42 });
    expect(spot.inset).toBe(192);
  });

  it('has no spot for a missing item or a hidden sidebar', () => {
    expect(measureSidebarSpot('/budgets')).toBe(NO_SPOT);
    mountItem('/budgets', {});
    expect(measureSidebarSpot('/budgets')).toBe(NO_SPOT);
  });

  it('cuts a hole for the item into the backdrop, and none without an item', () => {
    mountItem('/budgets', { top: 200, left: 8, width: 176, height: 36 });
    const clip = spotlightClipPath(measureSidebarSpot('/budgets'));
    expect(clip).toMatch(/^path\(evenodd, "M0 0H\d+V\d+H0ZM20 197H172A15 15 0 0 1 187 212/);
    expect(spotlightClipPath(NO_SPOT)).toBeUndefined();
  });
});
