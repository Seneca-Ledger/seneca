/**
 * Thin wrapper around getNestedValue + resolveLabel for reading Intlayer
 * translation trees in a single call.
 *
 * Usage:
 *   const t = useIntlayer('myPage');
 *   const tx = makeTx(t);
 *   const label = tx(['section', 'title']);
 */

import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';

/**
 * Creates a scoped translator bound to a translation root object.
 * Returns a `tx` function that traverses the root by a dot-segment path array
 * and resolves the Intlayer node to a plain string.
 */
export const makeTx =
  (root: unknown) =>
  (path: string[]): string =>
    resolveLabel(getNestedValue(root, path));

export { getNestedValue, resolveLabel };
