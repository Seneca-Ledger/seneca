'use client';

import { getHTMLTextDir } from 'intlayer';
import { useEffect } from 'react';
import { useLocale } from '@/app/i18n';

export function useHTMLLanguage(): void {
  const { locale } = useLocale();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = getHTMLTextDir(locale);
  }, [locale]);
}
