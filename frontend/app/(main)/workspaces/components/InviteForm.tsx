'use client';

import Button from '@mui/material/Button';
import React, { useState } from 'react';
import { Send as SendIcon } from '@/app/components/icons';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';
import type { InvitePermissions, WorkspaceRole } from './hooks/useMemberManagement';

const PERMISSION_KEYS: Array<keyof InvitePermissions> = [
  'canEditStatements',
  'canEditCustomTables',
  'canEditCategories',
  'canEditDataEntry',
  'canShareFiles',
];

const DEFAULT_PERMISSIONS: InvitePermissions = {
  canEditStatements: true,
  canEditCustomTables: true,
  canEditCategories: true,
  canEditDataEntry: true,
  canShareFiles: false,
};

type InviteFormProps = {
  isOwnerOrAdmin: boolean;
  onInvite: (params: {
    email: string;
    role: WorkspaceRole;
    permissions: InvitePermissions;
  }) => Promise<void>;
};

type EmailRoleFieldsProps = {
  inviteEmail: string;
  inviteRole: WorkspaceRole;
  isOwnerOrAdmin: boolean;
  disabledStyle: React.CSSProperties;
  onEmailChange: (value: string) => void;
  onRoleChange: (value: WorkspaceRole) => void;
};

function EmailRoleFields({
  inviteEmail,
  inviteRole,
  isOwnerOrAdmin,
  disabledStyle,
  onEmailChange,
  onRoleChange,
}: EmailRoleFieldsProps): React.ReactElement {
  const t = useIntlayer('workspaceMembers');
  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid var(--border-color)',
    background: 'var(--card)',
    padding: '8px 12px',
    fontSize: 14,
    color: 'var(--foreground)',
    borderRadius: tokens.radius.md,
    boxSizing: 'border-box',
    ...disabledStyle,
  };
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
      }}
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
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
          onChange={e => onEmailChange(e.target.value)}
          required
          disabled={!isOwnerOrAdmin}
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
          onChange={value => onRoleChange(value as WorkspaceRole)}
          disabled={!isOwnerOrAdmin}
          options={[
            { value: 'member', label: t.roles.member.value },
            { value: 'viewer', label: t.roles.viewer.value },
            { value: 'admin', label: t.roles.admin.value },
          ]}
        />
      </div>
    </div>
  );
}

type PermissionsGridProps = {
  invitePermissions: InvitePermissions;
  isOwnerOrAdmin: boolean;
  onPermissionChange: (key: keyof InvitePermissions, checked: boolean | 'indeterminate') => void;
};

function PermissionsGrid({
  invitePermissions,
  isOwnerOrAdmin,
  onPermissionChange,
}: PermissionsGridProps): React.ReactElement {
  const t = useIntlayer('workspaceMembers');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
        {t.invite.permissionsTitle}
      </span>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 8,
        }}
      >
        {PERMISSION_KEYS.map(key => (
          <label
            key={key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              color: 'var(--foreground)',
            }}
          >
            <Checkbox
              checked={invitePermissions[key]}
              onCheckedChange={checked => onPermissionChange(key, checked)}
              disabled={!isOwnerOrAdmin}
            />
            {t.permissions[key]}
          </label>
        ))}
      </div>
    </div>
  );
}

export function InviteForm({ isOwnerOrAdmin, onInvite }: InviteFormProps): React.ReactElement {
  const t = useIntlayer('workspaceMembers');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitePermissions, setInvitePermissions] =
    useState<InvitePermissions>(DEFAULT_PERMISSIONS);

  const disabledStyle: React.CSSProperties = {
    opacity: !isOwnerOrAdmin ? 0.6 : 1,
    cursor: !isOwnerOrAdmin ? 'not-allowed' : 'auto',
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setInviteLoading(true);

    await (async () => {
      await onInvite({ email: inviteEmail, role: inviteRole, permissions: invitePermissions });
      setInviteEmail('');
    })().finally(async () => {
      setInviteLoading(false);
    });
  };

  const handlePermissionChange = (
    key: keyof InvitePermissions,
    checked: boolean | 'indeterminate',
  ): void => {
    setInvitePermissions(prev => ({ ...prev, [key]: checked }));
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        background: 'var(--card)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <EmailRoleFields
        inviteEmail={inviteEmail}
        inviteRole={inviteRole}
        isOwnerOrAdmin={isOwnerOrAdmin}
        disabledStyle={disabledStyle}
        onEmailChange={setInviteEmail}
        onRoleChange={setInviteRole}
      />
      {inviteRole === 'member' && (
        <PermissionsGrid
          invitePermissions={invitePermissions}
          isOwnerOrAdmin={isOwnerOrAdmin}
          onPermissionChange={handlePermissionChange}
        />
      )}
      {!isOwnerOrAdmin && (
        <div
          style={{
            border: '1px solid #fbbf24',
            borderRadius: tokens.radius.md,
            background: 'var(--color-warning-soft-bg)',
            padding: '10px 12px',
            fontSize: 14,
            color: 'var(--color-warning-soft-text)',
          }}
        >
          {t.invite.onlyOwnerOrAdmin}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          size="small"
          disabled={!isOwnerOrAdmin || inviteLoading}
          startIcon={<SendIcon size={16} />}
        >
          {inviteLoading ? t.sending : t.invite.send}
        </Button>
      </div>
    </form>
  );
}
