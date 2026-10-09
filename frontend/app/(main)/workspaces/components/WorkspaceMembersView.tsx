'use client';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import { alpha, type SxProps, type Theme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronDown,
  MailPlus,
  MoreHorizontal,
  Search,
  Send as SendIcon,
} from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Select } from '@/app/components/ui/select';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { normalizeAvatarUrl } from '@/app/lib/avatar-url';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import {
  filterAndSortMembers,
  type MemberRoleFilter,
  type MemberSortBy,
} from './workspace-members.utils';

type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

type WorkspaceOverview = {
  workspace: { id: string; name: string; ownerId?: string | null; createdAt?: string };
  members: Array<{
    id: string;
    email?: string;
    name?: string;
    avatarUrl?: string | null;
    timeZone?: string | null;
    role: WorkspaceRole;
    permissions?: {
      canEditStatements?: boolean;
      canEditCustomTables?: boolean;
      canEditCategories?: boolean;
      canEditDataEntry?: boolean;
      canShareFiles?: boolean;
    } | null;
    joinedAt?: string;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: WorkspaceRole;
    permissions?: {
      canEditStatements?: boolean;
      canEditCustomTables?: boolean;
      canEditCategories?: boolean;
      canEditDataEntry?: boolean;
      canShareFiles?: boolean;
    } | null;
    status: string;
    token: string;
    expiresAt?: string;
    createdAt?: string;
    link?: string;
  }>;
};

type InvitePermissions = {
  canEditStatements: boolean;
  canEditCustomTables: boolean;
  canEditCategories: boolean;
  canEditDataEntry: boolean;
  canShareFiles: boolean;
};

const INVITATION_EXPIRY_DAYS = 7;
const ALL_ROLES: WorkspaceRole[] = ['owner', 'admin', 'member', 'viewer'];

const SORT_OPTIONS: MemberSortBy[] = ['name', 'role', 'joinedAt'];

const ROLE_FILTER_OPTIONS: MemberRoleFilter[] = ['all', 'owner', 'admin', 'viewer', 'member'];

const PERMISSION_KEYS: Array<keyof InvitePermissions> = [
  'canEditStatements',
  'canEditCustomTables',
  'canEditCategories',
  'canEditDataEntry',
  'canShareFiles',
];

/** A toggle the member does not carry is a right they do not have. */
const readMemberPermissions = (member: {
  permissions?: Partial<InvitePermissions> | null;
}): InvitePermissions => ({
  canEditStatements: member.permissions?.canEditStatements === true,
  canEditCustomTables: member.permissions?.canEditCustomTables === true,
  canEditCategories: member.permissions?.canEditCategories === true,
  canEditDataEntry: member.permissions?.canEditDataEntry === true,
  canShareFiles: member.permissions?.canShareFiles === true,
});

const isWorkspaceRole = (role: string): role is WorkspaceRole =>
  (ALL_ROLES as string[]).includes(role);

const getInitials = (value?: string) =>
  (value || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

const getApiMessage = (err: unknown, fallback: string) => {
  if (!err || typeof err !== 'object') {
    return fallback;
  }
  const response = (err as { response?: { data?: { message?: string } } }).response;
  return response?.data?.message ?? fallback;
};

const formatDate = (value: string | undefined, fallback: string) => {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return formatStoredDateWithOptions(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const MEMBER_ROW_SKELETON_KEYS = ['row-0', 'row-1', 'row-2', 'row-3', 'row-4'];

/** Divider between flat sections and rows; barely there, in either theme. */
const HAIRLINE = (theme: Theme): string => alpha(theme.palette.text.primary, 0.06);

const TRUNCATE_SX = {
  color: 'var(--foreground)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

// Quiet text buttons for the toolbar and inline controls; action.hover is brand
// green in this theme, so the hover wash is a neutral tint instead.
const TOOLBAR_BUTTON_SX = {
  textTransform: 'none',
  fontWeight: 500,
  color: 'var(--muted-foreground)',
  '&:hover': {
    color: 'var(--foreground)',
    bgcolor: (theme: Theme) => alpha(theme.palette.text.primary, 0.05),
  },
} satisfies SxProps<Theme>;

// A flat row: hairline under it, a faint wash on hover. The ••• button only
// shows on hover or keyboard focus; touch screens have no hover, so there it stays.
const MEMBER_ROW_SX = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1.5,
  px: 1.5,
  py: 1.25,
  mx: -1.5,
  borderRadius: tokens.radius.sm,
  borderBottom: '1px solid',
  borderColor: HAIRLINE,
  transition: 'background-color 120ms ease',
  '&:hover': { bgcolor: (theme: Theme) => alpha(theme.palette.text.primary, 0.04) },
  '& .members-row-actions': { opacity: 0, transition: 'opacity 120ms ease' },
  '&:hover .members-row-actions, & .members-row-actions:focus-visible, & .members-row-actions[aria-expanded="true"]':
    { opacity: 1 },
  '@media (hover: none)': { '& .members-row-actions': { opacity: 1 } },
} satisfies SxProps<Theme>;

/** Mirrors a loaded member row: flat, hairline underneath, 32px avatar. */
function MemberRowSkeleton(): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        py: 1.25,
        borderBottom: '1px solid',
        borderColor: HAIRLINE,
      }}
    >
      <Box sx={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 1.5 }}>
        <Skeleton variant="circular" width={32} height={32} />
        <Box>
          <Skeleton variant="text" width={140} height={18} />
          <Skeleton variant="text" width={220} height={14} />
        </Box>
      </Box>
      <Skeleton variant="rounded" width={52} height={20} />
    </Box>
  );
}

export default function WorkspaceMembersView() {
  const { user } = useAuth();
  const t = useIntlayer('workspaceMembers');
  const getRoleLabel = (role: string): string =>
    isWorkspaceRole(role) ? t.roles[role].value : role;
  const getRoleFilterLabel = (key: MemberRoleFilter): string =>
    key === 'all' ? t.allRoles.value : t.roles[key].value;
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [updatingRoleMemberId, setUpdatingRoleMemberId] = useState<string | null>(null);
  const [updatingPermissionsMemberId, setUpdatingPermissionsMemberId] = useState<string | null>(
    null,
  );
  const [permissionsMenuAnchorMap, setPermissionsMenuAnchorMap] = useState<
    Record<string, HTMLElement | null>
  >({});
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);
  const [searchEmail, setSearchEmail] = useState('');
  const [roleFilter, setRoleFilter] = useState<MemberRoleFilter>('all');
  const [sortBy, setSortBy] = useState<MemberSortBy>('name');
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null);
  const [roleMenuAnchor, setRoleMenuAnchor] = useState<null | HTMLElement>(null);
  const [memberMenuAnchorMap, setMemberMenuAnchorMap] = useState<
    Record<string, HTMLElement | null>
  >({});
  const [roleMenuAnchorMap, setRoleMenuAnchorMap] = useState<Record<string, HTMLElement | null>>(
    {},
  );
  const [invitePermissions, setInvitePermissions] = useState<InvitePermissions>({
    canEditStatements: true,
    canEditCustomTables: true,
    canEditCategories: true,
    canEditDataEntry: true,
    canShareFiles: false,
  });

  const currentMembership = useMemo(
    () => overview?.members.find(item => item.id === user?.id),
    [overview?.members, user?.id],
  );

  const isOwnerOrAdmin = currentMembership?.role === 'owner' || currentMembership?.role === 'admin';
  const isWorkspaceOwner = currentMembership?.role === 'owner';

  const visibleMembers = useMemo(
    () =>
      filterAndSortMembers(overview?.members || [], {
        searchEmail,
        roleFilter,
        sortBy,
      }),
    [overview?.members, roleFilter, searchEmail, sortBy],
  );

  const loadOverview = async () => {
    await (async () => {
      setLoading(true);
      setFetchError(null);
      const response = await apiClient.get<WorkspaceOverview>('/workspaces/me');
      setOverview(response.data);
    })()
      .catch(async err => {
        setFetchError(getApiMessage(err, t.errors.loadFailed.value));
      })
      .finally(async () => {
        setLoading(false);
      });
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const canRemoveMember = (member: WorkspaceOverview['members'][number]) => {
    if (!overview) {
      return false;
    }
    if (!isOwnerOrAdmin) {
      return false;
    }
    if (member.role === 'owner') {
      return false;
    }
    if (member.id === user?.id) {
      return false;
    }

    if (overview.workspace.ownerId === user?.id) {
      return true;
    }

    return member.role === 'member' || member.role === 'viewer';
  };

  const getAllowedRoleTargets = (member: WorkspaceOverview['members'][number]): WorkspaceRole[] => {
    if (!isOwnerOrAdmin) {
      return [];
    }
    if (member.id === user?.id) {
      return [];
    }

    if (isWorkspaceOwner) {
      return ALL_ROLES;
    }

    if (member.role === 'owner' || member.role === 'admin') {
      return [];
    }

    return ['member', 'viewer'];
  };

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!overview?.workspace.id) {
      return;
    }

    setInviteLoading(true);

    await (async () => {
      await apiClient.post(`/workspaces/${overview.workspace.id}/invitations`, {
        email: inviteEmail,
        role: inviteRole,
        permissions: inviteRole === 'member' ? invitePermissions : undefined,
      });

      setInviteEmail('');
      toast.success(t.toasts.inviteSent.value);
      await loadOverview();
    })()
      .catch(async err => {
        toast.error(getApiMessage(err, t.errors.sendFailed.value));
      })
      .finally(async () => {
        setInviteLoading(false);
      });
  };

  const handleChangeMemberRole = async (
    member: WorkspaceOverview['members'][number],
    nextRole: WorkspaceRole,
  ) => {
    if (!overview?.workspace.id) {
      return;
    }
    if (member.role === nextRole) {
      return;
    }

    const affectsOwnerRole = member.role === 'owner' || nextRole === 'owner';
    if (affectsOwnerRole && !window.confirm(t.confirms.ownerRole.value)) {
      return;
    }

    setUpdatingRoleMemberId(member.id);

    await (async () => {
      await apiClient.patch(`/workspaces/${overview.workspace.id}/members/${member.id}/role`, {
        role: nextRole,
      });
      toast.success(t.toasts.roleUpdated.value);
      await loadOverview();
    })()
      .catch(async err => {
        toast.error(getApiMessage(err, t.errors.updateRoleFailed.value));
      })
      .finally(async () => {
        setUpdatingRoleMemberId(null);
      });
  };

  /**
   * The toggles are replaced wholesale: the API reads a missing key as "no", so
   * sending a partial object would silently revoke the rest.
   */
  const handleTogglePermission = async (
    member: WorkspaceOverview['members'][number],
    key: keyof InvitePermissions,
    checked: boolean,
  ) => {
    if (!overview?.workspace.id) {
      return;
    }

    const next = { ...readMemberPermissions(member), [key]: checked };

    setUpdatingPermissionsMemberId(member.id);

    await (async () => {
      await apiClient.patch(
        `/workspaces/${overview.workspace.id}/members/${member.id}/permissions`,
        { permissions: next },
      );
      toast.success(t.toasts.permissionsUpdated.value);
      // Patch the one row instead of reloading: the menu stays open for the
      // next toggle, and reloading would detach the element it is anchored to.
      setOverview(prev =>
        prev
          ? {
              ...prev,
              members: prev.members.map(item =>
                item.id === member.id ? { ...item, permissions: next } : item,
              ),
            }
          : prev,
      );
    })()
      .catch(async err => {
        toast.error(getApiMessage(err, t.errors.updatePermissionsFailed.value));
      })
      .finally(async () => {
        setUpdatingPermissionsMemberId(null);
      });
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!overview?.workspace.id) {
      return;
    }

    setRemovingMemberId(memberId);

    await (async () => {
      await apiClient.delete(`/workspaces/${overview.workspace.id}/members/${memberId}`);
      toast.success(t.toasts.memberRemoved.value);
      await loadOverview();
    })()
      .catch(async err => {
        toast.error(getApiMessage(err, t.errors.removeFailed.value));
      })
      .finally(async () => {
        setRemovingMemberId(null);
      });
  };

  const handleResendInvitation = async (invite: WorkspaceOverview['invitations'][number]) => {
    if (!overview?.workspace.id) {
      return;
    }

    setResendingInvitationId(invite.id);

    await (async () => {
      await apiClient.post(`/workspaces/${overview.workspace.id}/invitations`, {
        email: invite.email,
        role: invite.role,
        permissions: invite.role === 'member' ? invite.permissions : undefined,
      });
      toast.success(t.toasts.inviteResent.value);
      await loadOverview();
    })()
      .catch(async err => {
        toast.error(getApiMessage(err, t.errors.resendFailed.value));
      })
      .finally(async () => {
        setResendingInvitationId(null);
      });
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!overview?.workspace.id) {
      return;
    }
    if (!window.confirm(t.confirms.revokeInvite.value)) {
      return;
    }

    setRevokingInvitationId(invitationId);

    await (async () => {
      await apiClient.delete(`/workspaces/${overview.workspace.id}/invitations/${invitationId}`);
      toast.success(t.toasts.inviteRevoked.value);
      await loadOverview();
    })()
      .catch(async err => {
        toast.error(getApiMessage(err, t.errors.revokeFailed.value));
      })
      .finally(async () => {
        setRevokingInvitationId(null);
      });
  };

  const handleMemberMenuAction = async (
    member: WorkspaceOverview['members'][number],
    action: string,
  ) => {
    if (action === 'remove') {
      if (!window.confirm(t.confirms.removeMember.value)) {
        return;
      }
      await handleRemoveMember(member.id);
      return;
    }

    if (!action.startsWith('role:')) {
      return;
    }

    const role = action.replace('role:', '') as WorkspaceRole;
    await handleChangeMemberRole(member, role);
  };

  const copyInviteLink = async (token: string, providedLink?: string) => {
    await (async () => {
      const link = providedLink || `${window.location.origin}/invite/${token}`;
      await navigator.clipboard.writeText(link);
      toast.success(t.toasts.linkCopied.value);
    })().catch(async () => {
      toast.error(t.errors.copyFailed.value);
    });
  };

  // Same shape as the loaded tab — toolbar row, flat rows, invitations below —
  // so nothing jumps when the data arrives.
  if (loading) {
    return (
      <Box
        sx={{
          height: 'calc(100vh - var(--global-nav-height, 0px))',
          overflowY: 'auto',
          bgcolor: 'var(--background)',
        }}
      >
        <Box
          sx={{
            maxWidth: 1120,
            px: { xs: 2.5, sm: 4 },
            py: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
            <Skeleton variant="text" width={130} height={32} sx={{ mr: 'auto' }} />
            <Skeleton variant="rounded" width={240} height={36} />
            <Skeleton variant="text" width={90} height={24} />
            <Skeleton variant="text" width={110} height={24} />
            <Skeleton variant="rounded" width={136} height={32} />
          </Box>
          <Box>
            {MEMBER_ROW_SKELETON_KEYS.map(key => (
              <MemberRowSkeleton key={key} />
            ))}
          </Box>
          <Box sx={{ pt: 2.5, borderTop: '1px solid', borderColor: HAIRLINE }}>
            <Skeleton variant="text" width={170} height={18} />
            <Skeleton variant="text" width={150} height={14} />
          </Box>
        </Box>
      </Box>
    );
  }

  if (!overview) {
    return (
      <Box
        sx={{
          height: 'calc(100vh - var(--global-nav-height, 0px))',
          overflowY: 'auto',
          bgcolor: 'var(--background)',
        }}
      >
        <Box sx={{ maxWidth: 1120, px: { xs: 2.5, sm: 4 }, py: 3 }}>
          <Box role="alert" sx={{ fontSize: 14, color: 'var(--destructive)' }}>
            {fetchError || t.errors.loadFailed}
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: 'calc(100vh - var(--global-nav-height, 0px))',
        overflowY: 'auto',
        bgcolor: 'var(--background)',
      }}
    >
      <Box
        sx={{
          maxWidth: 1120,
          px: { xs: 2.5, sm: 4 },
          py: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
        }}
      >
        {/* Every control in one toolbar row, straight on the page. */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <TextField
            aria-label={t.searchAria.value}
            placeholder={t.searchPlaceholder.value}
            value={searchEmail}
            onChange={e => setSearchEmail(e.target.value)}
            size="small"
            variant="outlined"
            sx={{
              width: { xs: '100%', sm: 240 },
              '& .MuiOutlinedInput-root': { bgcolor: 'transparent' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border)' },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} style={{ color: 'var(--muted-foreground)' }} />
                </InputAdornment>
              ),
            }}
          />

          <Button
            variant="text"
            size="small"
            onClick={e => setSortMenuAnchor(e.currentTarget)}
            endIcon={<ChevronDown size={14} />}
            sx={TOOLBAR_BUTTON_SX}
          >
            {t.sortButton.value.replace('{value}', t.sort[sortBy].value)}
          </Button>
          <Menu
            anchorEl={sortMenuAnchor}
            open={Boolean(sortMenuAnchor)}
            onClose={() => setSortMenuAnchor(null)}
            aria-label={t.sortMenuAria.value}
          >
            {SORT_OPTIONS.map(option => (
              <MenuItem
                key={option}
                selected={option === sortBy}
                onClick={() => {
                  setSortBy(option);
                  setSortMenuAnchor(null);
                }}
              >
                {t.sort[option]}
              </MenuItem>
            ))}
          </Menu>

          <Button
            variant="text"
            size="small"
            onClick={e => setRoleMenuAnchor(e.currentTarget)}
            endIcon={<ChevronDown size={14} />}
            sx={TOOLBAR_BUTTON_SX}
          >
            {t.roleButton.value.replace('{value}', getRoleFilterLabel(roleFilter))}
          </Button>
          <Menu
            anchorEl={roleMenuAnchor}
            open={Boolean(roleMenuAnchor)}
            onClose={() => setRoleMenuAnchor(null)}
            aria-label={t.roleMenuAria.value}
          >
            {ROLE_FILTER_OPTIONS.map(option => (
              <MenuItem
                key={option}
                selected={option === roleFilter}
                onClick={() => {
                  setRoleFilter(option);
                  setRoleMenuAnchor(null);
                }}
              >
                {getRoleFilterLabel(option)}
              </MenuItem>
            ))}
          </Menu>

          <Button
            variant="contained"
            size="small"
            onClick={() => setShowInviteForm(prev => !prev)}
            startIcon={<MailPlus size={16} />}
          >
            {t.invite.button}
          </Button>
        </Box>

        {/* Invite form */}
        {showInviteForm && (
          <Box
            component="form"
            onSubmit={handleInvite}
            sx={{
              // Opens in the flow as a flat band between hairlines, not a card.
              borderTop: '1px solid',
              borderBottom: '1px solid',
              borderColor: HAIRLINE,
              py: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2,
              }}
            >
              {/* Email */}
              <Box
                sx={{
                  gridColumn: { xs: '1', sm: '1 / -1' },
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.75,
                }}
              >
                <label
                  htmlFor="invite-email"
                  style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}
                >
                  {t.invite.email}
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={event => setInviteEmail(event.target.value)}
                  required
                  disabled={!isOwnerOrAdmin}
                  style={{
                    width: '100%',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    padding: '8px 12px',
                    fontSize: 14,
                    color: 'var(--foreground)',
                    borderRadius: tokens.radius.md,
                    boxSizing: 'border-box',
                    opacity: !isOwnerOrAdmin ? 0.6 : 1,
                    cursor: !isOwnerOrAdmin ? 'not-allowed' : 'auto',
                  }}
                />
              </Box>

              {/* Role */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <label
                  htmlFor="invite-role"
                  style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}
                >
                  {t.invite.role}
                </label>
                <Select
                  fullWidth
                  id="invite-role"
                  value={inviteRole}
                  onChange={value => setInviteRole(value as WorkspaceRole)}
                  disabled={!isOwnerOrAdmin}
                  options={[
                    { value: 'member', label: t.roles.member.value },
                    { value: 'viewer', label: t.roles.viewer.value },
                    { value: 'admin', label: t.roles.admin.value },
                  ]}
                />
              </Box>
            </Box>

            {/* Permissions */}
            {inviteRole === 'member' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2" fontWeight={500} sx={{ color: 'var(--foreground)' }}>
                  {t.invite.permissionsTitle}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1,
                  }}
                >
                  {PERMISSION_KEYS.map(key => (
                    <Box
                      key={key}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                        fontSize: 14,
                        color: 'var(--foreground)',
                      }}
                    >
                      <Checkbox
                        checked={invitePermissions[key]}
                        onCheckedChange={checked =>
                          setInvitePermissions(prev => ({
                            ...prev,
                            [key]: checked,
                          }))
                        }
                        disabled={!isOwnerOrAdmin}
                      />
                      {t.permissions[key]}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {!isOwnerOrAdmin && (
              <Box
                sx={{
                  border: '1px solid #fbbf24',
                  bgcolor: 'var(--color-warning-soft-bg)',
                  p: 1.5,
                  fontSize: 14,
                  color: 'var(--color-warning-soft-text)',
                  borderRadius: tokens.radius.md,
                }}
              >
                {t.invite.onlyOwnerOrAdmin}
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                size="small"
                disabled={!isOwnerOrAdmin || inviteLoading}
                startIcon={<SendIcon size={16} />}
              >
                {inviteLoading ? t.sending : t.invite.send}
              </Button>
            </Box>
          </Box>
        )}

        {/* Members: a flat list, hairlines between rows, a faint wash under the pointer. */}
        <Box>
          {visibleMembers.length < overview.members.length ? (
            <Typography
              variant="caption"
              sx={{ display: 'block', mb: 1, color: 'var(--muted-foreground)' }}
            >
              {t.showing.value
                .replace('{visible}', String(visibleMembers.length))
                .replace('{total}', String(overview.members.length))}
            </Typography>
          ) : null}
          {visibleMembers.length === 0 ? (
            <Typography variant="body2" sx={{ py: 2, color: 'var(--muted-foreground)' }}>
              {t.noMatches}
            </Typography>
          ) : (
            visibleMembers.map(member => {
              const canRemove = canRemoveMember(member);
              const roleTargets = getAllowedRoleTargets(member);
              const canManageRole = roleTargets.length > 0;
              const roleUpdating = updatingRoleMemberId === member.id;
              const memberPermissions = readMemberPermissions(member);
              const grantedCount = PERMISSION_KEYS.filter(key => memberPermissions[key]).length;
              // Only the member role carries toggles: owners and admins are
              // unrestricted, viewers never write.
              const canManagePermissions = isOwnerOrAdmin && member.role === 'member';
              const permissionsUpdating = updatingPermissionsMemberId === member.id;

              return (
                <Box key={member.id} sx={MEMBER_ROW_SX}>
                  <Box sx={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        flexShrink: 0,
                        overflow: 'hidden',
                        borderRadius: tokens.radius.full,
                        // Monochrome initials: the avatar identifies, it does not decorate.
                        bgcolor: theme => alpha(theme.palette.text.primary, 0.08),
                        color: 'var(--muted-foreground)',
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
                          alt={member.name || member.email || t.avatarAlt.value}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        getInitials(member.name || member.email)
                      )}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={500} sx={TRUNCATE_SX}>
                        {member.name || member.email}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ ...TRUNCATE_SX, display: 'block', color: 'var(--muted-foreground)' }}
                      >
                        {member.email} · {member.timeZone || t.timezoneAuto}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    <Tooltip
                      title={
                        isWorkspaceRole(member.role)
                          ? t.roleTooltips[member.role].value
                          : t.roleTooltips.fallback.value
                      }
                      placement="top"
                    >
                      <span>
                        {canManageRole ? (
                          <>
                            <Button
                              variant="text"
                              size="small"
                              disabled={roleUpdating}
                              onClick={e =>
                                setRoleMenuAnchorMap(prev => ({
                                  ...prev,
                                  [member.id]: e.currentTarget,
                                }))
                              }
                              endIcon={<ChevronDown size={12} />}
                              sx={TOOLBAR_BUTTON_SX}
                            >
                              {roleUpdating ? t.updating : getRoleLabel(member.role)}
                            </Button>
                            <Menu
                              anchorEl={roleMenuAnchorMap[member.id]}
                              open={Boolean(roleMenuAnchorMap[member.id])}
                              onClose={() =>
                                setRoleMenuAnchorMap(prev => ({ ...prev, [member.id]: null }))
                              }
                              aria-label={t.changeRoleAria.value.replace(
                                '{name}',
                                member.email || member.id,
                              )}
                            >
                              {roleTargets.map(role => (
                                <MenuItem
                                  key={role}
                                  disabled={role === member.role}
                                  onClick={() => {
                                    setRoleMenuAnchorMap(prev => ({ ...prev, [member.id]: null }));
                                    void handleChangeMemberRole(member, role);
                                  }}
                                >
                                  {getRoleLabel(role)}
                                </MenuItem>
                              ))}
                            </Menu>
                          </>
                        ) : (
                          // A light outlined tag, not a filled badge.
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-block',
                              border: '1px solid var(--border)',
                              borderRadius: tokens.radius.sm,
                              px: 1,
                              py: '1px',
                              fontSize: 12,
                              fontWeight: 500,
                              color: 'var(--muted-foreground)',
                            }}
                          >
                            {getRoleLabel(member.role)}
                          </Box>
                        )}
                      </span>
                    </Tooltip>

                    {canManagePermissions && (
                      <>
                        <Button
                          variant="text"
                          size="small"
                          disabled={permissionsUpdating}
                          onClick={e =>
                            setPermissionsMenuAnchorMap(prev => ({
                              ...prev,
                              [member.id]: e.currentTarget,
                            }))
                          }
                          endIcon={<ChevronDown size={12} />}
                          sx={TOOLBAR_BUTTON_SX}
                        >
                          {permissionsUpdating
                            ? t.updating
                            : `${t.invite.permissionsTitle.value} · ${grantedCount}/${PERMISSION_KEYS.length}`}
                        </Button>
                        <Menu
                          anchorEl={permissionsMenuAnchorMap[member.id]}
                          open={Boolean(permissionsMenuAnchorMap[member.id])}
                          onClose={() =>
                            setPermissionsMenuAnchorMap(prev => ({ ...prev, [member.id]: null }))
                          }
                        >
                          {PERMISSION_KEYS.map(key => (
                            <MenuItem
                              key={key}
                              disabled={permissionsUpdating}
                              onClick={() =>
                                void handleTogglePermission(member, key, !memberPermissions[key])
                              }
                              sx={{ gap: 1 }}
                            >
                              <Checkbox
                                checked={memberPermissions[key]}
                                disabled={permissionsUpdating}
                                onCheckedChange={checked =>
                                  void handleTogglePermission(member, key, Boolean(checked))
                                }
                              />
                              {t.permissions[key]}
                            </MenuItem>
                          ))}
                        </Menu>
                      </>
                    )}

                    <IconButton
                      size="small"
                      className="members-row-actions"
                      aria-label={t.actionsAria.value.replace('{name}', member.email || member.id)}
                      onClick={e =>
                        setMemberMenuAnchorMap(prev => ({ ...prev, [member.id]: e.currentTarget }))
                      }
                    >
                      <MoreHorizontal size={16} />
                    </IconButton>
                    <Menu
                      anchorEl={memberMenuAnchorMap[member.id]}
                      open={Boolean(memberMenuAnchorMap[member.id])}
                      onClose={() =>
                        setMemberMenuAnchorMap(prev => ({ ...prev, [member.id]: null }))
                      }
                      aria-label={t.memberActionsAria.value.replace(
                        '{name}',
                        member.email || member.id,
                      )}
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
                            {t.setAs.value.replace('{role}', getRoleLabel(role))}
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
                        {removingMemberId === member.id ? t.removing : t.removeFromWorkspace}
                      </MenuItem>
                    </Menu>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

        {/* Pending invitations: a lower section under a thin rule, not a box. */}
        <Box sx={{ pt: 2.5, borderTop: '1px solid', borderColor: HAIRLINE }}>
          <Typography
            component="h2"
            sx={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--muted-foreground)',
            }}
          >
            {t.pending.title} · {overview.invitations.length}
          </Typography>
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.5, color: 'var(--muted-foreground)', opacity: 0.8 }}
          >
            {t.pending.expiry.value.replace('{days}', String(INVITATION_EXPIRY_DAYS))}
          </Typography>

          {overview.invitations.length === 0 ? (
            <Typography
              variant="body2"
              sx={{ mt: 1.5, color: 'var(--muted-foreground)', opacity: 0.6 }}
            >
              {t.pending.empty}
            </Typography>
          ) : (
            <Box sx={{ mt: 1 }}>
              {overview.invitations.map(invite => {
                const isResending = resendingInvitationId === invite.id;
                const isRevoking = revokingInvitationId === invite.id;
                const isActionBusy = isResending || isRevoking;

                return (
                  <Box key={invite.id} sx={MEMBER_ROW_SX}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={500} sx={TRUNCATE_SX}>
                        {invite.email}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ ...TRUNCATE_SX, display: 'block', color: 'var(--muted-foreground)' }}
                      >
                        {t.pending.meta.value
                          .replace('{role}', getRoleLabel(invite.role))
                          .replace('{invited}', formatDate(invite.createdAt, t.notAvailable.value))
                          .replace('{expires}', formatDate(invite.expiresAt, t.notAvailable.value))}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <Button
                        size="small"
                        variant="text"
                        disabled={!isOwnerOrAdmin || isActionBusy}
                        onClick={() => void handleResendInvitation(invite)}
                        sx={TOOLBAR_BUTTON_SX}
                      >
                        {isResending ? t.sending : t.pending.resend}
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        color="error"
                        disabled={!isOwnerOrAdmin || isActionBusy}
                        onClick={() => void handleRevokeInvitation(invite.id)}
                      >
                        {isRevoking ? t.pending.revoking : t.pending.revoke}
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        disabled={isActionBusy}
                        onClick={() => void copyInviteLink(invite.token, invite.link)}
                        sx={TOOLBAR_BUTTON_SX}
                      >
                        {t.pending.copyLink}
                      </Button>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
