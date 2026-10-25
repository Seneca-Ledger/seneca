import type { NavGroup, NavGroupId, NavItem } from './navigation-config';

export type NavEntry =
  | { kind: 'item'; item: NavItem }
  | { kind: 'group'; group: NavGroup; items: NavItem[] };

/**
 * The sidebar's rows: ungrouped items where they are, each group where its first
 * item would be. A group none of whose items is visible is left out.
 */
export function groupNavItems(items: NavItem[], groups: NavGroup[]): NavEntry[] {
  const entries: NavEntry[] = [];
  const byGroup = new Map<NavGroupId, NavItem[]>();
  for (const item of items) {
    const group = groups.find(candidate => candidate.id === item.group);
    if (!group) {
      entries.push({ kind: 'item', item });
      continue;
    }
    const members = byGroup.get(group.id);
    if (members) {
      members.push(item);
    } else {
      const created = [item];
      byGroup.set(group.id, created);
      entries.push({ kind: 'group', group, items: created });
    }
  }
  return entries;
}
