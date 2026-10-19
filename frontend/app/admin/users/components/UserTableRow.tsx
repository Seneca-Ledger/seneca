'use client';
import {
  Chip,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  TableCell,
  TableRow,
} from '@mui/material';
import React from 'react';
import { Pencil } from '@/app/components/icons';
import { formatStoredDate } from '@/app/lib/user-format-store';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  permissions: string[] | null;
  createdAt: string;
}

export interface UserTableRowProps {
  user: User;
  localeCode: string;
  labels: {
    roleAdmin: React.ReactNode;
    roleUser: React.ReactNode;
    roleViewer: React.ReactNode;
    statusActive: React.ReactNode;
    statusInactive: React.ReactNode;
    permissionsDefault: string;
    managePermissionsTooltip: string;
  };
  onEditPermissions: (user: User) => void;
  onUpdateRole: ({ userId, newRole }: { userId: string; newRole: string }) => void;
  onToggleActive: (user: User) => void;
}

function RoleSelect({
  user,
  labels,
  onUpdateRole,
}: {
  user: User;
  labels: UserTableRowProps['labels'];
  onUpdateRole: UserTableRowProps['onUpdateRole'];
}): React.JSX.Element {
  return (
    <FormControl size="small" sx={{ minWidth: 120 }}>
      <Select
        value={user.role}
        onChange={e => onUpdateRole({ userId: user.id, newRole: e.target.value })}
      >
        <MenuItem value="admin">{labels.roleAdmin}</MenuItem>
        <MenuItem value="user">{labels.roleUser}</MenuItem>
        <MenuItem value="viewer">{labels.roleViewer}</MenuItem>
      </Select>
    </FormControl>
  );
}

function StatusChip({
  user,
  labels,
  onToggleActive,
}: {
  user: User;
  labels: UserTableRowProps['labels'];
  onToggleActive: (user: User) => void;
}): React.JSX.Element {
  const label = user.isActive ? labels.statusActive : labels.statusInactive;
  const color = user.isActive ? 'success' : 'default';
  return (
    <Chip
      label={label}
      color={color}
      size="small"
      onClick={() => onToggleActive(user)}
      sx={{ cursor: 'pointer' }}
    />
  );
}

function PermissionsChip({
  user,
  labels,
}: {
  user: User;
  labels: UserTableRowProps['labels'];
}): React.JSX.Element {
  const label = user.permissions?.length || labels.permissionsDefault;
  const color = user.permissions?.length ? 'primary' : 'default';
  return <Chip label={label} color={color} size="small" />;
}

export function UserTableRow({
  user,
  localeCode,
  labels,
  onEditPermissions,
  onUpdateRole,
  onToggleActive,
}: UserTableRowProps): React.JSX.Element {
  return (
    <TableRow>
      <TableCell>{user.email}</TableCell>
      <TableCell>{user.name}</TableCell>
      <TableCell>
        <RoleSelect user={user} labels={labels} onUpdateRole={onUpdateRole} />
      </TableCell>
      <TableCell>
        <StatusChip user={user} labels={labels} onToggleActive={onToggleActive} />
      </TableCell>
      <TableCell>
        <PermissionsChip user={user} labels={labels} />
      </TableCell>
      <TableCell>{formatStoredDate(user.createdAt, localeCode)}</TableCell>
      <TableCell>
        <IconButton
          size="small"
          onClick={() => onEditPermissions(user)}
          title={labels.managePermissionsTooltip}
        >
          <Pencil size={18} />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}
