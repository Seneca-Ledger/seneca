// @vitest-environment jsdom
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { useViewPreference } from './useViewPreference';

const apiGet = vi.hoisted(() => vi.fn());
const apiPut = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet, put: apiPut } }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));

let saved: ((next: Record<string, unknown>) => void) | null = null;

function Probe(): React.JSX.Element {
  const { state, save } = useViewPreference<{ owner?: string | null }>('transactions');
  saved = save;
  return <output data-testid="state">{state === undefined ? 'loading' : JSON.stringify(state)}</output>;
}

describe('useViewPreference', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPut.mockReset();
    apiPut.mockResolvedValue({ data: {} });
    saved = null;
  });

  it('reports "not loaded yet" apart from "nothing saved"', async () => {
    // The page must be able to tell the two apart, or it would overwrite a
    // saved filter with its defaults on the first render.
    apiGet.mockReturnValue(new Promise(() => undefined));
    const { getByTestId } = renderWithQuery(<Probe />);
    expect(getByTestId('state').textContent).toBe('loading');
  });

  it('gives back what the server remembered', async () => {
    apiGet.mockResolvedValue({ data: { state: { owner: 'me' } } });
    const { getByTestId } = renderWithQuery(<Probe />);
    await waitFor(() => expect(getByTestId('state').textContent).toBe('{"owner":"me"}'));
  });

  it('says null when nothing was ever saved', async () => {
    apiGet.mockResolvedValue({ data: { state: null } });
    const { getByTestId } = renderWithQuery(<Probe />);
    await waitFor(() => expect(getByTestId('state').textContent).toBe('null'));
  });

  it('shows the new value without waiting for the round trip', async () => {
    apiGet.mockResolvedValue({ data: { state: null } });
    const { getByTestId } = renderWithQuery(<Probe />);
    await waitFor(() => expect(getByTestId('state').textContent).toBe('null'));

    // Never resolves: the new value has to show before the server answers.
    apiPut.mockReturnValue(new Promise(() => undefined));

    saved?.({ owner: 'shared' });

    await waitFor(() => expect(getByTestId('state').textContent).toBe('{"owner":"shared"}'));
    expect(apiPut).toHaveBeenCalledWith('/view-preferences/transactions', {
      state: { owner: 'shared' },
    });
  });

  it('does not blow up when the save fails', async () => {
    apiGet.mockResolvedValue({ data: { state: null } });
    apiPut.mockRejectedValue(new Error('offline'));
    const { getByTestId } = renderWithQuery(<Probe />);
    await waitFor(() => expect(getByTestId('state').textContent).toBe('null'));

    // A preference that failed to stick is not worth an error to the user.
    expect(() => saved?.({ owner: 'me' })).not.toThrow();
    await waitFor(() => expect(getByTestId('state').textContent).toBe('{"owner":"me"}'));
  });
});
