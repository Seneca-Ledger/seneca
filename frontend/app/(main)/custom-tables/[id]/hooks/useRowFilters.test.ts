import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CustomTableColumn } from '../utils/types';
import { operatorsForColumn, useRowFilters } from './useRowFilters';

const column = (type: CustomTableColumn['type']): CustomTableColumn => ({
  id: type,
  key: type,
  title: type,
  type,
  position: 0,
  config: null,
});

describe('useRowFilters', () => {
  it('serialises column filters and search the way GET /rows expects', () => {
    const { result } = renderHook(() => useRowFilters());
    expect(result.current.filtersParam).toBeUndefined();

    act(() => result.current.addFilter({ col: 'amount', op: 'gt', value: 100 }));
    act(() => result.current.setSearchQuery('  coffee '));

    expect(JSON.parse(result.current.filtersParam ?? '[]')).toEqual([
      { col: 'amount', op: 'gt', value: 100 },
      { col: '__search__', op: 'search', value: 'coffee' },
    ]);

    act(() => result.current.removeFilter(result.current.filters[0].id));
    act(() => result.current.setSearchQuery(''));
    expect(result.current.filtersParam).toBeUndefined();
  });

  it('offers operators that match the column type', () => {
    expect(operatorsForColumn(column('number'))).toContain('between');
    expect(operatorsForColumn(column('boolean'))).toEqual(['eq']);
    expect(operatorsForColumn(column('text'))).toContain('contains');
    expect(operatorsForColumn(column('text'))).not.toContain('gt');
  });
});
