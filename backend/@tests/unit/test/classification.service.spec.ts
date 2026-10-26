import type { Branch } from '@/entities/branch.entity';
import type { CategorizationRule } from '@/entities/categorization-rule.entity';
import { type Category, CategoryType } from '@/entities/category.entity';
import type { Payee } from '@/entities/payee.entity';
import type { PayeeAlias } from '@/entities/payee-alias.entity';
import { type Transaction, TransactionType } from '@/entities/transaction.entity';
import type { Wallet } from '@/entities/wallet.entity';
import { AuditService } from '@/modules/audit/audit.service';
import { evaluateCondition } from '@/modules/classification/engine/rule-conditions';
import { ClassificationService } from '@/modules/classification/services/classification.service';

function createRepoMock<T>() {
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(data => data as T),
    save: vi.fn(data => Promise.resolve(data as T)),
    createQueryBuilder: vi.fn(),
  } as any;
}

describe('ClassificationService', () => {
  let service: ClassificationService;
  const categoryRepo = createRepoMock<Category>();
  const transactionRepo = createRepoMock<Transaction>();
  const payeeRepo = createRepoMock<Payee>();
  const payeeAliasRepo = createRepoMock<PayeeAlias>();
  const branchRepo = createRepoMock<Branch>();
  const walletRepo = createRepoMock<Wallet>();
  const categorizationRuleRepo = createRepoMock<CategorizationRule>();
  const cacheManager = { get: vi.fn(), set: vi.fn(), del: vi.fn() };
  const auditService = { createEvent: vi.fn() } as AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    walletRepo.find.mockResolvedValue([]);
    branchRepo.find.mockResolvedValue([]);
    service = new ClassificationService(
      categoryRepo as any,
      transactionRepo as any,
      payeeRepo as any,
      payeeAliasRepo as any,
      branchRepo as any,
      walletRepo as any,
      categorizationRuleRepo as any,
      { findOne: vi.fn(async () => null) } as any,
      cacheManager as any,
      auditService as any,
    );
  });

  it('should classify transaction with rule match and auto-fillers', async () => {
    const transaction = {
      credit: 1500,
      debit: null,
      counterpartyName: 'Kaspi',
      paymentPurpose: 'Продажи Kaspi',
    } as unknown as Transaction;

    vi.spyOn<any, any>(service as any, 'getClassificationRules').mockResolvedValue([
      {
        name: 'Kaspi sales',
        type: 'category',
        conditions: [
          {
            field: 'payment_purpose',
            operator: 'contains',
            value: 'Продажи',
          },
        ],
        result: {
          categoryId: 'cat-rule',
          walletId: 'wallet-rule',
          branchId: 'branch-rule',
        },
        priority: 100,
        isActive: true,
      },
    ]);

    vi.spyOn<any, any>(service as any, 'autoClassifyCategory').mockResolvedValue('cat-auto');
    vi.spyOn<any, any>(service as any, 'autoDetermineWallet').mockResolvedValue('wallet-auto');
    vi.spyOn<any, any>(service as any, 'autoDetermineBranch').mockResolvedValue('branch-auto');

    const result = await service.classifyTransaction(transaction, 'user-1');

    expect(result.transactionType).toBe(TransactionType.INCOME);
    expect(result.categoryId).toBe('cat-rule');
    expect(result.walletId).toBe('wallet-rule');
    expect(result.branchId).toBe('branch-rule');
  });

  it('should evaluate conditions correctly', () => {
    const evaluate = evaluateCondition;

    expect(
      evaluate('Kaspi Pay', { operator: 'contains', value: 'kaspi', field: 'payment_purpose' }),
    ).toBe(true);
    expect(evaluate('123', { operator: 'greater_than', value: '100', field: 'amount' })).toBe(true);
    expect(evaluate('99', { operator: 'greater_than', value: '100', field: 'amount' })).toBe(false);
    expect(
      evaluate('Kaspi', { operator: 'regex', value: 'kaspi|halyk', field: 'payment_purpose' }),
    ).toBe(true);
    expect(evaluate(null, { operator: 'contains', value: 'x', field: 'payment_purpose' })).toBe(
      false,
    );
  });

  it('should sanitize rule order by priority when multiple match', async () => {
    const transaction = {
      debit: 300,
      credit: null,
      counterpartyName: 'Marketing LLC',
      paymentPurpose: 'Рекламные услуги',
    } as unknown as Transaction;

    vi.spyOn<any, any>(service as any, 'getClassificationRules').mockResolvedValue([
      {
        name: 'Low priority',
        type: 'category',
        conditions: [{ field: 'payment_purpose', operator: 'contains', value: 'услуги' }],
        result: { categoryId: 'cat-low' },
        priority: 10,
        isActive: true,
      },
      {
        name: 'High priority',
        type: 'category',
        conditions: [{ field: 'payment_purpose', operator: 'contains', value: 'реклам' }],
        result: { categoryId: 'cat-high' },
        priority: 90,
        isActive: true,
      },
    ]);

    vi.spyOn<any, any>(service as any, 'autoClassifyCategory').mockResolvedValue('fallback');
    vi.spyOn<any, any>(service as any, 'autoDetermineWallet').mockResolvedValue(undefined);
    vi.spyOn<any, any>(service as any, 'autoDetermineBranch').mockResolvedValue(undefined);

    const result = await service.classifyTransaction(transaction, 'user-2');

    expect(result.transactionType).toBe(TransactionType.EXPENSE);
    expect(result.categoryId).toBe('cat-high');
  });
});
