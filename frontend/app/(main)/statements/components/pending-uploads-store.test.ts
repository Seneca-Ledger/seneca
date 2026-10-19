// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addPendingUploads,
  removePendingUploads,
  resolvePendingUploads,
  usePendingUploads,
} from './pending-uploads-store';

const readUploads = () => renderHook(() => usePendingUploads());

describe('pending-uploads-store', () => {
  afterEach(() => {
    const { result, unmount } = readUploads();
    act(() => removePendingUploads(result.current.map(upload => upload.key)));
    unmount();
  });

  it('registers one unresolved upload per file and returns the keys in file order', () => {
    const { result } = readUploads();
    let keys: string[] = [];
    act(() => {
      keys = addPendingUploads('ws-1', 3);
    });

    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
    expect(result.current).toEqual(
      keys.map(key => ({ key, workspaceId: 'ws-1', statementId: null })),
    );
  });

  it('pairs keys with created statement ids by index and leaves the rest unresolved', () => {
    const { result } = readUploads();
    let keys: string[] = [];
    act(() => {
      keys = addPendingUploads('ws-1', 3);
    });
    act(() => resolvePendingUploads(keys.slice(0, 2), ['stmt-a', 'stmt-b']));

    expect(result.current.map(upload => upload.statementId)).toEqual(['stmt-a', 'stmt-b', null]);
  });

  it('removes only the given keys and keeps the snapshot when nothing matches', () => {
    const { result } = readUploads();
    let keys: string[] = [];
    act(() => {
      keys = addPendingUploads('ws-1', 2);
    });
    const before = result.current;

    act(() => removePendingUploads(['unknown']));
    expect(result.current).toBe(before);

    act(() => removePendingUploads([keys[0]]));
    expect(result.current.map(upload => upload.key)).toEqual([keys[1]]);
  });

  it('keeps uploads of different workspaces apart', () => {
    const { result } = readUploads();
    act(() => {
      addPendingUploads('ws-1', 1);
      addPendingUploads('ws-2', 2);
    });

    expect(result.current.filter(upload => upload.workspaceId === 'ws-2')).toHaveLength(2);
    expect(result.current.filter(upload => upload.workspaceId === 'ws-1')).toHaveLength(1);
  });
});
