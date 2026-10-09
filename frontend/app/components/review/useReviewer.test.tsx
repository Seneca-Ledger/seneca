// @vitest-environment jsdom
import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { useDefaultReviewer } from './useReviewer';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet } }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));

function Probe(): React.JSX.Element {
  return <output data-testid="reviewer">{useDefaultReviewer()}</output>;
}

const member = (id: string) => ({ id, memberId: `m-${id}`, name: id });

describe('useDefaultReviewer', () => {
  it('shows the whole workspace when there is only one person', async () => {
    apiGet.mockResolvedValue({ data: { members: [member('solo')] } });

    const { getByTestId } = renderWithQuery(<Probe />);

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(getByTestId('reviewer').textContent).toBe('anyone');
  });

  it('defaults to my own backlog in a household', async () => {
    // Otherwise the badge counts the other person's rows and sends you to a
    // queue that will not show them.
    apiGet.mockResolvedValue({ data: { members: [member('me'), member('partner')] } });

    const { getByTestId } = renderWithQuery(<Probe />);

    await waitFor(() => expect(getByTestId('reviewer').textContent).toBe('me'));
  });

  it('falls back to the whole workspace while the members are still loading', () => {
    apiGet.mockReturnValue(new Promise(() => undefined));

    const { getByTestId } = renderWithQuery(<Probe />);

    expect(getByTestId('reviewer').textContent).toBe('anyone');
  });
});
