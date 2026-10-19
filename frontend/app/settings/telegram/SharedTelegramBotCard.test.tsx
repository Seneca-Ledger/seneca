import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';
import { SharedTelegramBotCard } from './SharedTelegramBotCard';

const apiGet = vi.hoisted(() => vi.fn());
const apiPut = vi.hoisted(() => vi.fn());
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
  default: { get: apiGet, put: apiPut, delete: apiDelete },
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => i18nContent,
}));

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

async function render(onChange = vi.fn()): Promise<HTMLDivElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(<SharedTelegramBotCard onChange={onChange} />);
  });
  await act(flush);
  return container;
}

const button = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find(
    element => element.textContent === text,
  ) as HTMLButtonElement | undefined;

function type(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('SharedTelegramBotCard', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    apiGet.mockReset();
    apiPut.mockReset();
    apiDelete.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('says the shared bot comes from TELEGRAM_BOT_TOKEN and offers no removal for it', async () => {
    apiGet.mockResolvedValue(apiResponse({ source: 'env' }));
    const container = await render();

    expect(container.textContent).toContain('sharedBot.sourceEnv');
    expect(button(container, 'sharedBot.remove')).toBeUndefined();
  });

  it('saves a token and tells the panel to re-read its bot', async () => {
    apiGet.mockResolvedValue(apiResponse({ source: 'disabled' }));
    apiPut.mockResolvedValue(apiResponse({ source: 'instance' }));
    const onChange = vi.fn();
    const container = await render(onChange);
    expect(button(container, 'sharedBot.save')?.disabled).toBe(true);

    await act(async () => {
      type(container.querySelector('input') as HTMLInputElement, ' 123:abc ');
    });
    await act(async () => {
      button(container, 'sharedBot.save')?.click();
      await flush();
    });

    expect(apiPut).toHaveBeenCalledWith('/settings/instance/telegram', { botToken: '123:abc' });
    expect(container.textContent).toContain('sharedBot.saved');
    expect(container.textContent).toContain('sharedBot.sourceInstance');
    expect(onChange).toHaveBeenCalled();
  });

  it('removes a saved shared bot', async () => {
    apiGet.mockResolvedValue(apiResponse({ source: 'instance' }));
    apiDelete.mockResolvedValue(apiResponse({ source: 'disabled' }));
    const container = await render();

    await act(async () => {
      button(container, 'sharedBot.remove')?.click();
      await flush();
    });

    expect(apiDelete).toHaveBeenCalledWith('/settings/instance/telegram');
    expect(container.textContent).toContain('sharedBot.sourceDisabled');
    expect(button(container, 'sharedBot.remove')).toBeUndefined();
  });
});
