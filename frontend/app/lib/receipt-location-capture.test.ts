// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getReceiptLocationCapture,
  setReceiptLocationCapture,
  useReceiptLocationCapture,
} from './receipt-location-capture';

const STORAGE_KEY = 'seneca-receipt-location-capture';

describe('receipt location capture preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is undecided on a device that was never asked', () => {
    expect(getReceiptLocationCapture()).toBeNull();
  });

  it('remembers both answers on this device', () => {
    setReceiptLocationCapture(true);
    expect(getReceiptLocationCapture()).toBe('on');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('on');

    setReceiptLocationCapture(false);
    expect(getReceiptLocationCapture()).toBe('off');
  });

  it('treats an unknown stored value as undecided', () => {
    localStorage.setItem(STORAGE_KEY, 'maybe');

    expect(getReceiptLocationCapture()).toBeNull();
  });

  it('stays usable when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(getReceiptLocationCapture()).toBeNull();
    expect(() => setReceiptLocationCapture(true)).not.toThrow();
  });

  it('updates subscribers when the choice changes', () => {
    const { result } = renderHook(() => useReceiptLocationCapture());
    expect(result.current).toBeNull();

    act(() => {
      setReceiptLocationCapture(false);
    });

    expect(result.current).toBe('off');
  });
});
