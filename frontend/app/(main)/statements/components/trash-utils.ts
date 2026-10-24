const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type TrashEntityType = 'statement' | 'table' | 'workspace';

const normalizeValue = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
};

export const resolveTrashEntityType = (file: Record<string, unknown>): TrashEntityType => {
  const rawType =
    normalizeValue(file.entityType) ||
    normalizeValue(file.itemType) ||
    normalizeValue(file.resourceType) ||
    normalizeValue(file.objectType) ||
    normalizeValue(file.type);

  if (rawType.includes('workspace')) {
    return 'workspace';
  }
  if (rawType.includes('table')) {
    return 'table';
  }
  return 'statement';
};

export const resolvePermanentDeletionDate = (
  deletedAt: string | null | undefined,
  ttlDays: number,
): Date | null => {
  if (!deletedAt) {
    return null;
  }

  const deletedDate = new Date(deletedAt);
  if (Number.isNaN(deletedDate.getTime())) {
    return null;
  }

  return new Date(deletedDate.getTime() + ttlDays * MS_PER_DAY);
};
