'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { ChevronDown, MoreHorizontal } from '@/app/components/icons';
import { normalizeAvatarUrl } from '@/app/lib/avatar-url';
import { tokens } from '@/lib/theme-tokens';
import type { WorkspaceMember, WorkspaceRole } from './hooks/useMemberManagement';

const ROLE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  owner: {
    bg: 'rgba(var(--primary-rgb,22,129,24),0.1)',
    color: 'var(--primary)',
    border: 'rgba(var(--primary-rgb,22,129,24),0.2)',
  },
  admin: {
    bg: 'var(--color-info-soft-bg)',
    color: 'var(--color-info-soft-text)',
    border: 'var(--color-info-soft-border)',
  },
  member: { bg: 'var(--muted)', color: 'var(--foreground)', border: 'var(--border-color)' },
  viewer: { bg: 'var(--muted)', color: 'var(--foreground)', border: 'var(--border-color)' },
};
const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};
const ROLE_TOOLTIPS: Record<string, string> = {
  owner: 'Full workspace control, including ownership transfer and member management.',
  admin: 'Can invite and manage non-owner members.',
  member: 'Can work with workspace data based on assigned permissions.',
  viewer: 'Read-only access to workspace content.',
};
const getRoleLabel = (role: string): string => ROLE_LABELS[role] || role;
const getInitials = (value?: string): string =>
  (value || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');

export type ChangeMemberRoleParams = { member: WorkspaceMember; role: WorkspaceRole };

type MemberRowProps = {
  member: WorkspaceMember;
  updatingRoleMemberId: string | null;
  removingMemberId: string | null;
  canRemove: boolean;
  roleTargets: WorkspaceRole[];
  onChangeMemberRole: (params: ChangeMemberRoleParams) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
};

type MemberAvatarProps = {
  avatarUrl: string | null;
  name?: string;
  email?: string;
};

function MemberAvatar({ avatarUrl, name, email }: MemberAvatarProps): React.ReactElement {
  const label = name || email || 'Member avatar';
  return (
    <Box
      sx={{
        width: 36,
        height: 36,
        flexShrink: 0,
        overflow: 'hidden',
        borderRadius: tokens.radius.full,
        bgcolor: 'rgba(var(--primary-rgb,22,129,24),0.1)',
        color: 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={label}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        getInitials(name || email)
      )}
    </Box>
  );
}

type RoleBadgeProps = {
  member: WorkspaceMember;
  roleTargets: WorkspaceRole[];
  roleUpdating: boolean;
  onChangeMemberRole: (params: ChangeMemberRoleParams) => Promise<void>;
};

function RoleBadge({
  member,
  roleTargets,
  roleUpdating,
  onChangeMemberRole,
}: RoleBadgeProps): React.ReactElement {
  const [roleMenuAnchor, setRoleMenuAnchor] = useState<HTMLElement | null>(null);
  const canManageRole = roleTargets.length > 0;
  const roleStyle = ROLE_COLORS[member.role] || ROLE_COLORS.member;
  const badgeStyle = {
    borderRadius: tokens.radius.sm,
    border: `1px solid ${roleStyle.border}`,
    background: roleStyle.bg,
    color: roleStyle.color,
    padding: '2px 10px',
    fontSize: 12,
    fontWeight: 500,
  };
  return (
    <Tooltip title={ROLE_TOOLTIPS[member.role] || 'Workspace role'} placement="top">
      <span>
        {canManageRole ? (
          <>
            <button
              type="button"
              disabled={roleUpdating}
              onClick={e => setRoleMenuAnchor(e.currentTarget)}
              style={{
                ...badgeStyle,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer',
                opacity: roleUpdating ? 0.6 : 1,
              }}
            >
              {roleUpdating ? 'Updating...' : getRoleLabel(member.role)}
              <ChevronDown size={12} />
            </button>
            <Menu
              anchorEl={roleMenuAnchor}
              open={Boolean(roleMenuAnchor)}
              onClose={() => setRoleMenuAnchor(null)}
            >
              {roleTargets.map(role => (
                <MenuItem
                  key={role}
                  disabled={role === member.role}
                  onClick={() => {
                    setRoleMenuAnchor(null);
                    void onChangeMemberRole({ member, role });
                  }}
                >
                  {getRoleLabel(role)}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : (
          <span style={badgeStyle}>{getRoleLabel(member.role)}</span>
        )}
      </span>
    </Tooltip>
  );
}

export function MemberRow({
  member,
  updatingRoleMemberId,
  removingMemberId,
  canRemove,
  roleTargets,
  onChangeMemberRole,
  onRemoveMember,
}: MemberRowProps): React.ReactElement {
  const [memberMenuAnchor, setMemberMenuAnchor] = useState<HTMLElement | null>(null);
  const avatarUrl = normalizeAvatarUrl(member.avatarUrl);
  const roleUpdating = updatingRoleMemberId === member.id;
  const isRemoving = removingMemberId === member.id;

  const handleRemove = async (): Promise<void> => {
    if (!window.confirm('Remove this member from workspace?')) {
      return;
    }
    await onRemoveMember(member.id);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.md,
        bgcolor: 'var(--background)',
        px: 2,
        py: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 1.5 }}>
        <MemberAvatar avatarUrl={avatarUrl} name={member.name} email={member.email} />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={500}
            sx={{
              color: 'var(--foreground)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {member.name || member.email}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'var(--muted-foreground)',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {member.email}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--muted-foreground)', display: 'block' }}>
            Timezone: {member.timeZone || 'Auto'}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <RoleBadge
          member={member}
          roleTargets={roleTargets}
          roleUpdating={roleUpdating}
          onChangeMemberRole={onChangeMemberRole}
        />
        <IconButton
          size="small"
          aria-label={`Actions for ${member.email || member.id}`}
          onClick={e => setMemberMenuAnchor(e.currentTarget)}
        >
          <MoreHorizontal size={16} />
        </IconButton>
        <Menu
          anchorEl={memberMenuAnchor}
          open={Boolean(memberMenuAnchor)}
          onClose={() => setMemberMenuAnchor(null)}
        >
          {roleTargets.length > 0 &&
            roleTargets.map(role => (
              <MenuItem
                key={`role:${role}`}
                disabled={role === member.role}
                onClick={() => {
                  setMemberMenuAnchor(null);
                  void onChangeMemberRole({ member, role });
                }}
              >
                Set as {getRoleLabel(role)}
              </MenuItem>
            ))}
          <MenuItem
            disabled={!canRemove || isRemoving}
            onClick={() => {
              setMemberMenuAnchor(null);
              void handleRemove();
            }}
            sx={{ color: 'error.main' }}
          >
            {isRemoving ? 'Removing...' : 'Remove from workspace'}
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}
