// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../test-setup';
import { SectionSpanProvider } from '../section-span';
import { TopCategoriesCard } from '../TopCategoriesCard';

// Mirrors react-intlayer's renderIntlayerNode: a Proxy over a rendered
// Fragment whose `.value` is intercepted to return the plain string, so the
// mock is usable both as a JSX child and via `.value` string access.
const value = (v: string) =>
  // biome-ignore lint/complexity/noUselessFragments: Proxy needs an object target — a bare string can't be proxied
  new Proxy(<>{v}</>, {
    get(target, prop, receiver) {
      if (prop === 'value') return v;
      return Reflect.get(target, prop, receiver);
    },
  });

const appLocale = vi.hoisted(() => ({ current: 'en' }));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    noCategoryData: value('No category data'),
    uncategorized: value('Uncategorized'),
    other: value('Other'),
    operations: value('Operations'),
    averageOperation: value('Average spend'),
  }),
  useLocale: () => ({ locale: appLocale.current }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="mock-echarts" />,
}));

// The slices the card hands the donut, so their links can be checked.
const donutSlices = vi.hoisted(() => ({ current: [] as Array<{ name: string; href?: string }> }));
vi.mock('@/app/components/charts/lazy-charts', () => ({
  LazyCategoryDonut: ({ slices }: { slices: Array<{ name: string; href?: string }> }) => {
    donutSlices.current = slices;
    return <div data-testid="mock-echarts" />;
  },
}));

describe('TopCategoriesCard', () => {
  beforeEach(() => {
    appLocale.current = 'en';
  });

  it('shows the empty state when there are no categories', () => {
    render(<TopCategoriesCard categories={[]} formatAmount={value => String(value)} />);

    expect(screen.getByText('No category data')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-echarts')).not.toBeInTheDocument();
  });

  it('paints slices in earthy tones held by each category, not their own colours, and dots the legend', () => {
    const categories = [
      { id: 'a', name: 'Taxes', color: '#ef4444', icon: null, amount: 300, percent: 60, count: 1 },
      { id: 'b', name: 'Rent', color: '#f59e0b', icon: null, amount: 150, percent: 30, count: 1 },
      {
        id: null,
        name: null,
        isOther: true,
        color: '#898781',
        icon: null,
        amount: 50,
        percent: 10,
        count: 1,
      },
    ];
    const { container, rerender } = render(
      <TopCategoriesCard categories={categories} formatAmount={v => `$${v}`} />,
    );

    const colors = (donutSlices.current as Array<{ color?: string }>).map(slice => slice.color);
    expect(colors.every(color => color?.startsWith('var(--cat-tone-'))).toBe(true);
    expect(colors[0]).not.toBe(colors[1]);
    expect(colors[2]).toBe('var(--cat-tone-other)');
    const dots = [...container.querySelectorAll<HTMLElement>('.lumio-dashboard__legend-dot')];
    expect(dots).toHaveLength(3);

    // Next month Rent ranks first: it keeps its tone.
    rerender(
      <TopCategoriesCard
        categories={[categories[1], categories[0], categories[2]]}
        formatAmount={v => `$${v}`}
      />,
    );
    const after = (donutSlices.current as Array<{ color?: string }>).map(slice => slice.color);
    expect(after[0]).toBe(colors[1]);
    expect(after[1]).toBe(colors[0]);
  });

  it('renders the localized fallback label for a null-name (uncategorized) row', () => {
    render(
      <TopCategoriesCard
        categories={[
          {
            id: null,
            name: null,
            color: '#898781',
            icon: null,
            amount: 500,
            percent: 100,
            count: 2,
          },
        ]}
        formatAmount={v => `$${v}`}
      />,
    );

    expect(screen.getByText('Uncategorized')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('$500')).toBeInTheDocument();
  });

  it('renders the localized "Other" label for the rollup row regardless of its raw name', () => {
    render(
      <TopCategoriesCard
        categories={[
          {
            id: null,
            name: null,
            isOther: true,
            color: '#898781',
            icon: null,
            amount: 250,
            percent: 12.5,
            count: 3,
          },
        ]}
        formatAmount={v => `$${v}`}
      />,
    );

    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByText('12.5%')).toBeInTheDocument();
  });

  it('renders a real category by its own name, not the uncategorized fallback', () => {
    render(
      <TopCategoriesCard
        categories={[
          {
            id: 'cat-1',
            name: 'Groceries',
            color: '#0584C7',
            icon: null,
            amount: 1200,
            percent: 40,
            count: 5,
          },
        ]}
        formatAmount={v => `$${v}`}
      />,
    );

    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.queryByText('Uncategorized')).not.toBeInTheDocument();
  });

  it('opens each named category in the report on the card month', () => {
    render(
      <TopCategoriesCard
        month="2026-10"
        categories={[
          { id: 'c1', name: 'Telegram', color: '#0ea5e9', icon: null, amount: 4, percent: 50, count: 1 },
          { id: null, name: null, color: '#898781', icon: null, amount: 4, percent: 50, count: 1 },
        ]}
        formatAmount={v => `$${v}`}
      />,
    );

    expect(screen.getByText('Telegram').closest('a')?.getAttribute('href')).toBe(
      '/reports?tab=cash-flow&month=2026-10&focus=category%3Atelegram',
    );
    // Uncategorized has no row of its own in the report.
    expect(screen.getByText('Uncategorized').closest('a')).toBeNull();
    // The donut's slices open the same places.
    expect(donutSlices.current.map(slice => slice.href)).toEqual([
      '/reports?tab=cash-flow&month=2026-10&focus=category%3Atelegram',
      undefined,
    ]);
  });

  it('says how each total came about only with the row to itself', () => {
    const card = (
      <TopCategoriesCard
        categories={[
          { id: 'c1', name: 'Telegram', color: '#0ea5e9', icon: null, amount: 12, percent: 100, count: 3 },
        ]}
        formatAmount={v => `$${v}`}
      />
    );
    const { rerender } = render(<SectionSpanProvider value={6}>{card}</SectionSpanProvider>);
    expect(screen.queryByText(/Operations/)).not.toBeInTheDocument();

    rerender(<SectionSpanProvider value={12}>{card}</SectionSpanProvider>);
    expect(screen.getByText('Operations: 3 · Average spend: $4')).toBeInTheDocument();
  });

  it("names a system category in the reader's language but links by its stored name", () => {
    appLocale.current = 'ru';
    render(
      <TopCategoriesCard
        month="2026-10"
        categories={[
          { id: 'c1', name: 'Advertising', color: '#0ea5e9', icon: null, amount: 4, percent: 100, count: 1 },
        ]}
        formatAmount={v => `$${v}`}
      />,
    );

    expect(screen.getByText('Реклама').closest('a')?.getAttribute('href')).toBe(
      '/reports?tab=cash-flow&month=2026-10&focus=category%3Aadvertising',
    );
    expect(screen.queryByText('Advertising')).not.toBeInTheDocument();
    // The donut's tooltip and legend read the slice name.
    expect(donutSlices.current.map(slice => slice.name)).toEqual(['Реклама']);
  });
});
