import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUser } from '@/app/test/fixtures/contracts';

const apiPatch = vi.hoisted(() => vi.fn());
const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
const routerPush = vi.hoisted(() => vi.fn());
const routerReplace = vi.hoisted(() => vi.fn());
const searchParams = vi.hoisted(() => ({ current: new URLSearchParams() }));
const setUser = vi.hoisted(() => vi.fn());
const authUser = vi.hoisted(() => ({
  id: 'user-1',
  email: 'symon@example.com',
  name: 'Symon Baikov',
  timeZone: '',
  lastLogin: '2026-01-01T00:00:00.000Z',
  avatarUrl: '/api/v1/users/avatars/member-1.png',
}));
const i18nContent = vi.hoisted(() => {
  const createI18nProxy = (path: string[] = []) =>
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === 'value') return path.join('.');
          return createI18nProxy([...path, String(prop)]);
        },
      },
    );

  return createI18nProxy();
});

vi.mock('@/app/lib/api', () => ({
  default: {
    patch: apiPatch,
    get: apiGet,
    post: apiPost,
  },
}));

vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({
    loading: false,
    setUser,
    user: authUser,
  }),
}));

vi.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: 'workspace-1' },
    loading: false,
  }),
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => i18nContent,
  useLocale: () => ({ locale: 'ru', availableLocales: ['ru', 'en'], setLocale: vi.fn() }),
}));

// Настоящий список — 418 зон, и отрисовка стольких кнопок в jsdom уходит за
// таймаут. Проверяется проводка ярлыка, а не полнота списка от ICU.
vi.mock('@/app/settings/profile/profileHelpers', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/settings/profile/profileHelpers')>()),
  resolveTimeZoneOptions: () => ['UTC', 'Europe/Berlin', 'Asia/Tokyo'],
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
  usePathname: () => '/settings/profile',
  useSearchParams: () => searchParams.current,
}));

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

async function renderPage(): Promise<HTMLDivElement> {
  const { default: ProfileSettingsPage } = await import('./page');
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(<ProfileSettingsPage />);
  });
  await act(async () => {
    await flushPromises();
  });
  return container;
}

const findButton = (container: HTMLElement, text: string): HTMLButtonElement | undefined =>
  Array.from(container.querySelectorAll('button')).find(button =>
    button.textContent?.includes(text),
  ) as HTMLButtonElement | undefined;

/** Object-shaped answers for the sections that check them against their contracts. */
const SETTINGS_RESPONSES: Record<string, unknown> = {
  '/backups/config': null,
  '/telegram/reports': { data: [], total: 0, page: 1, limit: 20 },
  '/telegram/connection': { connected: false, inThisWorkspace: false },
  '/settings/notifications/telegram': {
    connected: false,
    status: 'disconnected',
    source: 'disabled',
    settings: { timeoutMs: 10000, botTokenConfigured: false },
  },
};

describe('ProfileSettingsPage', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.replaceState(null, '', '/settings/profile');
    searchParams.current = new URLSearchParams();
    apiPatch.mockReset();
    apiGet.mockReset();
    apiPost.mockReset();
    routerPush.mockReset();
    routerReplace.mockReset();
    setUser.mockReset();
    // Every tab fetches something on mount; an empty list keeps the sections rendering.
    apiGet.mockImplementation(async (url: string) => ({
      data: SETTINGS_RESPONSES[url] ?? [],
    }));
    vi.restoreAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('disables profile save button when there are no changes and shows unsaved state after edits', async () => {
    const container = await renderPage();

    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton).toBeTruthy();
    expect(submitButton.disabled).toBe(true);

    const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setValue?.call(nameInput, 'Symon Baikov Updated');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const updatedSubmitButton = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(updatedSubmitButton.disabled).toBe(false);
    expect(container.textContent).toContain('profileCard.unsavedChanges');
  });

  it('names time zones in the interface language once the drawer is open', async () => {
    const container = await renderPage();

    const trigger = container.querySelector(
      '[data-testid="profile-timezone-trigger"]',
    ) as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    // Ящик уезжает в портал, поэтому его кнопки ищутся в body, а не в контейнере.
    // Пока он закрыт, зоны не называются — ни одной кнопки зоны в документе нет.
    expect(findButton(document.body, 'Europe/Berlin')).toBeUndefined();

    await act(async () => {
      trigger.click();
    });
    await act(async () => {
      await flushPromises();
    });

    const berlin = findButton(document.body, 'Europe/Berlin');
    expect(berlin).toBeTruthy();
    // Локаль в моке — ru, поэтому и название зоны обязано быть русским.
    expect(berlin?.textContent).toContain('Центральная Европа');
  });

  it('renders the six tabs and switches tab through the URL', async () => {
    const container = await renderPage();

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(6);
    expect(container.textContent).toContain('tabs.general');

    const securityTab = findButton(container, 'tabs.security');
    expect(securityTab).toBeTruthy();
    await act(async () => {
      securityTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(window.location.search).toBe('?tab=security');
    expect(container.textContent).toContain('emailCard.title');
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('translates legacy hash anchors into tab and section params', async () => {
    window.history.replaceState(null, '', '/settings/profile#sessions');

    const container = await renderPage();

    expect(window.location.search).toBe('?tab=security&section=sessions');
    expect(window.location.hash).toBe('');
    expect(container.textContent).toContain('sessionsCard.logoutAllButton');
  });

  it('asks confirmation before logging out all sessions', async () => {
    searchParams.current = new URLSearchParams('tab=security&section=sessions');
    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const container = await renderPage();

    expect(apiGet).toHaveBeenCalledWith('/auth/sessions', expect.anything());
    const logoutAllButton = findButton(container, 'sessionsCard.logoutAllButton');
    expect(logoutAllButton).toBeTruthy();

    await act(async () => {
      logoutAllButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(apiPost).not.toHaveBeenCalledWith('/auth/logout-all');
  });

  it('asks confirmation before password update', async () => {
    searchParams.current = new URLSearchParams('tab=security&section=password');
    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const container = await renderPage();

    const currentInput = container.querySelector('#password-current') as HTMLInputElement;
    const nextInput = container.querySelector('#password-next') as HTMLInputElement;
    const confirmInput = container.querySelector('#password-confirm') as HTMLInputElement;
    const form = confirmInput.closest('form') as HTMLFormElement;

    await act(async () => {
      currentInput.value = 'old-pass-123';
      currentInput.dispatchEvent(new Event('change', { bubbles: true }));
      nextInput.value = 'new-pass-123';
      nextInput.dispatchEvent(new Event('change', { bubbles: true }));
      confirmInput.value = 'new-pass-123';
      confirmInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(apiPatch).not.toHaveBeenCalledWith('/users/me/password', expect.anything());
  });

  it('renders appearance settings and saves the theme picked from the dropdown', async () => {
    apiPatch.mockResolvedValue({
      data: {
        user: currentUser({ themePreference: 'dark' }),
        message: 'Theme updated',
      },
    });

    const container = await renderPage();

    expect(container.textContent).toContain('appearanceCard.themeLabel');

    // The theme is a dropdown (Auto by default): open it, then pick Dark from the menu.
    const themeSelect = container.querySelector(
      '[role="combobox"][aria-label="appearanceCard.themeLabel"]',
    ) as HTMLElement;
    expect(themeSelect).toBeTruthy();
    await act(async () => {
      themeSelect.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    const darkOption = Array.from(document.querySelectorAll('[role="option"]')).find(
      option => option.textContent === 'appearanceCard.dark',
    ) as HTMLElement;
    expect(darkOption).toBeTruthy();

    await act(async () => {
      darkOption.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(apiPatch).toHaveBeenCalledWith('/users/me/preferences', {
      themePreference: 'dark',
    });
    expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ themePreference: 'dark' }));
  });

  it('does not render the active theme block in appearance settings', async () => {
    const container = await renderPage();

    expect(container.textContent).not.toContain('appearanceCard.active');
  });

  it('embeds the Telegram panel in the notifications tab', async () => {
    searchParams.current = new URLSearchParams('tab=notifications');

    const container = await renderPage();

    expect(container.textContent).toContain('connect.title');
    expect(apiGet).toHaveBeenCalledWith('/telegram/reports');
    expect(apiGet).toHaveBeenCalledWith('/notifications/preferences', expect.anything());
  });
});
