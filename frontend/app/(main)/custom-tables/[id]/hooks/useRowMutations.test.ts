import { act, renderHook } from '@testing-library/react';
import { AxiosError, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomTableGridRow } from '../utils/types';

const patch = vi.fn();
const toastError = vi.fn();
const invalidateDocumentLists = vi.fn();

vi.mock('@/app/lib/invalidate-document-lists', () => ({
  invalidateDocumentLists: () => invalidateDocumentLists(),
}));

vi.mock('@/app/lib/api', () => ({
  default: { patch: (...args: unknown[]) => patch(...args), post: vi.fn() },
}));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    error: (...args: unknown[]) => toastError(...args),
    loading: vi.fn(),
    success: vi.fn(),
  }),
}));

import { useRowMutations } from './useRowMutations';

const ROW: CustomTableGridRow = {
  id: 'row-1',
  rowNumber: 1,
  data: { c_amount: -650, c_type: 'expense', c_note: '' },
  sourceKey: 'tx-1',
};

const messages = {
  addRowLoading: 'Adding',
  addRowSuccess: 'Added',
  addRowFailed: 'Add failed',
  cellSaveFailed: "Couldn't save the change",
};

const setup = (row: CustomTableGridRow = ROW) => {
  let rows = [row];
  const setRows = vi.fn((update: CustomTableGridRow[] | ((prev: CustomTableGridRow[]) => CustomTableGridRow[])) => {
    rows = typeof update === 'function' ? update(rows) : update;
  });
  const onRowsChanged = vi.fn();
  const { result } = renderHook(() =>
    useRowMutations({
      tableId: 'table-1',
      columns: [],
      rows,
      setRows,
      onRowsChanged,
      messages,
    }),
  );
  return { result, setRows, onRowsChanged, rows: () => rows };
};

/** A refusal the way axios surfaces the backend's error envelope. */
const refusal = (code: string, message: string) =>
  new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 400,
    data: { success: false, error: { code, message } },
  } as AxiosResponse);

describe('useRowMutations.updateCell', () => {
  beforeEach(() => {
    patch.mockReset();
    toastError.mockReset();
    invalidateDocumentLists.mockReset();
  });

  it('refreshes the document lists after a change reached an app record', async () => {
    patch.mockResolvedValue({
      data: { id: 'row-1', rowNumber: 1, data: { c_note: 'x' }, sourceKey: 'tx-1' },
    });
    const s = setup();
    await act(() => s.result.current.updateCell('row-1', 'c_note', 'x'));
    expect(invalidateDocumentLists).toHaveBeenCalledTimes(1);
  });

  it('leaves the document lists alone for a row added by hand', async () => {
    patch.mockResolvedValue({
      data: { id: 'row-1', rowNumber: 1, data: { c_note: 'x' }, sourceKey: null },
    });
    const s = setup({ ...ROW, sourceKey: null });
    await act(() => s.result.current.updateCell('row-1', 'c_note', 'x'));
    expect(invalidateDocumentLists).not.toHaveBeenCalled();
  });

  it("takes every value of the server's reply: a new type also flips the amount", async () => {
    patch.mockResolvedValue({
      data: {
        id: 'row-1',
        rowNumber: 1,
        data: { c_amount: 650, c_type: 'income', c_note: '' },
        sourceKey: 'tx-1',
      },
    });
    const s = setup();
    await act(() => s.result.current.updateCell('row-1', 'c_type', 'income'));
    expect(patch).toHaveBeenCalledWith('/custom-tables/table-1/rows/row-1', {
      data: { c_type: 'income' },
    });
    expect(s.rows()[0].data).toEqual({ c_amount: 650, c_type: 'income', c_note: '' });
    expect(s.onRowsChanged).toHaveBeenCalledTimes(1);
  });

  it('on the app refusing the edit keeps the row as it was and says why', async () => {
    patch.mockRejectedValue(refusal('SOURCE_FIELD_READ_ONLY', 'This value comes from the app'));
    const s = setup();
    await act(() => s.result.current.updateCell('row-1', 'c_type', 'income'));
    expect(s.setRows).not.toHaveBeenCalled();
    expect(s.rows()[0]).toBe(ROW);
    expect(s.onRowsChanged).not.toHaveBeenCalled();
    expect(invalidateDocumentLists).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError.mock.calls[0][0]).toEqual(expect.any(String));
    expect(toastError.mock.calls[0][0]).not.toBe('');
  });

  it('falls back to its own message when the error carries none', async () => {
    patch.mockRejectedValue('network down');
    const s = setup();
    await act(() => s.result.current.updateCell('row-1', 'c_note', 'x'));
    expect(toastError).toHaveBeenCalledWith("Couldn't save the change");
    expect(s.setRows).not.toHaveBeenCalled();
  });
});
