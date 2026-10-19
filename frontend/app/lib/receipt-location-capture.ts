'use client';

/**
 * Whether receipts photographed on this device get the device's position.
 * Stored per device on purpose: the browser's location permission is granted
 * per device too, so each phone is asked once. No value means the user has not
 * decided yet and sees the consent screen before the first camera shot.
 */
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'seneca-receipt-location-capture';

export const RECEIPT_LOCATION_CAPTURE_EVENT = 'seneca-receipt-location-capture-change';

export type ReceiptLocationCaptureChoice = 'on' | 'off' | null;

export function getReceiptLocationCapture(): ReceiptLocationCaptureChoice {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'on' || value === 'off' ? value : null;
  } catch {
    return null;
  }
}

export function setReceiptLocationCapture(on: boolean): void {
  const value = on ? 'on' : 'off';
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage may be unavailable (private mode); the screen will simply ask again.
  }
  window.dispatchEvent(
    new CustomEvent(RECEIPT_LOCATION_CAPTURE_EVENT, { detail: { choice: value } }),
  );
}

/** Reads the choice after mount and follows changes from this tab or another one. */
export function useReceiptLocationCapture(): ReceiptLocationCaptureChoice {
  const [choice, setChoice] = useState<ReceiptLocationCaptureChoice>(null);

  useEffect(() => {
    const sync = (): void => {
      setChoice(getReceiptLocationCapture());
    };
    sync();
    window.addEventListener(RECEIPT_LOCATION_CAPTURE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(RECEIPT_LOCATION_CAPTURE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return choice;
}
