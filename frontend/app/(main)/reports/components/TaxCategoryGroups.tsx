'use client';

import { Box, Checkbox, Skeleton, Typography } from '@mui/material';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import type { CategoryItem } from '@/app/lib/contracts';
import { useCategoryName } from '@/app/lib/use-category-name';

/** Placeholder rows per group while the categories load. */
const LOADING_ROWS = { expense: 12, income: 3 } as const;

const GRID_SX = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
    md: 'repeat(3, minmax(0, 1fr))',
  },
  columnGap: 3,
  maxWidth: 900,
} as const;

const ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  py: 0.5,
  fontSize: 14,
  color: 'text.primary',
} as const;

/**
 * The root categories as a yes/no list, expenses then income. `null` while
 * they load: the group labels stay, the rows are a box and a bar each.
 */
export function TaxCategoryGroups({
  categories,
  disabled,
  onToggle,
}: {
  categories: CategoryItem[] | null;
  disabled: boolean;
  onToggle: (category: CategoryItem) => void;
}): React.ReactElement {
  const t = useIntlayer('taxYearView');
  const categoryName = useCategoryName();
  return (
    <>
      {(['expense', 'income'] as const).map(type => {
        const group = (categories ?? []).filter(category => category.type === type);
        if (categories !== null && group.length === 0) {
          return null;
        }
        const groupLabel = type === 'expense' ? t.groupExpenses.value : t.income.value;
        return (
          <Box key={type} role="group" aria-label={groupLabel} sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', mb: 0.5 }}>
              {groupLabel}
            </Typography>
            <Box sx={GRID_SX}>
              {categories === null
                ? Array.from({ length: LOADING_ROWS[type] }, (_, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows
                    <Box key={index} sx={ROW_SX}>
                      <Box sx={{ p: 0.5, display: 'flex' }}>
                        <Skeleton
                          variant="rounded"
                          width={18}
                          height={18}
                          sx={{ borderRadius: '4px' }}
                        />
                      </Box>
                      <Skeleton variant="text" width="50%" />
                    </Box>
                  ))
                : group.map(category => (
                    <Box
                      key={category.id}
                      component="label"
                      sx={{ ...ROW_SX, cursor: disabled ? 'default' : 'pointer' }}
                    >
                      <Checkbox
                        size="small"
                        checked={Boolean(category.taxRelevant)}
                        disabled={disabled}
                        onChange={() => onToggle(category)}
                        // A thin outlined box: the app's blank one is a #f5f5f5 fill that
                        // vanishes on the warm page, and a darker fill reads as a heavy block.
                        icon={
                          <Box
                            component="span"
                            sx={{
                              width: 18,
                              height: 18,
                              borderRadius: '4px',
                              border: '1.5px solid',
                              borderColor: theme =>
                                theme.palette.mode === 'dark' ? '#5f5a53' : '#cfc9be',
                              bgcolor: 'var(--card)',
                            }}
                          />
                        }
                        sx={{ p: 0.5 }}
                      />
                      {categoryName(category.name)}
                    </Box>
                  ))}
            </Box>
          </Box>
        );
      })}
    </>
  );
}
