import { MetalWeightUnit } from '@/entities/investment-holding.entity';
import { MetalsTarget } from '@/modules/entity-imports/targets/metals.target';
import type { ImportContext } from '@/modules/entity-imports/targets/target.types';

const WORKSPACE = 'ws-1';
const ACCOUNT = { id: 'acc-1' };

type Row = string[];

function context(mapping: Record<string, number>, options: { account?: boolean } = {}) {
  const saved: Record<string, unknown>[] = [];
  const repos: Record<string, unknown> = {
    BalanceAccount: {
      findOne: jest.fn(async () => (options.account === false ? null : ACCOUNT)),
    },
    InvestmentHolding: {
      create: jest.fn((lot: Record<string, unknown>) => lot),
      save: jest.fn(async (lot: Record<string, unknown>) => {
        saved.push(lot);
        return { ...lot, id: `lot-${saved.length}` };
      }),
    },
  };
  const ctx = {
    workspaceId: WORKSPACE,
    userId: 'user-1',
    manager: { getRepository: (entity: { name: string }) => repos[entity.name] },
    currency: 'EUR',
    fileName: 'stack.csv',
    categorize: false,
    cell: (row: Row, field: string) => {
      const index = mapping[field];
      return Number.isInteger(index) ? String(row[index] ?? '') : '';
    },
    category: async () => null,
    created: [],
    updated: [],
  } as unknown as ImportContext;
  return { ctx, saved };
}

const MAPPING = {
  metal: 0,
  name: 1,
  quantity: 2,
  unitWeight: 3,
  weightUnit: 4,
  purity: 5,
  cost: 6,
  acquiredOn: 7,
  counterparty: 8,
};

describe('MetalsTarget', () => {
  it('reads a stacker spreadsheet: metal names, units and fineness', async () => {
    const { ctx, saved } = context(MAPPING);
    const rows: Row[] = [
      ['Gold', 'Krugerrand', '10', '1', 'oz', '0.9167', '30000', '2026-03-14', 'Degussa'],
      ['Серебро', 'Бар', '1', '1', 'кг', '999', '900', '14.03.2026', 'Пробирная палата'],
      ['XPT', '', '', '31.1035', 'g', '', '', '', ''],
    ];

    const results = await new MetalsTarget().run(rows, ctx, false);

    expect(results.map(row => row.status)).toEqual(['created', 'created', 'created']);
    expect(saved[0]).toMatchObject({
      metal: 'XAU',
      name: 'Krugerrand',
      quantity: 10,
      unitWeight: 1,
      weightUnit: MetalWeightUnit.TROY_OUNCE,
      purity: 0.9167,
      costTotal: 30000,
      costCurrency: 'EUR',
      acquiredOn: '2026-03-14',
      counterparty: 'Degussa',
    });
    // 999 is millesimal: taken literally it would value the bar a thousandfold.
    expect(saved[1]).toMatchObject({
      metal: 'XAG',
      weightUnit: MetalWeightUnit.KILOGRAM,
      purity: 0.999,
      acquiredOn: '2026-03-14',
    });
    // No name, no count, no cost: one piece, named after itself, cost unknown.
    expect(saved[2]).toMatchObject({
      metal: 'XPT',
      quantity: 1,
      purity: 1,
      costTotal: null,
      costCurrency: null,
      name: '1 × 31.1035 g XPT',
    });
  });

  it('leaves the price to the service rather than inventing one', async () => {
    const { ctx, saved } = context(MAPPING);
    await new MetalsTarget().run([['gold', '', '1', '1', 'oz', '', '', '', '']], ctx, false);
    expect(saved[0]).toMatchObject({ price: 0, pricedAt: null, priceSource: 'auto' });
    expect(ctx.created).toEqual([{ kind: 'metal_lot', id: 'lot-1' }]);
  });

  it('marks the rows it cannot read instead of guessing', async () => {
    const { ctx, saved } = context(MAPPING);
    const rows: Row[] = [
      ['copper', 'Round', '1', '1', 'oz', '', '', '', ''],
      ['gold', 'No weight', '1', '', 'oz', '', '', '', ''],
      ['gold', 'Odd fineness', '1', '1', 'oz', '5000', '', '', ''],
    ];

    const results = await new MetalsTarget().run(rows, ctx, false);

    expect(results).toEqual([
      { index: 0, status: 'error', reason: 'metal' },
      { index: 1, status: 'error', reason: 'unitWeight' },
      { index: 2, status: 'error', reason: 'purity' },
    ]);
    expect(saved).toHaveLength(0);
  });

  it('writes nothing on a dry run', async () => {
    const { ctx, saved } = context(MAPPING, { account: false });
    const results = await new MetalsTarget().run(
      [['gold', 'Krugerrand', '1', '1', 'oz', '', '', '', '']],
      ctx,
      true,
    );
    expect(results).toEqual([{ index: 0, status: 'created' }]);
    expect(saved).toHaveLength(0);
  });
});
