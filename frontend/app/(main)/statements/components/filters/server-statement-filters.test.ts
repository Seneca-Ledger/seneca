import { describe, expect, it } from 'vitest';
import {
  getVisibleFilterScreens,
  resetHiddenStatementFilters,
  serializeStatementFiltersToQuery,
} from './server-statement-filters';
import { DEFAULT_STATEMENT_FILTERS } from './statement-filters';

describe('server statement filters', () => {
  it('serializes statement filters into backend query params', () => {
    const params = serializeStatementFiltersToQuery({
      ...DEFAULT_STATEMENT_FILTERS,
      type: 'pdf',
      statuses: ['processing', 'error'],
      date: { mode: 'on', date: '2026-03-01', dateTo: '2026-03-31' },
      from: ['user:user-1'],
      to: ['bank:kaspi'],
      keywords: 'alex',
      amountMin: 10,
      amountMax: 100,
      limit: 25,
      approved: true,
      billable: false,
      groupBy: 'amount',
      has: ['errors', 'transactions'],
      currencies: ['KZT', 'USD'],
      exported: true,
      paid: false,
    });

    expect(params).toEqual({
      type: 'pdf',
      statuses: ['processing', 'error'],
      dateMode: 'on',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
      from: ['user:user-1'],
      to: ['bank:kaspi'],
      keywords: 'alex',
      amountMin: 10,
      amountMax: 100,
      limit: 25,
      approved: true,
      billable: false,
      groupBy: 'amount',
      has: ['errors', 'transactions'],
      currencies: ['KZT', 'USD'],
      exported: true,
      paid: false,
    });
  });

  it('resets hidden filters to defaults', () => {
    const result = resetHiddenStatementFilters(
      {
        ...DEFAULT_STATEMENT_FILTERS,
        amountMin: 10,
        amountMax: 100,
        approved: true,
        exported: true,
        keywords: 'keep',
      },
      ['keywords', 'type', 'statuses'],
    );

    expect(result).toEqual({
      ...DEFAULT_STATEMENT_FILTERS,
      keywords: 'keep',
    });
  });

  it('returns root screens that should stay visible for enabled columns', () => {
    const result = getVisibleFilterScreens(['receipt', 'date', 'amount', 'approved']);

    expect(result).toEqual([
      'amount',
      'amountView',
      'approved',
      'date',
      'groupBy',
      'has',
      'keywords',
      'limit',
      'status',
      'type',
    ]);
  });

  it('keeps receipt type filters visible when the receipt column is enabled', () => {
    const result = getVisibleFilterScreens(['receipt']);

    expect(result).toContain('type');
    expect(result).toContain('status');
  });
});
