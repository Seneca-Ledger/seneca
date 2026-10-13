'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Search } from '@/app/components/icons';
import { DrawerShell, type DrawerWidth } from '@/app/components/ui/drawer-shell';
import { useLocale } from '@/app/i18n';
import {
  filterStatementCategories,
  type StatementCategoryNode,
} from '@/app/lib/statement-categories';

type StatementCategoryDrawerLabels = {
  title: string;
  searchPlaceholder: string;
  allOption: string;
  noResults: string;
};

type StatementCategoryDrawerProps = {
  open: boolean;
  onClose: () => void;
  categories: StatementCategoryNode[];
  selectedCategoryId: string;
  selecting: boolean;
  onSelect: (categoryId: string) => void;
  labels: StatementCategoryDrawerLabels;
  width?: DrawerWidth;
  className?: string;
  showAllOption?: boolean;
  /** Pinned under the list, e.g. a "Create category" action. */
  footer?: ReactNode;
};

export default function StatementCategoryDrawer({
  open,
  onClose,
  categories,
  selectedCategoryId,
  selecting,
  onSelect,
  labels,
  width = 'sm',
  className = 'bg-card border-l-0',
  showAllOption = true,
  footer,
}: StatementCategoryDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { locale } = useLocale();

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
    }
  }, [open]);

  const filteredCategories = useMemo(
    () => filterStatementCategories(categories, searchQuery, locale),
    [categories, searchQuery, locale],
  );

  return (
    <DrawerShell
      isOpen={open}
      onClose={onClose}
      position="right"
      width={width}
      showCloseButton={false}
      className={className}
      title={
        <div className="lumio-payable-drawer__title-wrap">
          <button
            type="button"
            onClick={onClose}
            className="lumio-col-drawer__back-btn"
            aria-label={labels.title}
          >
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{labels.title}</span>
        </div>
      }
    >
      <div className="lumio-cat-drawer">
        <div className="lumio-cat-drawer__search">
          <label className="lumio-cat-drawer__search-label">
            <Search size={20} className="lumio-cat-drawer__search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder={labels.searchPlaceholder}
              className="lumio-cat-drawer__search-input"
            />
          </label>
        </div>

        <div className="lumio-cat-drawer__list">
          <div>
            {showAllOption ? (
              <button
                type="button"
                disabled={selecting}
                onClick={() => onSelect('')}
                className={`lumio-cat-drawer__option${selectedCategoryId === '' ? ' lumio-cat-drawer__option--selected' : ''}`}
              >
                <span>{labels.allOption}</span>
                {selectedCategoryId === '' ? <Check size={24} color="var(--primary)" /> : null}
              </button>
            ) : null}

            {filteredCategories.length === 0 ? (
              <div className="lumio-cat-drawer__no-results">{labels.noResults}</div>
            ) : (
              filteredCategories.map(category => {
                const isSelected = selectedCategoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    disabled={selecting}
                    onClick={() => onSelect(category.id)}
                    className={`lumio-cat-drawer__option${isSelected ? ' lumio-cat-drawer__option--selected' : ''}`}
                  >
                    <span>{category.name}</span>
                    {isSelected ? <Check size={24} color="var(--primary)" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
        {footer ? <div className="lumio-cat-drawer__footer">{footer}</div> : null}
      </div>
    </DrawerShell>
  );
}
