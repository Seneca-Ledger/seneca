'use client';

import Box from '@mui/material/Box';
import React from 'react';
import { Grid, List, Search, SortAsc } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

type ViewMode = 'grid' | 'list';
type SortOption = 'alphabetical' | 'recent' | 'favorites';

const SORT_OPTIONS: SortOption[] = ['favorites', 'alphabetical', 'recent'];

const VIEW_MODES: { mode: ViewMode; Icon: typeof Grid }[] = [
  { mode: 'grid', Icon: Grid },
  { mode: 'list', Icon: List },
];

type SortMenuProps = {
  sortOption: SortOption;
  showSortMenu: boolean;
  onToggle: () => void;
  onSelect: (opt: SortOption) => void;
};
function SortMenu({
  sortOption,
  showSortMenu,
  onToggle,
  onSelect,
}: SortMenuProps): React.JSX.Element {
  const t = useIntlayer('workspacesListView');
  return (
    <Box sx={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          padding: 8,
          border: '1px solid var(--border-color)',
          background: showSortMenu ? 'rgba(var(--primary-rgb,22,129,24),0.1)' : 'var(--card-bg)',
          color: showSortMenu ? 'var(--primary)' : 'var(--text-secondary)',
          cursor: 'pointer',
          borderRadius: tokens.radius.md,
        }}
        title={t.sort.button.value}
      >
        <SortAsc size={20} />
      </button>
      {showSortMenu && (
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            mt: 0.5,
            width: 192,
            bgcolor: 'background.paper',
            border: '1px solid var(--border-color)',
            borderRadius: tokens.radius.md,
            boxShadow: 3,
            zIndex: 10,
            overflow: 'hidden',
          }}
        >
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 16px',
                textAlign: 'left',
                fontSize: 14,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: sortOption === opt ? 600 : 400,
                color: sortOption === opt ? 'var(--primary)' : 'var(--foreground)',
              }}
            >
              {t.sort[opt]}
            </button>
          ))}
        </Box>
      )}
    </Box>
  );
}

type ViewToggleProps = { viewMode: ViewMode; onSelect: (mode: ViewMode) => void };
function ViewToggle({ viewMode, onSelect }: ViewToggleProps): React.JSX.Element {
  const t = useIntlayer('workspacesListView');
  return (
    <>
      {VIEW_MODES.map(({ mode, Icon }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onSelect(mode)}
          style={{
            padding: 8,
            border: '1px solid var(--border-color)',
            background:
              viewMode === mode ? 'rgba(var(--primary-rgb,22,129,24),0.1)' : 'var(--card-bg)',
            color: viewMode === mode ? 'var(--primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            borderRadius: tokens.radius.md,
          }}
          title={t.view[mode].value}
        >
          <Icon size={20} />
        </button>
      ))}
    </>
  );
}

type WorkspaceListFiltersProps = {
  searchQuery: string;
  searchPlaceholder: string;
  embedded: boolean;
  viewMode: ViewMode;
  sortOption: SortOption;
  showSortMenu: boolean;
  onSearchChange: (v: string) => void;
  onSortSelect: (opt: SortOption) => void;
  onSortMenuToggle: () => void;
  onViewModeSelect: (mode: ViewMode) => void;
};

export function WorkspaceListFilters({
  searchQuery,
  searchPlaceholder,
  embedded,
  viewMode,
  sortOption,
  showSortMenu,
  onSearchChange,
  onSortSelect,
  onSortMenuToggle,
  onViewModeSelect,
}: WorkspaceListFiltersProps): React.JSX.Element {
  return (
    // Search sized to what it holds, in one row with sort and view.
    <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ position: 'relative', width: { xs: '100%', sm: 320 } }} data-tour-id="search-bar">
        <Search
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
          onChange={e => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
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
      {!embedded && (
        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          <SortMenu
            sortOption={sortOption}
            showSortMenu={showSortMenu}
            onToggle={onSortMenuToggle}
            onSelect={onSortSelect}
          />
          <ViewToggle viewMode={viewMode} onSelect={onViewModeSelect} />
        </Box>
      )}
    </Box>
  );
}

export type { SortOption, ViewMode };
