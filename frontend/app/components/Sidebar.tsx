'use client';

import Skeleton from '@mui/material/Skeleton';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useNotifications } from '@/app/hooks/useNotifications';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer } from '@/app/i18n';
import { useExperimentalMode } from '@/app/lib/experimental-mode';
import { openCommandPalette } from './command-palette/command-palette-store';
import { Bell, PanelLeftClose, Search, Settings } from './icons';
import { AccountMenu } from './navigation/AccountMenu';
import {
  buildNavItems,
  isNavItemActive,
  isNavItemVisible,
  workspaceProfileOf,
} from './navigation/helpers/navigation-config';
import { toggleSidebarCollapsed, useSidebarCollapsed } from './navigation/sidebar-collapsed-store';
import { openAppPanel } from './panels/app-panels-store';
import { useReviewInboxTotal } from './review/useReviewInboxTotal';

const REVIEW_PATH = '/review';

// Matches buildNavItems() length so the skeleton doesn't jump when real items land.
const NAV_ITEM_SKELETON_KEYS = Array.from({ length: 16 }, (_, i) => `nav-skeleton-${i}`);

function SidebarContent({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();
  const { loading: authLoading } = useAuth();
  const { loading: workspaceLoading, currentWorkspace } = useWorkspace();
  const { nav, supportProject, shell, userMenu } = useIntlayer('navigation');
  const notificationsText = useIntlayer('notificationDropdown');
  const { unreadCount } = useNotifications();

  const isLoading = authLoading || workspaceLoading;
  const navItems = buildNavItems(nav as Parameters<typeof buildNavItems>[0]);
  const experimentalMode = useExperimentalMode();
  const profile = workspaceProfileOf(currentWorkspace);
  const visibleNavItems = navItems.filter(item =>
    isNavItemVisible(item, { hasPermission, experimentalMode, profile }),
  );
  // Only asked for when Review is in the menu: without the permission the call would be refused.
  const reviewWaiting =
    useReviewInboxTotal(visibleNavItems.some(item => item.path === REVIEW_PATH)) > 0;

  return (
    <>
      {/* Brand: the emblem alone, so the rest of the row is free for the actions */}
      <div className="lumio-sidebar__brand">
        <Link href="/" className="lumio-sidebar__brand-link" aria-label={shell.home.value}>
          <span className="lumio-sidebar__brand-emblem" />
        </Link>

        {/* Folded away in the idle rail, where there is only room for the emblem. */}
        <div className="lumio-sidebar__brand-actions">
          <button
            type="button"
            className="lumio-sidebar__brand-action"
            onClick={openCommandPalette}
            title={shell.search.value}
            aria-label={shell.search.value}
          >
            <Search size={17} />
          </button>
          <button
            type="button"
            className="lumio-sidebar__brand-action"
            onClick={() => {
              openAppPanel('notifications');
            }}
            title={notificationsText.title.value}
            aria-label={notificationsText.title.value}
          >
            <Bell size={17} />
            {unreadCount > 0 ? <span className="lumio-sidebar__brand-action-dot" /> : null}
          </button>
          <Link
            href="/settings/profile"
            className="lumio-sidebar__brand-action"
            title={userMenu.settings.value}
            aria-label={userMenu.settings.value}
          >
            <Settings size={17} />
          </Link>
          <button
            type="button"
            className="lumio-sidebar__brand-action"
            onClick={onToggleCollapsed}
            aria-pressed={collapsed}
            aria-label={collapsed ? shell.expandSidebar.value : shell.collapseSidebar.value}
            title={collapsed ? shell.expandSidebar.value : shell.collapseSidebar.value}
          >
            <PanelLeftClose size={17} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="lumio-sidebar__nav" aria-label={shell.mainNavigation.value}>
        {isLoading
          ? NAV_ITEM_SKELETON_KEYS.map(key => (
              <div className="lumio-sidebar__nav-item" key={key}>
                <Skeleton variant="rounded" width={18} height={18} />
                <Skeleton variant="text" width="60%" height={16} />
              </div>
            ))
          : visibleNavItems.map(item => {
              const active = isNavItemActive(pathname ?? '', item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`lumio-sidebar__nav-item${active ? ' lumio-sidebar__nav-item--active' : ''}`}
                >
                  {item.path === REVIEW_PATH ? (
                    // The icon is dimmed; the dot sits beside it so it keeps its full colour.
                    <span className="lumio-sidebar__nav-icon-slot">
                      <span className="lumio-sidebar__nav-icon">{item.icon}</span>
                      {/* Something waits in Review: a quiet dot, the count is on the page itself. */}
                      {reviewWaiting ? (
                        <span className="lumio-sidebar__nav-dot" data-testid="review-waiting-dot" />
                      ) : null}
                    </span>
                  ) : (
                    <span className="lumio-sidebar__nav-icon">{item.icon}</span>
                  )}
                  <span className="lumio-sidebar__nav-label">{item.label}</span>
                </Link>
              );
            })}
      </nav>

      <div className="lumio-sidebar__footer">
        <AccountMenu />

        <a
          href="https://github.com/sponsors/symonbaikov"
          target="_blank"
          rel="noopener noreferrer"
          className="lumio-sidebar__support-link"
        >
          <span className="lumio-sidebar__support-icon">💚</span>
          <span className="lumio-sidebar__support-label">
            {(supportProject as { value?: string })?.value ?? 'Support the project'}
          </span>
        </a>
      </div>
    </>
  );
}

export default function Sidebar() {
  // Collapsed keeps only the icon rail; hovering (or focusing into) the rail
  // brings the full sidebar back — both widths come from CSS, which reflows the
  // page beside it. The state lives in a store so the command palette can
  // toggle it from outside this tree.
  const collapsed = useSidebarCollapsed();

  return (
    <aside className={`lumio-shell__sidebar${collapsed ? ' lumio-shell__sidebar--rail' : ''}`}>
      <SidebarContent collapsed={collapsed} onToggleCollapsed={toggleSidebarCollapsed} />
    </aside>
  );
}
