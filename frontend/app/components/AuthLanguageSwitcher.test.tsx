import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthLanguageSwitcher } from './AuthLanguageSwitcher';

const localeMocks = vi.hoisted(() => ({
  setLocale: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
}));

vi.mock('@/app/i18n', () => ({
  useLocale: () => ({
    locale: 'en',
    setLocale: localeMocks.setLocale,
    availableLocales: ['ru', 'en', 'kk', 'de', 'fr'],
  }),
  useIntlayer: () => ({
    languages: {
      ru: { value: 'Русский' },
      en: { value: 'English' },
      kk: { value: 'Қазақша' },
      de: { value: 'Deutsch' },
      fr: { value: 'Français' },
    },
    languageModal: {
      title: 'Choose language',
      defaultLanguageNote: { value: 'Default' },
      savedToastPrefix: { value: 'Saved' },
    },
    shell: {
      closeLanguageDrawer: { value: 'Close language drawer' },
      search: { value: 'Search' },
      noLanguagesFound: 'No languages found',
    },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: toastMocks.success,
  },
}));

describe('AuthLanguageSwitcher', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    localeMocks.setLocale.mockReset();
    toastMocks.success.mockReset();
  });

  it("uses the app language drawer's selected row style", async () => {
    await act(async () => {
      root.render(<AuthLanguageSwitcher />);
      await Promise.resolve();
    });

    const trigger = container.querySelector('button[aria-label="English"]');
    expect(trigger).toBeTruthy();

    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const selectedLanguage = Array.from(document.querySelectorAll('button')).find(button =>
      button.textContent?.includes('English'),
    );

    // The sign-in page reuses the app's language drawer, selected-row style included.
    expect(selectedLanguage).toBeTruthy();
    expect(selectedLanguage?.className).toContain('lumio-navigation__lang-option--selected');
  });

  it('lists English first, then Germanic, then Romance, then the rest', async () => {
    await act(async () => {
      root.render(<AuthLanguageSwitcher />);
      await Promise.resolve();
    });
    await act(async () => {
      container
        .querySelector('button[aria-label="English"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const names = ['English', 'Deutsch', 'Français', 'Русский', 'Қазақша'];
    const order = Array.from(document.querySelectorAll('button'))
      .map(button => names.find(name => button.textContent?.includes(name)))
      .filter((name): name is string => Boolean(name) && name !== undefined);
    // The trigger repeats "English" before the drawer list; drop it.
    expect(order.slice(-names.length)).toEqual(names);
  });
});
