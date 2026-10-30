import { NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { CategoryType } from '@/entities/category.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '@/entities/transaction.entity';
import { StatementSuggestionsService } from '@/modules/classification/suggestions/statement-suggestions.service';

const WORKSPACE = 'ws-1';
const STATEMENT = 'stmt-1';
const CASH = { id: 'cat-cash', name: 'Cash withdrawals', systemKey: 'cash' };
const RENT = { id: 'cat-rent', name: 'Rent' };

const row = (id: string, overrides: Partial<Transaction>): Transaction =>
  ({
    id,
    workspaceId: WORKSPACE,
    statementId: STATEMENT,
    counterpartyName: 'Example Shop',
    paymentPurpose: 'Example Shop',
    transactionDate: '2026-03-01',
    transactionType: TransactionType.EXPENSE,
    amount: 10,
    isVerified: false,
    categoryId: 'cat-uncategorized',
    categorySource: TransactionCategorySource.DEFAULT,
    ...overrides,
  }) as Transaction;

function build({
  rows,
  parsingDetails = null,
  statementFound = true,
  ruleMatch = null,
  receipts = [],
}: {
  rows: Transaction[];
  parsingDetails?: Record<string, unknown> | null;
  statementFound?: boolean;
  ruleMatch?: { categoryId: string; source: TransactionCategorySource; reason: string } | null;
  receipts?: Array<Record<string, unknown>>;
}) {
  const builder = {
    select: () => builder,
    where: () => builder,
    andWhere: () => builder,
    getMany: async () => rows,
  };
  const transactions = {
    createQueryBuilder: () => builder,
    update: vi.fn(async () => ({ affected: 1 })),
    // No payees in these rows, so nothing to merge.
    manager: { transaction: async (work: (manager: unknown) => unknown) => work({ query: async () => [] }) },
  };
  const categories = {
    findOne: vi.fn(
      async ({ where }: { where: { id?: string; systemKey?: string; type?: CategoryType } }) =>
        where.id === RENT.id
          ? RENT
          : where.systemKey === CASH.systemKey && where.type === CategoryType.EXPENSE
            ? CASH
            : null,
    ),
    manager: { query: async () => [] },
  };
  const statements = {
    findOne: vi.fn(async () => (statementFound ? { id: STATEMENT, parsingDetails } : null)),
    query: vi.fn(async () => undefined),
  };
  const receiptQuery = {
    where: () => receiptQuery,
    andWhere: () => receiptQuery,
    getMany: async () => receipts,
  };
  const receiptRepository = { createQueryBuilder: () => receiptQuery };
  const classification = { suggestForPayee: vi.fn(async () => ruleMatch) };
  const taxAssignment = { reassess: vi.fn(async () => 0) };
  const service = new StatementSuggestionsService(
    transactions as never,
    categories as never,
    statements as never,
    receiptRepository as never,
    classification as never,
    taxAssignment as never,
    { createEvent: vi.fn() } as never,
  );
  return { service, transactions, statements, taxAssignment };
}

describe('StatementSuggestionsService', () => {
  it('answers not found for a statement of another workspace', async () => {
    const { service } = build({ rows: [], statementFound: false });

    await expect(service.suggest(WORKSPACE, 'user-1', STATEMENT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('suggests a row, guarding the write on the source it read', async () => {
    const atm = row('t1', { counterpartyName: 'ATM WITHDRAWAL 0042' });
    const shop = row('t2', {});
    const { service, transactions, taxAssignment } = build({ rows: [atm, shop] });

    const result = await service.suggest(WORKSPACE, 'user-1', STATEMENT);

    expect(result).toEqual({ suggested: 1, unchanged: 1 });
    expect(transactions.update).toHaveBeenCalledTimes(1);
    expect(transactions.update).toHaveBeenCalledWith(
      {
        id: atm.id,
        workspaceId: WORKSPACE,
        isVerified: false,
        categorySource: TransactionCategorySource.DEFAULT,
      },
      {
        categoryId: CASH.id,
        categorySource: TransactionCategorySource.KIND,
        categoryReason: 'kind:cash',
      },
    );
    expect(taxAssignment.reassess).toHaveBeenCalledWith(WORKSPACE, { ids: [atm.id] });
  });

  it('prefers a rule the user wrote over a suggestion', async () => {
    const atm = row('t1', { counterpartyName: 'ATM WITHDRAWAL 0042', categorySource: null });
    const { service, transactions } = build({
      rows: [atm],
      ruleMatch: { categoryId: RENT.id, source: TransactionCategorySource.RULE, reason: 'Office' },
    });

    await service.suggest(WORKSPACE, 'user-1', STATEMENT);

    expect(transactions.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: atm.id, categorySource: IsNull() }),
      { categoryId: RENT.id, categorySource: TransactionCategorySource.RULE, categoryReason: 'Office' },
    );
  });

  it('files a row the bank named no shop for by the receipt of that purchase', async () => {
    const pos = row('t1', {
      counterpartyName: 'POS Purchase',
      paymentPurpose: 'POS Purchase',
      transactionDate: '2026-03-10' as unknown as Date,
      amount: 42.5,
      currency: 'EUR',
    });
    const { service, transactions } = build({
      rows: [pos],
      receipts: [
        {
          id: 'receipt-1',
          transactionId: null,
          parsedData: {
            amount: 42.5,
            currency: 'EUR',
            date: '2026-03-10',
            vendor: 'Example Shop',
            categoryId: RENT.id,
            categorySource: TransactionCategorySource.MANUAL,
          },
        },
      ],
    });

    await service.suggest(WORKSPACE, 'user-1', STATEMENT);

    expect(transactions.update).toHaveBeenCalledWith(expect.objectContaining({ id: pos.id }), {
      categoryId: RENT.id,
      categorySource: TransactionCategorySource.RECEIPT,
      categoryReason: 'receipt:receipt-1',
    });
  });

  it('counts a row a person edited meanwhile as unchanged', async () => {
    const atm = row('t1', { counterpartyName: 'ATM WITHDRAWAL 0042' });
    const { service, transactions, taxAssignment } = build({ rows: [atm] });
    transactions.update.mockResolvedValueOnce({ affected: 0 });

    await expect(service.suggest(WORKSPACE, 'user-1', STATEMENT)).resolves.toEqual({
      suggested: 0,
      unchanged: 1,
    });
    expect(taxAssignment.reassess).not.toHaveBeenCalled();
  });
});
