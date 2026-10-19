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
import { tokens } from '@/lib/theme-tokens';
import type { MemberRoleFilter, MemberSortBy } from './workspace-members.utils';

const SORT_OPTIONS: Array<{ key: MemberSortBy; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'joinedAt', label: 'Date added' },
];

const ROLE_FILTER_OPTIONS: Array<{ key: MemberRoleFilter; label: string }> = [
  { key: 'all', label: 'All roles' },
  { key: 'owner', label: 'Owner' },
  { key: 'admin', label: 'Admin' },
  { key: 'viewer', label: 'Viewer' },
  { key: 'member', label: 'Member' },
];

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
        Sort: {SORT_OPTIONS.find(o => o.key === sortBy)?.label || 'Name'}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {SORT_OPTIONS.map(option => (
          <MenuItem
            key={option.key}
            selected={option.key === sortBy}
            onClick={() => {
              onSortByChange(option.key);
              setAnchor(null);
            }}
          >
            {option.label}
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
        Role: {ROLE_FILTER_OPTIONS.find(o => o.key === roleFilter)?.label || 'All roles'}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {ROLE_FILTER_OPTIONS.map(option => (
          <MenuItem
            key={option.key}
            selected={option.key === roleFilter}
            onClick={() => {
              onRoleFilterChange(option.key);
              setAnchor(null);
            }}
          >
            {option.label}
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
          aria-label="Search members by email"
          placeholder="Search by email"
          value={searchEmail}
          onChange={e => onSearchChange(e.target.value)}
          size="small"
          variant="outlined"
          sx={{ width: { xs: '100%', sm: 320 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} style={{ color: 'var(--muted-foreground)' }} />
              </InputAdornment>
            ),
          }}
        />
        <SortMenu sortBy={sortBy} onSortByChange={onSortByChange} />
        <RoleMenu roleFilter={roleFilter} onRoleFilterChange={onRoleFilterChange} />
      </Box>
      <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
        Showing {visibleCount} of {totalCount} members.
      </Typography>
    </Box>
  );
}
