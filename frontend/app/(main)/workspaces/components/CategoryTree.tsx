'use client';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { ChevronRight, Lock, Search as SearchIcon, Tag } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { resolveCategoryIconUrl } from '@/app/lib/category-icon-url';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import { tokens } from '@/lib/theme-tokens';
import type { Category, CategoryUsageCount } from './hooks/useCategoryManagement';

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

const getBadgeSource = (category: Category): NonNullable<Category['source']> | null => {
  if (category.source === 'parsing') {
    return 'parsing';
  }
  if (category.isSystem || category.source === 'system') {
    return 'system';
  }
  return null;
};

const getBadgeLabel = (
  category: Category,
  labels: { parsing: string; system: string },
): string | null => {
  if (category.source === 'parsing') {
    return labels.parsing;
  }
  if (category.isSystem || category.source === 'system') {
    return labels.system;
  }
  return null;
};

type CategoryTreeProps = {
  categories: Category[];
  loading: boolean;
  locale: string;
  selectedIds: Set<string>;
  togglingIds: Set<string>;
  usageCounts: Record<string, CategoryUsageCount>;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onToggleEnabled: (category: Category) => Promise<void>;
  onOpenDialog: (category: Category) => void;
  onOpenCreateDialog: () => void;
  labels: {
    nameColumn: string;
    enabled: string;
    noData: string;
    add: string;
    parsing: string;
    system: string;
  };
};

export function CategoryTree({
  categories,
  loading,
  locale,
  selectedIds,
  togglingIds,
  usageCounts,
  onToggleSelectAll,
  onToggleSelect,
  onToggleEnabled,
  onOpenDialog,
  onOpenCreateDialog,
  labels,
}: CategoryTreeProps): React.ReactElement {
  return (
    <Box
      sx={{
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        bgcolor: 'var(--card)',
        p: 1,
      }}
      data-tour-id="categories-list"
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--muted-foreground)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Checkbox
            aria-label="Select all categories"
            checked={selectedIds.size === categories.length && categories.length > 0}
            onCheckedChange={onToggleSelectAll}
          />
          <span>{labels.nameColumn}</span>
        </Box>
        <span>{labels.enabled}</span>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress size={32} />
        </Box>
      ) : categories.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
          <Box
            sx={{
              mx: 'auto',
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: tokens.radius.full,
              bgcolor: 'var(--muted)',
              color: 'var(--muted-foreground)',
            }}
          >
            <SearchIcon size={32} />
          </Box>
          <Typography variant="h6" fontWeight={500} sx={{ color: 'var(--foreground)', mb: 3 }}>
            {labels.noData}
          </Typography>
          <button
            type="button"
            onClick={onOpenCreateDialog}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--foreground)',
              cursor: 'pointer',
              borderRadius: tokens.radius.md,
            }}
          >
            {labels.add}
          </button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, px: 1, pb: 2 }}>
          {categories.map((category, index) => {
            const categoryColor = category.color || '#2196F3';
            const hasIcon = Boolean(category.icon?.trim());
            const iconUrl = resolveCategoryIconUrl(category.icon);
            const isEnabled = category.isEnabled !== false;
            const isToggling = togglingIds.has(category.id);
            const iconTint = alpha(categoryColor, isEnabled ? 0.16 : 0.12);
            const badgeSource = getBadgeSource(category);
            const badgeLabel = getBadgeLabel(category, {
              parsing: labels.parsing,
              system: labels.system,
            });
            const badgeColors = badgeSource ? SOURCE_BADGE_COLORS[badgeSource] : null;

            return (
              <Box
                key={category.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${categoryColor}`,
                  borderRadius: tokens.radius.md,
                  px: 2,
                  py: 2,
                  bgcolor:
                    index % 2 === 0 ? 'var(--card)' : 'rgba(var(--muted-rgb,243,244,246),0.4)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Checkbox
                    aria-label={category.name}
                    checked={selectedIds.has(category.id)}
                    onCheckedChange={() => onToggleSelect(category.id)}
                  />
                  {!category.isSystem && hasIcon ? (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: tokens.radius.sm,
                        bgcolor: iconTint,
                        color: categoryColor,
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
                        <Tag size={16} />
                      )}
                    </Box>
                  ) : null}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body1"
                        fontWeight={600}
                        sx={{ color: 'var(--foreground)' }}
                      >
                        {getCategoryDisplayName(category, locale)}
                      </Typography>
                      {badgeLabel && badgeColors && (
                        <Box
                          component="span"
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            px: 1,
                            py: 0.25,
                            fontSize: 12,
                            fontWeight: 500,
                            bgcolor: badgeColors.bg,
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
                      sx={{ color: 'var(--muted-foreground)', display: 'block', mt: 0.25 }}
                    >
                      {usageCounts[category.id]?.total ? (
                        <span>Used in {usageCounts[category.id].total} transactions</span>
                      ) : (
                        <span>Not used yet</span>
                      )}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <button
                    type="button"
                    onClick={event => {
                      event.stopPropagation();
                      void onToggleEnabled(category);
                    }}
                    disabled={isToggling}
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                      alignItems: 'center',
                      width: 54,
                      height: 32,
                      borderRadius: tokens.radius.full,
                      border: 'none',
                      background: isEnabled ? 'var(--primary)' : 'rgba(107,114,128,0.4)',
                      cursor: isToggling ? 'default' : 'pointer',
                      opacity: isToggling ? 0.6 : 1,
                      transition: 'background 0.2s',
                      padding: 0,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        display: 'inline-block',
                        width: 24,
                        height: 24,
                        borderRadius: tokens.radius.full,
                        background: 'var(--card)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'transform 0.2s',
                        transform: isEnabled ? 'translateX(28px)' : 'translateX(4px)',
                      }}
                    />
                  </button>

                  {category.isSystem ? (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: tokens.radius.full,
                        color: 'rgba(107,114,128,0.6)',
                      }}
                    >
                      <Lock size={16} />
                    </Box>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenDialog(category)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
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
  );
}
