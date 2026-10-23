'use client';

import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAuth } from '@/app/hooks/useAuth';
import { useNotifications } from '@/app/hooks/useNotifications';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer } from '@/app/i18n';
import { useExperimentalMode } from '@/app/lib/experimental-mode';
import { setPrivacyMode, usePrivacyMode } from '@/app/lib/privacy-mode';
import { openCommandPalette } from './command-palette/command-palette-store';
import { Bell, ChevronDown, CircleHelp, Eye, EyeOff, Heart, Search, Settings } from './icons';
import { AccountMenu } from './navigation/AccountMenu';
import {
  activeNavPath,
  buildNavGroups,
  buildNavItems,
  groupNavItems,
  isNavItemVisible,
  type NavGroupId,
  type NavItem,
  workspaceProfileOf,
} from './navigation/helpers/navigation-config';
import { toggleSidebarCollapsed, useSidebarCollapsed } from './navigation/sidebar-collapsed-store';
import { openAppPanel } from './panels/app-panels-store';
import { useReviewInboxTotal } from './review/useReviewInboxTotal';

const REVIEW_PATH = '/review';

// Matches the top-level rows (single items and group headers, groups folded) so
// the skeleton doesn't jump when real items land.
const NAV_ITEM_SKELETON_KEYS = Array.from({ length: 8 }, (_, i) => `nav-skeleton-${i}`);

/** The rail shows icons alone, so it names each row beside it on hover. */
function RailTip({
  collapsed,
  title,
  children,
}: {
  collapsed: boolean;
  title: React.ReactNode;
  children: React.ReactElement;
}) {
  if (!collapsed) return children;
  return (
    <Tooltip title={title} placement="right">
      {children}
    </Tooltip>
  );
}

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();
  const { loading: authLoading } = useAuth();
  const { loading: workspaceLoading, currentWorkspace } = useWorkspace();
  const { nav, navGroups, supportProject, shell, userMenu, help } = useIntlayer('navigation');
  const notificationsText = useIntlayer('notificationDropdown');
  const { unreadCount } = useNotifications();
  const privacy = usePrivacyMode();

  const isLoading = authLoading || workspaceLoading;
  const navItems = buildNavItems(nav as Parameters<typeof buildNavItems>[0]);
  const experimentalMode = useExperimentalMode();
  const profile = workspaceProfileOf(currentWorkspace);
  const visibleNavItems = navItems.filter(item =>
    isNavItemVisible(item, { hasPermission, experimentalMode, profile }),
  );
  const entries = groupNavItems(
    visibleNavItems,
    buildNavGroups(navGroups as Parameters<typeof buildNavGroups>[0]),
  );
  // Only asked for when Review is in the menu: without the permission the call would be refused.
  const reviewWaiting =
    useReviewInboxTotal(visibleNavItems.some(item => item.path === REVIEW_PATH)) > 0;

  // Groups open and fold by hand only, any number at once. Arriving on a page
  // opens its own group so the page is in sight, and folds nothing. Keyed on the
  // group too, because it is only known once the menu has loaded.
  const activePath = activeNavPath(pathname ?? '', visibleNavItems);
  const activeGroup = visibleNavItems.find(item => item.path === activePath)?.group;
  const arrival = `${pathname ?? ''}|${activeGroup ?? ''}`;
  const [openGroups, setOpenGroups] = useState<ReadonlySet<NavGroupId>>(() => new Set());
  const [seenArrival, setSeenArrival] = useState<string | undefined>(undefined);
  if (arrival !== seenArrival) {
    setSeenArrival(arrival);
    if (activeGroup && !openGroups.has(activeGroup)) {
      setOpenGroups(new Set(openGroups).add(activeGroup));
    }
  }
  const toggleGroup = (id: NavGroupId): void => {
    const next = new Set(openGroups);
    if (!next.delete(id)) next.add(id);
    setOpenGroups(next);
  };

  // The rows share the window height (CSS sizes them from the count), counted with
  // every group folded: opening a group or switching to the rail never shrinks the
  // rows, the nav scrolls instead. Only a really short window makes them smaller.
  const rowCount = (isLoading ? NAV_ITEM_SKELETON_KEYS.length : entries.length) + 2;
  const rowsStyle = { '--seneca-sidebar-rows': rowCount } as React.CSSProperties;

  const renderItem = (item: NavItem) => {
    const active = item.path === activePath;
    return (
      <RailTip key={item.path} collapsed={collapsed} title={item.label}>
        <Link
          href={item.path}
          className={`seneca-sidebar__nav-item${active ? ' seneca-sidebar__nav-item--active' : ''}`}
        >
          {item.path === REVIEW_PATH ? (
            // The icon is dimmed; the dot sits beside it so it keeps its full colour.
            <span className="seneca-sidebar__nav-icon-slot">
              <span className="seneca-sidebar__nav-icon">{item.icon}</span>
              {/* Something waits in Review: a quiet dot, the count is on the page itself. */}
              {reviewWaiting ? (
                <span className="seneca-sidebar__nav-dot" data-testid="review-waiting-dot" />
              ) : null}
            </span>
          ) : (
            <span className="seneca-sidebar__nav-icon">{item.icon}</span>
          )}
          <span className="seneca-sidebar__nav-label">{item.label}</span>
        </Link>
      </RailTip>
    );
  };

  return (
    <>
      {/* Brand: the emblem alone, so the rest of the row is free for the actions.
          On the rail only search stays, as a row under it. */}
      <div className="seneca-sidebar__brand" style={rowsStyle}>
        <Link href="/" className="seneca-sidebar__brand-link" aria-label={shell.home.value}>
          <span className="seneca-sidebar__brand-emblem" />
        </Link>

        <div className="seneca-sidebar__brand-actions">
          <button
            type="button"
            className="seneca-sidebar__brand-action"
            onClick={() => {
              setPrivacyMode(!privacy);
            }}
            aria-pressed={privacy}
            title={userMenu.privacyMode.value}
            aria-label={userMenu.privacyMode.value}
          >
            {privacy ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
          <button
            type="button"
            className="seneca-sidebar__brand-action"
            onClick={() => {
              openAppPanel('help');
            }}
            title={help.title.value}
            aria-label={help.title.value}
          >
            <CircleHelp size={17} />
          </button>
          <button
            type="button"
            // The one action the rail keeps, sized like the nav rows under it.
            className="seneca-sidebar__brand-action seneca-sidebar__brand-action--search"
            onClick={openCommandPalette}
            title={shell.search.value}
            aria-label={shell.search.value}
          >
            <Search size={17} />
          </button>
          <button
            type="button"
            className="seneca-sidebar__brand-action"
            onClick={() => {
              openAppPanel('notifications');
            }}
            title={notificationsText.title.value}
            aria-label={notificationsText.title.value}
          >
            <Bell size={17} />
            {unreadCount > 0 ? <span className="seneca-sidebar__brand-action-dot" /> : null}
          </button>
          <Link
            href="/settings/profile"
            className="seneca-sidebar__brand-action"
            title={userMenu.settings.value}
            aria-label={userMenu.settings.value}
          >
            <Settings size={17} />
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <nav
        className="seneca-sidebar__nav"
        aria-label={shell.mainNavigation.value}
        style={rowsStyle}
      >
        {isLoading
          ? NAV_ITEM_SKELETON_KEYS.map(key => (
              <div className="seneca-sidebar__nav-item" key={key}>
                <Skeleton variant="rounded" width={18} height={18} />
                {/* Labelled like a real row, so the collapsed rail folds it away. */}
                <span className="seneca-sidebar__nav-label">
                  <Skeleton variant="text" width="60%" height={16} />
                </span>
              </div>
            ))
          : entries.map(entry => {
              if (entry.kind === 'item') return renderItem(entry.item);
              const { group, items } = entry;
              const open = openGroups.has(group.id);
              const holdsActive = items.some(item => item.path === activePath);
              return (
                <div className="seneca-sidebar__group" key={group.id}>
                  <RailTip collapsed={collapsed} title={group.label}>
                    <button
                      type="button"
                      // A folded group that holds the page on screen is marked as the way back to it.
                      className={`seneca-sidebar__nav-item seneca-sidebar__group-toggle${
                        holdsActive && !open ? ' seneca-sidebar__nav-item--active' : ''
                      }`}
                      aria-expanded={open}
                      onClick={() => {
                        toggleGroup(group.id);
                      }}
                    >
                      <span className="seneca-sidebar__nav-icon">{group.icon}</span>
                      <span className="seneca-sidebar__nav-label">{group.label}</span>
                      <span className="seneca-sidebar__group-caret" aria-hidden="true">
                        <ChevronDown size={16} />
                      </span>
                    </button>
                  </RailTip>
                  {open ? (
                    <div className="seneca-sidebar__group-items">{items.map(renderItem)}</div>
                  ) : null}
                </div>
              );
            })}
      </nav>

      <div className="seneca-sidebar__footer" style={rowsStyle}>
        <AccountMenu />

        <a
          href="https://github.com/sponsors/symonbaikov"
          target="_blank"
          rel="noopener noreferrer"
          className="seneca-sidebar__support-link"
        >
          <span className="seneca-sidebar__support-icon" aria-hidden="true">
            <Heart />
          </span>
          <span className="seneca-sidebar__support-label">
            {(supportProject as { value?: string })?.value ?? 'Support the project'}
          </span>
        </a>
      </div>
    </>
  );
}

export default function Sidebar({ initialCollapsed = false }: { initialCollapsed?: boolean }) {
  // Collapsed keeps only the icon rail, expanded the full sidebar; both widths come
  // from CSS, and the page beside it reflows either way. The pin button outside the
  // sidebar switches between them. The state lives in a store so the command
  // palette and the keyboard shortcut can toggle it from outside this tree.
  const collapsed = useSidebarCollapsed(initialCollapsed);
  const { shell } = useIntlayer('navigation');
  const pinLabel = collapsed ? shell.expandSidebar.value : shell.collapseSidebar.value;

  return (
    <>
      <aside className={`seneca-shell__sidebar${collapsed ? ' seneca-shell__sidebar--rail' : ''}`}>
        <SidebarContent collapsed={collapsed} />
      </aside>
      {/* Outside the aside, which clips its overflow: it sits on the seam between
          the sidebar and the page, level with the emblem, on every page. */}
      <button
        type="button"
        className={`seneca-shell__sidebar-pin${collapsed ? ' seneca-shell__sidebar-pin--rail' : ''}`}
        onClick={toggleSidebarCollapsed}
        aria-pressed={!collapsed}
        aria-label={pinLabel}
        title={pinLabel}
      >
        {/* Three lines in the button's own colour, so it follows the theme. */}
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 6H20M4 12H20M4 18H20"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      </button>
    </>
  );
}
