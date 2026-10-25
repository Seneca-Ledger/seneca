'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';
import { ChevronDown, Search } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import { useMemberRoleText } from './hooks/useMemberRoleText';
import type { MemberRoleFilter, MemberSortBy } from './workspace-members.utils';

const SORT_OPTIONS: MemberSortBy[] = ['name', 'role', 'joinedAt'];

const ROLE_FILTER_OPTIONS: MemberRoleFilter[] = ['all', 'owner', 'admin', 'viewer', 'member'];

type MembersSearchBarProps = {
  searchEmail: string;
  roleFilter: MemberRoleFilter;
  sortBy: MemberSortBy;
  visibleCount: number;
  totalCount: number;
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (value: MemberRoleFilter) => void;
  onSortByChange: (value: MemberSortBy) => void;
};

type SortMenuProps = {
  sortBy: MemberSortBy;
  onSortByChange: (value: MemberSortBy) => void;
};

function SortMenu({ sortBy, onSortByChange }: SortMenuProps): React.ReactElement {
  const t = useIntlayer('workspaceMembers');
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={e => setAnchor(e.currentTarget)}
        endIcon={<ChevronDown size={14} />}
        sx={{ minWidth: 160, justifyContent: 'space-between' }}
      >
        {t.sortButton.value.replace('{value}', t.sort[sortBy].value)}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {SORT_OPTIONS.map(option => (
          <MenuItem
            key={option}
            selected={option === sortBy}
            onClick={() => {
              onSortByChange(option);
              setAnchor(null);
            }}
          >
            {t.sort[option]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

type RoleMenuProps = {
  roleFilter: MemberRoleFilter;
  onRoleFilterChange: (value: MemberRoleFilter) => void;
};

function RoleMenu({ roleFilter, onRoleFilterChange }: RoleMenuProps): React.ReactElement {
  const t = useIntlayer('workspaceMembers');
  const { roleLabel } = useMemberRoleText();
  const filterLabel = (key: MemberRoleFilter): string =>
    key === 'all' ? t.allRoles.value : roleLabel(key);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={e => setAnchor(e.currentTarget)}
        endIcon={<ChevronDown size={14} />}
        sx={{ minWidth: 180, justifyContent: 'space-between' }}
      >
        {t.roleButton.value.replace('{value}', filterLabel(roleFilter))}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {ROLE_FILTER_OPTIONS.map(option => (
          <MenuItem
            key={option}
            selected={option === roleFilter}
            onClick={() => {
              onRoleFilterChange(option);
              setAnchor(null);
            }}
          >
            {filterLabel(option)}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export function MembersSearchBar({
  searchEmail,
  roleFilter,
  sortBy,
  visibleCount,
  totalCount,
  onSearchChange,
  onRoleFilterChange,
  onSortByChange,
}: MembersSearchBarProps): React.ReactElement {
  const t = useIntlayer('workspaceMembers');
  return (
    <Box
      sx={{
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        bgcolor: 'var(--card)',
        p: { xs: 2, sm: 3 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        <TextField
          aria-label={t.searchAria.value}
          placeholder={t.searchPlaceholder.value}
          value={searchEmail}
          onChange={e => onSearchChange(e.target.value)}
          size="small"
          variant="outlined"
          sx={{ width: { xs: '100%', sm: 320 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} style={{ color: 'var(--muted-foreground)' }} />
                </InputAdornment>
              ),
            },
          }}
        />
        <SortMenu sortBy={sortBy} onSortByChange={onSortByChange} />
        <RoleMenu roleFilter={roleFilter} onRoleFilterChange={onRoleFilterChange} />
      </Box>
      <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
        {t.showing.value
          .replace('{visible}', String(visibleCount))
          .replace('{total}', String(totalCount))}
      </Typography>
    </Box>
  );
}
