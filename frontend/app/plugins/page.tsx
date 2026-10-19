'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { openAppPanel } from '@/app/components/panels/app-panels-store';

/** Plugins are a panel now; the route opens it over the dashboard. */
export default function PluginsRoute(): null {
  const router = useRouter();

  useEffect(() => {
    openAppPanel('plugins');
    router.replace('/dashboard');
  }, [router]);

  return null;
}
