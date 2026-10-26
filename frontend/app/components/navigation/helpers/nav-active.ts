import type { NavItem } from './navigation-config';

/** Whether a page is the item's path or under it. */
export function isNavItemActive(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

/**
 * The one item a page belongs to. Items can nest (/statements holds /statements/pay),
 * so the most specific match wins and only one row lights up.
 */
export function activeNavPath(pathname: string, items: NavItem[]): string | undefined {
  let best: string | undefined;
  for (const item of items) {
    if (isNavItemActive(pathname, item.path) && item.path.length > (best?.length ?? -1)) {
      best = item.path;
    }
  }
  return best;
}
