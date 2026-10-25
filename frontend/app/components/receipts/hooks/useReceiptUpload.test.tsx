// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReceiptUpload } from './useReceiptUpload';

const apiMocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({
  default: {
    post: apiMocks.post,
  },
}));

type UploadHookSnapshot = ReturnType<typeof useReceiptUpload>;

let latestHook: UploadHookSnapshot | null = null;

function HookProbe() {
  latestHook = useReceiptUpload();
  return null;
}

describe('useReceiptUpload', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    apiMocks.post.mockReset();
    latestHook = null;
  });

  it('uploads files to the receipts upload endpoint', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const responsePayload = { receipts: [{ id: 'receipt-1' }] };

    apiMocks.post.mockResolvedValue({ data: responsePayload });

    await act(async () => {
      root.render(<HookProbe />);
    });

    const file = new File(['hello'], 'receipt.jpg', { type: 'image/jpeg' });
    let result: unknown;

    await act(async () => {
      result = await latestHook?.uploadReceipts([file], 'deu');
    });

        expect(result).toBeUndefined();

    expect(apiMocks.post).toHaveBeenCalledWith(
      '/receipts/upload',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: expect.any(Function),
      }),
    );

    const [, formData] = apiMocks.post.mock.calls[0];
    expect(formData.getAll('files')).toHaveLength(1);
    expect(formData.get('language')).toBe('deu');

    await act(async () => {
      root.unmount();
    });
  });

  it('tracks upload progress and resets state after success', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    apiMocks.post.mockImplementation(async (_url, _body, config) => {
      config?.onUploadProgress?.({ loaded: 4, total: 8 });
      return { data: { receipts: [] } };
    });

    await act(async () => {
      root.render(<HookProbe />);
    });

    const file = new File(['hello'], 'receipt.jpg', { type: 'image/jpeg' });

    await act(async () => {
      await latestHook?.uploadReceipts([file]);
    });

    expect(latestHook?.uploading).toBe(false);
    expect(latestHook?.progress).toBe(0);
    expect(latestHook?.error).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('surfaces a readable error message when upload fails', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const error = {
      isAxiosError: true,
      response: {
        data: {
          message: 'Upload failed badly',
        },
      },
    };

    apiMocks.post.mockRejectedValue(error);

    await act(async () => {
      root.render(<HookProbe />);
    });

    const file = new File(['hello'], 'receipt.jpg', { type: 'image/jpeg' });

    let caughtError: unknown;

    await act(async () => {
      try {
        await latestHook?.uploadReceipts([file]);
      } catch (uploadError) {
        caughtError = uploadError;
      }
    });

    expect(caughtError).toEqual(error);
    expect(latestHook?.error).toBe('Upload failed badly');
    expect(latestHook?.uploading).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });
});
