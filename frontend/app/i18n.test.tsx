// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const intlayer = vi.hoisted(() => ({
  locale: 'en',
  getIntlayer: vi.fn((key: string, locale: string) => ({ key, locale })),
}));

vi.mock('react-intlayer', () => ({
  getIntlayer: intlayer.getIntlayer,
  useIntlayerContext: () => ({ locale: intlayer.locale }),
  useLocale: () => ({ locale: intlayer.locale }),
}));

import { getCachedIntlayer, useIntlayer } from './i18n';

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
