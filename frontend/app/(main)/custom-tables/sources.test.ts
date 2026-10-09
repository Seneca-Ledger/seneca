import { describe, expect, it } from 'vitest';
import {
  buildSourcePayload,
  EMPTY_SOURCE_FILTERS,
  normalizeSourceFilters,
  SOURCE_KINDS,
} from './sources';

describe('SOURCE_KINDS', () => {
  it.each(SOURCE_KINDS.map(s => [s.id, s] as const))('%s has unique column fields', (_id, source) => {
    expect(new Set(source.columnFields).size).toBe(source.columnFields.length);
  });

  it('declares status options exactly for sources with a status filter', () => {
    for (const source of SOURCE_KINDS) {
      expect(Boolean(source.statusOptions)).toBe(source.filterFields.includes('status'));
    }
  });
});

describe('normalizeSourceFilters', () => {
  it('drops empty strings and arrays and uppercases the currency', () => {
    expect(
      normalizeSourceFilters({
        ...EMPTY_SOURCE_FILTERS,
        dateFrom: '2026-09-01',
        categoryIds: ['cat-1'],
        currency: 'eur',
      }),
    ).toEqual({ dateFrom: '2026-09-01', categoryIds: ['cat-1'], currency: 'EUR' });
  });

  it('returns an empty object for untouched filters', () => {
    expect(normalizeSourceFilters(EMPTY_SOURCE_FILTERS)).toEqual({});
  });
});

describe('buildSourcePayload', () => {
  it('sends only titles of the chosen source and trims optional fields', () => {
    const budgets = SOURCE_KINDS.find(s => s.id === 'budgets');
    if (!budgets) throw new Error('missing source');
    const payload = buildSourcePayload({
      source: budgets,
      filters: EMPTY_SOURCE_FILTERS,
      name: ' Budgets 2026 ',
      description: '  ',
      categoryId: '',
      currency: 'EUR',
      titles: { name: 'Бюджет', limit: 'Лимит', date: 'Дата' },
    });
    expect(payload).toEqual({
      kind: 'budgets',
      filters: {},
      name: 'Budgets 2026',
      description: undefined,
      categoryId: undefined,
      currency: undefined,
      columnTitles: { name: 'Бюджет', limit: 'Лимит' },
    });
  });

  it('falls back to the workspace currency only for sources without a currency column', () => {
    const budgets = SOURCE_KINDS.find(s => s.id === 'budgets');
    if (!budgets) throw new Error('missing source');
    const payload = buildSourcePayload({
      source: { ...budgets, columnFields: budgets.columnFields.filter(f => f !== 'currency') },
      filters: EMPTY_SOURCE_FILTERS,
      name: 'X',
      description: '',
      categoryId: '',
      currency: 'EUR',
      titles: {},
    });
    expect(payload.currency).toBe('EUR');
  });
});
