import { waitFor } from '@testing-library/react';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFThumbnail } from './PDFThumbnail';

type NextImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

vi.mock('next/image', () => ({
  default: (props: NextImageProps) => <img {...props} alt={props.alt || ''} />,
}));

vi.mock('@/app/lib/workspace-headers', () => ({
  getWorkspaceHeaders: () => ({ 'X-CSRF-Token': 'test-csrf' }),
}));

vi.mock('@/app/lib/csrf', () => ({
  hasSessionCookie: () => true,
  getCsrfHeaders: () => ({ 'X-CSRF-Token': 'test-csrf' }),
}));

describe('PDFThumbnail', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    container.remove();
    container = null as unknown as HTMLDivElement;
  });

  it('shows file placeholder icon when thumbnail request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    const root = createRoot(container);

    await act(async () => {
      root.render(<PDFThumbnail fileId="statement-1" size={36} className="text-red-500" />);
      await Promise.resolve();
    });

    const fallbackIcon = container.querySelector(
      '[data-testid="pdf-thumbnail-fallback-icon"]',
    ) as SVGElement | null;

    expect(fallbackIcon).toBeTruthy();
    expect(fallbackIcon?.getAttribute('width')).toBe('29');
    expect(fallbackIcon?.getAttribute('height')).toBe('29');
    expect(fallbackIcon?.getAttribute('style')).toContain('color: rgb(156, 163, 175)');
    expect(fallbackIcon?.className.baseVal).not.toContain('text-red-500');
  });

  it('renders the shared spinner while the thumbnail is loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );

    const root = createRoot(container);

    await act(async () => {
      root.render(<PDFThumbnail fileId="statement-loading" size={36} />);
      await Promise.resolve();
    });

    const spinner = container.querySelector('[aria-label="Loading"]');
    expect(spinner).toBeTruthy();
    expect(spinner?.getAttribute('role')).toBe('status');
  });

  it('shows error icon and message in preview mode when thumbnail fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PDFThumbnail
          fileId="statement-2"
          width={320}
          height={460}
          errorMessage="Unable to load document"
        />,
      );
      await Promise.resolve();
    });

    const errorIcon = container.querySelector('[data-testid="pdf-thumbnail-error-icon"]');
    expect(errorIcon).toBeTruthy();
    expect(container.textContent).toContain('Unable to load document');
  });

  it('requests a thumbnail with an explicit width for larger previews', async () => {
    vi.stubGlobal(
      'FileReader',
      class MockFileReader {
        result: string | ArrayBuffer | null = null;
        onloadend: null | (() => void) = null;

        readAsDataURL() {
          this.result = 'data:image/png;base64,ZmFrZQ==';
          this.onloadend?.();
        }
      },
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['thumbnail'], { type: 'image/png' })),
    });
    vi.stubGlobal('fetch', fetchMock);

    const root = createRoot(container);

    await act(async () => {
      root.render(<PDFThumbnail fileId="statement-width" width={320} height={460} />);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/statements/statement-width/thumbnail?width=320'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('can request a higher-resolution thumbnail without changing display size', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['thumbnail'], { type: 'image/png' })),
    });
    vi.stubGlobal('fetch', fetchMock);

    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PDFThumbnail fileId="statement-hidpi" width={320} thumbnailWidth={640} height={460} />,
      );
      await Promise.resolve();
    });

    const frame = container.querySelector(
      '[data-testid="pdf-thumbnail-frame"]',
    ) as HTMLDivElement | null;
    expect(fetchMock.mock.calls[0]?.[0]).toContain('width=640');
    expect(frame?.style.width).toBe('320px');
  });

  it('uses backend dev api base url when NEXT_PUBLIC_API_URL is not set', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');

    vi.resetModules();

    vi.stubGlobal(
      'FileReader',
      class MockFileReader {
        result: string | ArrayBuffer | null = null;
        onloadend: null | (() => void) = null;

        readAsDataURL() {
          this.result = 'data:image/png;base64,ZmFrZQ==';
          this.onloadend?.();
        }
      },
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['thumbnail'], { type: 'image/png' })),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { PDFThumbnail: FreshPDFThumbnail } = await import('./PDFThumbnail');
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(<FreshPDFThumbnail fileId="statement-dev" width={320} height={460} />);
        await Promise.resolve();
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toContain(
        'http://localhost:3001/api/v1/statements/statement-dev/thumbnail?width=320',
      );
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it('caches thumbnails separately for different requested widths', async () => {
    vi.stubGlobal(
      'FileReader',
      class MockFileReader {
        result: string | ArrayBuffer | null = null;
        onloadend: null | (() => void) = null;

        readAsDataURL() {
          this.result = 'data:image/png;base64,ZmFrZQ==';
          this.onloadend?.();
        }
      },
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['thumbnail'], { type: 'image/png' })),
    });
    vi.stubGlobal('fetch', fetchMock);

    const root = createRoot(container);

    await act(async () => {
      root.render(<PDFThumbnail fileId="statement-cache" width={120} height={180} />);
      await Promise.resolve();
    });

    await act(async () => {
      root.render(<PDFThumbnail fileId="statement-cache" width={420} height={620} />);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('width=120');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('width=420');
  });

  it('preserves the document page proportions in preview mode', async () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const originalImage = globalThis.Image;

    vi.stubGlobal(
      'FileReader',
      class MockFileReader {
        result: string | ArrayBuffer | null = null;
        onloadend: null | (() => void) = null;

        readAsDataURL() {
          this.result = 'data:image/png;base64,ZmFrZQ==';
          this.onloadend?.();
        }
      },
    );

    URL.createObjectURL = vi.fn(() => 'blob:thumbnail-metadata');
    URL.revokeObjectURL = vi.fn();

    class MockImage {
      naturalWidth = 292;
      naturalHeight = 414;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      set src(_value: string) {
        this.onload?.();
      }
    }

    vi.stubGlobal('Image', MockImage as unknown as typeof Image);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['thumbnail'], { type: 'image/png' })),
    });
    vi.stubGlobal('fetch', fetchMock);

    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <PDFThumbnail
            fileId="statement-proportions"
            width={414}
            height={620}
            preservePageAspect
          />,
        );
        await Promise.resolve();
      });

      await waitFor(() => {
        const frame = container.querySelector(
          '[data-testid="pdf-thumbnail-frame"]',
        ) as HTMLDivElement | null;
        expect(frame).toBeTruthy();
        expect(frame?.style.width).toBe('414px');
        expect(frame?.style.height).toBe('587px');
      });
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
      vi.stubGlobal('Image', originalImage);
    }
  });
});
