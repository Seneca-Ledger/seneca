import type { CategoryItem } from '@/app/lib/contracts';

export type Category = CategoryItem;

export interface CategoryRowActions {
  onEdit: (category: Category) => void;
  onToggle: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export interface CategoryLabels {
  name: string;
  lastActivity: string;
  never: string;
  usesOne: string;
  usesMany: string;
  disabled: string;
  system: string;
  parsing: string;
  menu: string;
  edit: string;
  enable: string;
  disable: string;
  delete: string;
  search: string;
}

export const formatUses = (labels: CategoryLabels, count: number): string =>
  (count === 1 ? labels.usesOne : labels.usesMany).replace('{count}', String(count));
