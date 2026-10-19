import type React from 'react';

/**
 * Mirrors react-intlayer's renderIntlayerNode: a Proxy over a rendered
 * Fragment whose `.value` is intercepted to return the plain string, so the
 * mock is usable both as a JSX child and via `.value` string access.
 */
export const value = (v: string): React.ReactElement =>
  // biome-ignore lint/complexity/noUselessFragments: Proxy needs an object target — a bare string can't be proxied
  new Proxy(<>{v}</>, {
    get(target, prop, receiver) {
      if (prop === 'value') {
        return v;
      }
      return Reflect.get(target, prop, receiver);
    },
  });

/**
 * A dictionary that resolves any (nested) key to its own path, e.g.
 * `t.checklist.cashReconciled.value === 'checklist.cashReconciled'`.
 * Explicit `overrides` win, so tests can pin the strings they assert on.
 */
export function autoDictionary(overrides: Record<string, unknown> = {}, path = ''): unknown {
  // biome-ignore lint/complexity/noUselessFragments: Proxy needs an object target
  return new Proxy(<>{path}</>, {
    get(target, prop, receiver) {
      if (prop === 'value') {
        return path;
      }
      if (typeof prop !== 'string' || prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      if (!path && prop in overrides) {
        return overrides[prop];
      }
      return autoDictionary({}, path ? `${path}.${prop}` : prop);
    },
  });
}
