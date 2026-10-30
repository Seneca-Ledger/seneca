import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CashFlowTreemap } from './CashFlowTreemap';

vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: 'en' }),
}));

const big = { id: 'big', name: 'Big Spend', icon: null, value: 960, children: [] };
// 4% of a 1000×320 map: a column 40px wide, too narrow for a word.
const small = { id: 'small', name: 'Small Spend', icon: null, value: 40, children: [] };

function renderMap(): void {
  render(
    <CashFlowTreemap
      items={[big, small]}
      formatAmount={value => `$${value}`}
      onOpen={vi.fn()}
      backLabel="All categories"
    />,
  );
}

describe('CashFlowTreemap', () => {
  it('captions a large tile with its name and amount', () => {
    renderMap();

    const tile = screen.getByTestId('treemap-tile-big');
    expect(within(tile).getByText(big.name)).toBeInTheDocument();
    expect(within(tile).getByText(`$${big.value}`)).toBeInTheDocument();
  });

  it('draws only the icon on a small tile and names it in the tooltip', async () => {
    renderMap();

    const tile = screen.getByTestId('treemap-tile-small');
    expect(within(tile).queryByText(small.name)).not.toBeInTheDocument();
    expect(tile.querySelector('foreignObject svg')).not.toBeNull();

    fireEvent.mouseOver(tile);
    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getByText(small.name)).toBeInTheDocument();
    expect(within(tooltip).getByText(`$${small.value} · 4%`)).toBeInTheDocument();
  });
});
