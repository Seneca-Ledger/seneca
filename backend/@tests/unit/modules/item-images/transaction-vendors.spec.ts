import { vendorsOfTransactions } from '@/modules/item-images/transaction-vendors';

const WORKSPACE = 'workspace-1';
const CHARGED = '11111111-1111-4111-8111-111111111111';
const BY_PAYEE = '22222222-2222-4222-8222-222222222222';

describe('vendorsOfTransactions', () => {
  it('takes the matched charge first, then the payee’s subscription, in the workspace', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([{ transactionId: CHARGED, name: 'Example Stream', domain: 'example.com' }])
      .mockResolvedValueOnce([{ transactionId: BY_PAYEE, name: 'Example Cloud', domain: null }]);

    const vendors = await vendorsOfTransactions({ query } as any, WORKSPACE, [CHARGED, BY_PAYEE]);

    expect(vendors).toEqual([
      { subjectId: CHARGED, name: 'Example Stream', domain: 'example.com' },
      { subjectId: BY_PAYEE, name: 'Example Cloud', domain: null },
    ]);
    expect(query.mock.calls[0][1]).toEqual([WORKSPACE, [CHARGED, BY_PAYEE]]);
    // Only the rows the charges did not answer are looked up by payee.
    expect(query.mock.calls[1][1]).toEqual([WORKSPACE, [BY_PAYEE]]);
    for (const [sql] of query.mock.calls) {
      expect(sql).toMatch(/workspace_id = \$1/);
    }
  });

  it('asks nothing for no rows', async () => {
    const query = vi.fn();

    expect(await vendorsOfTransactions({ query } as any, WORKSPACE, [])).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
