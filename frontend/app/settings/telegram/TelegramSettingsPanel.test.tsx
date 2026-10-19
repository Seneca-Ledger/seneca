import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';
import { TelegramSettingsPanel } from './TelegramSettingsPanel';

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
const apiDelete = vi.hoisted(() => vi.fn());
const i18nContent = vi.hoisted(() => {
  const createI18nProxy = (path: string[] = []): unknown =>
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
  default: { get: apiGet, post: apiPost, delete: apiDelete, put: vi.fn() },
}));

vi.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => i18nContent,
  useLocale: () => ({ locale: 'en' }),
}));

const LINK = { url: 'https://t.me/seneca_bot?start=code', expiresAt: '2099-01-01T00:00:00.000Z' };

type Bot = 'own' | 'shared' | 'none';

function botStatus(bot: Bot) {
  return {
    connected: bot !== 'none',
    status: bot !== 'none' ? 'connected' : 'disconnected',
    source: bot === 'own' ? 'workspace' : bot === 'shared' ? 'instance' : 'disabled',
    settings: { timeoutMs: 10000, botTokenConfigured: bot !== 'none', sharedBot: bot === 'shared' },
  };
}

function mockApi(options: { bot?: Bot; connections: Array<Record<string, boolean>> }) {
  const connections = [...options.connections];
  apiGet.mockImplementation(async (url: string) => {
    if (url === '/telegram/connection') {
      // The last answer repeats once the queue runs dry.
      return apiResponse(connections.length > 1 ? connections.shift() : connections[0]);
    }
    if (url === '/settings/notifications/telegram') {
      return apiResponse(botStatus(options.bot ?? 'own'));
    }
    if (url === '/settings/instance/telegram') {
      return apiResponse({ source: options.bot === 'shared' ? 'instance' : 'disabled' });
    }
    return apiResponse({ data: [], total: 0, page: 1, limit: 20 });
  });
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

async function render(isAdmin = false): Promise<HTMLDivElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(<TelegramSettingsPanel isAdmin={isAdmin} />);
  });
  await act(flush);
  return container;
}

const button = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find(
    element => element.textContent === text,
  ) as HTMLButtonElement | undefined;

describe('TelegramSettingsPanel', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    apiGet.mockReset();
    apiPost.mockReset();
    apiDelete.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('opens the bot link in a new tab and shows the chat as connected once Start is pressed', async () => {
    const notYet = { connected: false, inThisWorkspace: false };
    mockApi({ connections: [notYet, notYet, { connected: true, inThisWorkspace: true }] });
    apiPost.mockResolvedValue(apiResponse(LINK));
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const container = await render();

    await act(async () => {
      button(container, 'connect.button')?.click();
      await flush();
    });

    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(apiPost).toHaveBeenCalledWith('/telegram/link');
    expect(tab.location.href).toBe(LINK.url);
    expect(tab.opener).toBeNull();
    expect(container.textContent).toContain('connect.waiting');
    expect(container.querySelector(`a[href="${LINK.url}"]`)).toBeTruthy();

    // First poll: Start not pressed yet. Second: connected.
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await flush();
    });
    expect(container.textContent).toContain('connect.waiting');
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await flush();
    });

    expect(container.textContent).toContain('connect.connectedHere');
    expect(container.textContent).toContain('messages.connected');
    expect(container.textContent).not.toContain('connect.waiting');
  });

  it('closes the blank tab and shows the error when no link can be made', async () => {
    mockApi({ connections: [{ connected: false, inThisWorkspace: false }] });
    apiPost.mockRejectedValue(new Error('Telegram bot is not configured'));
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const container = await render();

    await act(async () => {
      button(container, 'connect.button')?.click();
      await flush();
    });

    expect(tab.close).toHaveBeenCalled();
    expect(container.textContent).not.toContain('connect.waiting');
  });

  it('stops waiting when the link expires', async () => {
    mockApi({ connections: [{ connected: false, inThisWorkspace: false }] });
    apiPost.mockResolvedValue(apiResponse({ ...LINK, expiresAt: '2000-01-01T00:00:00.000Z' }));
    vi.spyOn(window, 'open').mockReturnValue(null);
    const container = await render();

    await act(async () => {
      button(container, 'connect.button')?.click();
      await flush();
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await flush();
    });

    expect(container.textContent).toContain('connect.expired');
    expect(container.textContent).not.toContain('connect.waiting');
  });

  it('disconnects a chat connected to this workspace', async () => {
    mockApi({
      connections: [
        { connected: true, inThisWorkspace: true },
        { connected: false, inThisWorkspace: false },
      ],
    });
    apiDelete.mockResolvedValue(apiResponse(undefined));
    const container = await render();
    expect(container.textContent).toContain('connect.connectedHere');

    await act(async () => {
      button(container, 'connect.disconnect')?.click();
      await flush();
    });

    expect(apiDelete).toHaveBeenCalledWith('/telegram/connection');
    expect(button(container, 'connect.button')).toBeTruthy();
  });

  it('says the chat is connected elsewhere and still offers to connect it here', async () => {
    mockApi({ connections: [{ connected: true, inThisWorkspace: false }] });
    const container = await render();

    expect(container.textContent).toContain('connect.connectedElsewhere');
    expect(button(container, 'connect.button')?.disabled).toBe(false);
  });

  it('asks for a bot token before Connect can be pressed', async () => {
    mockApi({ bot: 'none', connections: [{ connected: false, inThisWorkspace: false }] });
    const container = await render();

    expect(container.textContent).toContain('connect.botMissing');
    expect(button(container, 'connect.button')?.disabled).toBe(true);
  });

  it('shows people of a workspace on the shared bot only Connect, not a token form', async () => {
    mockApi({ bot: 'shared', connections: [{ connected: false, inThisWorkspace: false }] });
    const container = await render();

    expect(button(container, 'connect.button')?.disabled).toBe(false);
    expect(container.textContent).not.toContain('bot.title');
    expect(container.textContent).not.toContain('sharedBot.title');
    expect(apiGet).not.toHaveBeenCalledWith('/settings/instance/telegram');
  });

  it('keeps the token form when there is no shared bot', async () => {
    mockApi({ bot: 'none', connections: [{ connected: false, inThisWorkspace: false }] });
    const container = await render();

    expect(container.textContent).toContain('bot.title');
    expect(container.textContent).not.toContain('sharedBot.title');
  });

  it('shows an instance admin the shared bot and the optional workspace bot', async () => {
    mockApi({ bot: 'shared', connections: [{ connected: false, inThisWorkspace: false }] });
    const container = await render(true);

    expect(container.textContent).toContain('sharedBot.title');
    expect(container.textContent).toContain('sharedBot.sourceInstance');
    expect(container.textContent).toContain('bot.title');
    expect(container.textContent).toContain('bot.overrideHint');
  });
});
