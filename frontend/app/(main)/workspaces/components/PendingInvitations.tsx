'use client';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useIntlayer } from '@/app/i18n';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import type { WorkspaceInvitation } from './hooks/useMemberManagement';
import { useMemberRoleText } from './hooks/useMemberRoleText';

const formatDate = (value: string | undefined, notAvailable: string): string => {
  if (!value) {
    return notAvailable;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return notAvailable;
  }
  return formatStoredDateWithOptions(date, { year: 'numeric', month: 'short', day: 'numeric' });
};

export type CopyLinkParams = { token: string; link?: string };

type PendingInvitationsProps = {
  invitations: WorkspaceInvitation[];
  isOwnerOrAdmin: boolean;
  expiryDays: number;
  resendingInvitationId: string | null;
  revokingInvitationId: string | null;
  onResend: (invite: WorkspaceInvitation) => Promise<void>;
  onRevoke: (invitationId: string) => Promise<void>;
  onCopyLink: (params: CopyLinkParams) => Promise<void>;
};

type InviteRowProps = {
  invite: WorkspaceInvitation;
  isOwnerOrAdmin: boolean;
  isResending: boolean;
  isRevoking: boolean;
  onResend: (invite: WorkspaceInvitation) => Promise<void>;
  onRevoke: (invitationId: string) => Promise<void>;
  onCopyLink: (params: CopyLinkParams) => Promise<void>;
};

function InviteRow({
  invite,
  isOwnerOrAdmin,
  isResending,
  isRevoking,
  onResend,
  onRevoke,
  onCopyLink,
}: InviteRowProps): React.ReactElement {
  const t = useIntlayer('workspaceMembers');
  const { roleLabel } = useMemberRoleText();
  const isActionBusy = isResending || isRevoking;
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        border: '1px dashed var(--border)',
        borderRadius: tokens.radius.md,
        px: 2,
        py: 1.5,
      }}
    >
      <Box>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            color: 'var(--foreground)',
          }}
        >
          {invite.email}
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--muted-foreground)', display: 'block' }}>
          {t.pending.meta.value
            .replace('{role}', roleLabel(invite.role))
            .replace('{invited}', formatDate(invite.createdAt, t.notAvailable.value))
            .replace('{expires}', formatDate(invite.expiresAt, t.notAvailable.value))}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          disabled={!isOwnerOrAdmin || isActionBusy}
          onClick={() => void onResend(invite)}
        >
          {isResending ? t.sending : t.pending.resend}
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          disabled={!isOwnerOrAdmin || isActionBusy}
          onClick={() => void onRevoke(invite.id)}
        >
          {isRevoking ? t.pending.revoking : t.pending.revoke}
        </Button>
        <Button
          size="small"
          variant="text"
          disabled={isActionBusy}
          onClick={() => void onCopyLink({ token: invite.token, link: invite.link })}
        >
          {t.pending.copyLink}
        </Button>
      </Box>
    </Box>
  );
}

export function PendingInvitations({
  invitations,
  isOwnerOrAdmin,
  expiryDays,
  resendingInvitationId,
  revokingInvitationId,
  onResend,
  onRevoke,
  onCopyLink,
}: PendingInvitationsProps): React.ReactElement {
  const t = useIntlayer('workspaceMembers');
  return (
    <Box
      sx={{
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        bgcolor: 'var(--card)',
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--muted-foreground)',
        }}
      >
        {t.pending.title}
      </Typography>
      <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
        {t.pending.expiry.value.replace('{days}', String(expiryDays))}
      </Typography>
      {invitations.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'var(--muted-foreground)' }}>
          {t.pending.empty}
        </Typography>
      ) : (
        invitations.map(invite => (
          <InviteRow
            key={invite.id}
            invite={invite}
            isOwnerOrAdmin={isOwnerOrAdmin}
            isResending={resendingInvitationId === invite.id}
            isRevoking={revokingInvitationId === invite.id}
            onResend={onResend}
            onRevoke={onRevoke}
            onCopyLink={onCopyLink}
          />
        ))
      )}
    </Box>
  );
}
