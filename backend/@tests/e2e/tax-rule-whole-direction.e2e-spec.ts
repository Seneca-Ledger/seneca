vi.mock('franc', () => ({ franc: () => 'und' }));

import { TaxRuleItem } from '../../src/contracts';
import { type ContractApp, startContractApp } from './helpers/contract-app';
import { deleteUserByEmail } from './helpers/e2e-app';

/** A tax rule without a category covers a whole direction; its null category is a value, not a 500. */
describe('Tax rules for a whole direction (e2e)', () => {
  const email = `tax-rule-direction-${Date.now()}@example.com`;
  let ctx: ContractApp;
  let code: string;
  let categoryId: string;
  const call: ContractApp['call'] = (...args) => ctx.call(...args);

  beforeAll(async () => {
    ctx = await startContractApp(email, 'Member One');
    await call('put', '/tax/settings/jurisdiction', { code: 'DE' }).expect(200);
    const rates = await call('get', '/tax-rates').expect(200);
    code = rates.body.find((rate: { code: string | null }) => rate.code).code;
    categoryId = (await call('get', '/categories?type=expense').expect(200)).body[0].id;
  });

  afterAll(async () => {
    if (ctx) {
      await deleteUserByEmail(ctx.dataSource, email);
      await ctx.app.close();
    }
  });

  it('creates one, and refuses a second for the same direction', async () => {
    const created = await ctx.answer(
      TaxRuleItem,
      call('post', '/tax/rules', { taxRateCode: code, direction: 'income' }),
    );
    expect(created.categoryId).toBeNull();

    const again = await call('post', '/tax/rules', { taxRateCode: code, direction: 'income' });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('TAX_RULE_DUPLICATE');
  });

  it('moves a category rule onto a whole direction, and refuses a clash there', async () => {
    const rule = await ctx.answer(
      TaxRuleItem,
      call('post', '/tax/rules', { categoryId, taxRateCode: code, direction: 'expense' }),
    );
    const moved = await ctx.answer(
      TaxRuleItem,
      call('put', `/tax/rules/${rule.id}`, { categoryId: null }),
    );
    expect(moved.categoryId).toBeNull();

    const other = await ctx.answer(
      TaxRuleItem,
      call('post', '/tax/rules', { categoryId, taxRateCode: code, direction: 'expense' }),
    );
    const clash = await call('put', `/tax/rules/${other.id}`, { categoryId: null });
    expect(clash.status).toBe(400);
    expect(clash.body.error.code).toBe('TAX_RULE_DUPLICATE');
  });
});
