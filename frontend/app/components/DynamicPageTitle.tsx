'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { PRODUCT_TITLE, resolvePageTitle } from '@/app/lib/page-title';

export default function DynamicPageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    document.title = resolvePageTitle(pathname || '/');
  }, [pathname]);

  useEffect(() => {
    return () => {
      document.title = PRODUCT_TITLE;
    };
  }, []);

  return null;
}
