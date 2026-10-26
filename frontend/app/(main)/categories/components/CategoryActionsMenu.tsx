import { Eye, EyeOff, MoreHorizontal, Pencil, Trash2 } from '@/app/components/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import type { Category, CategoryLabels, CategoryRowActions } from '../category-labels';

/** A category row's menu: edit, enable or disable, and delete for the workspace's own. */
export function CategoryActionsMenu({
  category,
  labels,
  actions,
  tourAnchor,
}: {
  category: Category;
  labels: CategoryLabels;
  actions: CategoryRowActions;
  tourAnchor: boolean;
}) {
  const enabled = category.isEnabled !== false;
  // MUI Menu walks its children for focus; a Fragment would hide them, so the items are an array.
  const items = [
    <DropdownMenuItem key="edit" onSelect={() => actions.onEdit(category)}>
      <Pencil size={14} aria-hidden />
      {labels.edit}
    </DropdownMenuItem>,
    <DropdownMenuItem key="toggle" onSelect={() => actions.onToggle(category)}>
      {enabled ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
      {enabled ? labels.disable : labels.enable}
    </DropdownMenuItem>,
  ];
  if (!category.isSystem) {
    items.push(
      <DropdownMenuSeparator key="separator" />,
      <DropdownMenuItem key="delete" onSelect={() => actions.onDelete(category)}>
        <Trash2 size={14} aria-hidden />
        {labels.delete}
      </DropdownMenuItem>,
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="seneca-categories__menu"
          data-tour-id={tourAnchor ? 'category-toggle' : undefined}
          aria-label={`${labels.menu}: ${category.name}`}
        >
          <MoreHorizontal size={16} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{items}</DropdownMenuContent>
    </DropdownMenu>
  );
}
