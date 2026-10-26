'use client';

import { Box, type SxProps, type Theme } from '@mui/material';
import { useState } from 'react';
import StatementCategoryDrawer from '@/app/(main)/statements/[id]/edit/StatementCategoryDrawer';
import { ChevronDown } from '@/app/components/icons';
import { useLocale } from '@/app/i18n';
import { getCategoryDisplayName, type StatementCategoryNode } from '@/app/lib/statement-categories';
import { tokens } from '@/app/lib/theme-tokens';

type PickerCategory = StatementCategoryNode & { isEnabled?: boolean };

const HEIGHT = { small: 40, medium: 48, compact: 36 } as const;

export interface CategoryPickerFieldProps {
  value: string;
  categories: PickerCategory[];
  onChange: (categoryId: string) => void;
  /** Shown on the field while nothing is picked. */
  placeholder: string;
  /** Adds a first row in the drawer that clears the field, under this name. */
  clearLabel?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  size?: keyof typeof HEIGHT;
  sx?: SxProps<Theme>;
}

/**
 * A form field for one category: it looks like the inputs around it and opens
 * the app's category drawer (search, "Create category"). A category created
 * there is picked at once and named here before the caller's list reloads.
 */
export function CategoryPickerField({
  value,
  categories,
  onChange,
  placeholder,
  clearLabel,
  disabled = false,
  id,
  ariaLabel,
  size = 'medium',
  sx,
}: CategoryPickerFieldProps): React.JSX.Element {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<PickerCategory[]>([]);
  const enabled = [
    ...categories.filter(category => category.isEnabled !== false),
    ...created.filter(extra => !categories.some(category => category.id === extra.id)),
  ];
  const selected = enabled.find(category => category.id === value);
  const label = selected ? getCategoryDisplayName(selected, locale) : placeholder;

  return (
    <>
      <Box
        component="button"
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        title={selected ? label : undefined}
        disabled={disabled}
        onClick={() => setOpen(true)}
        sx={[
          {
            display: 'flex',
            height: HEIGHT[size],
            width: '100%',
            minWidth: 0,
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            border: '1px solid var(--input)',
            borderRadius: tokens.radius.md,
            bgcolor: 'transparent',
            color: selected ? 'text.primary' : 'var(--text-muted)',
            px: 1.75,
            font: 'inherit',
            fontSize: size === 'medium' ? 16 : 14,
            textAlign: 'left',
            cursor: 'pointer',
            '&:hover:not(:disabled)': { borderColor: 'text.primary' },
            '&:focus-visible': {
              borderColor: 'primary.main',
              boxShadow: '0 0 0 3px var(--primary-50)',
              outline: 'none',
            },
            '&:disabled': { cursor: 'default', opacity: 0.6 },
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <Box
          component="span"
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {label}
        </Box>
        <ChevronDown aria-hidden style={{ width: 18, height: 18, flexShrink: 0 }} />
      </Box>
      {/* Mounted while open only: a page may hold many of these fields. */}
      {open ? (
        <StatementCategoryDrawer
          open
          onClose={() => setOpen(false)}
          categories={enabled}
          selectedCategoryId={value}
          clearLabel={clearLabel}
          onSelect={categoryId => {
            setOpen(false);
            if (categoryId !== value) {
              onChange(categoryId);
            }
          }}
          onCreated={category => {
            setCreated(prev => [...prev, category]);
            setOpen(false);
            onChange(category.id);
          }}
        />
      ) : null}
    </>
  );
}
