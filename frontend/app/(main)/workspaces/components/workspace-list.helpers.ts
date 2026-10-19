export type SortOption = 'alphabetical' | 'recent' | 'favorites';

export type SortableWorkspace = { isFavorite: boolean; name: string; createdAt: string };

function compareFavorites(a: SortableWorkspace, b: SortableWorkspace): number {
  if (a.isFavorite !== b.isFavorite) {
    return a.isFavorite ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

function compareAlphabetical(a: SortableWorkspace, b: SortableWorkspace): number {
  return a.name.localeCompare(b.name);
}

function compareRecent(a: SortableWorkspace, b: SortableWorkspace): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export const SORT_FNS: Record<SortOption, (a: SortableWorkspace, b: SortableWorkspace) => number> =
  {
    favorites: compareFavorites,
    alphabetical: compareAlphabetical,
    recent: compareRecent,
  };
