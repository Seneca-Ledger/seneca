'use client';

import { Check, ChevronDown } from '@/app/components/icons';
import { useLocale } from '@/app/i18n';
import { isPrivateCategory } from '@/app/lib/private-category';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import { tokens } from '@/lib/theme-tokens';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { resolveCategoryDisplay } from './helpers/transactionFormatters';
import type { Category, Transaction, UpdateCategoryFn } from './types';

interface CategoryDropdownProps {
  tx: Transaction;
  categories: Category[];
  label: string;
  align?: 'start' | 'end';
  onUpdateCategory?: UpdateCategoryFn;
}

interface CategoryMenuItemsProps {
  tx: Transaction;
  categories: Category[];
  locale: string;
  onUpdateCategory?: UpdateCategoryFn;
}

function CategoryMenuItems({
  tx,
  categories,
  locale,
  onUpdateCategory,
}: CategoryMenuItemsProps): React.ReactElement {
  return (
    <div className="lumio-tx-cat-menu">
      {categories
        .filter(cat => !isPrivateCategory(cat) && cat.isEnabled !== false)
        .map(cat => (
          <DropdownMenuItem
            key={cat.id}
            onClick={() => onUpdateCategory?.(tx.id, cat.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span
              style={{
                height: 8,
                width: 8,
                borderRadius: tokens.radius.full,
                display: 'inline-block',
                backgroundColor: cat.color,
              }}
            />
            {getCategoryDisplayName(cat, locale)}
            {tx.category?.id === cat.id && <Check size={12} style={{ marginLeft: 'auto' }} />}
          </DropdownMenuItem>
        ))}
    </div>
  );
}

export function CategoryDropdown({
  tx,
  categories,
  label,
  align = 'end',
  onUpdateCategory,
}: CategoryDropdownProps): React.ReactElement {
  const { locale } = useLocale();
  const { triggerLabel, style } = resolveCategoryDisplay(tx, label, locale);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="lumio-tx-cat-dropdown" style={style}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {triggerLabel}
          </span>
          <ChevronDown size={12} style={{ flexShrink: 0, opacity: 0.5 }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} style={{ width: 200 }}>
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <CategoryMenuItems
          tx={tx}
          categories={categories}
          locale={locale}
          onUpdateCategory={onUpdateCategory}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
