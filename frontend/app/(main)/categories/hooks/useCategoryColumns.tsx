import { parseISO } from 'date-fns';
import { useMemo } from 'react';
import { CategoryIconBadge } from '@/app/components/dashboard/CategoryIconBadge';
import type { GridColumnDef } from '@/app/components/data-grid';
import { Lock } from '@/app/components/icons';
import type { CategoryUsageCount } from '@/app/lib/contracts';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import { formatStoredDate } from '@/app/lib/user-format-store';
import {
  type Category,
  type CategoryLabels,
  type CategoryRowActions,
  formatUses,
} from '../category-labels';
import { CategoryActionsMenu } from '../components/CategoryActionsMenu';

/** The categories grid's columns: name with its marks, last activity, and the row menu. */
export function useCategoryColumns(options: {
  labels: CategoryLabels;
  locale: string;
  usage: Record<string, CategoryUsageCount>;
  search: string;
  onSearch: (value: string) => void;
  actions: CategoryRowActions;
}) {
  const { labels, locale, usage, search, onSearch, actions } = options;
  return useMemo<GridColumnDef<Category, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorFn: row => getCategoryDisplayName(row, locale),
        header: labels.name,
        sortFn: 'text',
        size: 360,
        meta: {
          label: labels.name,
          skeleton: { shape: 'text', icon: 24, width: 180 },
          headerActions: (
            <input
              type="search"
              className="seneca-categories__search"
              value={search}
              onChange={event => onSearch(event.target.value)}
              placeholder={labels.search}
              aria-label={labels.search}
              data-tour-id="categories-search"
            />
          ),
        },
        cell: ({ row }) => {
          const category = row.original;
          const enabled = category.isEnabled !== false;
          return (
            <span
              className={`seneca-categories__name${enabled ? '' : ' seneca-categories__name--disabled'}`}
            >
              <CategoryIconBadge name={category.name} color={null} icon={category.icon} size={24} />
              <span className="seneca-categories__name-text">
                {getCategoryDisplayName(category, locale)}
              </span>
              {category.isSystem ? (
                <Lock size={13} className="seneca-categories__lock" aria-label={labels.system} />
              ) : null}
              {category.source === 'parsing' ? (
                <span className="seneca-categories__mark">{labels.parsing}</span>
              ) : null}
              {enabled ? null : <span className="seneca-categories__mark">{labels.disabled}</span>}
            </span>
          );
        },
      },
      {
        id: 'lastActivity',
        accessorFn: row => usage[row.id]?.lastUsedAt ?? '',
        header: labels.lastActivity,
        sortFn: 'text',
        size: 200,
        cell: ({ row }) => {
          const counts = usage[row.original.id];
          const lastUsedAt = counts?.lastUsedAt;
          return (
            <span className="seneca-categories__activity">
              <span>{lastUsedAt ? formatStoredDate(parseISO(lastUsedAt)) : labels.never}</span>
              {counts?.total ? (
                <span className="seneca-categories__uses">{formatUses(labels, counts.total)}</span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        size: 64,
        enableSorting: false,
        enableHiding: false,
        meta: { align: 'end', label: labels.menu, skeleton: { shape: 'text', width: 18 } },
        cell: ({ row }) => (
          <CategoryActionsMenu
            category={row.original}
            labels={labels}
            actions={actions}
            tourAnchor={row.index === 0}
          />
        ),
      },
    ],
    [labels, locale, usage, search, onSearch, actions],
  );
}
