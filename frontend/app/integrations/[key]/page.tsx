'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { openAppPanel } from '@/app/components/panels/app-panels-store';

/**
 * Deep link to one integration's settings. Services with a page of their own
 * (Gmail, Google Drive, Dropbox) keep their static route, which
 * Next.js matches before this one.
 */
export default function IntegrationRoute(): null {
  const router = useRouter();
  const params = useParams<{ key: string }>();
  const key = typeof params?.key === 'string' ? params.key : undefined;

  useEffect(() => {
    openAppPanel('integrations', key);
    router.replace('/dashboard');
  }, [key, router]);

  return null;
}
