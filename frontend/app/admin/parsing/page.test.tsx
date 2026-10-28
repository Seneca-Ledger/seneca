// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParserHealth } from '@/app/lib/contracts';

const apiQueryDecoded = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: { role: 'admin' } as { role: string } | null }));

vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/app/lib/query-fn-schema', () => ({ apiQueryDecoded }));

import ParserHealthPage from './page';

const health: ParserHealth = {
  since: '2026-09-28T00:00:00.000Z',
  banks: [
    {
      bank: 'axis',
      statements: 12,
      needsReview: 3,
      errors: 1,
      declined: 2,
      reasons: [{ code: 'balance_chain', count: 3 }],
      layouts: [
        {
          fingerprint: 'bbbbbbbbbbbb',
          parser: 'AxisParser',
          headings: ['date:date | description:narration | debit:debit | credit:credit'],
          unknownWords: ['narration'],
          statements: 3,
          firstSeen: '2026-10-26T00:00:00.000Z',
          lastSeen: '2026-10-27T00:00:00.000Z',
          isNew: true,
        },
        {
          fingerprint: 'aaaaaaaaaaaa',
          parser: 'AxisParser',
          headings: ['date:date | description:particulars | debit:debit | credit:credit'],
          unknownWords: [],
          statements: 9,
          firstSeen: '2026-03-01T00:00:00.000Z',
          lastSeen: '2026-10-20T00:00:00.000Z',
          isNew: false,
        },
      ],
    },
  ],
};

describe('ParserHealthPage', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    apiQueryDecoded.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ParserHealthPage />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  };

  it("shows each bank's outcomes, why statements were held, and a new layout marked", async () => {
    auth.user = { role: 'admin' };
    apiQueryDecoded.mockResolvedValue(health);
    await render();

    expect(apiQueryDecoded).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/parsing/health', contract: 'ParserHealth' }),
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Axis Bank');
    expect(text).toContain('balance_chain · 3');
    expect(text).toContain('New layout');
    expect(text).toContain('description:narration');
    expect(text).toContain('Unknown words: narration');
    // Exactly one layout is marked new.
    expect(text.split('New layout')).toHaveLength(2);
  });

  it('asks nothing of the server for anyone but its administrator', async () => {
    auth.user = { role: 'user' };
    await render();

    expect(apiQueryDecoded).not.toHaveBeenCalled();
    expect(container.textContent).toContain('This page is for the server administrator only.');
  });
});
