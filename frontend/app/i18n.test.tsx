// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const intlayer = vi.hoisted(() => ({
  locale: 'en',
  getIntlayer: vi.fn((key: string, locale: string) => ({ key, locale })),
  getDictionary: vi.fn((dictionary: { key: string }, locale: string) => ({
    fromPack: dictionary.key,
    locale,
  })),
}));

vi.mock('react-intlayer', () => ({
  getDictionary: intlayer.getDictionary,
  getIntlayer: intlayer.getIntlayer,
  useIntlayerContext: () => ({ locale: intlayer.locale }),
  useLocale: () => ({ locale: intlayer.locale }),
}));

// Stand-ins for two built packs: the real ones import 157 dictionaries each.
const navigationPack = { default: { navigation: { key: 'navigation', content: {} } } };
vi.mock('../.intlayer/locale_pack/fr.mjs', () => navigationPack);
vi.mock('../.intlayer/locale_pack/nl.mjs', () => navigationPack);

import { getCachedIntlayer, loadLocalePack, useIntlayer } from './i18n';

describe('useIntlayer', () => {
  beforeEach(() => {
    intlayer.getIntlayer.mockClear();
  });

  it('builds a dictionary once per locale, however many components read it', () => {
    const first = renderHook(() => useIntlayer('statementsPage' as never));
    const second = renderHook(() => useIntlayer('statementsPage' as never));
    const outside = getCachedIntlayer('statementsPage' as never, 'en' as never);

    expect(second.result.current).toBe(first.result.current);
    expect(outside).toBe(first.result.current);
    expect(intlayer.getIntlayer).toHaveBeenCalledTimes(1);
  });

  it('builds it again for another locale', () => {
    intlayer.locale = 'de';
    const german = renderHook(() => useIntlayer('reviewInbox' as never));
    intlayer.locale = 'en';
    const english = renderHook(() => useIntlayer('reviewInbox' as never));

    expect(german.result.current).toEqual({ key: 'reviewInbox', locale: 'de' });
    expect(english.result.current).toEqual({ key: 'reviewInbox', locale: 'en' });
  });
});

describe('locale packs', () => {
  beforeEach(() => {
    intlayer.getIntlayer.mockClear();
  });

  it('reads a loaded pack instead of the all-locale dictionaries', async () => {
    await loadLocalePack('fr');

    expect(getCachedIntlayer('navigation' as never, 'fr' as never)).toEqual({
      fromPack: 'navigation',
      locale: 'fr',
    });
    expect(intlayer.getIntlayer).not.toHaveBeenCalled();
  });

  it('does not keep what it read before the pack arrived', async () => {
    const loading = loadLocalePack('nl');
    const early = getCachedIntlayer('navigation' as never, 'nl' as never);
    await loading;

    expect(early).toEqual({ key: 'navigation', locale: 'nl' });
    expect(getCachedIntlayer('navigation' as never, 'nl' as never)).toEqual({
      fromPack: 'navigation',
      locale: 'nl',
    });
  });
});
