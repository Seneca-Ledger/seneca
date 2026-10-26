import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { categoryItem } from '@/app/test/fixtures/contracts';
import { ReportScopeFilters } from './ReportScopeFilters';

const appLocale = vi.hoisted(() => ({ current: 'en' }));
vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));
const apiQueryDecoded = vi.hoisted(() => vi.fn());
vi.mock('@/app/lib/query-fn-schema', () => ({ apiQueryDecoded }));

describe('ReportScopeFilters', () => {
  beforeEach(() => {
    appLocale.current = 'en';
    apiQueryDecoded.mockImplementation(({ url }: { url: string }) =>
      Promise.resolve(
        url === '/categories'
          ? [
              categoryItem({ id: 'cat-ads', name: 'Advertising', isSystem: true, source: 'system' }),
              categoryItem({ id: 'cat-mine', name: 'Studio rent', source: 'user' }),
            ]
          : [],
      ),
    );
  });

  it('lists system categories in the reader\'s language and scopes by their id', async () => {
    appLocale.current = 'ru';
    const onChange = vi.fn();
    const { rerender } = render(
      <ReportScopeFilters value={{ walletIds: [], categoryIds: [] }} onChange={onChange} />,
    );

    fireEvent.mouseDown(await screen.findByRole('combobox'));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('Реклама')).toBeInTheDocument();
    expect(within(listbox).getByText('Studio rent')).toBeInTheDocument();
    expect(within(listbox).queryByText('Advertising')).toBeNull();

    fireEvent.click(within(listbox).getByText('Реклама'));
    expect(onChange).toHaveBeenCalledWith({ walletIds: [], categoryIds: ['cat-ads'] });

    // The select sums up the choice in the same words (the open list hides it from the a11y tree).
    rerender(
      <ReportScopeFilters value={{ walletIds: [], categoryIds: ['cat-ads'] }} onChange={onChange} />,
    );
    expect(screen.getByRole('combobox', { hidden: true })).toHaveTextContent('Реклама');
  });
});
