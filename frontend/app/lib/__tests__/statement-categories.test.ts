import { describe, expect, it } from 'vitest';

import {
  filterStatementCategories,
  flattenStatementCategories,
  getCategoryDisplayName,
  localizeStatementCategoryName,
} from '../statement-categories';

describe('statement categories helpers', () => {
  const categories = [
    {
      id: '1',
      name: 'Equipment',
      children: [
        {
          id: '1-1',
          name: 'Laptop',
        },
      ],
    },
    {
      id: '2',
      name: 'Advertising',
    },
  ];

  it('flattens nested categories with parent path', () => {
    expect(flattenStatementCategories(categories, '', 'en')).toEqual([
      {
        id: '1',
        name: 'Equipment',
        baseName: 'Equipment',
      },
      {
        id: '1-1',
        name: 'Equipment / Laptop',
        baseName: 'Laptop',
      },
      {
        id: '2',
        name: 'Advertising',
        baseName: 'Advertising',
      },
    ]);
  });

  it('filters flattened categories by search query', () => {
    expect(filterStatementCategories(categories, 'lap', 'en')).toEqual([
      {
        id: '1-1',
        name: 'Equipment / Laptop',
        baseName: 'Laptop',
      },
    ]);
  });

  it('returns all flattened categories when query is empty', () => {
    expect(filterStatementCategories(categories, '   ', 'en')).toHaveLength(3);
  });

  it('localizes known system category names by locale', () => {
    expect(localizeStatementCategoryName('Логистика и доставка', 'en')).toBe(
      'Logistics and delivery',
    );
    expect(localizeStatementCategoryName('Продажи', 'en')).toBe('Sales');
    expect(localizeStatementCategoryName('Аренда', 'kk')).toBe('Жалға алу');
    expect(localizeStatementCategoryName('Logistics and delivery', 'ru')).toBe(
      'Логистика и доставка',
    );
  });

  it('localizes only system categories for display and keeps parsing names raw', () => {
    expect(getCategoryDisplayName({ name: 'Аренда', source: 'system' }, 'en')).toBe('Rent');
    expect(getCategoryDisplayName({ name: 'Аренда', source: 'parsing' }, 'en')).toBe('Аренда');
  });

  it('localizes known default categories when legacy rows have no source marker', () => {
    expect(getCategoryDisplayName({ name: 'Аренда' }, 'en')).toBe('Rent');
    expect(getCategoryDisplayName({ name: 'Командировки' }, 'en')).toBe('Travel');
  });

  it('flattens categories with localized system names and raw parsing names', () => {
    expect(
      flattenStatementCategories(
        [
          { id: 'sys-1', name: 'Аренда', source: 'system' },
          { id: 'parsing-1', name: 'Аренда', source: 'parsing' },
        ],
        '',
        'en',
      ),
    ).toEqual([
      { id: 'sys-1', name: 'Rent', source: 'system', isSystem: undefined, baseName: 'Аренда' },
      {
        id: 'parsing-1',
        name: 'Аренда',
        source: 'parsing',
        isSystem: undefined,
        baseName: 'Аренда',
      },
    ]);
  });

  it('does not alter custom category names', () => {
    expect(localizeStatementCategoryName('Kaspi Marketplace Fees', 'en')).toBe(
      'Kaspi Marketplace Fees',
    );
    expect(localizeStatementCategoryName('Kaspi Marketplace Fees', 'ru')).toBe(
      'Kaspi Marketplace Fees',
    );
  });
});
