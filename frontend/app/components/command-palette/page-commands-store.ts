'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { openCommandPalette } from './command-palette-store';
import type { Command } from './command-registry';

/**
 * Commands a page lends the palette while it is mounted (the Documents list's
 * selection actions), and the one-off pickers those commands open. Lives outside
 * React like the palette's open state, so a page shortcut can open a picker with
 * a plain function call.
 */
export interface PageCommands {
  /** Section heading, already localized — e.g. "3 selected". */
  title: string;
  commands: Command[];
}

export interface PickerItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Short trailing note, e.g. how many documents carry this category. */
  hint?: string;
}

export interface PalettePicker {
  /** Changes per open, so the palette starts the picker with an empty field. */
  id: string;
  placeholder: string;
  items: PickerItem[];
  onPick: (itemId: string) => void;
}

interface State {
  page: PageCommands | null;
  picker: PalettePicker | null;
}

let state: State = { page: null, picker: null };
const listeners = new Set<() => void>();

function emit(next: Partial<State>): void {
  state = { ...state, ...next };
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

const serverState: State = { page: null, picker: null };

export function usePaletteExtras(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

/**
 * Registers the page's commands for as long as the caller stays mounted.
 *
 * The palette hears about a change only when what it shows changes (heading,
 * rows, keys). Each row runs the caller's latest handler, so the page can hand
 * in fresh closures every render without republishing — a subscriber that
 * renders with the page would otherwise loop.
 */
export function usePageCommands(page: PageCommands | null): void {
  const latest = useRef(page);
  useEffect(() => {
    latest.current = page;
  });
  const signature = page
    ? JSON.stringify([
        page.title,
        page.commands.map(command => [command.id, command.label, command.binding, command.hint]),
      ])
    : '';
  // biome-ignore lint/correctness/useExhaustiveDependencies: signature is the trigger
  useEffect(() => {
    const current = latest.current;
    emit({
      page: current && {
        title: current.title,
        commands: current.commands.map(command => ({
          ...command,
          run: () => latest.current?.commands.find(item => item.id === command.id)?.run(),
        })),
      },
    });
  }, [signature]);
  useEffect(() => () => emit({ page: null }), []);
}

/** Opens the palette straight onto a list to choose from. */
export function openPalettePicker(picker: PalettePicker): void {
  emit({ picker });
  openCommandPalette();
}

/** The palette drops the picker once it closes, so the next open is the usual list. */
export function clearPalettePicker(): void {
  if (state.picker) {
    emit({ picker: null });
  }
}
