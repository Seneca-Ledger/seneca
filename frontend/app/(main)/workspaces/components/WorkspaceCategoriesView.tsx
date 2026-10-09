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
  Skeleton,
  Switch,
  type SxProps,
  TextField,
  type Theme,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ChangeEvent, useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, ChevronRight, Lock, Search as SearchIcon } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { useAuth } from '@/app/hooks/useAuth';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { CATEGORY_ICON_CHOICES, categoryIconFor } from '@/app/lib/category-icon-choices';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import { tokens } from '@/lib/theme-tokens';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  isSystem?: boolean;
  source?: 'system' | 'user' | 'parsing';
  isEnabled?: boolean;
  color?: string;
  icon?: string;
  parentId?: string;
}

const SOURCE_BADGE_COLORS: Record<
  NonNullable<Category['source']>,
  { bg: string; color: string; border: string }
> = {
  system: {
    bg: 'var(--color-info-soft-bg)',
    color: 'var(--color-info-soft-text)',
    border: 'var(--color-info-soft-border)',
  },
  parsing: {
    bg: 'var(--color-warning-soft-bg)',
    color: '#d97706',
    border: 'var(--color-warning-soft-border)',
  },
  user: { bg: 'var(--muted)', color: 'var(--text-secondary)', border: 'var(--border-color)' },
};

interface CategoryUsageCount {
  transactions: number;
  statements: number;
  total: number;
}

const resolveIconUrl = (iconValue?: string) => {
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

const CATEGORY_ROW_SKELETON_KEYS = [
  'row-0',
  'row-1',
  'row-2',
  'row-3',
  'row-4',
  'row-5',
  'row-6',
  'row-7',
];

/** Divider between rows; barely there, in either theme. */
const HAIRLINE = (theme: Theme): string => alpha(theme.palette.text.primary, 0.06);

// Flat row: a hairline under it and a faint wash on hover (action.hover is brand
// green in this theme). The edit chevron stays faint until the row is hovered.
const CATEGORY_ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 2,
  px: 1.5,
  py: 1.25,
  borderBottom: '1px solid',
  borderColor: HAIRLINE,
  transition: 'background-color 120ms ease',
  '&:hover': { bgcolor: (theme: Theme) => alpha(theme.palette.text.primary, 0.04) },
  '& .category-row-open': { opacity: 0.35, transition: 'opacity 120ms ease' },
  '&:hover .category-row-open, & .category-row-open:focus-visible': { opacity: 1 },
  '@media (hover: none)': { '& .category-row-open': { opacity: 1 } },
} satisfies SxProps<Theme>;

// A compact switch; "on" is the filled green, which is darker and calmer than
// the accent green in dark mode.
const COMPACT_SWITCH_SX = {
  width: 34,
  height: 20,
  p: 0,
  '& .MuiSwitch-switchBase': {
    p: '3px',
    transitionDuration: '160ms',
    '&:hover': { bgcolor: 'transparent' },
    '&.Mui-checked': {
      transform: 'translateX(14px)',
      color: '#fff',
      '&:hover': { bgcolor: 'transparent' },
      '& + .MuiSwitch-track': { bgcolor: 'var(--primary-fill)', opacity: 1 },
    },
    '&.Mui-disabled': { opacity: 0.55 },
  },
  '& .MuiSwitch-thumb': { width: 14, height: 14, boxShadow: 'none' },
  '& .MuiSwitch-track': {
    borderRadius: tokens.radius.full,
    bgcolor: (theme: Theme) => alpha(theme.palette.text.primary, 0.2),
    opacity: 1,
  },
} satisfies SxProps<Theme>;

function CategoryRowSkeleton(): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.md,
        px: 2,
        py: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Skeleton variant="rounded" width={18} height={18} />
        <Skeleton variant="rounded" width={32} height={32} />
        <Box>
          <Skeleton variant="text" width={140} height={20} />
          <Skeleton variant="text" width={100} height={14} />
        </Box>
      </Box>
      <Skeleton
        variant="rounded"
        width={52}
        height={32}
        sx={{ borderRadius: tokens.radius.full }}
      />
    </Box>
  );
}

export default function WorkspaceCategoriesView() {
  const t = useIntlayer('categoriesPage');
  const { locale } = useLocale();
  const { user } = useAuth();
  const tx = (path: string[], fallback: string) => resolveLabel(getNestedValue(t, path), fallback);
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconInputRef = useRef<HTMLInputElement | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [disableConfirm, setDisableConfirm] = useState<{
    category: Category;
    usage: CategoryUsageCount;
  } | null>(null);
  // The category name sits in bold inside the sentence, so the template is split around it.
  const [disableUsedInBefore, disableUsedInAfter = ''] =
    t.manage.disableDialog.usedIn.value.split('{name}');

  const getCategoryBadgeLabel = (category: Category) => {
    if (category.source === 'parsing') {
      return tx(['sourceBadges', 'parsing'], 'Parsing data');
    }

    if (category.isSystem || category.source === 'system') {
      return tx(['sourceBadges', 'system'], 'System');
    }

    return null;
  };

  const getCategoryBadgeSource = (category: Category): NonNullable<Category['source']> | null => {
    if (category.source === 'parsing') {
      return 'parsing';
    }
    if (category.isSystem || category.source === 'system') {
      return 'system';
    }
    return null;
  };

  const [formData, setFormData] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
    color: DEFAULT_CATEGORY_COLOR,
    icon: 'mdi:tag',
    withoutIcon: false,
    parentId: '',
  });
  const SelectedGlyph = categoryIconFor(formData.icon);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) => apiQuery<Category[]>({ url: '/categories', signal }),
    enabled: Boolean(user),
  });

  const usageQuery = useQuery({
    queryKey: queryKeys.categoryUsage(workspaceId),
    queryFn: ({ signal }) =>
      apiQuery<Record<string, CategoryUsageCount>>({ url: '/categories/usage/counts', signal }),
    enabled: Boolean(user),
  });

  const categories = categoriesQuery.data ?? [];
  const usageCounts = usageQuery.data ?? {};

  /**
   * Переключение галочки правит одну строку прямо в кэше — список не должен
   * гаснуть скелетоном из-за одного чекбокса.
   */
  const setCategories = useCallback(
    (update: (prev: Category[]) => Category[]) => {
      queryClient.setQueryData<Category[]>(queryKeys.categories(workspaceId), previous =>
        update(previous ?? []),
      );
    },
    [queryClient, workspaceId],
  );

  const loadCategories = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.categories(workspaceId) });
  }, [queryClient, workspaceId]);

  const filteredCategories = categories.filter(cat => {
    return getCategoryDisplayName(cat, locale).toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        type: category.type,
        color: category.color || DEFAULT_CATEGORY_COLOR,
        icon: category.icon || 'mdi:tag',
        withoutIcon: !category.icon,
        parentId: category.parentId || '',
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        type: 'expense',
        color: DEFAULT_CATEGORY_COLOR,
        icon: 'mdi:tag',
        withoutIcon: false,
        parentId: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
    if (iconInputRef.current) {
      iconInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    await (async () => {
      const { withoutIcon, ...restFormData } = formData;
      const data = {
        ...restFormData,
        icon: withoutIcon ? undefined : restFormData.icon,
        parentId: restFormData.parentId || undefined,
      };

      if (editingCategory) {
        await apiClient.put(`/categories/${editingCategory.id}`, data);
        toast.success(t.toasts.updated.value);
      } else {
        await apiClient.post('/categories', data);
        toast.success(t.toasts.created.value);
      }

      await loadCategories();
      handleCloseDialog();
    })().catch(async err => {
      console.error('Failed to save category:', err);
      toast.error(t.toasts.saveFailed.value);
    });
  };

  const performToggle = async (category: Category, nextEnabled: boolean) => {
    setDisableConfirm(null);
    setTogglingIds(prev => new Set(prev).add(category.id));

    await (async () => {
      await apiClient.put(`/categories/${category.id}`, { isEnabled: nextEnabled });
      setCategories(prev =>
        prev.map(item => (item.id === category.id ? { ...item, isEnabled: nextEnabled } : item)),
      );
    })()
      .catch(async err => {
        console.error('Failed to toggle category state:', err);
        toast.error(t.toasts.saveFailed.value);
      })
      .finally(async () => {
        setTogglingIds(prev => {
          const next = new Set(prev);
          next.delete(category.id);
          return next;
        });
      });
  };

  const handleToggleEnabled = async (category: Category) => {
    if (togglingIds.has(category.id)) {
      return;
    }

    const nextEnabled = category.isEnabled === false;

    if (!nextEnabled) {
      const usage = await apiClient
        .get(`/categories/${category.id}/usage-count`)
        .then(response => response.data as CategoryUsageCount)
        .catch((err: unknown) => {
          console.error('Failed to get category usage count:', err);
          return null;
        });
      if (usage && usage.total > 0) {
        setDisableConfirm({ category, usage });
        return;
      }
    }

    await performToggle(category, nextEnabled);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredCategories.length && filteredCategories.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCategories.map(c => c.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBulkEnable = async (enable: boolean) => {
    await (async () => {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          apiClient.put(`/categories/${id}`, { isEnabled: enable }),
        ),
      );
      toast.success(enable ? t.manage.toasts.enabled.value : t.manage.toasts.disabled.value);
      await loadCategories();
      setSelectedIds(new Set());
    })().catch(async err => {
      console.error('Failed to bulk toggle categories:', err);
      toast.error(t.toasts.saveFailed.value);
    });
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(t.manage.confirmBulkDelete.value)) {
      return;
    }

    await (async () => {
      const customIds = Array.from(selectedIds).filter(
        id => !categories.find(c => c.id === id)?.isSystem,
      );
      await Promise.all(customIds.map(id => apiClient.delete(`/categories/${id}`)));
      toast.success(t.manage.toasts.deleted.value);
      await loadCategories();
      setSelectedIds(new Set());
    })().catch(async err => {
      console.error('Failed to delete categories:', err);
      toast.error(t.manage.toasts.deleteFailed.value);
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
      const url = response.data?.url || response.data;
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
    <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, py: 4, maxWidth: 1120 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Hint, search and Add in one header, straight on the page. */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {/* A hint, not a banner. */}
            <Typography
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                fontSize: 12,
                color: 'var(--muted-foreground)',
              }}
            >
              <Box
                component="span"
                sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'var(--primary)' }}
              />
              {t.manage.disableHint}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Box sx={{ position: 'relative', width: { xs: '100%', sm: 260 } }}>
              <SearchIcon
                size={16}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--muted-foreground)',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                data-tour-id="categories-search"
                placeholder={tx(['searchPlaceholder'], 'Find category')}
                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  padding: '8px 12px 8px 36px',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  color: 'var(--foreground)',
                  borderRadius: tokens.radius.sm,
                  boxSizing: 'border-box',
                }}
              />
            </Box>
            <button
              type="button"
              onClick={() => handleOpenDialog()}
              data-tour-id="categories-add-button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                border: 'none',
                background: 'var(--primary-fill)',
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 600,
                color: '#fff',
                cursor: 'pointer',
                borderRadius: tokens.radius.md,
              }}
            >
              {t.add}
            </button>
          </Box>
        </Box>

        {selectedIds.size > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body2"
              fontWeight={500}
              sx={{ mr: 1, color: 'var(--muted-foreground)' }}
            >
              {t.manage.selectedCount.value.replace('{count}', String(selectedIds.size))}
            </Typography>
            <button
              type="button"
              onClick={() => handleBulkEnable(true)}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--card)',
                padding: '6px 12px',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--foreground)',
                cursor: 'pointer',
                borderRadius: tokens.radius.md,
              }}
            >
              {t.manage.enable}
            </button>
            <button
              type="button"
              onClick={() => handleBulkEnable(false)}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--card)',
                padding: '6px 12px',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--foreground)',
                cursor: 'pointer',
                borderRadius: tokens.radius.md,
              }}
            >
              {t.manage.disable}
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              style={{
                border: '1px solid rgba(239,68,68,0.3)',
                background: 'var(--color-error-soft-bg)',
                padding: '6px 12px',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--destructive)',
                cursor: 'pointer',
                borderRadius: tokens.radius.md,
              }}
            >
              {t.manage.deleteCustom}
            </button>
          </Box>
        ) : null}

        {/* Category list: flat rows on the page, no outer frame. */}
        <Box className="lumio-categories-list" data-tour-id="categories-list">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1.5,
              py: 1,
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--muted-foreground)',
              borderBottom: '1px solid',
              borderColor: HAIRLINE,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Checkbox
                aria-label={t.manage.selectAll.value}
                checked={
                  selectedIds.size === filteredCategories.length && filteredCategories.length > 0
                }
                onCheckedChange={handleToggleSelectAll}
              />
              <span>{tx(['columns', 'name'], 'Name')}</span>
            </Box>
            <span>{tx(['enabled'], 'Enabled')}</span>
          </Box>

          {categoriesQuery.isPending ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1.5 }}>
              {CATEGORY_ROW_SKELETON_KEYS.map(key => (
                <CategoryRowSkeleton key={key} />
              ))}
            </Box>
          ) : filteredCategories.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
              <Box sx={{ display: 'inline-flex', color: 'var(--muted-foreground)', mb: 1.5 }}>
                <SearchIcon size={28} />
              </Box>
              <Typography sx={{ fontSize: 15, fontWeight: 500, color: 'var(--foreground)', mb: 2 }}>
                {tx(['noData'], 'No categories')}
              </Typography>
              <button
                type="button"
                onClick={() => handleOpenDialog()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  padding: '8px 16px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                  borderRadius: tokens.radius.md,
                }}
              >
                {t.add}
              </button>
            </Box>
          ) : (
            <Box
              sx={{
                // Bulk actions reload the list in the background without blanking the rows.
                opacity: categoriesQuery.isFetching ? 0.6 : 1,
                transition: 'opacity 150ms ease',
              }}
            >
              {filteredCategories.map((category, index) => {
                const categoryColor = category.color || '#2196F3';
                const hasIcon = Boolean(category.icon?.trim());
                const iconUrl = resolveIconUrl(category.icon);
                const CategoryGlyph = categoryIconFor(category.icon);
                const badgeLabel = getCategoryBadgeLabel(category);
                const badgeSource = getCategoryBadgeSource(category);
                const badgeColors = badgeSource ? SOURCE_BADGE_COLORS[badgeSource] : null;
                const isEnabled = category.isEnabled !== false;
                const isToggling = togglingIds.has(category.id);

                return (
                  <Box key={category.id} sx={CATEGORY_ROW_SX}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                      <Checkbox
                        aria-label={category.name}
                        checked={selectedIds.has(category.id)}
                        onCheckedChange={() => handleToggleSelect(category.id)}
                      />
                      {/* Colour as a small marker, not a stripe down every row. */}
                      {!category.isSystem && hasIcon ? (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            width: 16,
                            justifyContent: 'center',
                            color: categoryColor,
                            opacity: isEnabled ? 1 : 0.5,
                            flexShrink: 0,
                          }}
                        >
                          {iconUrl ? (
                            <Box
                              component="img"
                              src={iconUrl}
                              alt=""
                              sx={{ width: 16, height: 16, objectFit: 'contain' }}
                            />
                          ) : (
                            <CategoryGlyph size={16} />
                          )}
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            width: 16,
                            display: 'flex',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Box
                            component="span"
                            aria-hidden
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: categoryColor,
                              opacity: isEnabled ? 1 : 0.4,
                            }}
                          />
                        </Box>
                      )}
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            sx={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: isEnabled ? 'var(--foreground)' : 'var(--muted-foreground)',
                            }}
                          >
                            {getCategoryDisplayName(category, locale)}
                          </Typography>
                          {badgeLabel && badgeColors && (
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                px: 0.75,
                                fontSize: 11,
                                fontWeight: 500,
                                color: badgeColors.color,
                                border: `1px solid ${badgeColors.border}`,
                                borderRadius: tokens.radius.sm,
                              }}
                            >
                              {badgeLabel}
                            </Box>
                          )}
                        </Box>
                        <Typography
                          variant="caption"
                          sx={{ color: 'var(--muted-foreground)', display: 'block' }}
                        >
                          {usageCounts[category.id]?.total ? (
                            <span>
                              {t.manage.usedIn.value.replace(
                                '{count}',
                                String(usageCounts[category.id].total),
                              )}
                            </span>
                          ) : (
                            <span>{t.manage.notUsed}</span>
                          )}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Switch
                        data-tour-id={index === 0 ? 'category-toggle' : undefined}
                        checked={isEnabled}
                        disableRipple
                        disabled={isToggling}
                        onClick={event => event.stopPropagation()}
                        onChange={() => handleToggleEnabled(category)}
                        slotProps={{
                          input: {
                            'aria-label': t.manage.toggleAria.value.replace(
                              '{name}',
                              getCategoryDisplayName(category, locale),
                            ),
                            role: 'switch',
                          },
                        }}
                        sx={COMPACT_SWITCH_SX}
                      />
                      {category.isSystem ? (
                        <Box
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 28,
                            height: 28,
                            color: 'var(--muted-foreground)',
                            opacity: 0.5,
                          }}
                        >
                          <Lock size={14} />
                        </Box>
                      ) : (
                        <button
                          type="button"
                          className="category-row-open"
                          aria-label={t.manage.editAria.value.replace(
                            '{name}',
                            getCategoryDisplayName(category, locale),
                          )}
                          onClick={() => handleOpenDialog(category)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 28,
                            height: 28,
                            borderRadius: tokens.radius.full,
                            color: 'var(--muted-foreground)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <ChevronRight size={16} />
                        </button>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      {/* Edit/Create dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editingCategory ? t.dialog.editTitle : t.dialog.createTitle}
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
          <Button onClick={handleCloseDialog} color="inherit">
            {t.dialog.cancel}
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name}>
            {t.dialog.save}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Disable confirm dialog */}
      <Dialog
        open={Boolean(disableConfirm)}
        onClose={() => setDisableConfirm(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>{t.manage.disableDialog.title}</DialogTitle>
        <DialogContent dividers>
          {disableConfirm ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                {disableUsedInBefore}
                <strong>{disableConfirm.category.name}</strong>
                {disableUsedInAfter}
              </Typography>
              <Typography variant="body2" color="text.primary">
                {(disableConfirm.usage.transactions === 1
                  ? t.manage.disableDialog.transactionsOne
                  : t.manage.disableDialog.transactionsMany
                ).value.replace('{count}', String(disableConfirm.usage.transactions))}
              </Typography>
              <Typography variant="body2" color="text.primary">
                {(disableConfirm.usage.statements === 1
                  ? t.manage.disableDialog.statementsOne
                  : t.manage.disableDialog.statementsMany
                ).value.replace('{count}', String(disableConfirm.usage.statements))}
              </Typography>
              <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 500, mt: 1 }}>
                {t.manage.disableDialog.warning}
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDisableConfirm(null)} color="inherit">
            {t.dialog.cancel}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (disableConfirm) {
                void performToggle(disableConfirm.category, false);
              }
            }}
          >
            {t.manage.disable}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
