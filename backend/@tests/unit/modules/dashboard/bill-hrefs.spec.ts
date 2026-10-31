import { In } from 'typeorm';
import { billHrefsFor } from '@/modules/dashboard/bill-hrefs';
import { PayableDirection } from '@/entities/payable.entity';

const WORKSPACE = 'workspace-1';
const SALE_TX = '11111111-1111-4111-8111-111111111111';
const BILL_TX = '22222222-2222-4222-8222-222222222222';
const PLAIN_TX = '33333333-3333-4333-8333-333333333333';
const SALE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BILL = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function repos({ bills = [] as object[], payments = [] as object[] } = {}) {
  const paymentRepo = { find: vi.fn(async () => payments) };
  const payables = {
    find: vi.fn(async () => bills),
    manager: { getRepository: () => paymentRepo },
  };
  return { payables: payables as any, paymentRepo };
}

describe('billHrefsFor', () => {
  it('opens a sale in Income and a bill in Expenses, ringing the row', async () => {
    const { payables } = repos({
      bills: [
        { id: SALE, direction: PayableDirection.RECEIVABLE, linkedTransactionId: SALE_TX },
        { id: BILL, direction: PayableDirection.PAYABLE, linkedTransactionId: null },
      ],
      payments: [{ payableId: BILL, transactionId: BILL_TX }],
    });

    const hrefOf = await billHrefsFor(payables, WORKSPACE, [SALE_TX, BILL_TX, PLAIN_TX]);

    expect(hrefOf(SALE_TX)).toBe(`/statements/receive?focus=${encodeURIComponent(`payable:${SALE}`)}`);
    expect(hrefOf(BILL_TX)).toBe(`/statements/pay?focus=${encodeURIComponent(`payable:${BILL}`)}`);
    expect(hrefOf(PLAIN_TX)).toBeNull();
  });

  it('looks only in the caller’s workspace', async () => {
    const { payables, paymentRepo } = repos();

    await billHrefsFor(payables, WORKSPACE, [SALE_TX]);

    expect(paymentRepo.find.mock.calls[0][0].where).toEqual({
      workspaceId: WORKSPACE,
      transactionId: In([SALE_TX]),
    });
    expect(payables.find.mock.calls[0][0].where).toEqual([
      { workspaceId: WORKSPACE, linkedTransactionId: In([SALE_TX]) },
    ]);
  });

  it('asks nothing when every row has a document', async () => {
    const { payables, paymentRepo } = repos();

    expect((await billHrefsFor(payables, WORKSPACE, []))(SALE_TX)).toBeNull();
    expect(paymentRepo.find).not.toHaveBeenCalled();
  });
});
