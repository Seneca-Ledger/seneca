// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addPendingUploads,
  removePendingUploads,
  resolvePendingUploads,
  usePendingUploads,
} from '../pending-uploads-store';
import { useUploadSkeletonKeys } from './useUploadSkeletonKeys';

type Props = Parameters<typeof useUploadSkeletonKeys>[0];

const base: Props = {
  workspaceId: 'ws-1',
  receiptRows: [],
  statements: [],
  limit: 30,
};

const renderKeys = (props: Props = base) =>
  renderHook((current: Props) => useUploadSkeletonKeys(current), { initialProps: props });

const upload = (count: number, workspaceId = 'ws-1'): string[] => {
  let keys: string[] = [];
  act(() => {
    keys = addPendingUploads(workspaceId, count);
  });
  return keys;
};

describe('useUploadSkeletonKeys', () => {
  afterEach(() => {
    const { result, unmount } = renderHook(() => usePendingUploads());
    act(() => removePendingUploads(result.current.map(pending => pending.key)));
    unmount();
  });

  it('shows one placeholder per uploaded file as soon as the upload starts', () => {
    const { result } = renderKeys();
    const keys = upload(3);

    expect(result.current).toEqual(keys);
  });

  it('keeps the placeholders when the list already holds other receipts', () => {
    const { result } = renderKeys({ ...base, receiptRows: [{ statementId: 'older-stmt' }] });
    const keys = upload(2);

    expect(result.current).toEqual(keys);
  });

  it('holds a created upload until its receipt row arrives and swaps in the same render', () => {
    const { result, rerender } = renderKeys();
    const keys = upload(2);
    act(() => resolvePendingUploads(keys, ['stmt-1', 'stmt-2']));

    expect(result.current).toEqual(keys);

    rerender({ ...base, receiptRows: [{ statementId: 'stmt-1' }] });
    expect(result.current).toEqual([keys[1]]);
  });

  it('does not treat the scan statement in the statements list as the row', () => {
    const { result, rerender } = renderKeys();
    const keys = upload(1);
    act(() => resolvePendingUploads(keys, ['stmt-1']));

    rerender({
      ...base,
      statements: [{ id: 'stmt-1', parsingDetails: { detectedBy: 'receipt-scan' } }],
    });

    expect(result.current).toEqual(keys);
  });

  it('clears on a regular statement row with the created id', () => {
    const { result, rerender } = renderKeys();
    const keys = upload(1);
    act(() => resolvePendingUploads(keys, ['stmt-1']));

    rerender({ ...base, statements: [{ id: 'stmt-1' }] });

    expect(result.current).toEqual([]);
  });

  it('drops a matched upload from the store so a later refetch cannot bring it back', () => {
    const store = renderHook(() => usePendingUploads());
    const { rerender } = renderKeys();
    const keys = upload(1);
    act(() => resolvePendingUploads(keys, ['stmt-1']));

    rerender({ ...base, receiptRows: [{ statementId: 'stmt-1' }] });

    expect(store.result.current).toEqual([]);
  });

  it('shows nothing for another workspace', () => {
    upload(2, 'ws-2');
    const { result } = renderKeys();
    expect(result.current).toEqual([]);
  });

  it('never shows more placeholders than fit on a page', () => {
    const { result } = renderKeys({ ...base, limit: 2 });
    upload(5);

    expect(result.current).toHaveLength(2);
  });
});
