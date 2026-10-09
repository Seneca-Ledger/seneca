'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Command } from './command-registry';
import { keyLabel } from './shortcut-display';

/** Matches tinykeys' own sequence timeout, so a chord feels the same everywhere. */
const SEQUENCE_TIMEOUT_MS = 1000;
const MODIFIER_ORDER = ['Alt', 'Control', 'Meta', 'Shift'];

/** 'Alt+Shift+KeyT' -> 'Alt+Shift+KeyT' with the modifiers in a fixed order. */
function normalizePress(spec: string): string {
  const parts = spec.split('+');
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1).map(mod => (mod === 'Ctrl' ? 'Control' : mod));
  return [...MODIFIER_ORDER.filter(mod => mods.includes(mod)), key].join('+');
}

/** Keyed on `code`, so Shift's `?` and a Cyrillic `ф` still match their key. */
function eventPress(event: React.KeyboardEvent): string {
  const mods: string[] = [];
  if (event.altKey) {
    mods.push('Alt');
  }
  if (event.ctrlKey) {
    mods.push('Control');
  }
  if (event.metaKey) {
    mods.push('Meta');
  }
  if (event.shiftKey) {
    mods.push('Shift');
  }
  return [...mods, event.code].join('+');
}

function indexBindings(commands: Command[]): {
  exact: Map<string, Command>;
  sequences: Map<string, Command>;
  prefixes: Set<string>;
} {
  const exact = new Map<string, Command>();
  const sequences = new Map<string, Command>();
  const prefixes = new Set<string>();
  for (const command of commands) {
    if (!command.binding) {
      continue;
    }
    const presses = command.binding.trim().split(/\s+/).map(normalizePress);
    if (presses.length === 1) {
      exact.set(presses[0], command);
    } else {
      prefixes.add(presses[0]);
      sequences.set(presses.join(' '), command);
    }
  }
  return { exact, sequences, prefixes };
}

/**
 * The shortcuts the palette advertises also fire inside it, but only while the
 * field is empty — once there is a query, every key belongs to the search.
 *
 * A chord's first press is swallowed so it never lands in the field. If the
 * second press does not complete a chord (typing "go" to find Goals), both
 * characters are handed back, so nothing is silently eaten.
 */
export function usePaletteShortcuts({
  commands,
  inputEmpty,
  onRun,
  onFlush,
}: {
  commands: Command[];
  inputEmpty: boolean;
  onRun: (command: Command) => void;
  onFlush: (typed: string) => void;
}): { onKeyDown: (event: React.KeyboardEvent) => boolean; pending: string } {
  const [pending, setPending] = useState('');
  const pendingRef = useRef<{ press: string; typed: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    setPending('');
  }, []);

  useEffect(() => clearPending, [clearPending]);

  const { exact, sequences, prefixes } = useMemo(() => indexBindings(commands), [commands]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent): boolean => {
      const waiting = pendingRef.current;
      if (!(inputEmpty || waiting)) {
        return false;
      }
      // Bare modifiers and navigation keys belong to the cursor, not here.
      if (event.key.length !== 1) {
        return false;
      }

      const press = eventPress(event);

      if (waiting) {
        const command = sequences.get(`${waiting.press} ${press}`);
        clearPending();
        event.preventDefault();
        if (command) {
          onRun(command);
        } else {
          onFlush(waiting.typed + event.key);
        }
        return true;
      }

      const command = exact.get(press);
      if (command) {
        event.preventDefault();
        onRun(command);
        return true;
      }

      if (prefixes.has(press)) {
        event.preventDefault();
        pendingRef.current = { press, typed: event.key };
        setPending(keyLabel(press, false));
        timerRef.current = setTimeout(() => {
          const stale = pendingRef.current;
          clearPending();
          if (stale) {
            onFlush(stale.typed);
          }
        }, SEQUENCE_TIMEOUT_MS);
        return true;
      }

      return false;
    },
    [exact, sequences, prefixes, inputEmpty, onRun, onFlush, clearPending],
  );

  return { onKeyDown, pending };
}
