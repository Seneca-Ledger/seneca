'use client';

import { type ReactNode, use } from 'react';
import { useIntlayerContext, useLocale } from 'react-intlayer';
import { getCachedIntlayer, loadLocalePack } from './lib/locale-packs';

type UseIntlayer = typeof import('react-intlayer').useIntlayer;

/**
 * Holds the browser render of its children until the language's pack is in.
 * A component of its own, so the hooks of the tree above never suspend.
 */
export const LocalePackGate = ({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}): ReactNode => {
  if (typeof window !== 'undefined') {
    use(loadLocalePack(locale));
  }
  return children;
};

export const useIntlayer = ((key: string, locale?: string) => {
  // intlayer 9 types the context as `{}`; at runtime it is the provider's value.
  const { locale: currentLocale } = useIntlayerContext() as { locale?: string };
  return getCachedIntlayer(key as never, (locale ?? currentLocale) as never);
}) as UseIntlayer;

export { getCachedIntlayer, loadLocalePack, useLocale };
