import { CustomTablesBaseQueryInput } from '@/contracts';
import { decodeBody } from '../../../helpers/schema-body';

describe('CustomTablesBaseQueryInput', () => {
  it('transforms and validates shared custom table filters', () => {
    const { value, errors } = decodeBody(CustomTablesBaseQueryInput, {
      days: '30',
      tableIds: ['550e8400-e29b-41d4-a716-446655440000'],
    });

    expect(errors).toHaveLength(0);
    expect(value?.days).toBe(30);
    expect(value?.tableIds).toEqual(['550e8400-e29b-41d4-a716-446655440000']);
  });
});
