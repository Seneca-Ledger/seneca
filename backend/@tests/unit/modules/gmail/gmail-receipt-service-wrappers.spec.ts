import { Category, Receipt } from '@/entities';
import { GmailReceiptCategoryService } from '@/modules/gmail/services/gmail-receipt-category.service';
import { GmailReceiptDuplicateService } from '@/modules/gmail/services/gmail-receipt-duplicate.service';

type ReceiptDuplicateServiceLike = {
  findPotentialDuplicates: (receipt: Receipt) => Promise<Receipt[]>;
  markAsDuplicate: (receiptId: string, originalId: string, workspaceId: string) => Promise<void>;
  unmarkDuplicate: (receiptId: string, workspaceId: string) => Promise<void>;
};

describe('Gmail receipt service wrappers', () => {
  it('delegates category suggestion and categorising to ReceiptCategoryService', async () => {
    const receipt = { id: 'receipt-1' } as Receipt;
    const category = { id: 'category-1', name: 'Food' } as Category;
    const receiptCategoryService = {
      suggest: jest.fn().mockResolvedValue({ category, source: 'history', reason: null }),
      categorize: jest.fn().mockResolvedValue(category),
    };

    const service = new GmailReceiptCategoryService(
      receiptCategoryService as never,
    );

    await expect(service.suggestCategory(receipt)).resolves.toBe(category);
    await expect(service.categorize(receipt)).resolves.toBe(category);
    expect(receiptCategoryService.suggest).toHaveBeenCalledWith(receipt);
    expect(receiptCategoryService.categorize).toHaveBeenCalledWith(receipt);
  });

  it('delegates duplicate lookup to ReceiptDuplicateService', async () => {
    const receipt = { id: 'receipt-1' } as Receipt;
    const duplicates = [{ id: 'receipt-2' }] as Receipt[];
    const receiptDuplicateService = {
      findPotentialDuplicates: jest.fn().mockResolvedValue(duplicates),
      markAsDuplicate: jest.fn().mockResolvedValue(undefined),
      unmarkDuplicate: jest.fn().mockResolvedValue(undefined),
    };

    const service = new GmailReceiptDuplicateService(
      receiptDuplicateService as unknown as ReceiptDuplicateServiceLike,
    );

    await expect(service.findPotentialDuplicates(receipt)).resolves.toEqual(duplicates);
    await service.markAsDuplicate('receipt-1', 'receipt-2', 'ws-1');
    await service.unmarkDuplicate('receipt-1', 'ws-1');

    expect(receiptDuplicateService.findPotentialDuplicates).toHaveBeenCalledWith(receipt);
    expect(receiptDuplicateService.markAsDuplicate).toHaveBeenCalledWith(
      'receipt-1',
      'receipt-2',
      'ws-1',
    );
    expect(receiptDuplicateService.unmarkDuplicate).toHaveBeenCalledWith('receipt-1', 'ws-1');
  });
});
