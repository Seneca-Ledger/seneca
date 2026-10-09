import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Category, Receipt, Transaction } from '@/entities';
import { AiCategoryClassifier } from '@/modules/classification/helpers/ai-category-classifier.helper';
import { ReceiptCategoryService } from '@/modules/receipts/services/receipt-category.service';

function createTransactionQueryBuilder(result: Transaction[]) {
  return {
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
  };
}

describe('ReceiptCategoryService', () => {
  let service: ReceiptCategoryService;
  let categoryRepository: { find: jest.Mock; createQueryBuilder: jest.Mock };
  let transactionRepository: { createQueryBuilder: jest.Mock };
  let isAvailableSpy: jest.SpyInstance;
  let classifySpy: jest.SpyInstance;

  beforeEach(async () => {
    categoryRepository = {
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    transactionRepository = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptCategoryService,
        { provide: getRepositoryToken(Category), useValue: categoryRepository },
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
      ],
    }).compile();

    service = module.get(ReceiptCategoryService);

    // By default the AI classifier is unavailable (no workspace AI settings).
    isAvailableSpy = jest
      .spyOn(AiCategoryClassifier.prototype, 'isAvailable')
      .mockReturnValue(false);
    classifySpy = jest
      .spyOn(AiCategoryClassifier.prototype, 'classifyBatch')
      .mockResolvedValue({ matches: [], failedCount: 1 });
  });

  afterEach(() => {
    isAvailableSpy.mockRestore();
    classifySpy.mockRestore();
  });

  it('loads categories by workspaceId for regular receipts', async () => {
    const categories = [{ id: 'food', name: 'Продукты', isEnabled: true }] as Category[];

    categoryRepository.find.mockResolvedValue(categories);
    transactionRepository.createQueryBuilder.mockReturnValue(createTransactionQueryBuilder([]));

    const result = await service.suggestCategory({
      workspaceId: 'workspace-1',
      parsedData: { vendor: 'Кафе Пушкин' },
    } as Receipt);

    expect(categoryRepository.find).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1', isEnabled: true },
    });
    expect(categoryRepository.createQueryBuilder).not.toHaveBeenCalled();
    // The vendor's own name is never read as a category; the lexicon itself is
    // covered by the `matchByKeywords` tests below.
    expect(result).toBeNull();
  });

  it('loads categories by workspaceId for gmail (via-statement) receipts too', async () => {
    const categories = [{ id: 'food', name: 'Продукты', isEnabled: true }] as Category[];

    categoryRepository.find.mockResolvedValue(categories);
    transactionRepository.createQueryBuilder.mockReturnValue(createTransactionQueryBuilder([]));

    const result = await service.suggestCategory(
      {
        workspaceId: 'workspace-1',
        parsedData: { vendor: 'Кафе Пушкин' },
      } as Receipt,
      'via-statement',
    );

    // The legacy via-statement join is gone: both modes query by workspaceId.
    expect(categoryRepository.find).toHaveBeenCalled();
    expect(categoryRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('filters categories by expense type for expense receipts', async () => {
    const expenseCategories = [{ id: 'food', name: 'Продукты', type: 'expense', isEnabled: true }] as Category[];

    categoryRepository.find.mockResolvedValue(expenseCategories);
    transactionRepository.createQueryBuilder.mockReturnValue(createTransactionQueryBuilder([]));

    const result = await service.suggestCategory({
      workspaceId: 'workspace-1',
      parsedData: { vendor: 'Кафе Пушкин', transactionType: 'expense' },
    } as Receipt);

    expect(categoryRepository.find).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1', isEnabled: true, type: 'expense' },
    });
    expect(result).toBeNull();
  });

  it('filters categories by income type for income receipts', async () => {
    const incomeCategories = [{ id: 'sales', name: 'Продажи', type: 'income', isEnabled: true }] as Category[];

    categoryRepository.find.mockResolvedValue(incomeCategories);
    transactionRepository.createQueryBuilder.mockReturnValue(createTransactionQueryBuilder([]));

    const result = await service.suggestCategory({
      workspaceId: 'workspace-1',
      parsedData: { vendor: 'ООО Ромашка', transactionType: 'income' },
    } as Receipt);

    expect(categoryRepository.find).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1', isEnabled: true, type: 'income' },
    });
    expect(result).toBeNull();
  });

  describe('vendor names that merely look like a category name', () => {
    // A receipt vendor is not a bank descriptor, so the curated keyword lexicon
    // ("кафе", "pizza", "аптека") stays. What has to go is matching the vendor
    // against the *name* of a category: any substring scored 0.8 there, so
    // "Travelodge" became Travel and "Rentokil" became Rent.
    const BUSINESS_CATEGORIES = [
      { id: 'travel', name: 'Travel', isEnabled: true },
      { id: 'rent', name: 'Rent', isEnabled: true },
      { id: 'interest', name: 'Interest', isEnabled: true },
      { id: 'services', name: 'Professional services', isEnabled: true },
    ] as Category[];

    it.each(['Travelodge London', 'Rentokil Initial PLC', 'Interesting Books Ltd'])(
      'suggests nothing for %s',
      async vendor => {
        categoryRepository.find.mockResolvedValue(BUSINESS_CATEGORIES);
        transactionRepository.createQueryBuilder.mockReturnValue(createTransactionQueryBuilder([]));

        const result = await service.suggestCategory({
          workspaceId: 'workspace-1',
          parsedData: { vendor },
        } as Receipt);

        expect(result).toBeNull();
      },
    );

    it('still answers from what this workspace filed for the same vendor before', async () => {
      categoryRepository.find.mockResolvedValue(BUSINESS_CATEGORIES);
      transactionRepository.createQueryBuilder.mockReturnValue(
        createTransactionQueryBuilder([{ categoryId: 'services' }] as Transaction[]),
      );

      const result = await service.suggestCategory({
        workspaceId: 'workspace-1',
        parsedData: { vendor: 'Travelodge London' },
      } as Receipt);

      expect(result?.id).toBe('services');
    });
  });

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

  it('uses AI classification when available', async () => {
    isAvailableSpy.mockReturnValue(true);
    classifySpy.mockResolvedValue({
      matches: [{ index: 0, categoryName: 'Продукты', categoryId: 'food', confidence: 0.95 }],
      failedCount: 0,
    });

    const categories = [{ id: 'food', name: 'Продукты' }, { id: 'shop', name: 'Покупки' }] as Category[];
    categoryRepository.find.mockResolvedValue(categories);
    transactionRepository.createQueryBuilder.mockReturnValue(createTransactionQueryBuilder([]));

    const result = await service.suggestCategory({
      workspaceId: 'workspace-1',
      parsedData: { vendor: 'Magnum', lineItems: [{ description: 'Продукты' }] },
    } as Receipt);

    expect(classifySpy).toHaveBeenCalled();
    expect(result?.id).toBe('food');
  });

  it('returns null when there are no categories', async () => {
    categoryRepository.find.mockResolvedValue([]);
    const result = await service.suggestCategory({
      workspaceId: 'workspace-1',
      parsedData: { vendor: 'Кафе' },
    } as Receipt);
    expect(result).toBeNull();
  });
});