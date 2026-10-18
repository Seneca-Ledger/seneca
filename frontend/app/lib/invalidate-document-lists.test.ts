import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

const client = new QueryClient();
vi.mock('./query-client', () => ({ getQueryClient: () => client }));

import {
  FINANCIAL_QUERY_ROOTS,
  invalidateDocumentLists,
  invalidateFinancialData,
  NON_FINANCIAL_QUERY_ROOTS,
} from './invalidate-document-lists';

/** Every first element of a key written in query-keys.ts. */
function queryKeyRoots(): string[] {
  const source = readFileSync(join(__dirname, 'query-keys.ts'), 'utf8');
  return [...new Set([...source.matchAll(/\['([a-z-]+)'/g)].map(match => match[1]))];
}

describe('invalidateFinancialData', () => {
  it('classifies every query root, so a new figure cannot miss the refresh', () => {
    const classified = new Set<string>([...FINANCIAL_QUERY_ROOTS, ...NON_FINANCIAL_QUERY_ROOTS]);
    const missing = queryKeyRoots().filter(root => !classified.has(root));

    expect(missing).toEqual([]);
    expect(FINANCIAL_QUERY_ROOTS.filter(root => NON_FINANCIAL_QUERY_ROOTS.includes(root as never))).toEqual(
      [],
    );
  });

  it('marks every figure built from documents stale, and leaves the rest alone', () => {
    for (const root of [...FINANCIAL_QUERY_ROOTS, ...NON_FINANCIAL_QUERY_ROOTS]) {
      client.setQueryData([root, 'ws-1'], { cached: true });
    }

    invalidateFinancialData();

    for (const root of FINANCIAL_QUERY_ROOTS) {
      expect(client.getQueryState([root, 'ws-1'])?.isInvalidated).toBe(true);
    }
    for (const root of NON_FINANCIAL_QUERY_ROOTS) {
      expect(client.getQueryState([root, 'ws-1'])?.isInvalidated).toBe(false);
    }
  });

  it('runs when a document changes, since documents are where the numbers come from', () => {
    client.clear();
    client.setQueryData(['dashboard', 'ws-1', 'month', '2026-10-01'], { cached: true });
    client.setQueryData(['reports', 'spend-flow', 'ws-1', {}], { cached: true });

    invalidateDocumentLists();

    expect(client.getQueryState(['dashboard', 'ws-1', 'month', '2026-10-01'])?.isInvalidated).toBe(
      true,
    );
    expect(client.getQueryState(['reports', 'spend-flow', 'ws-1', {}])?.isInvalidated).toBe(true);
  });
});
