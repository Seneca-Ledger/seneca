import { describe, expect, it } from 'vitest';

import { buildTopSpendersStatementsParams, resolveSpenderFlow } from './top-spenders.utils';

describe('top spenders helpers', () => {
  it('resolves spender flow from debit and credit values', () => {
    expect(
      resolveSpenderFlow({ sourceType: 'statement', totalDebit: 320, totalCredit: 0 }),
    ).toEqual({
      flowType: 'spend',
      amount: 320,
    });

    expect(
      resolveSpenderFlow({ sourceType: 'statement', totalDebit: 0, totalCredit: 150 }),
    ).toEqual({
      flowType: 'income',
      amount: 150,
    });

    expect(resolveSpenderFlow({ sourceType: 'receipt', totalDebit: 90, totalCredit: 0 })).toEqual({
      flowType: 'spend',
      amount: 90,
    });
  });

  it('builds statements request params with limit instead of pageSize', () => {
    expect(buildTopSpendersStatementsParams(3, 500)).toEqual({
      page: 3,
      limit: 500,
    });
  });
});
