import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/lib/workspace-headers', () => ({
  getWorkspaceHeaders: () => ({ 'X-CSRF-Token': 'test-csrf' }),
}));

vi.mock('@/app/lib/csrf', () => ({
  hasSessionCookie: () => true,
  getCsrfHeaders: () => ({ 'X-CSRF-Token': 'test-csrf' }),
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    errors: {
      authRequired: { value: 'Auth required' },
      fileLoadError: { value: 'File load error' },
      fileLoadFailed: { value: 'Failed to load file' },
      pdfRendererFailed: { value: 'Renderer failed' },
      downloadFailed: { value: 'Download failed' },
      downloadAlertFailed: { value: 'Download alert failed' },
      uploadFailed: { value: 'Upload failed' },
      parsingFailed: { value: 'Parsing failed' },
      displayFailed: { value: 'Display failed' },
    },
    loading: { value: 'Loading' },
    fileNotAttached: { value: 'Файл не прикреплен' },
    loadError: { value: 'Ошибка загрузки' },
    uploadFileHint: { value: 'Загрузите файл, чтобы продолжить' },
    uploading: { value: 'Загрузка...' },
    uploadFile: { value: 'Загрузить файл' },
    close: { value: 'Закрыть' },
    startParsing: { value: 'Запустить парсинг' },
    startParsingDescription: { value: 'Начать повторный парсинг файла?' },
    decline: { value: 'Позже' },
    startingParsing: { value: 'Запуск...' },
    startParsingButton: { value: 'Запустить парсинг' },
    receiptTitle: 'Receipt',
    openFileMenu: { value: 'Open file menu' },
    closePreview: { value: 'Close preview' },
    download: 'Download',
  }),
}));

// Marking mode has its own tests (pdf-teach); here the preview runs without it.
vi.mock('./pdf-teach/useTeachSession', () => ({
  useTeachMode: () => ({
    teaching: false,
    session: { pageWidths: {}, setPageWidth: () => undefined },
    teachAgain: () => undefined,
  }),
}));

vi.mock('./ui/modal-shell', () => ({
  ModalShell: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));

describe('PDFPreviewModal manual attach flow', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let originalCreateObjectUrl: typeof URL.createObjectURL;
  let originalRevokeObjectUrl: typeof URL.revokeObjectURL;
  let PDFPreviewModal: typeof import('./PDFPreviewModal').PDFPreviewModal;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    originalCreateObjectUrl = URL.createObjectURL;
    originalRevokeObjectUrl = URL.revokeObjectURL;

    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue('blob://preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
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

  async function loadComponent() {
    const module = await import('./PDFPreviewModal');
    PDFPreviewModal = module.PDFPreviewModal;
  }

  it('builds source-specific file endpoints', async () => {
    const module = (await import('./PDFPreviewModal')) as {
      getFileEndpoint?: (source: 'statement' | 'receipt', fileId: string) => string;
    };

    expect(module.getFileEndpoint?.('statement', 'statement-1')).toBe(
      '/api/v1/statements/statement-1/file',
    );
    expect(module.getFileEndpoint?.('receipt', 'receipt-1')).toBe(
      '/api/v1/receipts/receipt-1/file',
    );
  });

  it('shows upload CTA in error state for manual statement placeholder', async () => {
    await act(async () => {
      await loadComponent();
      root.render(
        <PDFPreviewModal
          isOpen
          onClose={vi.fn()}
          fileId="statement-1"
          fileName="manual-expense.csv"
          allowAttachFile
        />,
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Загрузить файл');
  });

  it('offers parsing prompt after successful file attach and starts replace parsing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'statement-1' }) })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'statement-1' }) });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      await loadComponent();
      root.render(
        <PDFPreviewModal
          isOpen
          onClose={vi.fn()}
          fileId="statement-1"
          fileName="manual-expense.csv"
          allowAttachFile
        />,
      );
      await Promise.resolve();
    });

    const uploadInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(uploadInput).toBeTruthy();

    const file = new File(['%PDF-1.4'], 'receipt.pdf', { type: 'application/pdf' });
    await act(async () => {
      Object.defineProperty(uploadInput, 'files', {
        value: [file],
        configurable: true,
      });
      uploadInput.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Запустить парсинг');

    const startParsingButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Запустить парсинг'),
    ) as HTMLButtonElement;

    await act(async () => {
      startParsingButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/statements/statement-1/reprocess?mode=replace',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('loads receipt pdf files from the receipts endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      await loadComponent();
      root.render(
        <PDFPreviewModal
          isOpen
          onClose={vi.fn()}
          fileId="receipt-1"
          fileName="receipt.pdf"
          source="receipt"
        />,
      );
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/receipts/receipt-1/file',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('renders image preview for receipt images while preserving file endpoint loading', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      blob: async () => new Blob(['image-bytes'], { type: 'image/jpeg' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      await loadComponent();
      root.render(
        <PDFPreviewModal
          isOpen
          onClose={vi.fn()}
          fileId="receipt-image-1"
          fileName="receipt.jpg"
          source="receipt"
        />,
      );
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/receipts/receipt-image-1/file',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(container.querySelector('img[alt="receipt.jpg"]')).toBeTruthy();
  });

  it('uses enlarged image preview sizing only for store receipt images', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg' : null),
      },
      blob: async () => new Blob(['image-bytes'], { type: 'image/jpeg' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      await loadComponent();
      root.render(
        <PDFPreviewModal
          isOpen
          onClose={vi.fn()}
          fileId="receipt-image-2"
          fileName="store-receipt.jpg"
          source="receipt"
        />,
      );
      await Promise.resolve();
    });

    const storeReceiptImage = container.querySelector(
      'img[alt="store-receipt.jpg"]',
    ) as HTMLImageElement;

    expect(storeReceiptImage).toBeTruthy();
    expect(storeReceiptImage.className).toContain(
      'seneca-pdf-preview-modal__image-preview--receipt',
    );
    expect(storeReceiptImage.className).not.toContain('max-h-[78vh]');

    await act(async () => {
      root.render(
        <PDFPreviewModal
          isOpen
          onClose={vi.fn()}
          fileId="statement-image-3"
          fileName="statement-photo.jpg"
          source="statement"
        />,
      );
      await Promise.resolve();
    });

    const statementImage = container.querySelector(
      'img[alt="statement-photo.jpg"]',
    ) as HTMLImageElement;

    expect(statementImage).toBeTruthy();
    expect(statementImage.className).toContain('seneca-pdf-preview-modal__image-preview');
    expect(statementImage.className).not.toContain(
      'seneca-pdf-preview-modal__image-preview--receipt',
    );
  });

  it('uses dark surface classes for the preview shell and canvas', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      await loadComponent();
      root.render(
        <PDFPreviewModal
          isOpen
          onClose={vi.fn()}
          fileId="receipt-1"
          fileName="receipt.pdf"
          source="receipt"
        />,
      );
      await Promise.resolve();
    });

    const previewShell = Array.from(container.querySelectorAll('div')).find(node =>
      node.className.includes('seneca-pdf-preview-modal__body'),
    );
    const previewCanvas = Array.from(container.querySelectorAll('div')).find(node =>
      node.className.includes('seneca-pdf-preview-modal__content'),
    );

    expect(previewShell).toBeTruthy();
    expect(previewCanvas).toBeTruthy();
  });
});
