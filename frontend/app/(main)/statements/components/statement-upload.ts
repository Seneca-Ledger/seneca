'use client';

import apiClient from '@/app/lib/api';
import type { DeviceLocation } from '@/app/lib/device-location';
import { enqueue, indexedDbStore, isOfflineStoreAvailable } from '@/app/lib/offline/offline-queue';
import { enqueuePlaceFollowups, needsPlaceFollowup } from '@/app/lib/receipt-place-followup';

export const RECEIPT_SCAN_UPLOAD_BATCH_SIZE = 5;

export type StatementUploadLabels = {
  pickAtLeastOne: string;
  uploadedProcessing: string;
  uploadFailed: string;
};

type UploadCallbacks = {
  onUploadSuccess: (message: string) => void;
  refreshAfterCreate: () => Promise<void>;
};

type UploadStatementFilesParams = UploadCallbacks & {
  files: File[];
  allowDuplicates: boolean;
  labels: StatementUploadLabels;
  requireManualCategorySelection?: boolean;
};

type UploadReceiptScanFilesParams = UploadCallbacks & {
  files: File[];
  labels: StatementUploadLabels;
  deviceLocation?: DeviceLocation | null;
  /** The workspace the upload was started in; the one open now when not given. */
  workspaceId?: string | null;
  /** After each batch: offset of its first file and the created statement ids, in file order. */
  onBatchCreated?: (fileOffset: number, statementIds: string[]) => void;
};

type UploadScanDrawerFilesParams = UploadCallbacks & {
  labels: StatementUploadLabels;
  onBatchCreated?: UploadReceiptScanFilesParams['onBatchCreated'];
  payload: {
    files: File[];
    allowDuplicates: boolean;
    requireManualCategorySelection: boolean;
    /** Still pending when the drawer hands the files over; awaited before the first request. */
    deviceLocationRequest?: Promise<DeviceLocation | null> | null;
  };
};

// Read once per upload: batches go out one after another, and switching
// workspace in the meantime must not send the rest of them to the new one.
const readOpenWorkspaceId = (): string | null => localStorage.getItem('currentWorkspaceId');

const chunkFiles = (files: File[], size: number): File[][] => {
  const chunks: File[][] = [];

  for (let index = 0; index < files.length; index += size) {
    chunks.push(files.slice(index, index + size));
  }

  return chunks;
};

const readCreatedStatementIds = (responseData: unknown): string[] => {
  const created = (responseData as { data?: unknown } | null)?.data;
  if (!Array.isArray(created)) {
    return [];
  }
  return created.flatMap(statement => {
    const id = (statement as { id?: unknown } | null)?.id;
    return typeof id === 'string' ? [id] : [];
  });
};

// eslint-disable-next-line complexity
export const extractUploadErrorMessage = (error: unknown, fallback: string): string => {
  // HttpExceptionFilter wraps failures as { error: { message } }; older/plain
  // Nest responses still use a top-level { message }.
  const responseData = (
    error as {
      response?: { data?: { message?: unknown; error?: { message?: unknown } } };
    }
  )?.response?.data;
  const responseMessage = responseData?.error?.message ?? responseData?.message;

  if (Array.isArray(responseMessage)) {
    const [firstMessage] = responseMessage;
    return typeof firstMessage === 'string' && firstMessage.trim() ? firstMessage : fallback;
  }

  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return responseMessage;
  }

  return fallback;
};

export const uploadStatementFiles = async ({
  files,
  allowDuplicates,
  labels,
  onUploadSuccess,
  refreshAfterCreate,
  requireManualCategorySelection = false,
}: UploadStatementFilesParams): Promise<void> => {
  if (files.length === 0) {
    throw new Error(labels.pickAtLeastOne);
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  formData.append('allowDuplicates', allowDuplicates ? 'true' : 'false');
  formData.append(
    'requireManualCategorySelection',
    requireManualCategorySelection ? 'true' : 'false',
  );

  try {
    await apiClient.post('/statements/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    onUploadSuccess(labels.uploadedProcessing);
    await refreshAfterCreate();
  } catch (error) {
    console.error('Failed to upload statements:', error);
    throw new Error(extractUploadErrorMessage(error, labels.uploadFailed));
  }
};

export const uploadReceiptScanFiles = async ({
  files,
  deviceLocation,
  workspaceId = readOpenWorkspaceId(),
  labels,
  onUploadSuccess,
  refreshAfterCreate,
  onBatchCreated,
}: UploadReceiptScanFilesParams): Promise<void> => {
  if (files.length === 0) {
    throw new Error(labels.pickAtLeastOne);
  }

  try {
    let fileOffset = 0;
    for (const batch of chunkFiles(files, RECEIPT_SCAN_UPLOAD_BATCH_SIZE)) {
      const formData = new FormData();
      for (const file of batch) {
        formData.append('files', file);
      }
      if (deviceLocation) {
        formData.append('latitude', String(deviceLocation.latitude));
        formData.append('longitude', String(deviceLocation.longitude));
        formData.append('accuracy', String(deviceLocation.accuracy));
      }

      // No network: the photos wait on the device and go out when it is back.
      if (isOfflineStoreAvailable() && typeof navigator !== 'undefined' && !navigator.onLine) {
        await enqueue(indexedDbStore, {
          kind: 'receipt-scan',
          fields: deviceLocation
            ? {
                latitude: String(deviceLocation.latitude),
                longitude: String(deviceLocation.longitude),
                accuracy: String(deviceLocation.accuracy),
              }
            : {},
          files: batch,
        });
        fileOffset += batch.length;
        continue;
      }
      const response = await apiClient.post('/statements/upload-receipt', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
        },
      });
      onBatchCreated?.(fileOffset, readCreatedStatementIds(response?.data));
      fileOffset += batch.length;
    }

    onUploadSuccess(labels.uploadedProcessing);
    await refreshAfterCreate();
  } catch (error) {
    console.error('Failed to upload receipt scans:', error);
    throw new Error(extractUploadErrorMessage(error, labels.uploadFailed));
  }
};

export const uploadScanDrawerFiles = async ({
  payload,
  labels,
  onUploadSuccess,
  refreshAfterCreate,
  onBatchCreated,
}: UploadScanDrawerFilesParams): Promise<void> => {
  if (payload.files.length === 0) {
    throw new Error(labels.pickAtLeastOne);
  }

  const workspaceId = readOpenWorkspaceId();
  const capturedAt = Date.now();
  // Bounded by getDeviceLocation's timeout and usually settled by now.
  const deviceLocation = payload.deviceLocationRequest ? await payload.deviceLocationRequest : null;
  // A request exists only for a camera shot the user agreed to tag. Without a
  // good fix the shop is asked about once GPS comes back.
  const askForPlace =
    Boolean(payload.deviceLocationRequest) &&
    workspaceId !== null &&
    needsPlaceFollowup(deviceLocation);
  await uploadReceiptScanFiles({
    files: payload.files,
    deviceLocation,
    workspaceId,
    labels,
    onUploadSuccess,
    refreshAfterCreate,
    onBatchCreated: (fileOffset, statementIds) => {
      if (askForPlace && workspaceId) {
        enqueuePlaceFollowups(
          statementIds.map(statementId => ({ statementId, workspaceId, capturedAt })),
        );
      }
      onBatchCreated?.(fileOffset, statementIds);
    },
  });
};
