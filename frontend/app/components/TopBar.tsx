'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/hooks/useAuth';
import { useIntlayer } from '@/app/i18n';
import { AUTH_ROUTE_PREFIXES } from '@/app/lib/auth-routes';

const HIDDEN_PATHS = ['/onboarding', ...AUTH_ROUTE_PREFIXES, '/shared', '/invite', '/chat'];

/**
 * Mobile-only header. On desktop everything that used to live here — search,
 * notifications, plugins, help, the account menu — sits in the sidebar, and the
 * bar is hidden by CSS; on mobile it is just the logo, because the bottom bar
 * carries the navigation.
 */
export default function TopBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { shell } = useIntlayer('navigation');

  if (!user || HIDDEN_PATHS.some(p => pathname?.startsWith(p))) {
    return null;
  }

  return (
    <header className="lumio-topbar">
      <Link href="/dashboard" className="lumio-topbar__mobile-logo" aria-label={shell.home.value}>
        <span className="lumio-topbar__mobile-logo-mark" />
      </Link>
    </header>
  );
}
