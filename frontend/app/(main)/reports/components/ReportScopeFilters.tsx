'use client';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { useCategoryName } from '@/app/lib/use-category-name';
import { tokens } from '@/lib/theme-tokens';

interface NamedOption {
  id: string;
  name: string;
}

export interface ReportScope {
  walletIds: string[];
  categoryIds: string[];
}

interface ReportScopeFiltersProps {
  value: ReportScope;
  onChange: (scope: ReportScope) => void;
}

const selectSx = {
  height: 36,
  fontSize: 12,
  bgcolor: 'var(--card)',
  borderRadius: tokens.radius.md,
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border)' },
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--muted-foreground)',
};

export function ReportScopeFilters({
  value,
  onChange,
}: ReportScopeFiltersProps): React.JSX.Element | null {
  const t = useIntlayer('reportsPage');
  const labels = t.labels as Record<string, { value?: string } | undefined>;
  const text = (key: string, fallback: string): string => labels[key]?.value ?? fallback;
  const categoryName = useCategoryName();

  const [wallets, setWallets] = useState<NamedOption[]>([]);
  const [categories, setCategories] = useState<NamedOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    // Either list may fail on its own (no permission): the other still fills.
    void Promise.all([
      apiQueryDecoded({ url: '/wallets', contract: 'WalletList' }).catch(() => []),
      apiQueryDecoded({ url: '/categories', contract: 'CategoryList' }).catch(() => []),
    ]).then(([wallets, categories]) => {
      if (cancelled) {
        return;
      }
      setWallets(wallets.map(({ id, name }) => ({ id, name })));
      setCategories(categories.map(({ id, name }) => ({ id, name })));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const renderSelect = (
    options: NamedOption[],
    selected: string[],
    onSelect: (ids: string[]) => void,
    allLabel: string,
  ): React.JSX.Element => (
    <Select
      multiple
      displayEmpty
      size="small"
      value={selected}
      onChange={event => {
        const next = event.target.value;
        onSelect(typeof next === 'string' ? next.split(',') : next);
      }}
      renderValue={ids =>
        ids.length === 0
          ? allLabel
          : ids
              .map(id => options.find(option => option.id === id)?.name)
              .filter(Boolean)
              .join(', ')
      }
      sx={selectSx}
    >
      {options.map(option => (
        <MenuItem key={option.id} value={option.id} sx={{ fontSize: 12 }}>
          <Checkbox size="small" checked={selected.includes(option.id)} />
          <ListItemText
            primary={option.name}
            slotProps={{
              primary: { sx: { fontSize: 12 } },
            }}
          />
        </MenuItem>
      ))}
    </Select>
  );

  // Nothing to scope by yet (fresh workspace) — don't show empty dropdowns.
  if (wallets.length === 0 && categories.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        gap: 2,
        mb: 2.5,
      }}
      data-tour-id="reports-scope-filters"
    >
      {wallets.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <span style={fieldLabelStyle}>{text('filterAccounts', 'Accounts')}</span>
          {renderSelect(
            wallets,
            value.walletIds,
            walletIds => onChange({ ...value, walletIds }),
            text('filterAllAccounts', 'All accounts'),
          )}
        </Box>
      )}

      {categories.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <span style={fieldLabelStyle}>{text('filterCategories', 'Categories')}</span>
          {renderSelect(
            categories.map(category => ({ ...category, name: categoryName(category.name) })),
            value.categoryIds,
            categoryIds => onChange({ ...value, categoryIds }),
            text('filterAllCategories', 'All categories'),
          )}
        </Box>
      )}
    </Box>
  );
}
