import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Category, Receipt } from '@/entities';
import { TransactionCategorySource, TransactionType } from '@/entities/transaction.entity';
import { ClassificationService } from '@/modules/classification/services/classification.service';
import { ReceiptCategoryService } from '@/modules/receipts/services/receipt-category.service';

describe('ReceiptCategoryService', () => {
  let service: ReceiptCategoryService;
  let categoryRepository: { findOne: jest.Mock };
  let classification: { suggestForPayee: jest.Mock };

  const receipt = (parsedData: Receipt['parsedData']) =>
    ({ workspaceId: 'workspace-1', userId: 'user-1', parsedData }) as Receipt;

  beforeEach(async () => {
    categoryRepository = { findOne: jest.fn() };
    classification = {
      suggestForPayee: jest.fn(async () => null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptCategoryService,
        { provide: getRepositoryToken(Category), useValue: categoryRepository },
        { provide: ClassificationService, useValue: classification },
      ],
    }).compile();

    service = module.get(ReceiptCategoryService);
  });

  describe('the category of a receipt vendor', () => {
    it('asks the same engine a bank row goes through, as the vendor payee', async () => {
      await service.suggest(
        receipt({ vendor: 'Railway Corporation', amount: 14.63, transactionType: 'expense' }),
      );

      expect(classification.suggestForPayee).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        counterpartyName: 'Railway Corporation',
        paymentPurpose: 'Railway Corporation',
        transactionType: TransactionType.EXPENSE,
        amount: 14.63,
      });
    });

    it('asks for an income category for an income receipt', async () => {
      await service.suggest(receipt({ vendor: 'Client GmbH', transactionType: 'income' }));

      expect(classification.suggestForPayee).toHaveBeenCalledWith(
        expect.objectContaining({ transactionType: TransactionType.INCOME }),
      );
    });

    it('writes the category and where it came from onto the receipt', async () => {
      classification.suggestForPayee.mockResolvedValue({
        categoryId: 'hosting',
        source: TransactionCategorySource.HISTORY,
        reason: 'Railway Corporation',
      });
      categoryRepository.findOne.mockResolvedValue({ id: 'hosting', name: 'Hosting' });
      const scanned = receipt({ vendor: 'Railway Corporation' });

      const category = await service.categorize(scanned);

      expect(category?.id).toBe('hosting');
      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'hosting', workspaceId: 'workspace-1', isEnabled: true },
      });
      expect(scanned.parsedData).toEqual({
        vendor: 'Railway Corporation',
        category: 'Hosting',
        categoryId: 'hosting',
        categorySource: 'history',
        categoryReason: 'Railway Corporation',
      });
    });

    it.each(['Travelodge London', 'Rentokil Initial PLC'])(
      'leaves %s for the user when nothing was taught about it',
      async vendor => {
        const scanned = receipt({ vendor });

        expect(await service.categorize(scanned)).toBeNull();
        expect(scanned.parsedData).toEqual({ vendor });
      },
    );

    it('suggests nothing without a vendor, and never asks', async () => {
      expect(await service.suggest(receipt({ amount: 3 }))).toBeNull();
      expect(classification.suggestForPayee).not.toHaveBeenCalled();
    });

    it('drops a suggestion whose category is disabled or gone', async () => {
      classification.suggestForPayee.mockResolvedValue({
        categoryId: 'gone',
        source: TransactionCategorySource.HISTORY,
        reason: null,
      });
      categoryRepository.findOne.mockResolvedValue(null);

      expect(await service.suggest(receipt({ vendor: 'Railway Corporation' }))).toBeNull();
    });
  });

  describe('line items', () => {
    it('matches Russian default categories via keywords', () => {
      const categories = [{ id: 'food', name: 'Продукты' }] as Category[];
      expect(service.matchByKeywords('Кафе Пушкин', categories)?.id).toBe('food');
      expect(service.matchByKeywords('Кофейня на углу', categories)?.id).toBe('food');
    });

    it('matches English category names via keywords', () => {
      const categories = [{ id: 'food', name: 'Food & Dining' }] as Category[];
      expect(service.matchByKeywords('Pizza Hut', categories)?.id).toBe('food');
    });

    it('does not match keywords when no category corresponds', () => {
      const categories = [{ id: 'salary', name: 'Зарплата' }] as Category[];
      expect(service.matchByKeywords('Кафе Пушкин', categories)).toBeNull();
    });
  });
});
