'use client';

import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MuiMenu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronUp,
  LogOut,
  Moon,
  Plug,
  Puzzle,
  Settings,
  Sparkles,
  User,
} from '@/app/components/icons';
import { openAppPanel } from '@/app/components/panels/app-panels-store';
import { useAuth } from '@/app/hooks/useAuth';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer } from '@/app/i18n';
import { normalizeAvatarUrl } from '@/app/lib/avatar-url';
import { resolveLabel } from '@/app/lib/side-panel-utils';
import { useThemePreference } from './hooks/useThemePreference';

/**
 * The account entry at the foot of the sidebar: avatar, name, and the short menu
 * of everything that used to sit in the top bar. Entries that need room of their
 * own (notifications, plugins, integrations, what's new) open the right-hand
 * panel the rest of the app already uses, so nothing escapes the sidebar.
 */
// eslint-disable-next-line max-lines-per-function
export function AccountMenu({
  variant = 'sidebar',
  onAction,
}: {
  variant?: 'sidebar' | 'mobile';
  /** Lets the mobile menu drawer close itself once an entry has been picked. */
  onAction?: () => void;
}) {
  const router = useRouter();
  const { user, logout, setUser } = useAuth();
  const { hasPermission } = usePermissions();
  const { setTheme, resolvedTheme } = useTheme();
  const { userMenu, nav } = useIntlayer('navigation');
  // Placed by coordinates rather than by the trigger: opening the menu widens a
  // collapsed rail under it, and an anchor element would be measured mid-slide.
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const { handleThemePreferenceChange } = useThemePreference({
    userThemePreference: user?.themePreference,
    user,
    setUser,
    setTheme,
    resolveLabel,
    navTheme: undefined,
  });

  if (!user) {
    return null;
  }

  const avatarUrl = normalizeAvatarUrl(user.avatarUrl);
  const isDark = resolvedTheme === 'dark';
  // The same permission the integrations and plugins links have always carried.
  const canOpenApps = hasPermission('telegram.connect');

  /** Dismissing the menu leaves the drawer around it alone. */
  const dismiss = (): void => {
    setAnchor(null);
  };

  /** Picking an entry closes the menu and, on mobile, the drawer holding it. */
  const pick = (): void => {
    setAnchor(null);
    onAction?.();
  };

  /** The sidebar's open width, so the menu covers it exactly and reaches no further. */
  const measure = (trigger: HTMLElement): { top: number; left: number; width: number } => {
    const rect = trigger.getBoundingClientRect();
    const sidebar = trigger.closest('.lumio-shell__sidebar');
    if (variant === 'mobile' || !sidebar) {
      return { top: rect.top, left: rect.left, width: rect.width };
    }
    const shell = sidebar.closest('.lumio-shell');
    const full = shell
      ? Number.parseFloat(getComputedStyle(shell).getPropertyValue('--lumio-sidebar-width-full'))
      : Number.NaN;
    return {
      top: rect.top,
      left: sidebar.getBoundingClientRect().left,
      width: Number.isFinite(full) && full > 0 ? full : rect.width,
    };
  };

  const openPanel = (key: Parameters<typeof openAppPanel>[0]): void => {
    pick();
    openAppPanel(key);
  };

  return (
    <>
      <button
        type="button"
        className={`lumio-account__trigger lumio-account__trigger--${variant}`}
        onClick={event => {
          setAnchor(measure(event.currentTarget));
        }}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        data-tour-id={variant === 'sidebar' ? 'user-menu-trigger' : undefined}
      >
        <span className="lumio-account__avatar">
          {avatarUrl && !avatarError ? (
            <img
              src={avatarUrl}
              alt=""
              onError={() => {
                setAvatarError(true);
              }}
            />
          ) : (
            <User size={14} />
          )}
        </span>
        <span className="lumio-account__name">{user.name}</span>
        <ChevronUp size={14} className="lumio-account__caret" />
      </button>

      <MuiMenu
        anchorReference="anchorPosition"
        // MUI keeps popovers 16px off the viewport edge by default, which would
        // push the menu off the sidebar's left edge and over the page.
        marginThreshold={0}
        anchorPosition={anchor ? { top: anchor.top, left: anchor.left } : undefined}
        open={Boolean(anchor)}
        onClose={dismiss}
        // Grows upward from the trigger, flush with the sidebar's left edge.
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              width: anchor?.width,
              mb: 1,
              // Narrower than a page menu, so the labels still fit the sidebar's width.
              '& .MuiMenuItem-root': { fontSize: 13.5, minHeight: 36, py: 0.5 },
              '& .MuiListItemIcon-root': { minWidth: 30 },
            },
          },
        }}
      >
        {/* Stays open on click: the switch is the control, not a navigation step. */}
        <MenuItem
          onClick={() => {
            void handleThemePreferenceChange(isDark ? 'light' : 'dark');
          }}
        >
          <ListItemIcon>
            <Moon size={18} />
          </ListItemIcon>
          <ListItemText>{userMenu.darkMode}</ListItemText>
          <Switch checked={isDark} size="small" tabIndex={-1} sx={{ mr: -1 }} />
        </MenuItem>

        {canOpenApps ? (
          <MenuItem
            onClick={() => {
              openPanel('plugins');
            }}
          >
            <ListItemIcon>
              <Puzzle size={18} />
            </ListItemIcon>
            <ListItemText>{nav.plugins}</ListItemText>
          </MenuItem>
        ) : null}

        {canOpenApps ? (
          <MenuItem
            onClick={() => {
              openPanel('integrations');
            }}
          >
            <ListItemIcon>
              <Plug size={18} />
            </ListItemIcon>
            <ListItemText>{nav.integrations}</ListItemText>
          </MenuItem>
        ) : null}

        <MenuItem
          onClick={() => {
            openPanel('whatsNew');
          }}
        >
          <ListItemIcon>
            <Sparkles size={18} />
          </ListItemIcon>
          <ListItemText>{userMenu.whatsNew}</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            pick();
            router.push('/settings/profile');
          }}
        >
          <ListItemIcon>
            <Settings size={18} />
          </ListItemIcon>
          <ListItemText>{userMenu.settings}</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={() => {
            pick();
            void logout();
            toast.success(userMenu.logoutSuccess.value);
          }}
          sx={{ color: 'error.main', '& .MuiListItemIcon-root': { color: 'error.main' } }}
        >
          <ListItemIcon>
            <LogOut size={18} />
          </ListItemIcon>
          <ListItemText>{userMenu.logout}</ListItemText>
        </MenuItem>
      </MuiMenu>
    </>
  );
}
