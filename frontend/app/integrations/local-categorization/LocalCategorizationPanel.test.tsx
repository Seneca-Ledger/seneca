// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.hoisted(() => vi.fn());
const apiPut = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
const reactActEnvironmentFlag = 'IS_REACT_ACT_ENVIRONMENT';

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiGet,
    put: apiPut,
    post: apiPost,
  },
}));

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('LocalCategorizationPanel', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>)[reactActEnvironmentFlag] = true;
    apiGet.mockReset();
    apiPut.mockReset();
    apiPost.mockReset();
  });

  it('lets a user save settings, upload a model archive, and test a merchant', async () => {
    apiGet.mockResolvedValue({
      data: {
        connected: false,
        settings: {
          enabled: true,
          modelId: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
          threshold: 0.35,
          modelInstalled: false,
        },
      },
    });
    apiPut.mockResolvedValue({
      data: {
        connected: true,
        settings: {
          enabled: true,
          modelId: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
          threshold: 0.4,
          modelInstalled: true,
        },
      },
    });
    apiPost.mockImplementation((url: string) => {
      if (url === '/settings/local-categorization/test') {
        return Promise.resolve({
          data: {
            ready: true,
            merchantName: 'Fresh Market',
            category: 'Продукты',
            modelLoadError: null,
          },
        });
      }
      return Promise.resolve({
        data: {
          connected: true,
          settings: {
            enabled: true,
            modelId: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
            threshold: 0.4,
            modelInstalled: true,
          },
        },
      });
    });

    const { LocalCategorizationPanel } = await import('./LocalCategorizationPanel');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<LocalCategorizationPanel />);
    });
    await act(async () => {
      await flushPromises();
    });

    expect(container.textContent).toContain('Model missing');

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Save settings',
    ) as HTMLButtonElement;
    await act(async () => {
      saveButton.click();
      await flushPromises();
    });

    expect(apiPut).toHaveBeenCalledWith(
      '/settings/local-categorization',
      expect.objectContaining({ threshold: 0.35 }),
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['zip'], 'model.zip', { type: 'application/zip' });
    await act(async () => {
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await flushPromises();
    });

    expect(apiPost).toHaveBeenCalledWith(
      '/settings/local-categorization/model',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }),
    );

    const merchantInput = container.querySelector('input[name="merchantName"]') as HTMLInputElement;
    await act(async () => {
      merchantInput.value = 'Fresh Market';
      merchantInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const testButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === 'Test merchant',
    ) as HTMLButtonElement;
    await act(async () => {
      testButton.click();
      await flushPromises();
    });

    expect(container.textContent).toContain('Продукты');
  });
});
