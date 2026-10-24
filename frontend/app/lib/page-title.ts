import { APP_NAME } from '@/app/lib/brand';

const PRODUCT_TITLE = `${APP_NAME} — Bank statement processing`;

const TITLES_BY_PREFIX: Array<[string, string]> = [
  ['/dashboard', `${APP_NAME} — Dashboard`],
  ['/statements', `${APP_NAME} — Statements`],
  ['/tables', `${APP_NAME} — Tables`],
  ['/categories', `${APP_NAME} — Categories`],
  ['/tags', `${APP_NAME} — Tags`],
  ['/workspaces/members', `${APP_NAME} — Workspace members`],
  ['/workspaces/overview', `${APP_NAME} — Workspace overview`],
  ['/workspaces/list', `${APP_NAME} — Workspaces`],
  ['/workspaces', `${APP_NAME} — Workspaces`],
  ['/reports', `${APP_NAME} — Reports`],
  ['/ledger', `${APP_NAME} — Ledger`],
  ['/audit', `${APP_NAME} — Audit log`],
  ['/settings', `${APP_NAME} — Settings`],
];

export const resolvePageTitle = (pathname: string): string => {
  const normalized = pathname.trim();
  if (!normalized || normalized === '/') return PRODUCT_TITLE;

  const exactMatch = TITLES_BY_PREFIX.find(([prefix]) => normalized === prefix);
  if (exactMatch) return exactMatch[1];

  const prefixMatch = TITLES_BY_PREFIX.find(([prefix]) =>
    normalized.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`),
  );

  return prefixMatch?.[1] ?? PRODUCT_TITLE;
};

export { PRODUCT_TITLE };
