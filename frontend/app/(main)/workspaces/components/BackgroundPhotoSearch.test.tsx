// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { BackgroundPhotoSearch } from './BackgroundPhotoSearch';

const getMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({
  default: { get: getMock },
  apiBaseUrl: '/api/v1',
}));

const PHOTO = {
  id: '52d321f0-11e6-425b-992f-08b021c3120b',
  title: 'Mountains Fjord',
  creator: 'Travel Adventures',
  license: 'cc0',
  attribution: '"Mountains Fjord" by Travel Adventures is marked with CC0 1.0.',
  sourceUrl: 'https://stocksnap.io/photo/mountains-fjord',
};

function page(results = [PHOTO], hasMore = false) {
  return { data: { results, page: 1, hasMore } };
}

describe('BackgroundPhotoSearch', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue(page());
  });

  it('runs the first suggestion on open, so the tab is never empty', async () => {
    renderWithQuery(<BackgroundPhotoSearch disabled={false} onPick={vi.fn()} />);

    expect(await screen.findByAltText('Mountains Fjord')).toBeTruthy();
    expect(getMock).toHaveBeenCalledWith('/workspaces/backgrounds/search', {
      params: { q: 'mountains', page: 1 },
    });
    // Thumbnails come through the API proxy, never straight from a third party.
    expect(screen.getByAltText('Mountains Fjord').getAttribute('src')).toBe(
      `/api/v1/workspaces/backgrounds/preview/${PHOTO.id}`,
    );
  });

  it('searches in English when a translated suggestion is tapped', async () => {
    renderWithQuery(<BackgroundPhotoSearch disabled={false} onPick={vi.fn()} />);
    await screen.findByAltText('Mountains Fjord');

    fireEvent.click(screen.getByText('Fjords'));

    await waitFor(() =>
      expect(getMock).toHaveBeenLastCalledWith('/workspaces/backgrounds/search', {
        params: { q: 'fjord', page: 1 },
      }),
    );
  });

  it('hands the picked photo id to the caller', async () => {
    const onPick = vi.fn();
    renderWithQuery(<BackgroundPhotoSearch disabled={false} onPick={onPick} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mountains Fjord' }));

    expect(onPick).toHaveBeenCalledWith(PHOTO.id);
  });

  it('appends the next page without repeating a photo', async () => {
    const second = { ...PHOTO, id: '11111111-2222-3333-4444-555555555555', title: 'Lake' };
    getMock
      .mockResolvedValueOnce(page([PHOTO], true))
      .mockResolvedValueOnce({ data: { results: [PHOTO, second], page: 2, hasMore: false } });
    renderWithQuery(<BackgroundPhotoSearch disabled={false} onPick={vi.fn()} />);

    fireEvent.click(await screen.findByText('Show more'));

    expect(await screen.findByAltText('Lake')).toBeTruthy();
    expect(screen.getAllByAltText('Mountains Fjord')).toHaveLength(1);
    expect(screen.queryByText('Show more')).toBeNull();
  });

  it('passes the server message through when the allowance is used up', async () => {
    getMock.mockRejectedValueOnce({
      response: { data: { error: { message: 'The image search allowance is used up for now' } } },
    });
    renderWithQuery(<BackgroundPhotoSearch disabled={false} onPick={vi.fn()} />);

    expect(await screen.findByText('The image search allowance is used up for now')).toBeTruthy();
  });
});
