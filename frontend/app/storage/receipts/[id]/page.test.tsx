// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ReceiptDocumentPage from './page';

import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { IntlayerProviderContent } from 'react-intlayer';

function TestProviders({ children }: { children: React.ReactNode }) {
  return (
    <IntlayerProviderContent locale="en" setLocale={() => undefined}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>{children}</LocalizationProvider>
    </IntlayerProviderContent>
  );
}

const apiMocks = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiPost: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiMocks.mockApiGet,
    patch: apiMocks.mockApiPatch,
    post: apiMocks.mockApiPost,
  },
  receiptsApi: {
    approveReceipt: apiMocks.mockApiPost,
  },
  apiBaseUrl: 'http://localhost:3000',
}));

vi.mock('@/app/lib/workspace-headers', () => ({
  getWorkspaceHeaders: () => ({ 'X-CSRF-Token': 'test-csrf' }),
}));

vi.mock('@/app/lib/csrf', () => ({
  hasSessionCookie: () => true,
  getCsrfHeaders: () => ({ 'X-CSRF-Token': 'test-csrf' }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@mui/material/Dialog', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="receipt-export-modal">{children}</div> : null,
}));

vi.mock('@mui/material/DialogTitle', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@mui/material/DialogContent', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@mui/material/DialogActions', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'receipt-1' }),
  useRouter: () => ({ push: routerMocks.push, back: routerMocks.back }),
  useSearchParams: () => routerMocks.searchParams,
}));

// The map pulls in Leaflet and React Query; its own test covers it.
vi.mock('@/app/components/receipts/location/ReceiptLocationSection', () => ({
  ReceiptLocationSection: ({ receipt }: { receipt: { id: string } }) => (
    <section data-testid="receipt-location-section">Location of {receipt.id}</section>
  ),
}));

describe('ReceiptDocumentPage', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let originalCreateObjectUrl: typeof URL.createObjectURL;
  let originalRevokeObjectUrl: typeof URL.revokeObjectURL;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    originalCreateObjectUrl = URL.createObjectURL;
    originalRevokeObjectUrl = URL.revokeObjectURL;

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue('blob://receipt-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    routerMocks.push.mockReset();
    routerMocks.searchParams = new URLSearchParams();
    apiMocks.mockApiGet.mockReset();
    apiMocks.mockApiPatch.mockReset();
    apiMocks.mockApiPost.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    container.remove();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectUrl,
    });
    vi.unstubAllGlobals();
  });

  it('renders store receipt details as a full page with receipt preview and parsed fields', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/receipts/receipt-1') {
        return Promise.resolve({
          data: {
            id: 'receipt-1',
            statementId: '11111111-1111-4111-8111-111111111111',
            subject: 'Magnum receipt',
            sender: 'camera-scan',
            source: 'scan',
            status: 'draft',
            receivedAt: '2026-03-29T10:30:00.000Z',
            language: 'ru',
            metadata: {
              attachments: [{ filename: 'receipt.pdf', mimeType: 'application/pdf' }],
            },
            parsedData: {
              vendor: 'Magnum',
              amount: 15420,
              currency: 'KZT',
              date: '2026-03-29',
              categoryId: 'cat-1',
              lineItems: [{ description: 'Groceries', amount: 15420 }],
            },
          },
        });
      }

      if (url === '/categories') {
        return Promise.resolve({
          data: [{ id: 'cat-1', name: 'Groceries', isEnabled: true }],
        });
      }

      return Promise.resolve({ data: [] });
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/pdf' : null),
      },
      blob: async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
    } as Response);

    await act(async () => {
      root.render(
        <TestProviders>
          <ReceiptDocumentPage />
        </TestProviders>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Receipt details');
    expect(container.textContent).toContain('Magnum receipt');
    expect(container.textContent).toContain('Magnum');
    expect(container.textContent).toContain('Export to table');
    expect(container.querySelector('iframe[title="Magnum receipt"]')).toBeTruthy();
    expect(container.querySelector('input[aria-label="Vendor"]')).toBeTruthy();
    expect(container.querySelector('[role="combobox"][aria-label="Category"]')).toBeTruthy();
    expect(
      container.querySelector('[data-testid="receipt-location-section"]')?.textContent,
    ).toContain('receipt-1');

    const pageLayout = Array.from(container.querySelectorAll('div')).find(element =>
      element.className.includes('max-w-7xl'),
    );

    const fileSummaryCard = Array.from(container.querySelectorAll('div')).find(element =>
      element.className.includes('bg-slate-50 p-5'),
    );

    const metadataCard = Array.from(container.querySelectorAll('div')).find(element =>
      element.className.includes('grid gap-3 text-sm text-slate-600'),
    );

    expect(pageLayout).toBeFalsy();
    expect(fileSummaryCard).toBeFalsy();
    expect(metadataCard).toBeFalsy();
    expect(container.textContent).toContain('Original document');
    expect(container.textContent).toContain('Parsed fields');
  });

  it('uses dark surface classes for receipt preview and parsed fields shells', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/receipts/receipt-1') {
        return Promise.resolve({
          data: {
            id: 'receipt-1',
            subject: 'Dark mode receipt',
            sender: 'camera-scan',
            source: 'scan',
            status: 'draft',
            receivedAt: '2026-03-29T10:30:00.000Z',
            metadata: {
              attachments: [{ filename: 'receipt.jpg', mimeType: 'image/jpeg' }],
            },
            parsedData: {
              vendor: 'Store',
              amount: 500,
              currency: 'USD',
              date: '2026-03-29',
              lineItems: [{ description: 'Item', amount: 500 }],
            },
          },
        });
      }

      if (url === '/categories') {
        return Promise.resolve({ data: [] });
      }

      return Promise.resolve({ data: [] });
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      blob: async () => new Blob(['image'], { type: 'image/jpeg' }),
    } as Response);

    await act(async () => {
      root.render(
        <TestProviders>
          <ReceiptDocumentPage />
        </TestProviders>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const previewSection = Array.from(container.querySelectorAll('section')).find(element =>
      element.textContent?.includes('Original document'),
    );
    const parsedFieldsSection = Array.from(container.querySelectorAll('section')).find(element =>
      element.textContent?.includes('Parsed fields'),
    );

    expect(previewSection).toBeTruthy();
    expect(parsedFieldsSection).toBeTruthy();
    expect(container.querySelector('img[alt="Dark mode receipt"]')).toBeTruthy();
  });

  it('uses a white title for the receipt document name in dark mode', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/receipts/receipt-1') {
        return Promise.resolve({
          data: {
            id: 'receipt-1',
            subject: 'Document title receipt',
            sender: 'camera-scan',
            source: 'scan',
            status: 'draft',
            receivedAt: '2026-03-29T10:30:00.000Z',
            metadata: {
              attachments: [{ filename: 'receipt.jpg', mimeType: 'image/jpeg' }],
            },
            parsedData: {
              vendor: 'Store',
              amount: 500,
              currency: 'USD',
              date: '2026-03-29',
              lineItems: [],
            },
          },
        });
      }

      if (url === '/categories') {
        return Promise.resolve({ data: [] });
      }

      return Promise.resolve({ data: [] });
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      blob: async () => new Blob(['image'], { type: 'image/jpeg' }),
    } as Response);

    await act(async () => {
      root.render(
        <TestProviders>
          <ReceiptDocumentPage />
        </TestProviders>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const title = Array.from(container.querySelectorAll('h1')).find(element =>
      element.textContent?.includes('Document title receipt'),
    );

    expect(title).toBeTruthy();
    expect(title?.textContent).toContain('Document title receipt');
  });

  it('navigates back to statements from the receipt page', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/receipts/receipt-1') {
        return Promise.resolve({
          data: {
            id: 'receipt-1',
            subject: 'Receipt',
            sender: 'camera-scan',
            source: 'scan',
            status: 'draft',
            receivedAt: '2026-03-29T10:30:00.000Z',
            metadata: {
              attachments: [{ filename: 'receipt.jpg', mimeType: 'image/jpeg' }],
            },
            parsedData: {
              vendor: 'Store',
              amount: 500,
              currency: 'KZT',
              date: '2026-03-29',
              lineItems: [],
            },
          },
        });
      }

      if (url === '/categories') {
        return Promise.resolve({ data: [] });
      }

      return Promise.resolve({ data: [] });
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      blob: async () => new Blob(['image'], { type: 'image/jpeg' }),
    } as Response);

    await act(async () => {
      root.render(
        <TestProviders>
          <ReceiptDocumentPage />
        </TestProviders>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const backButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Back'),
    );

    expect(backButton).toBeTruthy();

    await act(async () => {
      backButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(routerMocks.back).toHaveBeenCalled();
  });

  it('uses shared detail action buttons in the receipt header', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/receipts/receipt-1') {
        return Promise.resolve({
          data: {
            id: 'receipt-1',
            subject: 'Receipt',
            sender: 'camera-scan',
            source: 'scan',
            status: 'draft',
            receivedAt: '2026-03-29T10:30:00.000Z',
            metadata: {
              attachments: [{ filename: 'receipt.jpg', mimeType: 'image/jpeg' }],
            },
            parsedData: {
              vendor: 'Store',
              amount: 500,
              currency: 'KZT',
              date: '2026-03-29',
              lineItems: [],
            },
          },
        });
      }

      if (url === '/categories') {
        return Promise.resolve({ data: [] });
      }

      return Promise.resolve({ data: [] });
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      blob: async () => new Blob(['image'], { type: 'image/jpeg' }),
    } as Response);

    await act(async () => {
      root.render(
        <TestProviders>
          <ReceiptDocumentPage />
        </TestProviders>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const actionLabels = ['Download', 'Export to table', 'Approve receipt'];

    for (const label of actionLabels) {
      const actionButton = Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent?.includes(label),
      ) as HTMLButtonElement | undefined;

      expect(actionButton).toBeTruthy();
      expect(actionButton?.tagName.toLowerCase()).toBe('button');
    }
  });

  it('returns to the documents list after approving the receipt', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/receipts/receipt-1') {
        return Promise.resolve({
          data: {
            id: 'receipt-1',
            subject: 'Receipt',
            sender: 'camera-scan',
            source: 'scan',
            status: 'draft',
            receivedAt: '2026-03-29T10:30:00.000Z',
            metadata: { attachments: [] },
            parsedData: {
              vendor: 'Store',
              amount: 500,
              currency: 'KZT',
              date: '2026-03-29',
              lineItems: [],
            },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    apiMocks.mockApiPatch.mockResolvedValue({ data: {} });
    apiMocks.mockApiPost.mockResolvedValue({ receipt: {}, transaction: { id: 'tx-1' } });

    await act(async () => {
      root.render(
        <TestProviders>
          <ReceiptDocumentPage />
        </TestProviders>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const approveButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Approve receipt'),
    );
    await act(async () => {
      approveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(apiMocks.mockApiPost).toHaveBeenCalledWith('receipt-1', {});
    expect(routerMocks.push).toHaveBeenCalledWith('/statements/submit');
  });

  it('returns to Review after approving a receipt opened from there', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/receipts/receipt-1') {
        return Promise.resolve({
          data: {
            id: 'receipt-1',
            subject: 'Receipt',
            sender: 'camera-scan',
            source: 'scan',
            status: 'draft',
            receivedAt: '2026-03-29T10:30:00.000Z',
            metadata: { attachments: [] },
            parsedData: {
              vendor: 'Store',
              amount: 500,
              currency: 'KZT',
              date: '2026-03-29',
              lineItems: [],
            },
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
    routerMocks.searchParams = new URLSearchParams('from=review');
    apiMocks.mockApiPatch.mockResolvedValue({ data: {} });
    apiMocks.mockApiPost.mockResolvedValue({ receipt: {}, transaction: { id: 'tx-1' } });

    await act(async () => {
      root.render(
        <TestProviders>
          <ReceiptDocumentPage />
        </TestProviders>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const approveButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Approve receipt'),
    );
    await act(async () => {
      approveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(apiMocks.mockApiPost).toHaveBeenCalledWith('receipt-1', {});
    expect(routerMocks.push).toHaveBeenCalledWith('/review');
  });

  it('renders store receipt image previews much larger on the receipt details page', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/receipts/receipt-1') {
        return Promise.resolve({
          data: {
            id: 'receipt-1',
            subject: 'Large receipt preview',
            sender: 'camera-scan',
            source: 'scan',
            status: 'draft',
            receivedAt: '2026-03-29T10:30:00.000Z',
            metadata: {
              attachments: [{ filename: 'receipt.jpg', mimeType: 'image/jpeg' }],
            },
            parsedData: {
              vendor: 'Store',
              amount: 500,
              currency: 'KZT',
              date: '2026-03-29',
              lineItems: [],
            },
          },
        });
      }

      if (url === '/categories') {
        return Promise.resolve({ data: [] });
      }

      return Promise.resolve({ data: [] });
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      blob: async () => new Blob(['image'], { type: 'image/jpeg' }),
    } as Response);

    await act(async () => {
      root.render(
        <TestProviders>
          <ReceiptDocumentPage />
        </TestProviders>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const previewImage = container.querySelector(
      'img[alt="Large receipt preview"]',
    ) as HTMLImageElement;

    expect(previewImage).toBeTruthy();
    expect(previewImage.style.width).toBe('180%');
    expect(previewImage.style.maxWidth).toBe('none');
    expect(previewImage.style.height).toBe('auto');
  });

  it('opens a currency drawer from the currency field and applies the selected currency', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/receipts/receipt-1') {
        return Promise.resolve({
          data: {
            id: 'receipt-1',
            subject: 'Receipt',
            sender: 'camera-scan',
            source: 'scan',
            status: 'draft',
            receivedAt: '2026-03-29T10:30:00.000Z',
            metadata: {
              attachments: [{ filename: 'receipt.jpg', mimeType: 'image/jpeg' }],
            },
            parsedData: {
              vendor: 'Store',
              amount: 500,
              currency: 'KZT',
              date: '2026-03-29',
              lineItems: [],
            },
          },
        });
      }

      if (url === '/categories') {
        return Promise.resolve({ data: [] });
      }

      return Promise.resolve({ data: [] });
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      blob: async () => new Blob(['image'], { type: 'image/jpeg' }),
    } as Response);

    await act(async () => {
      root.render(
        <TestProviders>
          <ReceiptDocumentPage />
        </TestProviders>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const currencyTrigger = container.querySelector('[aria-label="Currency"]') as HTMLElement;

    expect(currencyTrigger).toBeTruthy();

    await act(async () => {
      currencyTrigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('Select a currency');
    expect(document.body.textContent).toContain('USD - $');

    const usdButton = Array.from(document.querySelectorAll('button')).find(button =>
      button.textContent?.includes('USD - $'),
    );

    expect(usdButton).toBeTruthy();

    await act(async () => {
      usdButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    const updatedCurrencyTrigger = container.querySelector(
      '[aria-label="Currency"]',
    ) as HTMLElement;

    expect(updatedCurrencyTrigger.textContent).toContain('USD');
    expect(apiMocks.mockApiPatch).toHaveBeenCalledWith('/receipts/receipt-1', {
      parsedData: {
        vendor: 'Store',
        amount: 500,
        currency: 'USD',
        date: '2026-03-29',
        tax: undefined,
        paymentMethod: '',
        transactionType: 'expense',
        categoryId: undefined,
        lineItems: [{ description: 'Store', amount: 500 }],
      },
    });
  });

  it('autosaves editable receipt fields and hides manual draft or reject actions', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/receipts/receipt-1') {
        return Promise.resolve({
          data: {
            id: 'receipt-1',
            subject: 'Receipt autosave',
            sender: 'camera-scan',
            source: 'scan',
            status: 'draft',
            receivedAt: '2026-03-29T10:30:00.000Z',
            metadata: {
              attachments: [{ filename: 'receipt.jpg', mimeType: 'image/jpeg' }],
            },
            parsedData: {
              vendor: 'Store',
              amount: 500,
              currency: 'KZT',
              date: '2026-03-29',
              lineItems: [],
            },
          },
        });
      }

      if (url === '/categories') {
        return Promise.resolve({ data: [] });
      }

      return Promise.resolve({ data: [] });
    });

    apiMocks.mockApiPatch.mockResolvedValue({ data: { ok: true } });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      blob: async () => new Blob(['image'], { type: 'image/jpeg' }),
    } as Response);

    await act(async () => {
      root.render(
        <TestProviders>
          <ReceiptDocumentPage />
        </TestProviders>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain('Save draft');
    expect(container.textContent).not.toContain('Reject receipt');

    const vendorInput = container.querySelector('input[aria-label="Vendor"]') as HTMLInputElement;

    expect(vendorInput).toBeTruthy();

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setValue?.call(vendorInput, 'Mega Store');
      vendorInput.dispatchEvent(new Event('input', { bubbles: true }));
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(apiMocks.mockApiPatch).toHaveBeenCalledWith('/receipts/receipt-1', {
      parsedData: {
        vendor: 'Mega Store',
        amount: 500,
        currency: 'KZT',
        date: '2026-03-29',
        tax: undefined,
        paymentMethod: '',
        transactionType: 'expense',
        categoryId: undefined,
        lineItems: [{ description: 'Store', amount: 500 }],
      },
    });
  });

  it('exports all receipt line items into a custom table after confirmation', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/receipts/receipt-1') {
        return Promise.resolve({
          data: {
            id: 'receipt-1',
            statementId: '22222222-2222-4222-8222-222222222222',
            subject: 'Receipt export',
            sender: 'camera-scan',
            source: 'scan',
            status: 'draft',
            receivedAt: '2026-03-29T10:30:00.000Z',
            metadata: {
              attachments: [{ filename: 'receipt.jpg', mimeType: 'image/jpeg' }],
            },
            parsedData: {
              vendor: 'Store',
              amount: 500,
              currency: 'KZT',
              date: '2026-03-29',
              lineItems: [
                { description: 'COM 3PC SET', amount: 9.44 },
                { description: 'BABY WIPES', amount: 1.97 },
              ],
            },
          },
        });
      }

      if (url === '/categories') {
        return Promise.resolve({ data: [] });
      }

      return Promise.resolve({ data: [] });
    });

    apiMocks.mockApiPost
      .mockResolvedValueOnce({ data: { id: 'table-1' } })
      .mockResolvedValueOnce({ data: { key: 'item-col' } })
      .mockResolvedValueOnce({ data: { key: 'date-col' } })
      .mockResolvedValueOnce({ data: { key: 'amount-col' } })
      .mockResolvedValueOnce({ data: { key: 'currency-col' } })
      .mockResolvedValueOnce({ data: { key: 'source-col' } })
      .mockResolvedValueOnce({ data: { key: 'status-col' } })
      .mockResolvedValueOnce({ data: { created: 1, rows: [] } });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      blob: async () => new Blob(['image'], { type: 'image/jpeg' }),
    } as Response);

    await act(async () => {
      root.render(
        <TestProviders>
          <ReceiptDocumentPage />
        </TestProviders>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const exportButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Export to table'),
    );

    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('Confirm export');
    expect(document.body.textContent).toContain(
      'Are you sure you want to export this statement to a custom table?',
    );
    expect(apiMocks.mockApiPost).not.toHaveBeenCalled();

    const confirmExportButton = Array.from(document.body.querySelectorAll('button')).find(
      button => button.textContent?.trim() === 'Export',
    );

    expect(confirmExportButton).toBeTruthy();

    await act(async () => {
      confirmExportButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(apiMocks.mockApiPost).toHaveBeenNthCalledWith(1, '/custom-tables', {
      name: 'Receipt Receipt export',
      description: `Exported from scanned receipt on ${new Date(
        '2026-03-29T10:30:00.000Z',
      ).toLocaleDateString()}`,
    });
    expect(apiMocks.mockApiPost).toHaveBeenNthCalledWith(2, '/custom-tables/table-1/columns', {
      title: 'Item',
      type: 'text',
    });
    expect(apiMocks.mockApiPost).toHaveBeenNthCalledWith(3, '/custom-tables/table-1/columns', {
      title: 'Date',
      type: 'date',
    });
    expect(apiMocks.mockApiPost).toHaveBeenNthCalledWith(4, '/custom-tables/table-1/columns', {
      title: 'Amount',
      type: 'number',
    });
    expect(apiMocks.mockApiPost).toHaveBeenNthCalledWith(5, '/custom-tables/table-1/columns', {
      title: 'Currency',
      type: 'text',
    });
    expect(apiMocks.mockApiPost).toHaveBeenNthCalledWith(6, '/custom-tables/table-1/columns', {
      title: 'Source',
      type: 'text',
    });
    expect(apiMocks.mockApiPost).toHaveBeenNthCalledWith(7, '/custom-tables/table-1/columns', {
      title: 'Status',
      type: 'text',
    });
    expect(apiMocks.mockApiPost).toHaveBeenNthCalledWith(8, '/custom-tables/table-1/rows/batch', {
      rows: [
        {
          data: {
            'item-col': 'COM 3PC SET',
            'date-col': '2026-03-29',
            'amount-col': 9.44,
            'currency-col': 'KZT',
            'source-col': 'scan',
            'status-col': 'draft',
          },
        },
        {
          data: {
            'item-col': 'BABY WIPES',
            'date-col': '2026-03-29',
            'amount-col': 1.97,
            'currency-col': 'KZT',
            'source-col': 'scan',
            'status-col': 'draft',
          },
        },
      ],
    });
    expect(routerMocks.push).toHaveBeenCalledWith('/custom-tables/table-1');
  });

  it('keeps export to table available when receipt has no linked statement id', async () => {
    apiMocks.mockApiGet.mockImplementation((url: string) => {
      if (url === '/receipts/receipt-1') {
        return Promise.resolve({
          data: {
            id: 'receipt-1',
            statementId: null,
            subject: 'Receipt without statement link',
            sender: 'camera-scan',
            source: 'scan',
            status: 'draft',
            receivedAt: '2026-03-29T10:30:00.000Z',
            metadata: {
              attachments: [{ filename: 'receipt.jpg', mimeType: 'image/jpeg' }],
            },
            parsedData: {
              vendor: 'Store',
              amount: 500,
              currency: 'KZT',
              date: '2026-03-29',
              lineItems: [],
            },
          },
        });
      }

      if (url === '/categories') {
        return Promise.resolve({ data: [] });
      }

      return Promise.resolve({ data: [] });
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      blob: async () => new Blob(['image'], { type: 'image/jpeg' }),
    } as Response);

    await act(async () => {
      root.render(
        <TestProviders>
          <ReceiptDocumentPage />
        </TestProviders>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const exportButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Export to table'),
    ) as HTMLButtonElement | undefined;

    expect(exportButton).toBeTruthy();
    expect(exportButton?.disabled).toBe(false);
  });
});
