'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { openAppPanel } from '@/app/components/panels/app-panels-store';

/**
 * Integrations are a panel now. The route stays for deep links — tours, docs,
 * old bookmarks — and opens the panel over the dashboard.
 */
export default function IntegrationsRoute(): null {
  const router = useRouter();

  useEffect(() => {
    openAppPanel('integrations');
    router.replace('/dashboard');
  }, [router]);

  return null;
}
