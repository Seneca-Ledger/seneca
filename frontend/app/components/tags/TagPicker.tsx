'use client';

import { useId, useState } from 'react';
import { Plus, Tag, X } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import type { StorageTag } from '@/app/lib/contracts';
import { TagDrawer } from './TagDrawer';

interface TagPickerProps {
  /** The tags the record carries now. */
  value: readonly StorageTag[];
  /** The complete new set; the caller saves it. */
  onChange: (next: StorageTag[]) => void;
  disabled?: boolean;
}

/**
 * The tags of one record as chips, and a button that opens the tag drawer to
 * attach, detach or create tags.
 */
export function TagPicker({ value, onChange, disabled }: TagPickerProps) {
  const t = useIntlayer('tagsPage');
  const labelId = useId();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const remove = (id: string): void => {
    onChange(value.filter(tag => tag.id !== id));
  };

  return (
    <div className="seneca-tag-dialog__field">
      <span id={labelId} className="seneca-tag-dialog__label">
        {t.title}
      </span>
      {/* biome-ignore lint/a11y/useSemanticElements: a list of chips, not a form fieldset */}
      <div className="seneca-tag-picker" role="group" aria-labelledby={labelId}>
        {value.map(tag => (
          <span key={tag.id} className="seneca-tag-picker__chip">
            <Tag size={14} color="var(--text-muted)" aria-hidden />
            {tag.name}
            <button
              type="button"
              className="seneca-tag-picker__remove"
              onClick={() => remove(tag.id)}
              disabled={disabled}
              aria-label={t.picker.remove.value.replace('{name}', tag.name)}
            >
              <X size={12} aria-hidden />
            </button>
          </span>
        ))}
        <button
          type="button"
          className="seneca-tag-picker__add"
          disabled={disabled}
          onClick={() => setDrawerOpen(true)}
        >
          <Plus size={14} aria-hidden />
          {t.picker.add}
        </button>
      </div>
      <TagDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
