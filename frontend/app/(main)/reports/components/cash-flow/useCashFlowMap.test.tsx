// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { useCashFlowMap } from './useCashFlowMap';

const apiGet = vi.hoisted(() => vi.fn());
const apiPut = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet, put: apiPut } }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => search.params }));

let hook: ReturnType<typeof useCashFlowMap> | null = null;

function Probe(): React.JSX.Element {
  hook = useCashFlowMap();
  return <output data-testid="include">{String(hook.filters.includeTransfers)}</output>;
}

/** Answers the saved view; the cash-flow request itself never resolves. */
function serve(savedView: Record<string, unknown> | null): void {
  apiGet.mockImplementation((url: string) =>
    url === '/view-preferences/reports'
      ? Promise.resolve({ data: { state: savedView } })
      : new Promise(() => undefined),
  );
}

describe('useCashFlowMap: include transfers', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPut.mockReset();
    apiPut.mockResolvedValue({ data: {} });
    hook = null;
  });

  it('is on when nothing was saved', async () => {
    serve(null);
    const { getByTestId } = renderWithQuery(<Probe />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/view-preferences/reports', expect.anything()));
    expect(getByTestId('include').textContent).toBe('true');
  });

  it('comes back off when this person turned it off', async () => {
    serve({ includeTransfers: false });
    const { getByTestId } = renderWithQuery(<Probe />);
    await waitFor(() => expect(getByTestId('include').textContent).toBe('false'));
  });

  it('saves the switch to the server, and only the switch', async () => {
    serve(null);
    const { getByTestId } = renderWithQuery(<Probe />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/view-preferences/reports', expect.anything()));

    act(() => hook?.update({ includeTransfers: false }));
    await waitFor(() => expect(getByTestId('include').textContent).toBe('false'));
    expect(apiPut).toHaveBeenCalledWith('/view-preferences/reports', {
      state: { includeTransfers: false, netRefunds: false },
    });

    apiPut.mockClear();
    act(() => hook?.update({ compare: false }));
    expect(apiPut).not.toHaveBeenCalled();
    expect(hook?.filters.compare).toBe(false);
  });
});

describe('useCashFlowMap: refunds and the comparison window', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPut.mockReset();
    apiPut.mockResolvedValue({ data: {} });
    hook = null;
  });

  const lastMapParams = (): Record<string, unknown> =>
    apiGet.mock.calls.filter(([url]) => url === '/reports/cash-flow-map').at(-1)?.[1]?.params;

  it('counts refunds as income until this person asks to net them, and remembers that', async () => {
    serve(null);
    renderWithQuery(<Probe />);
    await waitFor(() => expect(lastMapParams()).toBeDefined());
    expect(hook?.filters.netRefunds).toBe(false);
    expect(lastMapParams()).not.toHaveProperty('netRefunds');

    act(() => hook?.update({ netRefunds: true }));
    await waitFor(() => expect(lastMapParams()).toMatchObject({ netRefunds: true }));
    expect(apiPut).toHaveBeenCalledWith('/view-preferences/reports', {
      state: { includeTransfers: true, netRefunds: true },
    });
  });

  it('comes back netting refunds when that was saved', async () => {
    serve({ netRefunds: true });
    renderWithQuery(<Probe />);
    await waitFor(() => expect(hook?.filters.netRefunds).toBe(true));
  });

  it('asks for last year only while comparing', async () => {
    serve(null);
    renderWithQuery(<Probe />);
    await waitFor(() => expect(lastMapParams()).toBeDefined());
    expect(lastMapParams()).not.toHaveProperty('compareTo');

    act(() => hook?.update({ compareTo: 'year' }));
    await waitFor(() => expect(lastMapParams()).toMatchObject({ compare: true, compareTo: 'year' }));

    act(() => hook?.update({ compare: false }));
    await waitFor(() => expect(lastMapParams()).not.toHaveProperty('compare'));
    expect(lastMapParams()).not.toHaveProperty('compareTo');
  });
});

describe('useCashFlowMap: the period a link names', () => {
  beforeEach(() => {
    apiGet.mockReset();
    serve(null);
    hook = null;
  });

  it('opens on `?from=&to=` when both are days in order', () => {
    search.params = new URLSearchParams('tab=cash-flow&from=2026-09-01&to=2026-09-30');
    renderWithQuery(<Probe />);
    expect(hook?.filters.from).toBe('2026-09-01');
    expect(hook?.filters.to).toBe('2026-09-30');
  });

  it('falls back to the first preset on a malformed or reversed period', () => {
    search.params = new URLSearchParams('from=2026-09-30&to=2026-09-01');
    renderWithQuery(<Probe />);
    expect(hook?.filters.from).not.toBe('2026-09-30');
    search.params = new URLSearchParams();
  });
});
