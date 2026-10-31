// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemThumb } from './ItemThumb';

const { image, kind } = vi.hoisted(() => ({
  image: { current: null as null | { subjectId: string; url: string; label: string | null } },
  kind: { current: null as string | null },
}));
vi.mock('./useItemImage', () => ({
  useItemVisual: () => ({ data: { image: image.current, vendor: null, kind: kind.current } }),
  itemImageSrc: (stored: { url: string }) => `http://api.example.com${stored.url}`,
}));
vi.mock('next/dynamic', () => ({
  default: () => (props: { name: string }) => <div data-testid="picker">{props.name}</div>,
}));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({ findPicture: { value: 'Find a picture' }, title: { value: 'Picture' } }),
}));

const ID = '11111111-1111-4111-8111-111111111111';

describe('ItemThumb', () => {
  beforeEach(() => {
    image.current = null;
    kind.current = null;
  });

  it('draws the kind of thing until a picture is picked', () => {
    kind.current = 'desktop';
    render(<ItemThumb subject="transaction" id={ID} name="Sold Mac Mini M4" />);

    const thumb = screen.getByTestId(`item-thumb-${ID}`);
    expect(thumb.querySelector('img')).toBeNull();
    expect(thumb.querySelector('svg')).not.toBeNull();
    expect(thumb).toHaveAccessibleName('Find a picture');
  });

  it('falls back to the first letter', () => {
    render(<ItemThumb subject="transaction" id={ID} name="example thing" />);

    expect(screen.getByTestId(`item-thumb-${ID}`)).toHaveTextContent('E');
  });

  it('shows the stored picture', () => {
    image.current = { subjectId: ID, url: '/uploads/item-images/a.png', label: 'Example Mini' };
    render(<ItemThumb subject="transaction" id={ID} name="Sold Example Mini" />);

    const img = screen.getByTestId(`item-thumb-${ID}`).querySelector('img');
    expect(img?.getAttribute('src')).toMatch(/\/uploads\/item-images\/a\.png$/);
  });

  it('opens the search, and nothing in it opens the row', () => {
    const openRow = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: stands in for a clickable row
      // biome-ignore lint/a11y/useKeyWithClickEvents: stands in for a clickable row
      <div onClick={openRow}>
        <ItemThumb subject="payable" id={ID} name="Sold Example Mini" />
      </div>,
    );

    fireEvent.click(screen.getByTestId(`item-thumb-${ID}`));

    expect(screen.getByTestId('picker')).toHaveTextContent('Sold Example Mini');
    fireEvent.click(screen.getByTestId('picker'));
    expect(openRow).not.toHaveBeenCalled();
  });
});
