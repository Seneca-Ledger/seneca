'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Plus, Search, Tag } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { useTags } from '@/app/hooks/useTags';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { StorageTag } from '@/app/lib/contracts';
import { TagFormDialog } from './TagFormDialog';

type TagDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** The tags the record carries now. */
  value: readonly StorageTag[];
  /** The complete new set; the caller saves it. */
  onChange: (next: StorageTag[]) => void;
  disabled?: boolean;
};

/**
 * The tags of one record in a right-hand drawer, laid out like the category
 * drawer: search, every tag of the workspace with the attached ones checked
 * (a click toggles one), and "Create a new tag" pinned under the list.
 */
export function TagDrawer({ open, onClose, value, onChange, disabled }: TagDrawerProps) {
  const t = useIntlayer('tagsPage');
  const { locale } = useLocale();
  const { data: allTags = [], isSuccess } = useTags();
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const selectedIds = new Set(value.map(tag => tag.id));

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
    }
  }, [open]);

  const filteredTags = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase(locale);
    return allTags
      .filter(tag => !query || tag.name.toLocaleLowerCase(locale).includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [allTags, searchQuery, locale]);

  const toggle = (tag: StorageTag): void => {
    onChange(
      selectedIds.has(tag.id)
        ? value.filter(other => other.id !== tag.id)
        : [...value, { id: tag.id, name: tag.name, color: tag.color }],
    );
  };

  const emptyText = (): string | null => {
    if (!isSuccess || filteredTags.length > 0) return null;
    return allTags.length === 0 ? t.emptyTitle.value : t.noMatches.value;
  };
  const empty = emptyText();

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
              {empty ? (
                <div className="seneca-cat-drawer__no-results">{empty}</div>
              ) : (
                filteredTags.map(tag => {
                  const isSelected = selectedIds.has(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={disabled}
                      aria-pressed={isSelected}
                      onClick={() => toggle(tag)}
                      className={`seneca-cat-drawer__option${isSelected ? ' seneca-cat-drawer__option--selected' : ''}`}
                    >
                      <Tag size={18} aria-hidden className="seneca-cat-drawer__option-icon" />
                      <span className="seneca-cat-drawer__option-name">{tag.name}</span>
                      {isSelected ? <Check size={18} color="var(--primary)" aria-hidden /> : null}
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
              disabled={disabled}
              onClick={() => setCreating(true)}
            >
              <Plus size={18} aria-hidden />
              {t.createNew.value}
            </Button>
          </div>
        </div>
      </DrawerShell>
      {open && creating ? (
        <TagFormDialog
          open
          tag={null}
          onClose={() => setCreating(false)}
          onCreated={({ id, name, color }) => onChange([...value, { id, name, color }])}
        />
      ) : null}
    </>
  );
}
