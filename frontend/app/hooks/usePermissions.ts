'use client';

import { useCallback, useMemo } from 'react';
import { type User, useAuth } from './useAuth';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    // Admin has all permissions
    'statement.view',
    'workspaces.view',
    'statement.upload',
    'statement.delete',
    'statement.edit',
    'transaction.view',
    'transaction.edit',
    'transaction.delete',
    'transaction.bulk_update',
    'category.view',
    'category.create',
    'category.edit',
    'category.delete',
    'branch.view',
    'branch.create',
    'branch.edit',
    'branch.delete',
    'wallet.view',
    'wallet.create',
    'wallet.edit',
    'wallet.delete',
    'payable.view',
    'payable.create',
    'payable.edit',
    'payable.delete',
    'invoice.view',
    'invoice.create',
    'invoice.edit',
    'invoice.delete',
    'client.view',
    'client.create',
    'client.edit',
    'client.delete',
    'report.view',
    'report.export',
    'user.manage',
    'user.view_all',
    'audit_view',
    'audit_log.view',
    'telegram.view',
    'telegram.connect',
    'telegram.send',
    'budget.view',
    'budget.create',
    'budget.edit',
    'budget.delete',
    'goal.view',
    'goal.create',
    'goal.edit',
    'goal.delete',
    'subscription.view',
    'subscription.create',
    'subscription.edit',
    'subscription.delete',
    'api_key.manage',
    'ledger.view',
    'ledger.post',
    'ledger.manage_accounts',
  ],
  user: [
    // View-only permissions for regular users
    'statement.view',
    'workspaces.view',
    'transaction.view',
    'category.view',
    'branch.view',
    'wallet.view',
    'invoice.view',
    'client.view',
    'report.view',
    'telegram.view',
    'telegram.connect',
    'telegram.send',
    'budget.view',
    'goal.view',
    'subscription.view',
    'ledger.view',
  ],
  viewer: [
    // Read-only permissions
    'statement.view',
    'workspaces.view',
    'transaction.view',
    'category.view',
    'branch.view',
    'wallet.view',
    'invoice.view',
    'client.view',
    'report.view',
    'telegram.view',
    'budget.view',
    'goal.view',
    'subscription.view',
    'ledger.view',
  ],
};

const computePermissions = (user: User | null): string[] => {
  if (!user) return [];

  // Admin has all permissions
  if (user.role === 'admin') {
    return ROLE_PERMISSIONS.admin;
  }

  // If user has custom permissions, merge with role-based
  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  const customPermissions = user.permissions || [];

  // Merge and deduplicate
  const merged = [...new Set([...rolePermissions, ...customPermissions])];
  if (merged.includes('audit_log.view') && !merged.includes('audit_view')) {
    merged.push('audit_view');
  }
  if (merged.includes('audit_view') && !merged.includes('audit_log.view')) {
    merged.push('audit_log.view');
  }
  return merged;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types
export function usePermissions() {
  const { user } = useAuth();

  // Computed once per user; previously rebuilt on every hasPermission() call,
  // which nav components make a dozen times per render.
  const permissions = useMemo(() => computePermissions(user), [user]);
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);

  const hasPermission = useCallback(
    (permission: string): boolean => permissionSet.has(permission),
    [permissionSet],
  );

  const hasAnyPermission = useCallback(
    (required: string[]): boolean => required.some(p => permissionSet.has(p)),
    [permissionSet],
  );

  const hasAllPermissions = useCallback(
    (required: string[]): boolean => required.every(p => permissionSet.has(p)),
    [permissionSet],
  );

  const isAdmin = user?.role === 'admin';

  return useMemo(
    () => ({ permissions, hasPermission, hasAnyPermission, hasAllPermissions, isAdmin }),
    [permissions, hasPermission, hasAnyPermission, hasAllPermissions, isAdmin],
  );
}
