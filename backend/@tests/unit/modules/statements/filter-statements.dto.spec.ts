import { StatementsQuery } from '@/contracts';
import { decodeQuery } from '../../../helpers/schema-body';

describe('StatementsQuery', () => {
  it('decodes query values into typed filter fields', () => {
    const { value, errors } = decodeQuery(StatementsQuery, {
      page: '2',
      limit: '15',
      search: 'kaspi',
      type: 'pdf',
      statuses: ['processing', 'error'],
      from: 'user:user-1,bank:kaspi',
      to: ['bank:bereke_new'],
      keywords: 'alex',
      amountMin: '10.5',
      amountMax: '100.25',
      approved: 'true',
      billable: 'false',
      groupBy: 'amount',
      has: 'errors,transactions',
      currencies: ['KZT', 'USD'],
      exported: 'true',
      paid: 'false',
      datePreset: 'thisMonth',
      dateMode: 'after',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
      categoryId: 'cat-1',
    });

    expect(errors).toEqual([]);
    expect(value).toMatchObject({
      page: 2,
      limit: 15,
      statuses: ['processing', 'error'],
      from: ['user:user-1', 'bank:kaspi'],
      to: ['bank:bereke_new'],
      amountMin: 10.5,
      amountMax: 100.25,
      approved: true,
      billable: false,
      has: ['errors', 'transactions'],
      currencies: ['KZT', 'USD'],
      exported: true,
      paid: false,
    });
  });

  it('reads an empty value as absent and rejects what the DTO rejected', () => {
    expect(decodeQuery(StatementsQuery, { page: '', search: '' })).toEqual({ value: {}, errors: [] });
    expect(decodeQuery(StatementsQuery, { page: '0' }).errors).not.toEqual([]);
    expect(decodeQuery(StatementsQuery, { page: 'two' }).errors).not.toEqual([]);
    expect(decodeQuery(StatementsQuery, { approved: 'yes' }).errors).not.toEqual([]);
    expect(decodeQuery(StatementsQuery, { groupBy: 'colour' }).errors).not.toEqual([]);
    // forbidNonWhitelisted: an unknown key was a 400, and stays one.
    expect(decodeQuery(StatementsQuery, { sortBy: 'date' }).errors).not.toEqual([]);
  });
});
