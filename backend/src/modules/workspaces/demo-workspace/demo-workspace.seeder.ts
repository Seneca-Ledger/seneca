import { createHash, randomUUID } from 'node:crypto';
import { type EntityManager, In, IsNull } from 'typeorm';
import { generateTransactionFingerprint } from '../../../common/utils/fingerprint.util';
import {
  BalanceAccount,
  BalanceSnapshot,
  BankName,
  Budget,
  BudgetPeriodType,
  Category,
  CategoryType,
  CustomTable,
  CustomTableColumn,
  CustomTableColumnType,
  CustomTableRow,
  FileType,
  Goal,
  GoalContribution,
  Statement,
  StatementStatus,
  StoicClass,
  Subscription,
  SubscriptionCharge,
  SubscriptionChargeMatchStatus,
  SubscriptionFrequency,
  SubscriptionStatus,
  Transaction,
  TransactionCategorySource,
  TransactionType,
  TransferPairKind,
  TransferPairSource,
  Wallet,
} from '../../../entities';
import {
  DEMO_CURRENCY,
  DEMO_IT_CATEGORY,
  type DemoAccountKey,
  type DemoCategoryName,
  type DemoDataset,
  type DemoStatement,
} from './demo-data.generator';

/** Categories whose spending the tax-year report lists as deductible. */
const TAX_RELEVANT: DemoCategoryName[] = [
  DEMO_IT_CATEGORY,
  'Equipment',
  'Insurance',
  'Professional services',
  'Rent',
];

const COLUMN_TYPES = {
  text: CustomTableColumnType.TEXT,
  currency: CustomTableColumnType.CURRENCY,
  date: CustomTableColumnType.DATE,
  select: CustomTableColumnType.SELECT,
} as const;

const FREQUENCIES = {
  monthly: SubscriptionFrequency.MONTHLY,
  annual: SubscriptionFrequency.ANNUAL,
} as const;

/**
 * TypeORM writes a string into a `date` column as it is, so the day does not
 * shift with the server's time zone the way a `Date` at midnight UTC would.
 */
const dateColumn = (date: string) => date as unknown as Date;

const euros = (cents: number) => cents / 100;

/**
 * Writes a generated demo dataset into a workspace that already has its
 * defaults (system categories, balance accounts, the owner's membership).
 * Every write goes through `manager`, so the caller's transaction holds all
 * of it or none. Rows are written as an import and the user's later work
 * would leave them; nothing is emitted, so no listener, webhook or mail fires.
 */
export async function seedDemoWorkspace(
  manager: EntityManager,
  target: { workspaceId: string; userId: string },
  data: DemoDataset,
): Promise<void> {
  const { workspaceId, userId } = target;
  const categories = await prepareCategories(manager, workspaceId, userId);
  const categoryId = (name: DemoCategoryName | null) => {
    if (name === null) return null;
    const id = categories.get(name);
    if (!id) throw new Error(`Demo category "${name}" is missing in workspace ${workspaceId}`);
    return id;
  };

  const wallets = new Map<DemoAccountKey, Wallet>();
  for (const account of data.accounts) {
    wallets.set(
      account.key,
      await manager.save(
        manager.create(Wallet, {
          workspaceId,
          userId,
          name: account.name,
          accountNumber: account.accountNumber,
          bankName: 'Nordbank',
          currency: DEMO_CURRENCY,
          initialBalance: euros(account.openingCents),
        }),
      ),
    );
  }

  /** Saved transactions by the generator's ref, for the subscription charges. */
  const transactions = new Map<string, { id: string; date: string }>();
  /** One id per move between the accounts, shared by its two legs. */
  const transferPairIds = new Map<string, string>();
  const transferPairId = (key: string | null) => {
    if (key === null) return null;
    if (!transferPairIds.has(key)) transferPairIds.set(key, randomUUID());
    return transferPairIds.get(key) as string;
  };
  for (const statement of data.statements) {
    const wallet = wallets.get(statement.account) as Wallet;
    const saved = await manager.save(
      manager.create(Statement, statementRow(statement, wallet.accountNumber as string, target)),
    );
    const rows = statement.transactions.map(row => {
      const pairId = transferPairId(row.transferKey);
      const amount = euros(row.cents);
      return manager.create(Transaction, {
        workspaceId,
        statementId: saved.id,
        walletId: wallet.id,
        transactionDate: dateColumn(row.date),
        counterpartyName: row.counterparty,
        paymentPurpose: row.purpose,
        amount,
        debit: row.type === 'expense' ? amount : null,
        credit: row.type === 'income' ? amount : null,
        currency: DEMO_CURRENCY,
        transactionType: row.type === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE,
        categoryId: categoryId(row.category),
        categorySource: row.category ? TransactionCategorySource.HISTORY : null,
        isVerified: row.confirmed,
        fingerprint: generateTransactionFingerprint({
          workspaceId,
          accountNumber: wallet.accountNumber as string,
          date: row.date,
          amount,
          currency: DEMO_CURRENCY,
          direction: row.type === 'income' ? 'credit' : 'debit',
          merchant: row.counterparty,
        }),
        transferPairId: pairId,
        transferPairSource: pairId ? TransferPairSource.AUTO : null,
        transferPairKind: pairId ? TransferPairKind.TRANSFER : null,
      });
    });
    const savedRows = await manager.save(Transaction, rows, { chunk: 200 });
    statement.transactions.forEach((row, index) => {
      transactions.set(row.ref, { id: savedRows[index].id, date: row.date });
    });
  }

  await manager.save(
    Budget,
    data.budgets.map(budget =>
      manager.create(Budget, {
        workspaceId,
        categoryId: categoryId(budget.category) as string,
        name: budget.category,
        limitAmount: euros(budget.limitCents),
        currency: DEMO_CURRENCY,
        periodType: BudgetPeriodType.MONTHLY,
        currentPeriodStart: dateColumn(`${data.anchor.slice(0, 7)}-01`),
        createdById: userId,
        // As if set up when the history starts: the Stoic balance counts a
        // budget only in the months after it was made.
        createdAt: new Date(`${data.statements[0].dateFrom}T00:00:00Z`),
      }),
    ),
  );

  for (const subscription of data.subscriptions) {
    const saved = await manager.save(
      manager.create(Subscription, {
        workspaceId,
        vendorName: subscription.vendor,
        amount: euros(subscription.cents),
        currency: DEMO_CURRENCY,
        frequency: FREQUENCIES[subscription.frequency],
        status: SubscriptionStatus.ACTIVE,
        ownerId: userId,
        createdById: userId,
        categoryId: categoryId(subscription.category),
        lastChargeDate: dateColumn(subscription.lastChargeDate),
        nextChargeDate: dateColumn(subscription.nextChargeDate),
      }),
    );
    await manager.save(
      SubscriptionCharge,
      subscription.chargeRefs.map(ref => {
        const charge = transactions.get(ref) as { id: string; date: string };
        return manager.create(SubscriptionCharge, {
          workspaceId,
          subscriptionId: saved.id,
          transactionId: charge.id,
          amount: euros(subscription.cents),
          currency: DEMO_CURRENCY,
          chargeDate: dateColumn(charge.date),
          expectedAmount: euros(subscription.cents),
          matchStatus: SubscriptionChargeMatchStatus.MATCHED,
        });
      }),
    );
  }

  for (const goal of data.goals) {
    const saved = await manager.save(
      manager.create(Goal, {
        workspaceId,
        name: goal.name,
        targetAmount: euros(goal.targetCents),
        currency: DEMO_CURRENCY,
        targetDate: goal.targetDate,
        coverPreset: goal.coverPreset,
        createdById: userId,
      }),
    );
    await manager.save(
      GoalContribution,
      goal.contributions.map(contribution =>
        manager.create(GoalContribution, {
          workspaceId,
          goalId: saved.id,
          amount: euros(contribution.cents),
          contributionDate: contribution.date,
          createdById: userId,
        }),
      ),
    );
  }

  const equipment = await manager.findOne(BalanceAccount, {
    where: { workspaceId, code: 'ASSET_FIXED' },
  });
  if (equipment) {
    await manager.save(
      BalanceSnapshot,
      data.equipmentValue.map(snapshot =>
        manager.create(BalanceSnapshot, {
          workspaceId,
          accountId: equipment.id,
          snapshotDate: snapshot.date,
          amount: euros(snapshot.cents),
          currency: DEMO_CURRENCY,
          createdBy: userId,
        }),
      ),
    );
  }

  const table = await manager.save(
    manager.create(CustomTable, { workspaceId, userId, name: data.customTable.name }),
  );
  const columnKey = (key: string) => `col_${key}`;
  await manager.save(
    CustomTableColumn,
    data.customTable.columns.map((column, position) =>
      manager.create(CustomTableColumn, {
        tableId: table.id,
        key: columnKey(column.key),
        title: column.title,
        type: COLUMN_TYPES[column.type],
        position,
        config:
          column.type === 'currency'
            ? { currency: DEMO_CURRENCY, precision: 2 }
            : column.type === 'select'
              ? { options: data.customTable.statusOptions }
              : null,
      }),
    ),
  );
  await manager.save(
    CustomTableRow,
    data.customTable.rows.map((row, index) =>
      manager.create(CustomTableRow, {
        tableId: table.id,
        rowNumber: index + 1,
        data: Object.fromEntries(
          Object.entries(row).map(([key, value]) => [columnKey(key), value]),
        ),
      }),
    ),
  );
}

/**
 * The workspace's own categories by stored name — system categories are
 * seeded in English and translated by the client — plus `IT services`, which
 * the demo adds. A few are marked tax relevant so the tax-year report has
 * something to list.
 */
async function prepareCategories(
  manager: EntityManager,
  workspaceId: string,
  userId: string,
): Promise<Map<string, string>> {
  const existing = await manager.find(Category, { where: { workspaceId, parentId: IsNull() } });
  const byName = new Map(existing.map(row => [row.name, row.id]));
  if (!byName.has(DEMO_IT_CATEGORY)) {
    const created = await manager.save(
      manager.create(Category, {
        workspaceId,
        userId,
        name: DEMO_IT_CATEGORY,
        type: CategoryType.EXPENSE,
        stoicClass: StoicClass.WORK,
      }),
    );
    byName.set(created.name, created.id);
  }
  const relevant = TAX_RELEVANT.flatMap(name => byName.get(name) ?? []);
  if (relevant.length > 0) {
    await manager.update(Category, { workspaceId, id: In(relevant) }, { taxRelevant: true });
  }
  return byName;
}

function statementRow(
  statement: DemoStatement,
  accountNumber: string,
  target: { workspaceId: string; userId: string },
): Partial<Statement> {
  const bytes = Buffer.from(statement.csv, 'utf8');
  const debit = statement.transactions
    .filter(row => row.type === 'expense')
    .reduce((sum, row) => sum + row.cents, 0);
  const credit = statement.transactions
    .filter(row => row.type === 'income')
    .reduce((sum, row) => sum + row.cents, 0);
  return {
    workspaceId: target.workspaceId,
    userId: target.userId,
    fileName: statement.fileName,
    // Not on disk: the bytes are in `file_data`, which the file service
    // restores from on the first download, as for any imported statement.
    filePath: `uploads/${randomUUID()}.csv`,
    fileData: bytes,
    fileType: FileType.CSV,
    fileSize: bytes.length,
    fileHash: createHash('sha256').update(bytes).digest('hex'),
    bankName: BankName.OTHER,
    accountNumber,
    statementDateFrom: dateColumn(statement.dateFrom),
    statementDateTo: dateColumn(statement.dateTo),
    status: StatementStatus.COMPLETED,
    totalTransactions: statement.transactions.length,
    totalDebit: euros(debit),
    totalCredit: euros(credit),
    balanceStart: euros(statement.openingCents),
    balanceEnd: euros(statement.closingCents),
    currency: DEMO_CURRENCY,
    processedAt: new Date(`${statement.uploadedOn}T09:00:00Z`),
    createdAt: new Date(`${statement.uploadedOn}T09:00:00Z`),
    parsingDetails: {
      detectedBank: 'other',
      detectedFormat: 'csv',
      parserUsed: 'CsvParser',
      transactionsFound: statement.transactions.length,
      transactionsCreated: statement.transactions.length,
      transactionsDeduplicated: 0,
      metadataExtracted: {
        accountNumber,
        dateFrom: statement.dateFrom,
        dateTo: statement.dateTo,
        balanceStart: euros(statement.openingCents),
        balanceEnd: euros(statement.closingCents),
        currency: DEMO_CURRENCY,
      },
      validation: { passed: true, warnings: [] },
      errors: [],
      warnings: [],
    },
  };
}
