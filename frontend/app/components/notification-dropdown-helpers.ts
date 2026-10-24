import { tokens } from '@/lib/theme-tokens';
export type NotificationRef = {
  type: string;
  entityType: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
};

const TYPE_STATEMENT_HREFS = new Set([
  'transaction.uncategorized',
  'parsing.error',
  'import.failed',
  'statement.uploaded',
  'import.committed',
]);

const ENTITY_TYPE_HREFS: Record<string, string> = {
  category: '/categories',
  workspace: '/workspaces/overview',
  receipt: '/statements',
};

function getHrefByType(type: string, entityId: string | null): string | null {
  if (type === 'receipt.uncategorized' && entityId) {
    return `/storage/receipts/${entityId}`;
  }
  if (TYPE_STATEMENT_HREFS.has(type) && entityId) {
    return `/statements/${entityId}/edit`;
  }
  return null;
}

function getTransactionHref(meta: Record<string, unknown> | null): string {
  const sid = typeof meta?.statementId === 'string' ? meta.statementId : null;
  return sid ? `/statements/${sid}/edit` : '/statements';
}

function getHrefByEntityType(
  entityType: string | null,
  entityId: string | null,
  meta: Record<string, unknown> | null,
): string | null {
  if (entityType === 'statement' && entityId) return `/statements/${entityId}/edit`;
  if (entityType === 'transaction') return getTransactionHref(meta);
  if (entityType !== null && entityType in ENTITY_TYPE_HREFS) return ENTITY_TYPE_HREFS[entityType];
  return null;
}

export function getNotificationHref({
  type,
  entityType,
  entityId,
  meta,
}: NotificationRef): string | null {
  return getHrefByType(type, entityId) ?? getHrefByEntityType(entityType, entityId, meta);
}

export const MENU_PAPER_SX = {
  width: 360,
  mt: 1,
  p: 0,
  overflow: 'hidden',
  borderRadius: tokens.radius.lg,
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--card-bg)',
  color: 'var(--card-foreground)',
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.22)',
};
