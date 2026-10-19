// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MappingsResponse } from '../tax-declaration.types';
import { MappingStep } from './MappingStep';

const appLocale = vi.hoisted(() => ({ current: 'en' }));

vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));

const mappings: MappingsResponse = {
  formKey: 'de-euer',
  lines: [
    {
      key: 'ads',
      section: 'expense',
      lineNo: '40',
      fieldNo: null,
      label: 'Werbekosten',
      suggestedFor: [],
    },
  ],
  categories: [
    {
      categoryId: 'cat-ads',
      name: 'Advertising',
      type: 'expense',
      isSystem: true,
      transactionCount: 4,
      lineKey: null,
      status: 'unmapped',
    },
  ],
} as MappingsResponse;

describe('MappingStep', () => {
  beforeEach(() => {
    appLocale.current = 'en';
  });

  it("names categories in the reader's language and saves the mapping by category id", () => {
    appLocale.current = 'ru';
    const onSave = vi.fn();
    render(<MappingStep mappings={mappings} saving={false} onSave={onSave} />);

    expect(screen.getByRole('cell', { name: 'Реклама' })).toBeInTheDocument();
    expect(screen.queryByText('Advertising')).toBeNull();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /: Реклама$/ }));
    fireEvent.click(within(screen.getByRole('listbox')).getByText(/Werbekosten/));

    expect(onSave).toHaveBeenCalledWith([{ categoryId: 'cat-ads', lineKey: 'ads' }]);
  });

  it('shows the stored name in English', () => {
    render(<MappingStep mappings={mappings} saving={false} onSave={vi.fn()} />);

    expect(screen.getByRole('cell', { name: 'Advertising' })).toBeInTheDocument();
  });
});
