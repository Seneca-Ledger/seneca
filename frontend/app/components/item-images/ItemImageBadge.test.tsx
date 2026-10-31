// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemImageBadge } from './ItemImageBadge';

const { image, vendor } = vi.hoisted(() => ({
  image: { current: null as null | { subjectId: string; url: string; label: string | null } },
  vendor: { current: null as null | { subjectId: string; name: string; domain: string | null } },
}));
vi.mock('./useItemImage', () => ({
  useItemVisual: () => ({ data: { image: image.current, vendor: vendor.current } }),
  itemImageSrc: (stored: { url: string }) => `http://api.example.com${stored.url}`,
}));

const ID = '11111111-1111-4111-8111-111111111111';

describe('ItemImageBadge', () => {
  beforeEach(() => {
    image.current = null;
    vendor.current = null;
  });

  it('keeps the category badge while there is no picture', () => {
    render(<ItemImageBadge transactionId={ID} size={36}>category</ItemImageBadge>);

    expect(screen.getByText('category')).toBeInTheDocument();
  });

  it('shows the picture in its place', () => {
    image.current = { subjectId: ID, url: '/uploads/item-images/a.png', label: 'Example Mini' };
    render(<ItemImageBadge transactionId={ID} size={36}>category</ItemImageBadge>);

    expect(screen.queryByText('category')).toBeNull();
    expect(screen.getByAltText('Example Mini')).toHaveAttribute(
      'src',
      'http://api.example.com/uploads/item-images/a.png',
    );
  });

  it('shows the mark of the subscription the transaction paid', () => {
    vendor.current = { subjectId: ID, name: 'Example Stream', domain: 'example.com' };
    render(<ItemImageBadge transactionId={ID} size={36}>category</ItemImageBadge>);

    expect(screen.queryByText('category')).toBeNull();
    expect(screen.getByRole('img', { name: 'Example Stream' })).toBeInTheDocument();
  });

  it('keeps the category for a vendor it could only draw as initials', () => {
    vendor.current = { subjectId: ID, name: 'Example Stream', domain: null };
    render(<ItemImageBadge transactionId={ID} size={36}>category</ItemImageBadge>);

    expect(screen.getByText('category')).toBeInTheDocument();
  });
});
