'use client';

import { useEffect, useRef } from 'react';
import { createKeybindingsHandler } from 'tinykeys';

type KeyBindingMap = Record<string, (event: KeyboardEvent) => void>;

function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function useKeyboardShortcuts(
  bindings: KeyBindingMap,
  enabled = true,
  options?: { allowInEditable?: string[] },
): void {
  const bindingsRef = useRef(bindings);
  useEffect(() => {
    bindingsRef.current = bindings;
  });
  const allowInEditableRef = useRef(options?.allowInEditable);
  useEffect(() => {
    allowInEditableRef.current = options?.allowInEditable;
  });

  useEffect(() => {
    if (!enabled) return;

    // The guard sits in front of tinykeys, not behind each handler: chord
    // bookkeeping ('g' then 'd') advances on every keypress, so typing into a
    // field would otherwise prime a sequence that fires once focus moves away.
    const editable: KeyBindingMap = {};
    const guarded: KeyBindingMap = {};
    for (const key of Object.keys(bindingsRef.current)) {
      const handler = (event: KeyboardEvent): void => {
        bindingsRef.current[key]?.(event);
      };
      if (allowInEditableRef.current?.includes(key)) {
        editable[key] = handler;
      } else {
        guarded[key] = handler;
      }
    }

    const handleGuarded = createKeybindingsHandler(guarded);
    const handleEditable = createKeybindingsHandler(editable);
    const listener = (event: KeyboardEvent): void => {
      handleEditable(event);
      if (!isEditableTarget(event)) {
        handleGuarded(event);
      }
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [enabled]);
}
