// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listPlaceFollowups, setReceiptPlacePrompt } from '@/app/lib/receipt-place-followup';
import {
  extractUploadErrorMessage,
  uploadReceiptScanFiles,
  uploadScanDrawerFiles,
  uploadStatementFiles,
} from './statement-upload';

const apiMocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({
  default: {
    post: apiMocks.post,
  },
}));

const labels = {
  pickAtLeastOne: 'Select at least one file',
  uploadedProcessing: 'Files uploaded',
  uploadFailed: 'Failed to upload files',
};

describe('statement-upload helpers', () => {
  beforeEach(() => {
    apiMocks.post.mockReset();
  });

  it('extracts the first backend validation message from error payload arrays', () => {
    const error = {
      response: {
        data: {
          message: ['Receipt amount could not be determined', 'ignored'],
        },
      },
    };

    expect(extractUploadErrorMessage(error, labels.uploadFailed)).toBe(
      'Receipt amount could not be determined',
    );
  });

  it('extracts the message from the wrapped { error: { message } } envelope', () => {
    const error = {
      response: {
        data: {
          error: { code: 'BAD_REQUEST', message: 'Only image and PDF receipt files are supported' },
        },
      },
    };

    expect(extractUploadErrorMessage(error, labels.uploadFailed)).toBe(
      'Only image and PDF receipt files are supported',
    );
  });

  it('preserves backend receipt upload errors instead of replacing them with a generic message', async () => {
    const onUploadSuccess = vi.fn();
    const refreshAfterCreate = vi.fn().mockResolvedValue(undefined);

    apiMocks.post.mockRejectedValue({
      response: {
        data: {
          message: 'Receipt scan could not be processed',
        },
      },
    });

    await expect(
      uploadReceiptScanFiles({
        files: [new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })],
        labels,
        onUploadSuccess,
        refreshAfterCreate,
      }),
    ).rejects.toThrow('Receipt scan could not be processed');

    expect(onUploadSuccess).not.toHaveBeenCalled();
    expect(refreshAfterCreate).not.toHaveBeenCalled();
  });

  it('routes all scan drawer files through the receipt endpoint', async () => {
    const onUploadSuccess = vi.fn();
    const refreshAfterCreate = vi.fn().mockResolvedValue(undefined);
    apiMocks.post.mockResolvedValue({ data: {} });

    await uploadScanDrawerFiles({
      payload: {
        files: [
          new File(['statement'], 'statement.pdf', { type: 'application/pdf' }),
          new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }),
        ],
        allowDuplicates: true,
        requireManualCategorySelection: false,
      },
      labels,
      onUploadSuccess,
      refreshAfterCreate,
    });

    expect(apiMocks.post).toHaveBeenCalledTimes(1);
    expect(apiMocks.post).toHaveBeenCalledWith(
      '/statements/upload-receipt',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  });

  it('splits receipt scan batches into backend-sized upload requests', async () => {
    const onUploadSuccess = vi.fn();
    const refreshAfterCreate = vi.fn().mockResolvedValue(undefined);
    const files = Array.from(
      { length: 7 },
      (_, index) => new File([`receipt-${index}`], `receipt-${index}.jpg`, { type: 'image/jpeg' }),
    );

    apiMocks.post.mockResolvedValue({ data: {} });

    await uploadReceiptScanFiles({
      files,
      labels,
      onUploadSuccess,
      refreshAfterCreate,
    });

    expect(apiMocks.post).toHaveBeenCalledTimes(2);

    const firstBatch = apiMocks.post.mock.calls[0]?.[1] as FormData;
    const secondBatch = apiMocks.post.mock.calls[1]?.[1] as FormData;

    expect(firstBatch.getAll('files')).toHaveLength(5);
    expect(secondBatch.getAll('files')).toHaveLength(2);
    expect(onUploadSuccess).toHaveBeenCalledTimes(1);
    expect(refreshAfterCreate).toHaveBeenCalledTimes(1);
  });

  it('reports the statements created by each batch against the offset of its first file', async () => {
    const files = Array.from(
      { length: 7 },
      (_, index) => new File([`receipt-${index}`], `receipt-${index}.jpg`, { type: 'image/jpeg' }),
    );
    apiMocks.post
      .mockResolvedValueOnce({ data: { data: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id })) } })
      .mockResolvedValueOnce({ data: { data: [{ id: 'f' }, { id: 'g' }] } });
    const onBatchCreated = vi.fn();

    await uploadReceiptScanFiles({
      files,
      labels,
      onUploadSuccess: vi.fn(),
      refreshAfterCreate: vi.fn().mockResolvedValue(undefined),
      onBatchCreated,
    });

    expect(onBatchCreated.mock.calls).toEqual([
      [0, ['a', 'b', 'c', 'd', 'e']],
      [5, ['f', 'g']],
    ]);
  });

  it('waits for the pending device location before the first request', async () => {
    apiMocks.post.mockResolvedValue({ data: { data: [{ id: 'stmt-1' }] } });
    let settleLocation: ((value: null) => void) | undefined;
    const deviceLocationRequest = new Promise<null>(resolve => {
      settleLocation = resolve;
    });

    const upload = uploadScanDrawerFiles({
      payload: {
        files: [new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })],
        allowDuplicates: true,
        requireManualCategorySelection: false,
        deviceLocationRequest,
      },
      labels,
      onUploadSuccess: vi.fn(),
      refreshAfterCreate: vi.fn().mockResolvedValue(undefined),
    });

    await Promise.resolve();
    expect(apiMocks.post).not.toHaveBeenCalled();

    settleLocation?.(null);
    await upload;
    expect(apiMocks.post).toHaveBeenCalledTimes(1);
  });

  it('keeps statement uploads on the statement endpoint without receipt chunking', async () => {
    const onUploadSuccess = vi.fn();
    const refreshAfterCreate = vi.fn().mockResolvedValue(undefined);
    apiMocks.post.mockResolvedValue({ data: {} });

    await uploadStatementFiles({
      files: [new File(['statement'], 'statement.pdf', { type: 'application/pdf' })],
      allowDuplicates: true,
      labels,
      onUploadSuccess,
      refreshAfterCreate,
    });

    expect(apiMocks.post).toHaveBeenCalledTimes(1);
    expect(apiMocks.post).toHaveBeenCalledWith(
      '/statements/upload',
      expect.any(FormData),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
  });

  it('sends the device position with every receipt batch when one was captured', async () => {
    apiMocks.post.mockResolvedValue({ data: {} });
    const files = Array.from(
      { length: 6 },
      (_, index) => new File([`receipt-${index}`], `receipt-${index}.jpg`, { type: 'image/jpeg' }),
    );

    await uploadScanDrawerFiles({
      payload: {
        files,
        allowDuplicates: true,
        requireManualCategorySelection: false,
        deviceLocationRequest: Promise.resolve({
          latitude: 43.2383,
          longitude: 76.9453,
          accuracy: 15,
        }),
      },
      labels,
      onUploadSuccess: vi.fn(),
      refreshAfterCreate: vi.fn().mockResolvedValue(undefined),
    });

    expect(apiMocks.post).toHaveBeenCalledTimes(2);
    for (const [, formData] of apiMocks.post.mock.calls) {
      expect((formData as FormData).get('latitude')).toBe('43.2383');
      expect((formData as FormData).get('longitude')).toBe('76.9453');
      expect((formData as FormData).get('accuracy')).toBe('15');
    }
  });

  it('sends no location fields when no position was captured', async () => {
    apiMocks.post.mockResolvedValue({ data: {} });

    await uploadReceiptScanFiles({
      files: [new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })],
      deviceLocation: null,
      labels,
      onUploadSuccess: vi.fn(),
      refreshAfterCreate: vi.fn().mockResolvedValue(undefined),
    });

    const formData = apiMocks.post.mock.calls[0]?.[1] as FormData;
    expect(formData.has('latitude')).toBe(false);
    expect(formData.has('longitude')).toBe(false);
  });

  it('sends every batch to the workspace the upload started in', async () => {
    localStorage.setItem('currentWorkspaceId', 'ws-started');
    let releaseLocation: (location: null) => void = () => undefined;
    const deviceLocationRequest = new Promise<null>(resolve => {
      releaseLocation = resolve;
    });
    apiMocks.post.mockImplementation(async () => {
      // The user switches workspace while the upload is still running.
      localStorage.setItem('currentWorkspaceId', 'ws-switched');
      return { data: { data: [] } };
    });

    const upload = uploadScanDrawerFiles({
      payload: {
        files: Array.from(
          { length: 6 },
          (_, index) => new File(['receipt'], `r${index}.jpg`, { type: 'image/jpeg' }),
        ),
        allowDuplicates: false,
        requireManualCategorySelection: false,
        deviceLocationRequest,
      },
      labels,
      onUploadSuccess: vi.fn(),
      refreshAfterCreate: vi.fn().mockResolvedValue(undefined),
    });
    // ...or even before the first request, while the location is still pending.
    localStorage.setItem('currentWorkspaceId', 'ws-switched');
    releaseLocation(null);
    await upload;

    expect(apiMocks.post).toHaveBeenCalledTimes(2);
    for (const [, , config] of apiMocks.post.mock.calls) {
      expect(config.headers['X-Workspace-Id']).toBe('ws-started');
    }
    localStorage.clear();
  });

  describe('asking for the shop later', () => {
    const scan = (deviceLocationRequest: Promise<{ latitude: number; longitude: number; accuracy: number } | null> | null) =>
      uploadScanDrawerFiles({
        payload: {
          files: [new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })],
          allowDuplicates: true,
          requireManualCategorySelection: false,
          deviceLocationRequest,
        },
        labels,
        onUploadSuccess: vi.fn(),
        refreshAfterCreate: vi.fn().mockResolvedValue(undefined),
      });

    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem('currentWorkspaceId', 'ws-1');
      apiMocks.post.mockResolvedValue({ data: { data: [{ id: 'statement-1' }] } });
    });

    it('queues a camera shot that got no fix', async () => {
      await scan(Promise.resolve(null));

      expect(listPlaceFollowups()).toEqual([
        expect.objectContaining({ statementId: 'statement-1', workspaceId: 'ws-1' }),
      ]);
    });

    it('queues a camera shot with a rough fix, and still sends that fix', async () => {
      await scan(Promise.resolve({ latitude: 43.2, longitude: 76.9, accuracy: 800 }));

      expect(listPlaceFollowups()).toHaveLength(1);
      expect((apiMocks.post.mock.calls[0]?.[1] as FormData).get('accuracy')).toBe('800');
    });

    it('does not queue a good fix, a gallery photo or when turned off', async () => {
      await scan(Promise.resolve({ latitude: 43.2, longitude: 76.9, accuracy: 20 }));
      await scan(null);
      setReceiptPlacePrompt(false);
      await scan(Promise.resolve(null));

      expect(listPlaceFollowups()).toEqual([]);
    });
  });
});

