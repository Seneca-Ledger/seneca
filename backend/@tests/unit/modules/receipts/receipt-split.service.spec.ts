import { BadRequestException } from '@nestjs/common';
import { ReceiptSplitService } from '../../../../src/modules/receipts/services/receipt-split.service';

const receipt = {
  id: 'r1',
  workspaceId: 'w1',
  transactionId: 't1',
  parsedData: {
    vendor: 'Target',
    lineItems: [
      { description: 'Milk', amount: 4 },
      { description: 'Shampoo', amount: 6 },
    ],
  },
};

function setup(transaction: Record<string, unknown> = {}) {
  const receiptRepository = {
    findOne: vi.fn(async () => receipt),
    update: vi.fn(async () => undefined),
  };
  const transactionRepository = {
    findOne: vi.fn(async () => ({
      id: 't1',
      amount: 11,
      currency: 'EUR',
      categoryId: null,
      splitGroupId: null,
      ...transaction,
    })),
  };
  const categoryRepository = {
    find: vi.fn(async () => [
      { id: 'food', name: 'Food', isEnabled: true },
      { id: 'home', name: 'Household', isEnabled: true },
    ]),
  };
  const categoryService = {
    matchByKeywords: vi.fn(() => null),
  };
  const transactionsService = { split: vi.fn(async () => []) };
  const service = new ReceiptSplitService(
    receiptRepository as any,
    transactionRepository as any,
    categoryRepository as any,
    categoryService as any,
    transactionsService as any,
  );
  return { service, categoryService, transactionsService, receiptRepository };
}

describe('ReceiptSplitService', () => {
  it('says a split transaction is split', async () => {
    const { service } = setup({ splitGroupId: 'g1' });

    const suggestion = await service.suggest('r1', 'w1');

    expect(suggestion.alreadySplit).toBe(true);
    expect(suggestion.parts).toEqual([]);
  });

  it('applies the categories the user settled on, not the suggested ones', async () => {
    const { service, transactionsService, receiptRepository } = setup();

    await service.apply('r1', 'w1', 'u1', [
      { description: 'Milk', amount: 4, categoryId: 'food' },
      { description: 'Shampoo', amount: 6, categoryId: 'home' },
    ]);

    const parts = (transactionsService.split.mock.calls[0] as any[])[3].parts;
    expect(parts.map((part: any) => [part.categoryId, part.amount])).toEqual([
      ['home', 6.6],
      ['food', 4.4],
    ]);
    // The reviewed categories are remembered on the receipt's lines.
    expect(receiptRepository.update).toHaveBeenCalled();
  });

  it('refuses a preview whose lines are not the receipt lines', async () => {
    const { service, transactionsService } = setup();

    await expect(
      service.apply('r1', 'w1', 'u1', [
        { description: 'Milk', amount: 5, categoryId: 'food' },
        { description: 'Shampoo', amount: 6, categoryId: 'home' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionsService.split).not.toHaveBeenCalled();
  });

  it('refuses a category from outside the workspace', async () => {
    const { service } = setup();

    await expect(
      service.apply('r1', 'w1', 'u1', [
        { description: 'Milk', amount: 4, categoryId: 'food' },
        { description: 'Shampoo', amount: 6, categoryId: 'someone-elses' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to split a transaction twice', async () => {
    const { service } = setup({ splitGroupId: 'g1' });

    await expect(service.apply('r1', 'w1', 'u1')).rejects.toThrow('already split');
  });
});
