import { TextDecoder } from 'node:util';
import React from 'react';
import { vi } from 'vitest';

class TestTextEncoder {
  encode(input = ''): Uint8Array {
    return new Uint8Array(Buffer.from(input));
  }
}

Object.defineProperty(globalThis, 'TextEncoder', {
  configurable: true,
  writable: true,
  value: TestTextEncoder,
});

Object.defineProperty(globalThis, 'TextDecoder', {
  configurable: true,
  writable: true,
  value: TextDecoder,
});

// Node 26 объявляет собственный глобальный localStorage, который без флага
// --localstorage-file остаётся undefined и перекрывает реализацию jsdom
// (в vitest window === globalThis). Подменяем минимальным in-memory Storage.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.store.get(String(key)) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value));
  }

  removeItem(key: string): void {
    this.store.delete(String(key));
  }

  clear(): void {
    this.store.clear();
  }

  [name: string]: unknown;
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (globalThis[name] === undefined) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: new MemoryStorage(),
    });
  }
}

vi.mock('next/image', () => ({
  default: (props: { alt?: string; unoptimized?: boolean } & Record<string, unknown>) => {
    const { alt = '', unoptimized: Unoptimized, ...rest } = props;
    return React.createElement('img', { alt, ...rest });
  },
}));

// checkContract loads the contract schemas with a dynamic import. Loading the
// module once here keeps that import within the single flush most page tests
// wait for after a render.
await import('@/app/lib/contract-check');
