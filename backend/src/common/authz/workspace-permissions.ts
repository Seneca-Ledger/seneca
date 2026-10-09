import {
  type WorkspaceMemberPermissions,
  WorkspaceRole,
} from '../../entities/workspace-member.entity';
import { Permission } from '../enums/permissions.enum';

/**
 * What a workspace role may do, as one table instead of a chain of `if`s.
 *
 * The rules, in order:
 *
 * 1. Global-only permissions are never granted by workspace membership — owning
 *    a workspace does not make you an instance admin.
 * 2. Read permissions belong to every member of the workspace, viewers included.
 * 3. Viewers never write. Their `permissions` column is irrelevant: the UI has
 *    never sent toggles for the viewer role, so a missing column used to mean
 *    "not explicitly forbidden", which let a read-only invitee edit and delete.
 * 4. Owners and admins get everything else that is workspace-scoped.
 * 5. A plain member writes only where a toggle in `workspace_members.permissions`
 *    says so, and only `true` counts: a member with no column has no write
 *    rights. Everything not named by a toggle is owner/admin territory.
 *
 * Adding a new `Permission` therefore fails closed — it lands in rule 4 and has
 * to be put in a bucket deliberately. `workspace-permissions.spec.ts` asserts
 * that every permission is classified.
 */

/** Rule 1: the instance-admin permissions, outside any workspace's reach. */
export const GLOBAL_ONLY_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.USER_MANAGE,
  Permission.USER_VIEW_ALL,
  Permission.API_KEY_MANAGE,
]);

/** Rule 2: looking at the workspace, which is all a viewer is invited for. */
export const WORKSPACE_READ_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.STATEMENT_VIEW,
  Permission.TRANSACTION_VIEW,
  Permission.CATEGORY_VIEW,
  Permission.BRANCH_VIEW,
  Permission.WALLET_VIEW,
  Permission.PAYABLE_VIEW,
  Permission.INVOICE_VIEW,
  Permission.CLIENT_VIEW,
  Permission.REPORT_VIEW,
  Permission.BUDGET_VIEW,
  Permission.GOAL_VIEW,
  Permission.SUBSCRIPTION_VIEW,
  Permission.LEDGER_VIEW,
  Permission.TELEGRAM_VIEW,
]);

/**
 * Rule 5a: what a member may do without any toggle. Export is a read that
 * leaves a file behind, so it stops at the member; a viewer reads the screen.
 */
export const MEMBER_PERMISSIONS: ReadonlySet<Permission> = new Set([Permission.REPORT_EXPORT]);

/**
 * Rule 5b: the toggle that gates each write for a plain member.
 *
 * The toggles are named after surfaces, and the mapping follows those names.
 * Budgets, wallets, goals, payables, invoices, clients, branches, subscriptions
 * and the ledger have no toggle, so they stay with the owner and admins — same
 * as before this table existed.
 */
export const MEMBER_PERMISSION_GATES: Readonly<
  Partial<Record<Permission, keyof WorkspaceMemberPermissions>>
> = {
  [Permission.STATEMENT_UPLOAD]: 'canEditStatements',
  [Permission.STATEMENT_EDIT]: 'canEditStatements',
  [Permission.STATEMENT_DELETE]: 'canEditStatements',
  [Permission.TRANSACTION_EDIT]: 'canEditStatements',
  [Permission.TRANSACTION_DELETE]: 'canEditStatements',
  [Permission.TRANSACTION_BULK_UPDATE]: 'canEditStatements',
  [Permission.CATEGORY_CREATE]: 'canEditCategories',
  [Permission.CATEGORY_EDIT]: 'canEditCategories',
  [Permission.CATEGORY_DELETE]: 'canEditCategories',
};

/** Does this workspace role, with these toggles, carry this permission? */
export function workspaceRoleAllows(
  permission: Permission,
  role: WorkspaceRole | undefined | null,
  memberPermissions: WorkspaceMemberPermissions | null | undefined,
): boolean {
  if (!role) {
    return false;
  }
  if (GLOBAL_ONLY_PERMISSIONS.has(permission)) {
    return false;
  }
  if (WORKSPACE_READ_PERMISSIONS.has(permission)) {
    return true;
  }
  if (role === WorkspaceRole.VIEWER) {
    return false;
  }
  if (role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN) {
    return true;
  }
  if (MEMBER_PERMISSIONS.has(permission)) {
    return true;
  }
  const gate = MEMBER_PERMISSION_GATES[permission];
  return gate ? memberPermissions?.[gate] === true : false;
}

/**
 * The same rule for the surfaces that have a toggle but no guarded permission —
 * custom tables, data entry, file sharing. Service-level checks must go through
 * here so that "viewer" means the same thing everywhere.
 */
export function workspaceMemberCanEdit(
  role: WorkspaceRole,
  gate: keyof WorkspaceMemberPermissions,
  memberPermissions: WorkspaceMemberPermissions | null | undefined,
): boolean {
  if (role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN) {
    return true;
  }
  if (role === WorkspaceRole.VIEWER) {
    return false;
  }
  return memberPermissions?.[gate] === true;
}
