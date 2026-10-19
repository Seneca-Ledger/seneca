import { SpendOverTimeQuery, TopCategoriesQuery } from '@/contracts';
import { decodeQuery } from '../../../helpers/schema-body';

describe('Report queries', () => {
  it('decodes shared report filters for spend over time queries', () => {
    const { value, errors } = decodeQuery(SpendOverTimeQuery, {
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
      type: 'expense',
      groupBy: 'month',
      statuses: 'completed,error',
      keywords: 'kaspi',
      amountMin: '10.5',
      amountMax: '100.25',
      currencies: 'KZT,USD',
      approved: 'true',
      billable: 'false',
      exported: 'true',
      paid: 'false',
      bankName: 'Kaspi',
      counterparties: 'Acme',
    });

    expect(errors).toEqual([]);
    expect(value).toMatchObject({
      amountMin: 10.5,
      amountMax: 100.25,
      approved: true,
      billable: false,
      exported: true,
      paid: false,
    });
  });

  it('decodes shared report filters for top categories queries', () => {
    const { value, errors } = decodeQuery(TopCategoriesQuery, {
      dateFrom: '2026-03-01',
      dateTo: '2026-03-31',
      type: 'all',
      limit: '25',
      bankName: 'Kaspi',
      counterparties: 'Acme',
      statuses: 'completed,error',
      keywords: 'travel',
      amountMin: '5',
      amountMax: '500',
      currencies: 'EUR,USD',
      approved: 'false',
      billable: 'true',
      has: 'transactions',
      groupBy: 'merchant',
      exported: 'false',
      paid: 'true',
    });

    expect(errors).toEqual([]);
    expect(value).toMatchObject({
      limit: 25,
      amountMin: 5,
      amountMax: 500,
      approved: false,
      billable: true,
      exported: false,
      paid: true,
    });
  });
});
