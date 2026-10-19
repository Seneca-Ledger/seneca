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

const getInitials = (value?: string): string =>
  (value || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

const getRoleLabel = (role: string): string => ROLE_LABELS[role] || role;

type MembersListProps = {
  members: WorkspaceMember[];
  updatingRoleMemberId: string | null;
  removingMemberId: string | null;
  canRemoveMember: (member: WorkspaceMember) => boolean;
  getAllowedRoleTargets: (member: WorkspaceMember) => WorkspaceRole[];
  onChangeMemberRole: (member: WorkspaceMember, role: WorkspaceRole) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
};

export function MembersList({
  members,
  updatingRoleMemberId,
  removingMemberId,
  canRemoveMember,
  getAllowedRoleTargets,
  onChangeMemberRole,
  onRemoveMember,
}: MembersListProps): React.ReactElement {
  const [memberMenuAnchorMap, setMemberMenuAnchorMap] = useState<
    Record<string, HTMLElement | null>
  >({});
  const [roleMenuAnchorMap, setRoleMenuAnchorMap] = useState<Record<string, HTMLElement | null>>(
    {},
  );

  const handleMemberMenuAction = async (member: WorkspaceMember, action: string): Promise<void> => {
    if (action === 'remove') {
      if (!window.confirm('Remove this member from workspace?')) {
        return;
      }
      await onRemoveMember(member.id);
      return;
    }
    if (!action.startsWith('role:')) {
      return;
    }
    const role = action.replace('role:', '') as WorkspaceRole;
    await onChangeMemberRole(member, role);
  };

  if (members.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'var(--muted-foreground)' }}>
        No members match current filters.
      </Typography>
    );
  }

  return (
    <>
      {members.map(member => {
        const canRemove = canRemoveMember(member);
        const roleTargets = getAllowedRoleTargets(member);
        const canManageRole = roleTargets.length > 0;
        const roleUpdating = updatingRoleMemberId === member.id;
        const roleStyle = ROLE_COLORS[member.role] || ROLE_COLORS.member;

        return (
          <Box
            key={member.id}
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
                {normalizeAvatarUrl(member.avatarUrl) ? (
                  <img
                    src={normalizeAvatarUrl(member.avatarUrl) as string}
                    alt={member.name || member.email || 'Member avatar'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  getInitials(member.name || member.email)
                )}
              </Box>
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
                  Timezone: {member.timeZone || 'Auto'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={ROLE_TOOLTIPS[member.role] || 'Workspace role'} placement="top">
                <span>
                  {canManageRole ? (
                    <>
                      <button
                        type="button"
                        disabled={roleUpdating}
                        onClick={e =>
                          setRoleMenuAnchorMap(prev => ({ ...prev, [member.id]: e.currentTarget }))
                        }
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          borderRadius: tokens.radius.sm,
                          border: `1px solid ${roleStyle.border}`,
                          background: roleStyle.bg,
                          color: roleStyle.color,
                          padding: '2px 10px',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          opacity: roleUpdating ? 0.6 : 1,
                        }}
                      >
                        {roleUpdating ? 'Updating...' : getRoleLabel(member.role)}
                        <ChevronDown size={12} />
                      </button>
                      <Menu
                        anchorEl={roleMenuAnchorMap[member.id]}
                        open={Boolean(roleMenuAnchorMap[member.id])}
                        onClose={() =>
                          setRoleMenuAnchorMap(prev => ({ ...prev, [member.id]: null }))
                        }
                        aria-label={`Change role for ${member.email || member.id}`}
                      >
                        {roleTargets.map(role => (
                          <MenuItem
                            key={role}
                            disabled={role === member.role}
                            onClick={() => {
                              setRoleMenuAnchorMap(prev => ({ ...prev, [member.id]: null }));
                              void onChangeMemberRole(member, role);
                            }}
                          >
                            {getRoleLabel(role)}
                          </MenuItem>
                        ))}
                      </Menu>
                    </>
                  ) : (
                    <span
                      style={{
                        borderRadius: tokens.radius.sm,
                        border: `1px solid ${roleStyle.border}`,
                        background: roleStyle.bg,
                        color: roleStyle.color,
                        padding: '2px 10px',
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {getRoleLabel(member.role)}
                    </span>
                  )}
                </span>
              </Tooltip>

              <IconButton
                size="small"
                aria-label={`Actions for ${member.email || member.id}`}
                onClick={e =>
                  setMemberMenuAnchorMap(prev => ({ ...prev, [member.id]: e.currentTarget }))
                }
              >
                <MoreHorizontal size={16} />
              </IconButton>
              <Menu
                anchorEl={memberMenuAnchorMap[member.id]}
                open={Boolean(memberMenuAnchorMap[member.id])}
                onClose={() => setMemberMenuAnchorMap(prev => ({ ...prev, [member.id]: null }))}
                aria-label={`Member actions for ${member.email || member.id}`}
              >
                {canManageRole &&
                  roleTargets.map(role => (
                    <MenuItem
                      key={`role:${role}`}
                      disabled={role === member.role}
                      onClick={() => {
                        setMemberMenuAnchorMap(prev => ({ ...prev, [member.id]: null }));
                        void handleMemberMenuAction(member, `role:${role}`);
                      }}
                    >
                      Set as {getRoleLabel(role)}
                    </MenuItem>
                  ))}
                <MenuItem
                  disabled={!canRemove || removingMemberId === member.id}
                  onClick={() => {
                    setMemberMenuAnchorMap(prev => ({ ...prev, [member.id]: null }));
                    void handleMemberMenuAction(member, 'remove');
                  }}
                  sx={{ color: 'error.main' }}
                >
                  {removingMemberId === member.id ? 'Removing...' : 'Remove from workspace'}
                </MenuItem>
              </Menu>
            </Box>
          </Box>
        );
      })}
    </>
  );
}
