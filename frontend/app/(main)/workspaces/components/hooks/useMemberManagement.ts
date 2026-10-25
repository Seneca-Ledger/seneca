import { useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer' | 'accountant';
/** Ownership is never invited, only transferred. */
export type InviteRole = Exclude<WorkspaceRole, 'owner'>;

export type WorkspaceMember = {
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
};

export type WorkspaceInvitation = {
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
};

export type WorkspaceOverview = {
  workspace: { id: string; name: string; ownerId?: string | null; createdAt?: string };
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
};

export type InvitePermissions = {
  canEditStatements: boolean;
  canEditCustomTables: boolean;
  canEditCategories: boolean;
  canEditDataEntry: boolean;
  canShareFiles: boolean;
};

export const getApiMessage = (err: unknown, fallback: string): string => {
  if (!err || typeof err !== 'object') {
    return fallback;
  }
  const response = (err as { response?: { data?: { message?: string } } }).response;
  return response?.data?.message ?? fallback;
};

const affectsOwnerRole = (currentRole: WorkspaceRole, nextRole: WorkspaceRole): boolean =>
  currentRole === 'owner' || nextRole === 'owner';

type HookParams = {
  overview: WorkspaceOverview | null;
  onRefresh: () => Promise<void>;
};

type UseMemberManagementReturn = {
  removingMemberId: string | null;
  updatingRoleMemberId: string | null;
  resendingInvitationId: string | null;
  revokingInvitationId: string | null;
  handleInvite: (params: {
    email: string;
    role: InviteRole;
    permissions: InvitePermissions;
  }) => Promise<void>;
  handleChangeMemberRole: (member: WorkspaceMember, nextRole: WorkspaceRole) => Promise<void>;
  handleRemoveMember: (memberId: string) => Promise<void>;
  handleResendInvitation: (invite: WorkspaceInvitation) => Promise<void>;
  handleRevokeInvitation: (invitationId: string) => Promise<void>;
  copyInviteLink: (params: { token: string; link?: string }) => Promise<void>;
};

async function apiWithToast<T>(
  fn: () => Promise<T>,
  successMsg: string,
  errMsg: string,
): Promise<void> {
  try {
    await fn();
    toast.success(successMsg);
  } catch (err) {
    toast.error(getApiMessage(err, errMsg));
  }
}

function useMemberActions({
  overview,
  onRefresh,
}: HookParams): Pick<
  UseMemberManagementReturn,
  | 'removingMemberId'
  | 'updatingRoleMemberId'
  | 'handleInvite'
  | 'handleChangeMemberRole'
  | 'handleRemoveMember'
> {
  const t = useIntlayer('workspaceMembers');
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [updatingRoleMemberId, setUpdatingRoleMemberId] = useState<string | null>(null);
  const wid = overview?.workspace.id;

  const handleInvite = async ({
    email,
    role,
    permissions,
  }: {
    email: string;
    role: InviteRole;
    permissions: InvitePermissions;
  }): Promise<void> => {
    if (!wid) {
      return;
    }
    await apiWithToast(
      () =>
        apiClient
          .post(`/workspaces/${wid}/invitations`, {
            email,
            role,
            permissions: role === 'member' ? permissions : undefined,
          } satisfies ContractInput<'InviteMemberBody'>)
          .then(() => onRefresh()),
      t.toasts.inviteSent.value,
      t.errors.sendFailed.value,
    );
  };

  const handleChangeMemberRole = async (
    member: WorkspaceMember,
    nextRole: WorkspaceRole,
  ): Promise<void> => {
    if (!wid || member.role === nextRole) {
      return;
    }
    if (affectsOwnerRole(member.role, nextRole) && !window.confirm(t.confirms.ownerRole.value)) {
      return;
    }
    setUpdatingRoleMemberId(member.id);

    await (async () => {
      await apiClient.patch(`/workspaces/${wid}/members/${member.id}/role`, {
        role: nextRole,
      } satisfies ContractInput<'UpdateMemberRoleBody'>);
      toast.success(t.toasts.roleUpdated.value);
      await onRefresh();
    })()
      .catch(async err => {
        toast.error(getApiMessage(err, t.errors.updateRoleFailed.value));
      })
      .finally(async () => {
        setUpdatingRoleMemberId(null);
      });
  };

  const handleRemoveMember = async (memberId: string): Promise<void> => {
    if (!wid) {
      return;
    }
    setRemovingMemberId(memberId);

    await (async () => {
      await apiClient.delete(`/workspaces/${wid}/members/${memberId}`);
      toast.success(t.toasts.memberRemoved.value);
      await onRefresh();
    })()
      .catch(async err => {
        toast.error(getApiMessage(err, t.errors.removeFailed.value));
      })
      .finally(async () => {
        setRemovingMemberId(null);
      });
  };

  return {
    removingMemberId,
    updatingRoleMemberId,
    handleInvite,
    handleChangeMemberRole,
    handleRemoveMember,
  };
}

function useInvitationActions({
  overview,
  onRefresh,
}: HookParams): Pick<
  UseMemberManagementReturn,
  | 'resendingInvitationId'
  | 'revokingInvitationId'
  | 'handleResendInvitation'
  | 'handleRevokeInvitation'
  | 'copyInviteLink'
> {
  const t = useIntlayer('workspaceMembers');
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);
  const wid = overview?.workspace.id;

  const handleResendInvitation = async (invite: WorkspaceInvitation): Promise<void> => {
    if (!wid) {
      return;
    }
    setResendingInvitationId(invite.id);

    await (async () => {
      await apiClient.post(`/workspaces/${wid}/invitations`, {
        email: invite.email,
        // Ownership moves only by transfer; an owner-role invitation from before
        // that rule goes out again as admin.
        role: invite.role === 'owner' ? 'admin' : invite.role,
        permissions: invite.role === 'member' ? (invite.permissions ?? undefined) : undefined,
      } satisfies ContractInput<'InviteMemberBody'>);
      toast.success(t.toasts.inviteResent.value);
      await onRefresh();
    })()
      .catch(async err => {
        toast.error(getApiMessage(err, t.errors.resendFailed.value));
      })
      .finally(async () => {
        setResendingInvitationId(null);
      });
  };

  const handleRevokeInvitation = async (invitationId: string): Promise<void> => {
    if (!(wid && window.confirm(t.confirms.revokeInvite.value))) {
      return;
    }
    setRevokingInvitationId(invitationId);

    await (async () => {
      await apiClient.delete(`/workspaces/${wid}/invitations/${invitationId}`);
      toast.success(t.toasts.inviteRevoked.value);
      await onRefresh();
    })()
      .catch(async err => {
        toast.error(getApiMessage(err, t.errors.revokeFailed.value));
      })
      .finally(async () => {
        setRevokingInvitationId(null);
      });
  };

  const copyInviteLink = async ({
    token,
    link: provided,
  }: {
    token: string;
    link?: string;
  }): Promise<void> => {
    await (async () => {
      await navigator.clipboard.writeText(provided || `${window.location.origin}/invite/${token}`);
      toast.success(t.toasts.linkCopied.value);
    })().catch(async () => {
      toast.error(t.errors.copyFailed.value);
    });
  };

  return {
    resendingInvitationId,
    revokingInvitationId,
    handleResendInvitation,
    handleRevokeInvitation,
    copyInviteLink,
  };
}

export function useMemberManagement({
  overview,
  onRefresh,
}: HookParams): UseMemberManagementReturn {
  const memberActions = useMemberActions({ overview, onRefresh });
  const invitationActions = useInvitationActions({ overview, onRefresh });
  return { ...memberActions, ...invitationActions };
}
