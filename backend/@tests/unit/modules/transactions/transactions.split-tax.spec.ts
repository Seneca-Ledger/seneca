import { toMinor } from '@/common/utils/money.util';
import { TaxSource, TransactionType } from '@/entities/transaction.entity';
import { computeTax } from '@/modules/tax/tax-calculation';
import { TransactionsService } from '@/modules/transactions/transactions.service';
import { BadRequestException } from '@nestjs/common';

/**
 * Splitting divides one transaction into parts whose amounts sum to the
 * original. The tax has to be re-assessed per part: copying the parent's figure
 * onto each one would multiply the transaction's tax by the number of parts,
 * and the error would only surface as an inflated return a quarter later.
 */

const ORIGINAL = {
  id: 'tx-1',
  workspaceId: 'ws-1',
  transactionDate: new Date('2026-08-01'),
  counterpartyName: 'Magnum',
  paymentPurpose: 'Groceries',
  currency: 'KZT',
  transactionType: TransactionType.EXPENSE,
  amount: 12000,
  debit: 12000,
  credit: null,
  amountForeign: null,
  exchangeRate: null,
  categoryId: 'cat-food',
  transactionNature: 'goods',
  taxRateId: 'rate-standard',
  taxSource: TaxSource.DEFAULT,
  taxAmount: 1285.71,
  taxNetAmount: 10714.29,
  taxReverseCharge: false,
  taxLocked: false,
  isDuplicate: false,
  splitGroupId: null,
  splitIndex: null,
};

describe('TransactionsService.split — tax', () => {
  let service: TransactionsService;
  let savedRows: any[];
  let transactionRepository: any;
  let resolveSpy: jest.Mock;
  let original: any;

  /** Stands in for the real service: 12% inclusive, as KZ was in 2026. */
  const assignmentStub = {
    resolve: jest.fn(async ({ amountMinor }: { amountMinor: number }) => {
      const breakdown = computeTax({ amountMinor, rate: 12, isInclusive: true });
      return {
        taxRateId: 'rate-standard',
        taxRuleId: null,
        taxSource: TaxSource.DEFAULT,
        taxAmount: breakdown.taxMinor / 100,
        taxNetAmount: breakdown.netMinor / 100,
        taxReverseCharge: false,
      };
    }),
  };

  const makeManager = () => {
    const repo = {
      findOne: jest.fn(async () => ({ ...original })),
      create: jest.fn((data: any) => ({ ...data })),
      save: jest.fn(async (row: any) => {
        const stored = { ...row, id: row.id ?? `new-${savedRows.length}` };
        savedRows.push(stored);
        return stored;
      }),
    };
    return {
      transaction: jest.fn(async (cb: any) => cb({ getRepository: () => repo })),
      getRepository: () => ({ countBy: jest.fn(async ({ id }: any) => id.value.length) }),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    savedRows = [];
    original = { ...ORIGINAL };
    resolveSpy = assignmentStub.resolve as jest.Mock;
    transactionRepository = {
      findOne: jest.fn(async () => ({ ...original })),
      manager: makeManager(),
    };

    service = new TransactionsService(
      transactionRepository,
      {} as any,
      { findOne: jest.fn(async () => ({ id: 'u-1', role: 'admin' })) } as any,
      { findOne: jest.fn(async () => ({ permissions: { canEditStatements: true } })) } as any,
      { findOne: jest.fn(async () => null), create: jest.fn(x => x), save: jest.fn(async x => x) } as any,
      { set: jest.fn() } as any,
      { createEvent: jest.fn() } as any,
      { bulkConvert: jest.fn() } as any,
      assignmentStub as any,
    );
    (service as any).ensureCanEditStatements = jest.fn();
  });

  const splitInThree = () =>
    service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 6000 }, { amount: 4000 }, { amount: 2000 }],
    } as any);

  it('re-assesses each part from its own amount', async () => {
    await splitInThree();

    const amounts = resolveSpy.mock.calls.map(([input]) => input.amountMinor);
    expect(amounts).toEqual([toMinor(6000), toMinor(4000), toMinor(2000)]);
  });

  it('does not multiply the tax across the parts', async () => {
    await splitInThree();

    const total = savedRows.reduce((sum, row) => sum + row.taxAmount, 0);
    const parentTax = computeTax({ amountMinor: toMinor(12000), rate: 12, isInclusive: true });
    const parentMajor = parentTax.taxMinor / 100;

    // The failure this guards against is copying the parent figure onto each
    // part, which would give 3× the tax.
    expect(Number(total.toFixed(2))).toBeLessThan(parentMajor * 1.5);

    // Exact equality is not achievable, and not the right target. Each part is
    // now an independent row that has to stand on its own: net + tax must equal
    // its own amount, which forces its tax to be rounded from its own amount.
    // Rounding three parts separately can land up to a minor unit away from
    // rounding the whole — here 1285.72 against the pre-split 1285.71.
    // Allocating the parent's tax across the parts instead would fix the sum
    // but break per-row consistency, which is the worse trade: every row is a
    // document line in its own right. A split can never disturb a filed return
    // anyway, because splitting a locked row is refused.
    const partCount = savedRows.length;
    expect(Math.abs(total - parentMajor)).toBeLessThanOrEqual(partCount / 100);
  });

  it('keeps net + tax equal to the amount on every part', async () => {
    await splitInThree();

    for (const row of savedRows) {
      expect(Number((row.taxNetAmount + row.taxAmount).toFixed(2))).toBe(Number(row.amount));
    }
  });

  it('resolves against the transaction date, not today', async () => {
    await splitInThree();

    for (const [input] of resolveSpy.mock.calls) {
      expect(input.transactionDate).toEqual(ORIGINAL.transactionDate);
    }
  });

  it('re-resolves after a per-part category override', async () => {
    await service.split('tx-1', 'ws-1', 'u-1', {
      parts: [{ amount: 6000, categoryId: 'cat-rent' }, { amount: 6000 }],
    } as any);

    const categories = resolveSpy.mock.calls.map(([input]) => input.categoryId);
    // A part moved to another category may fall under a different rule, so the
    // override has to happen before assessment, not after.
    expect(categories).toEqual(['cat-rent', 'cat-food']);
  });

  it('carries a hand-picked rate into the parts', async () => {
    original = { ...ORIGINAL, taxSource: TaxSource.MANUAL, taxRateId: 'rate-chosen' };

    await splitInThree();

    for (const [input] of resolveSpy.mock.calls) {
      expect(input.explicitTaxRateId).toBe('rate-chosen');
    }
  });

  it('does not carry an auto-assigned rate as if it were chosen', async () => {
    await splitInThree();

    for (const [input] of resolveSpy.mock.calls) {
      expect(input.explicitTaxRateId).toBeNull();
    }
  });

  it('refuses to split a transaction already in a filed return', async () => {
    original = { ...ORIGINAL, taxLocked: true };

    // Re-assessing across parts would change figures already submitted.
    await expect(splitInThree()).rejects.toThrow(BadRequestException);
    expect(resolveSpy).not.toHaveBeenCalled();
  });
});

describe('TransactionsService.update — filed-return lock', () => {
  const build = (locked: boolean) => {
    const row = { ...ORIGINAL, taxLocked: locked };
    const repo = {
      findOne: jest.fn(async () => ({ ...row })),
      save: jest.fn(async (saved: any) => saved),
      manager: { getRepository: () => ({ countBy: jest.fn(async () => 99) }) },
    };
    const service = new TransactionsService(
      repo as any,
      {} as any,
      { findOne: jest.fn(async () => ({ id: 'u-1', role: 'admin' })) } as any,
      { findOne: jest.fn(async () => ({ permissions: { canEditStatements: true } })) } as any,
      { findOne: jest.fn(async () => null), create: jest.fn(x => x), save: jest.fn(async x => x) } as any,
      { set: jest.fn() } as any,
      { createEvent: jest.fn() } as any,
      { bulkConvert: jest.fn() } as any,
      { resolve: jest.fn() } as any,
    );
    (service as any).ensureCanEditStatements = jest.fn();
    (service as any).assertWorkspaceOwnedRefs = jest.fn();
    (service as any).invalidateReports = jest.fn();
    return { service, repo };
  };

  it.each(['amount', 'categoryId', 'transactionDate', 'currency', 'transactionType'])(
    'refuses to change %s once the row is in a filed return',
    async field => {
      const { service } = build(true);

      await expect(
        service.update('tx-1', 'ws-1', 'u-1', { [field]: 'x' } as any),
      ).rejects.toThrow(/filed tax return/);
    },
  );

  it('still allows edits that cannot move the figures', async () => {
    const { service } = build(true);

    // Locking must not turn the row into a museum piece: a typo in the
    // counterparty or a note has no bearing on what was filed.
    await expect(
      service.update('tx-1', 'ws-1', 'u-1', { comments: 'checked' } as any),
    ).resolves.toBeDefined();
  });

  it('leaves an unlocked row fully editable', async () => {
    const { service } = build(false);

    await expect(
      service.update('tx-1', 'ws-1', 'u-1', { amount: 999 } as any),
    ).resolves.toBeDefined();
  });
});
