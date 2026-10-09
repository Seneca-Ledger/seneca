'use client';

import { usePathname } from 'next/navigation';
import { AUTH_ROUTE_PREFIXES } from '@/app/lib/auth-routes';
import Sidebar from './Sidebar';

function shouldHideChrome(pathname: string | null) {
  if (!pathname) {
    return false;
  }
  return (
    pathname.startsWith('/onboarding') ||
    AUTH_ROUTE_PREFIXES.some(prefix => pathname.startsWith(prefix)) ||
    pathname.startsWith('/shared') ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/chat')
  );
}

export default function AppChrome() {
  const pathname = usePathname();

  if (shouldHideChrome(pathname)) {
    return null;
  }

  // Desktop sidebar (hidden on mobile via CSS; the bottom bar menu replaces it there)
  return <Sidebar />;
}
