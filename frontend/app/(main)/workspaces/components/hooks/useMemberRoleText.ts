import { useIntlayer } from '@/app/i18n';

type RoleKey = 'owner' | 'admin' | 'member' | 'viewer' | 'accountant';

const ROLE_KEYS: string[] = ['owner', 'admin', 'member', 'viewer', 'accountant'];

const isRoleKey = (role: string): role is RoleKey => ROLE_KEYS.includes(role);

/** Role names and tooltips from the members dictionary; an unknown role shows as it is. */
export function useMemberRoleText(): {
  roleLabel: (role: string) => string;
  roleTooltip: (role: string) => string;
} {
  const t = useIntlayer('workspaceMembers');
  return {
    roleLabel: role => (isRoleKey(role) ? t.roles[role].value : role),
    roleTooltip: role =>
      isRoleKey(role) ? t.roleTooltips[role].value : t.roleTooltips.fallback.value,
  };
}
