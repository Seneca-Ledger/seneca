'use client';

import { useSyncExternalStore } from 'react';

export type PendingUpload = {
  key: string;
  workspaceId: string | null;
  /** Null while the file is still on its way; the created statement id afterwards. */
  statementId: string | null;
};

const NO_UPLOADS: PendingUpload[] = [];

/**
 * Uploads live outside React: the request keeps running after the drawer closes,
 * the user leaves the list, or the page remounts on a workspace switch, and the
 * placeholder rows have to be there again when the list comes back.
 */
let uploads: PendingUpload[] = NO_UPLOADS;
const listeners = new Set<() => void>();

function emit(next: PendingUpload[]): void {
  uploads = next;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PendingUpload[] {
  return uploads;
}

function getServerSnapshot(): PendingUpload[] {
  return NO_UPLOADS;
}

let sequence = 0;

/** Registers one placeholder per file and returns their keys in file order. */
export function addPendingUploads(workspaceId: string | null, count: number): string[] {
  const added = Array.from({ length: count }, () => {
    sequence += 1;
    return { key: `upload-${Date.now()}-${sequence}`, workspaceId, statementId: null };
  });
  if (added.length > 0) {
    emit([...added, ...uploads]);
  }
  return added.map(upload => upload.key);
}

/** Pairs keys with the statement ids the backend created for the same files, by index. */
export function resolvePendingUploads(keys: string[], statementIds: string[]): void {
  const idByKey = new Map<string, string>();
  keys.forEach((key, index) => {
    const statementId = statementIds[index];
    if (statementId) {
      idByKey.set(key, statementId);
    }
  });
  if (idByKey.size === 0) {
    return;
  }
  emit(
    uploads.map(upload => {
      const statementId = idByKey.get(upload.key);
      return statementId ? { ...upload, statementId } : upload;
    }),
  );
}

export function removePendingUploads(keys: string[]): void {
  const removed = new Set(keys);
  const next = uploads.filter(upload => !removed.has(upload.key));
  if (next.length !== uploads.length) {
    emit(next.length > 0 ? next : NO_UPLOADS);
  }
}

/** Every pending upload across workspaces; filter by workspace at the call site. */
export function usePendingUploads(): PendingUpload[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
