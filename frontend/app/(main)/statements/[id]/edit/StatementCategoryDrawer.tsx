'use client';

import { useEffect, useMemo, useState } from 'react';
import { CategoryFormDialog } from '@/app/components/categories/CategoryFormDialog';
import { Check, ChevronLeft, Plus, Search } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useIntlayer, useLocale } from '@/app/i18n';
import { resolveCategoryVisual } from '@/app/lib/category-defaults';
import {
  filterStatementCategories,
  type StatementCategoryNode,
  type StatementCategoryOption,
} from '@/app/lib/statement-categories';

/** Ids picked last, newest first: kept per browser, a convenience only. */
const RECENT_KEY = 'seneca:recent-categories';
const RECENT_LIMIT = 5;

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function rememberRecent(id: string): void {
  try {
    const next = [id, ...readRecent().filter(other => other !== id)].slice(0, RECENT_LIMIT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage may be blocked; the order simply stays alphabetical.
  }
}

/** Recently picked first, then the rest alphabetically in the reader's language. */
function orderCategories(
  options: StatementCategoryOption[],
  recent: string[],
  locale: string,
): StatementCategoryOption[] {
  const rank = (id: string): number => {
    const index = recent.indexOf(id);
    return index === -1 ? recent.length : index;
  };
  return [...options].sort(
    (a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, locale),
  );
}

function CategoryGlyph({ option }: { option: StatementCategoryOption }): React.JSX.Element {
  const { Icon } = resolveCategoryVisual({
    name: option.baseName ?? option.name,
    icon: option.icon,
  });
  return <Icon size={18} aria-hidden className="seneca-cat-drawer__option-icon" />;
}

type StatementCategoryDrawerProps = {
  open: boolean;
  onClose: () => void;
  categories: StatementCategoryNode[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
  selecting?: boolean;
  /** A first row that picks "no category" (''), named by the caller: "Clear", "Any category"… */
  clearLabel?: string;
  /** A category made with "Create category"; by default it is simply selected. */
  onCreated?: (category: StatementCategoryNode) => void;
};

/**
 * The one category picker of the app: a right-hand drawer with search and a
 * "Create category" action pinned under the list. Every place that assigns a
 * category opens this drawer, directly or through CategoryPickerField.
 */
export default function StatementCategoryDrawer({
  open,
  onClose,
  categories,
  selectedCategoryId,
  onSelect,
  selecting = false,
  clearLabel,
  onCreated,
}: StatementCategoryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);
  // Callers often hold the list in state loaded once, so a new category is shown from here.
  const [created, setCreated] = useState<StatementCategoryNode[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const t = useIntlayer('categoriesPage');
  const { locale } = useLocale();

  useEffect(() => {
    if (open) {
      setRecent(readRecent());
    } else {
      setSearchQuery('');
    }
  }, [open]);

  const select = (categoryId: string): void => {
    if (categoryId) {
      rememberRecent(categoryId);
    }
    onSelect(categoryId);
  };

  const allCategories = useMemo(
    () => [
      ...categories,
      ...created.filter(extra => !categories.some(category => category.id === extra.id)),
    ],
    [categories, created],
  );

  const filteredCategories = useMemo(
    () =>
      orderCategories(
        filterStatementCategories(allCategories, searchQuery, locale),
        recent,
        locale,
      ),
    [allCategories, searchQuery, locale, recent],
  );

  return (
    <>
      <DrawerShell
        // The dialog takes the drawer's place; cancelling it comes back to the list.
        isOpen={open && !creating}
        onClose={onClose}
        position="right"
        width="sm"
        showCloseButton={false}
        className="bg-card border-l-0"
        title={
          <div className="seneca-payable-drawer__title-wrap">
            <button
              type="button"
              onClick={onClose}
              className="seneca-col-drawer__back-btn"
              aria-label={t.title.value}
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{t.title.value}</span>
          </div>
        }
      >
        <div className="seneca-cat-drawer">
          <div className="seneca-cat-drawer__search">
            <label className="seneca-cat-drawer__search-label">
              <Search size={18} className="seneca-cat-drawer__search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder={t.searchPlaceholder.value}
                className="seneca-cat-drawer__search-input"
              />
            </label>
          </div>

          <div className="seneca-cat-drawer__list">
            <div>
              {clearLabel ? (
                <button
                  type="button"
                  disabled={selecting}
                  onClick={() => select('')}
                  className={`seneca-cat-drawer__option${selectedCategoryId === '' ? ' seneca-cat-drawer__option--selected' : ''}`}
                >
                  <span className="seneca-cat-drawer__option-name">{clearLabel}</span>
                  {selectedCategoryId === '' ? <Check size={18} color="var(--primary)" /> : null}
                </button>
              ) : null}

              {filteredCategories.length === 0 ? (
                <div className="seneca-cat-drawer__no-results">{t.noData.value}</div>
              ) : (
                filteredCategories.map(category => {
                  const isSelected = selectedCategoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      disabled={selecting}
                      onClick={() => select(category.id)}
                      className={`seneca-cat-drawer__option${isSelected ? ' seneca-cat-drawer__option--selected' : ''}`}
                    >
                      <CategoryGlyph option={category} />
                      <span className="seneca-cat-drawer__option-name">{category.name}</span>
                      {isSelected ? <Check size={18} color="var(--primary)" /> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div className="seneca-cat-drawer__footer">
            <Button
              className="seneca-cat-drawer__create"
              variant="ghost"
              type="button"
              disabled={selecting}
              onClick={() => setCreating(true)}
            >
              <Plus size={18} aria-hidden />
              {t.dialog.createTitle.value}
            </Button>
          </div>
        </div>
      </DrawerShell>
      {/* Mounted only while creating: it needs the query client, which plain list uses do not. */}
      {open && creating ? (
        <CategoryFormDialog
          open
          category={null}
          onClose={() => setCreating(false)}
          onSaved={saved => {
            if (!saved.id) {
              return;
            }
            const category = { id: saved.id, name: saved.name };
            setCreated(prev => [...prev, category]);
            rememberRecent(category.id);
            if (onCreated) {
              onCreated(category);
            } else {
              onSelect(category.id);
            }
          }}
        />
      ) : null}
    </>
  );
}
