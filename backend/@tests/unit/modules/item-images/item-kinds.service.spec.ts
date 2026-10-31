import { ItemKindsService } from '@/modules/item-images/item-kinds.service';

const WORKSPACE = 'workspace-1';
const ME = 'member-1';
const MINE = '11111111-1111-4111-8111-111111111111';
const HIDDEN = '22222222-2222-4222-8222-222222222222';
const BILL = '33333333-3333-4333-8333-333333333333';

function setup() {
  const transactions = {
    find: vi.fn(async () => [
      { id: MINE, counterpartyName: 'Sold Example Mini', paymentPurpose: 'rocking chair', isPrivate: false, ownerMemberId: ME },
      { id: HIDDEN, counterpartyName: 'Sold sofa', paymentPurpose: null, isPrivate: true, ownerMemberId: 'member-2' },
    ]),
  };
  const payables = { find: vi.fn(async () => [{ id: BILL, vendor: 'Sold electric guitar', comment: null }]) };
  return { service: new ItemKindsService(transactions as any, payables as any), transactions, payables };
}

describe('ItemKindsService', () => {
  it('names the kind of each readable transaction, and nothing of someone else’s private one', async () => {
    const { service, transactions } = setup();

    expect(await service.forTransactions(WORKSPACE, [MINE, HIDDEN, 'not-an-id'], ME)).toEqual([
      { subjectId: MINE, kind: 'chair' },
    ]);
    expect(transactions.find.mock.calls[0][0].where.workspaceId).toBe(WORKSPACE);
  });

  it('names the kind of a bill from its vendor line', async () => {
    const { service, payables } = setup();

    expect(await service.forPayables(WORKSPACE, [BILL])).toEqual([{ subjectId: BILL, kind: 'guitar' }]);
    expect(payables.find.mock.calls[0][0].where.workspaceId).toBe(WORKSPACE);
  });
});
