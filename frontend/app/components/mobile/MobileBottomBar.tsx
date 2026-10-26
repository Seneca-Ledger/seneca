'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  BarChart2,
  FileText,
  LayoutDashboard,
  Plus,
  Receipt,
  ScanLine,
  Upload,
} from '@/app/components/icons';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import { AUTH_ROUTE_PREFIXES } from '@/app/lib/auth-routes';
import { normalizeAvatarUrl } from '@/app/lib/avatar-url';
import { avatarInitial, avatarTone } from '@/app/lib/initial-avatar';
import { isNavItemActive } from '../navigation/helpers/navigation-config';
import { MobileMenuDrawer } from './MobileMenuDrawer';
import { usePageQuickActions } from './quick-actions-store';

const HIDDEN_PATHS = ['/onboarding', ...AUTH_ROUTE_PREFIXES, '/shared', '/invite'];

const FAB_ACTIONS = [
  {
    id: 'upload',
    labelKey: 'fabUpload',
    icon: Upload,
    href: '/statements/submit?openExpenseDrawer=scan',
  },
  {
    id: 'scan',
    labelKey: 'fabScan',
    icon: ScanLine,
    href: '/statements/submit?openExpenseDrawer=scan',
  },
  {
    id: 'expense',
    labelKey: 'fabExpense',
    icon: Receipt,
    href: '/statements/submit?openExpenseDrawer=manual',
  },
] as const;

export default function MobileBottomBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { shell } = useIntlayer('navigation');
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const pageActions = usePageQuickActions();

  const closeFab = useCallback(() => setFabOpen(false), []);

  // Close FAB on route change
  useEffect(() => {
    closeFab();
  }, [pathname, closeFab]);

  // Close FAB on escape
  useEffect(() => {
    if (!fabOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFab();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fabOpen, closeFab]);

  if (HIDDEN_PATHS.some(p => pathname?.startsWith(p))) {
    return null;
  }

  const avatarUrl = normalizeAvatarUrl(user?.avatarUrl);
  const fabActions =
    pageActions ??
    FAB_ACTIONS.map(action => ({
      id: action.id,
      label: shell[action.labelKey].value,
      icon: action.icon,
      run: () => router.push(action.href),
    }));

  return (
    <>
      {/* FAB backdrop */}
      {fabOpen && (
        <div className="seneca-bottom-bar__fab-backdrop" onClick={closeFab} aria-hidden="true" />
      )}

      {/* FAB radial menu (upward) */}
      <div
        className={`seneca-bottom-bar__fab-menu${fabOpen ? ' seneca-bottom-bar__fab-menu--open' : ''}`}
        inert={!fabOpen}
      >
        {fabActions.map((action, index) => (
          <button
            key={action.id}
            type="button"
            className="seneca-bottom-bar__fab-action"
            style={{ '--fab-index': index } as React.CSSProperties}
            onClick={() => {
              action.run();
              closeFab();
            }}
          >
            <span className="seneca-bottom-bar__fab-action-icon">
              <action.icon size={18} />
            </span>
            <span className="seneca-bottom-bar__fab-action-label">{action.label}</span>
          </button>
        ))}
      </div>

      <nav
        className={`seneca-bottom-bar${fabOpen ? ' seneca-bottom-bar--fab-open' : ''}`}
        aria-label={shell.mobileNavigation.value}
      >
        {/* Tab 1: Dashboard */}
        <Link
          href="/dashboard"
          className={`seneca-bottom-bar__tab${isNavItemActive(pathname ?? '', '/dashboard') ? ' seneca-bottom-bar__tab--active' : ''}`}
        >
          <LayoutDashboard size={22} />
        </Link>

        {/* Tab 2: Statements */}
        <Link
          href="/statements"
          className={`seneca-bottom-bar__tab${isNavItemActive(pathname ?? '', '/statements') ? ' seneca-bottom-bar__tab--active' : ''}`}
        >
          <FileText size={22} />
        </Link>

        {/* Tab 3: FAB — Quick Actions */}
        <button
          type="button"
          className="seneca-bottom-bar__fab"
          onClick={() => setFabOpen(prev => !prev)}
          aria-label={shell.quickActions.value}
        >
          <Plus
            size={24}
            style={{
              transition: 'transform 0.25s',
              transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)',
            }}
          />
        </button>

        {/* Tab 4: Reports */}
        <Link
          href="/reports"
          className={`seneca-bottom-bar__tab${isNavItemActive(pathname ?? '', '/reports') ? ' seneca-bottom-bar__tab--active' : ''}`}
        >
          <BarChart2 size={22} />
        </Link>

        {/* Tab 5: the account — the menu drawer, with the account entry at its foot */}
        <button
          type="button"
          className="seneca-bottom-bar__tab"
          onClick={() => setDrawerOpen(true)}
          aria-label={shell.openMenu.value}
        >
          <span
            className="seneca-account__avatar seneca-account__avatar--tab"
            style={{ background: avatarTone(user?.email) }}
          >
            {avatarUrl && !avatarError ? (
              <img
                src={avatarUrl}
                alt=""
                onError={() => {
                  setAvatarError(true);
                }}
              />
            ) : (
              avatarInitial(user?.name || user?.email)
            )}
          </span>
        </button>
      </nav>

      <MobileMenuDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
