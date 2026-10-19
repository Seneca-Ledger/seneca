import { Permission } from '../../common/enums/permissions.enum';

/**
 * What an API key may do. Scopes are the same strings as the permissions the
 * routes already check, so a key can never reach further than the role of the
 * person who made it; it can only be narrower. A key without scopes (made
 * before scopes existed) keeps the full reach of its owner.
 */
export const ALL_SCOPES: Permission[] = Object.values(Permission);

/** Never granted to a key: keys managing keys, or people. */
const NEVER_FOR_KEYS = new Set<Permission>([
  Permission.API_KEY_MANAGE,
  Permission.USER_MANAGE,
  Permission.USER_VIEW_ALL,
  Permission.WORKSPACE_SETTINGS_MANAGE,
  Permission.INTEGRATION_MANAGE,
]);

export const GRANTABLE_SCOPES: Permission[] = ALL_SCOPES.filter(
  scope => !NEVER_FOR_KEYS.has(scope),
);

const isRead = (scope: string) =>
  scope.endsWith('.view') || scope.endsWith('.export') || scope === Permission.AUDIT_VIEW;

export const SCOPE_PRESETS: Record<'read' | 'write', Permission[]> = {
  read: GRANTABLE_SCOPES.filter(isRead),
  write: GRANTABLE_SCOPES,
};

export function isGrantableScope(value: string): value is Permission {
  return (GRANTABLE_SCOPES as string[]).includes(value);
}

/** Groups scopes by the area before the dot, for a checkbox list. */
export function groupScopes(scopes: Permission[]): Record<string, Permission[]> {
  const groups: Record<string, Permission[]> = {};
  for (const scope of scopes) {
    const area = scope.split('.')[0].replace(/_/g, ' ');
    groups[area] = [...(groups[area] ?? []), scope];
  }
  return groups;
}
