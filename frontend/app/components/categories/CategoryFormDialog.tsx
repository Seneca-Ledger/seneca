'use client';

import {
  alpha,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Check } from '@/app/components/icons';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { CATEGORY_ICON_CHOICES, categoryIconFor } from '@/app/lib/category-icon-choices';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import { tokens } from '@/lib/theme-tokens';

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

// Tailwind 500 tones: even saturation, readable as icon tints on light and dark.
const PREDEFINED_COLORS = [
  '#10b981', // emerald
  '#14b8a6', // teal
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#64748b', // slate
];

const DEFAULT_CATEGORY_COLOR = '#3b82f6';

const emptyForm = (category: CategoryFormValue | null) => ({
  name: category?.name ?? '',
  type: category?.type ?? ('expense' as 'income' | 'expense'),
  color: category?.color || DEFAULT_CATEGORY_COLOR,
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
  onSaved?: (saved: { name: string; type: 'income' | 'expense' }) => void;
}

/**
 * Create or edit a category: name with a live icon preview, type, icon and
 * colour. Used on the workspace Categories tab and wherever a category is
 * picked (the custom tables category drawer).
 */
export function CategoryFormDialog({ open, category, onClose, onSaved }: CategoryFormDialogProps) {
  const t = useIntlayer('categoriesPage');
  const tx = (path: string[], fallback: string) => resolveLabel(getNestedValue(t, path), fallback);
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(() => emptyForm(category));
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [saving, setSaving] = useState(false);
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const SelectedGlyph = categoryIconFor(formData.icon);

  // Every opening starts from the category handed in (or a blank form).
  useEffect(() => {
    if (open) {
      setFormData(emptyForm(category));
    }
  }, [open, category]);

  const handleClose = () => {
    onClose();
    if (iconInputRef.current) {
      iconInputRef.current.value = '';
    }
  };

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
      onSaved?.({ name: data.name, type: data.type });
      handleClose();
    })()
      .catch(async err => {
        console.error('Failed to save category:', err);
        toast.error(t.toasts.saveFailed.value);
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const triggerIconUpload = () => {
    iconInputRef.current?.click();
  };

  const handleIconFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const fd = new FormData();
    fd.append('icon', file);
    setUploadingIcon(true);

    await (async () => {
      const response = await apiClient.post('/data-entry/custom-fields/icon', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { url } = await checkContract(
        'UploadedIcon',
        response.data,
        '/data-entry/custom-fields/icon',
      );
      if (url) {
        setFormData(prev => ({ ...prev, icon: url, withoutIcon: false }));
        toast.success(t.toasts.iconUploaded.value);
      }
    })()
      .catch(async err => {
        console.error('Failed to upload icon:', err);
        toast.error(t.toasts.iconUploadFailed.value);
      })
      .finally(async () => {
        setUploadingIcon(false);
        if (iconInputRef.current) {
          iconInputRef.current.value = '';
        }
      });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>
        {category ? t.dialog.editTitle : t.dialog.createTitle}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          {/* Name and Type; the prefix previews the category as it is being built. */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={t.dialog.nameLabel.value}
              placeholder={t.dialog.placeholderName.value}
              fullWidth
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box
                        aria-hidden
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: tokens.radius.sm,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: alpha(formData.color, 0.14),
                          color: formData.color,
                        }}
                      >
                        {formData.withoutIcon ? (
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: formData.color,
                            }}
                          />
                        ) : resolveIconUrl(formData.icon) ? (
                          <Box
                            component="img"
                            src={resolveIconUrl(formData.icon) as string}
                            alt=""
                            sx={{ width: 18, height: 18, objectFit: 'contain' }}
                          />
                        ) : (
                          <SelectedGlyph size={18} />
                        )}
                      </Box>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>{t.type.label}</InputLabel>
              <Select
                value={formData.type}
                label={t.type.label.value}
                onChange={e =>
                  setFormData({
                    ...formData,
                    type: e.target.value as 'income' | 'expense',
                  })
                }
              >
                <MenuItem value="income">{t.type.income}</MenuItem>
                <MenuItem value="expense">{t.type.expense}</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Icon Picker */}
          <Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                mb: 1,
              }}
            >
              <Typography variant="subtitle2">{t.dialog.chooseIcon}</Typography>
              <Button
                variant="text"
                size="small"
                onClick={triggerIconUpload}
                disabled={uploadingIcon}
              >
                {uploadingIcon ? t.dialog.uploading : t.dialog.uploadIcon}
              </Button>
            </Box>
            <input
              type="file"
              accept="image/*"
              ref={iconInputRef}
              style={{ display: 'none' }}
              onChange={handleIconFileChange}
            />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
                gap: 0.5,
              }}
            >
              {CATEGORY_ICON_CHOICES.map(({ value, Icon }) => {
                const selected = !formData.withoutIcon && formData.icon === value;
                return (
                  <Box
                    key={value}
                    component="button"
                    type="button"
                    aria-label={value.replace('mdi:', '')}
                    aria-pressed={selected}
                    onClick={() => setFormData({ ...formData, icon: value, withoutIcon: false })}
                    sx={{
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      p: 0,
                      border: 'none',
                      borderRadius: tokens.radius.sm,
                      cursor: 'pointer',
                      bgcolor: selected ? alpha(formData.color, 0.14) : 'transparent',
                      color: selected ? formData.color : 'text.secondary',
                      boxShadow: selected ? `inset 0 0 0 1.5px ${formData.color}` : 'none',
                      '&:hover': {
                        bgcolor: alpha(formData.color, 0.1),
                        color: formData.color,
                      },
                    }}
                  >
                    <Icon size={22} />
                  </Box>
                );
              })}
            </Box>
            <Box sx={{ mt: 1.5 }}>
              <label
                style={{
                  display: 'inline-flex',
                  cursor: 'pointer',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  color: 'var(--foreground)',
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.withoutIcon}
                  onChange={e => setFormData({ ...formData, withoutIcon: e.target.checked })}
                />
                {tx(['dialog', 'withoutIcon'], 'Without icon')}
              </label>
            </Box>
          </Box>

          {/* Color Picker */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t.dialog.chooseColor}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, p: 0.5 }}>
              {PREDEFINED_COLORS.map(color => {
                const selected = formData.color === color;
                return (
                  <Box
                    key={color}
                    component="button"
                    type="button"
                    aria-label={color}
                    aria-pressed={selected}
                    onClick={() => setFormData({ ...formData, color })}
                    sx={{
                      width: 28,
                      height: 28,
                      p: 0,
                      border: 'none',
                      borderRadius: tokens.radius.full,
                      bgcolor: color,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      outline: selected ? `2px solid ${color}` : 'none',
                      outlineOffset: 2,
                    }}
                  >
                    {selected && <Check size={16} style={{ color: 'white' }} />}
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">
          {t.dialog.cancel}
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={!formData.name.trim() || saving}>
          {t.dialog.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
