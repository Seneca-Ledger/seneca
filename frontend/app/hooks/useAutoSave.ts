import { useEffect, useRef } from 'react';

type UseAutoSaveOptions<T> = {
  data: T;
  onSave: (data: T) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
  isEqual?: (a: T, b: T) => boolean;
};

// Shallow comparison for the common flat-form case; JSON.stringify on every
// render was measurable on the statement editor. Nested values fall back to
// reference equality, callers with deep shapes pass their own `isEqual`.
const defaultIsEqual = <T>(a: T, b: T): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every(key => Object.is(left[key], right[key]));
};

export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 500,
  enabled = true,
  isEqual = defaultIsEqual,
}: UseAutoSaveOptions<T>): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(data);
  const initializedRef = useRef(false);
  const wasEnabledRef = useRef(enabled);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      initializedRef.current = false;
      wasEnabledRef.current = false;
      return;
    }

    if (!(wasEnabledRef.current && initializedRef.current)) {
      lastSavedRef.current = data;
      initializedRef.current = true;
      wasEnabledRef.current = true;
      return;
    }

    if (isEqual(data, lastSavedRef.current)) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      await onSave(data);
      lastSavedRef.current = data;
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [data, debounceMs, enabled, isEqual, onSave]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}
