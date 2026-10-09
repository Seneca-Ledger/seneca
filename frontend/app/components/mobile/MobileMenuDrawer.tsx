'use client';

import FocusTrap from '@mui/material/Unstable_TrapFocus';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { X } from '@/app/components/icons';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useIntlayer } from '@/app/i18n';
import { useExperimentalMode } from '@/app/lib/experimental-mode';
import { AccountMenu } from '../navigation/AccountMenu';
import { buildNavItems, isNavItemActive } from '../navigation/helpers/navigation-config';

interface MobileMenuDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMenuDrawer({ open, onClose }: MobileMenuDrawerProps) {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();
  const { nav, shell } = useIntlayer('navigation');

  const navItems = buildNavItems(nav as Parameters<typeof buildNavItems>[0]);
  const experimentalMode = useExperimentalMode();
  const visibleNavItems = navItems.filter(
    item => hasPermission(item.permission) && (!item.experimental || experimentalMode),
  );

  // Close on route change
  useEffect(() => {
    onClose();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`lumio-mobile-drawer__backdrop${open ? ' lumio-mobile-drawer__backdrop--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel: inert while slid off-canvas; when open, focus moves in, stays inside
          and returns to the trigger on close. */}
      <FocusTrap open={open}>
        <aside
          className={`lumio-mobile-drawer${open ? ' lumio-mobile-drawer--open' : ''}`}
          aria-label={shell.menu.value}
          inert={!open}
          tabIndex={-1}
        >
          <div className="lumio-mobile-drawer__header">
            <span className="lumio-mobile-drawer__title">{shell.menu}</span>
            <button
              type="button"
              className="lumio-mobile-drawer__close"
              onClick={onClose}
              aria-label={shell.closeMenu.value}
            >
              <X size={20} />
            </button>
          </div>

          <nav className="lumio-mobile-drawer__nav">
            {visibleNavItems.map(item => {
              const active = isNavItemActive(pathname ?? '', item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`lumio-mobile-drawer__item${active ? ' lumio-mobile-drawer__item--active' : ''}`}
                  onClick={onClose}
                >
                  <span className="lumio-mobile-drawer__item-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="lumio-mobile-drawer__footer">
            <AccountMenu variant="mobile" onAction={onClose} />
          </div>
        </aside>
      </FocusTrap>
    </>
  );
}
