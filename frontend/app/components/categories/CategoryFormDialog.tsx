'use client';

import { Box, Button } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FULL_SCREEN_ON_PHONE, ModalShell } from '@/app/components/ui/modal-shell';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { CATEGORY_ICON_CHOICES, categoryIconFor } from '@/app/lib/category-icon-choices';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';

/** The fields the dialog edits; any category row from the API fits. */
export interface CategoryFormValue {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string | null;
  icon?: string | null;
  parentId?: string | null;
}

export const resolveIconUrl = (iconValue?: string | null) => {
  if (!iconValue) {
    return null;
  }
  if (iconValue.startsWith('http')) {
    return iconValue;
  }
  if (iconValue.startsWith('/uploads')) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const base = apiUrl.replace(/\/api\/v1$/, '') || '';
    return `${base}${iconValue}`;
  }
  return null;
};

const emptyForm = (category: CategoryFormValue | null) => ({
  name: category?.name ?? '',
  type: category?.type ?? ('expense' as 'income' | 'expense'),
  icon: category?.icon || 'mdi:tag',
  withoutIcon: category ? !category.icon : false,
  parentId: category?.parentId || '',
});

interface CategoryFormDialogProps {
  open: boolean;
  /** The category to edit; null creates a new one. */
  category: CategoryFormValue | null;
  onClose: () => void;
  /** After a successful save, with the name as saved (the category list is already refreshed). */
  onSaved?: (saved: { id: string; name: string; type: 'income' | 'expense' }) => void;
}

/** The icon the category has now: a line glyph, or a picture uploaded before uploads were dropped. */
function CurrentIcon({ icon, withoutIcon }: { icon: string; withoutIcon: boolean }) {
  if (withoutIcon) {
    return <span className="seneca-category-dialog__no-icon" aria-hidden="true" />;
  }
  const url = resolveIconUrl(icon);
  if (url) {
    return <img src={url} alt="" width={18} height={18} style={{ objectFit: 'contain' }} />;
  }
  const Glyph = categoryIconFor(icon);
  return <Glyph size={18} />;
}

/**
 * Create or edit a category: a name, income or expense, and a line icon. No
 * colour any more: charts give each category one of a few earthy tones of
 * their own (see categoryTones), and the colour stored on older rows is left
 * as it is. Used on the workspace Categories tab and wherever a category is
 * picked (the custom tables category drawer).
 */
export function CategoryFormDialog({ open, category, onClose, onSaved }: CategoryFormDialogProps) {
  const t = useIntlayer('categoriesPage');
  const tx = (path: string[], fallback: string) => resolveLabel(getNestedValue(t, path), fallback);
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(() => emptyForm(category));
  const [saving, setSaving] = useState(false);
  const named = formData.name.trim() !== '';

  // Every opening starts from the category handed in (or a blank form).
  useEffect(() => {
    if (open) {
      setFormData(emptyForm(category));
    }
  }, [open, category]);

  const handleSave = async () => {
    setSaving(true);
    await (async () => {
      const { withoutIcon, ...restFormData } = formData;
      const data = {
        ...restFormData,
        name: restFormData.name.trim(),
        icon: withoutIcon ? undefined : restFormData.icon,
        parentId: restFormData.parentId || undefined,
      };

      if (category) {
        await apiClient.put(
          `/categories/${category.id}`,
          data satisfies ContractInput<'UpdateCategoryBody'>,
        );
        toast.success(t.toasts.updated.value);
      } else {
        await apiClient.post('/categories', data satisfies ContractInput<'CreateCategoryBody'>);
        toast.success(t.toasts.created.value);
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.categories(workspaceId) });
      if (onSaved) {
        // Name and type are unique in a workspace, so the fresh list gives the new category's id.
        const list = await queryClient.fetchQuery({
          queryKey: queryKeys.categories(workspaceId),
          queryFn: ({ signal }) =>
            apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
        });
        const savedId =
          category?.id ??
          list.find(item => item.name === data.name && item.type === data.type)?.id ??
          '';
        onSaved({ id: savedId, name: data.name, type: data.type });
      }
      onClose();
    })()
      .catch(async err => {
        console.error('Failed to save category:', err);
        toast.error(t.toasts.saveFailed.value);
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const typeOptions: Array<{ value: 'expense' | 'income'; label: React.ReactNode }> = [
    { value: 'expense', label: t.type.expense },
    { value: 'income', label: t.type.income },
  ];

  return (
    <ModalShell
      isOpen={open}
      onClose={onClose}
      size="sm"
      paperSx={{ maxWidth: 520, ...FULL_SCREEN_ON_PHONE }}
      title={
        <span style={{ fontWeight: 500 }}>
          {category ? t.dialog.editTitle : t.dialog.createTitle}
        </span>
      }
      footer={
        <>
          <Button
            type="button"
            variant="text"
            onClick={onClose}
            sx={{ color: 'var(--text-muted)', fontWeight: 500 }}
          >
            {t.dialog.cancel}
          </Button>
          {/* Outlined until there is a name to save; sage only once it can be pressed. */}
          <Button
            type="button"
            variant={named ? 'contained' : 'outlined'}
            onClick={() => void handleSave()}
            disabled={!named || saving}
          >
            {t.dialog.save}
          </Button>
        </>
      }
    >
      <form
        className="seneca-category-dialog"
        onSubmit={event => {
          event.preventDefault();
          if (named && !saving) {
            void handleSave();
          }
        }}
      >
        <div className="seneca-category-dialog__row">
          <div className="seneca-category-dialog__field seneca-category-dialog__field--grow">
            <label htmlFor="category-name" className="seneca-category-dialog__label">
              {t.dialog.nameLabel}
            </label>
            <div className="seneca-category-dialog__name">
              <span className="seneca-category-dialog__name-icon">
                <CurrentIcon icon={formData.icon} withoutIcon={formData.withoutIcon} />
              </span>
              <input
                id="category-name"
                // biome-ignore lint/a11y/noAutofocus: the dialog exists to type this name
                autoFocus
                value={formData.name}
                placeholder={t.dialog.placeholderName.value}
                onChange={event => setFormData({ ...formData, name: event.target.value })}
              />
            </div>
          </div>
          <div className="seneca-category-dialog__field">
            <span className="seneca-category-dialog__label" id="category-type-label">
              {t.type.label}
            </span>
            {/* Two choices side by side, not a dropdown that hides one of them. */}
            <div
              className="seneca-category-dialog__segment"
              role="radiogroup"
              aria-labelledby="category-type-label"
            >
              {typeOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={formData.type === option.value}
                  onClick={() => setFormData({ ...formData, type: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="seneca-category-dialog__field">
          <span className="seneca-category-dialog__label" id="category-icon-label">
            {t.dialog.chooseIcon}
          </span>
          <Box
            className="seneca-category-dialog__icons"
            role="radiogroup"
            aria-labelledby="category-icon-label"
          >
            <button
              type="button"
              role="radio"
              aria-checked={formData.withoutIcon}
              title={tx(['dialog', 'withoutIcon'], 'Without icon')}
              aria-label={tx(['dialog', 'withoutIcon'], 'Without icon')}
              onClick={() => setFormData({ ...formData, withoutIcon: true })}
            >
              <span className="seneca-category-dialog__no-icon" aria-hidden="true" />
            </button>
            {CATEGORY_ICON_CHOICES.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={!formData.withoutIcon && formData.icon === value}
                title={label}
                aria-label={label}
                onClick={() => setFormData({ ...formData, icon: value, withoutIcon: false })}
              >
                <Icon size={20} />
              </button>
            ))}
          </Box>
        </div>
      </form>
    </ModalShell>
  );
}
