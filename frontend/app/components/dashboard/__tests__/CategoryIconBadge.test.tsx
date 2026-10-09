// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '../test-setup';
import { CategoryIconBadge } from '../CategoryIconBadge';

// Spread the real module: category-icon-choices pulls in the whole picker set.
vi.mock('@/app/components/icons', async importOriginal => ({
  ...(await importOriginal<object>()),
  Tag: () => <span data-testid="icon-tag" />,
  MoreHorizontal: () => <span data-testid="icon-more" />,
  Building2: () => <span data-testid="icon-building" />,
  ArrowLeftRight: () => null,
  Banknote: () => null,
  Briefcase: () => null,
  Car: () => null,
  CircleDollarSign: () => null,
  Cloud: () => null,
  CreditCard: () => null,
  Handshake: () => null,
  Heart: () => null,
  Home: () => null,
  Landmark: () => null,
  Laptop: () => null,
  Megaphone: () => null,
  Package: () => null,
  Percent: () => null,
  Plane: () => null,
  Printer: () => null,
  ReceiptText: () => null,
  Scale: () => null,
  Shield: () => null,
  ShoppingBag: () => null,
  Store: () => null,
  TrendingUp: () => null,
  Truck: () => null,
  Users: () => null,
  Utensils: () => null,
  Wallet: () => null,
  Wrench: () => null,
  Zap: () => null,
}));

describe('CategoryIconBadge', () => {
  it('renders the uploaded icon image when the category has one', () => {
    const { container } = render(
      <CategoryIconBadge name="Rent" color="#123456" icon="https://cdn.test/rent.png" />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/rent.png');
  });

  it('falls back to the default glyph for a known system category', () => {
    const { getByTestId } = render(<CategoryIconBadge name="Аренда" color={null} icon={null} />);
    expect(getByTestId('icon-building')).toBeInTheDocument();
  });

  it('shows the generic tag for unknown categories and the more glyph for Other', () => {
    const { getByTestId, rerender } = render(
      <CategoryIconBadge name="Groceries" color={null} icon={null} />,
    );
    expect(getByTestId('icon-tag')).toBeInTheDocument();
    rerender(<CategoryIconBadge name="Other" color="#898781" icon={null} isOther />);
    expect(getByTestId('icon-more')).toBeInTheDocument();
  });
});
