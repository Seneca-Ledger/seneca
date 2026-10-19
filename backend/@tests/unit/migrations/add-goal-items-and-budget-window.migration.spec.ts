import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddGoalItemsAndBudgetWindow migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1786280000000-AddGoalItemsAndBudgetWindow.ts',
  );

  const source = () => readFileSync(filePath, 'utf8');

  it('creates the cost breakdown table', () => {
    expect(existsSync(filePath)).toBe(true);
    const text = source();
    expect(text).toContain('CREATE TABLE IF NOT EXISTS "goal_items"');
    expect(text).toContain('"estimated_amount" numeric(15,2) NOT NULL');
    expect(text).toContain('"actual_amount" numeric(15,2)');
    expect(text).toContain('IDX_goal_items_workspace_goal');
  });

  it('leaves the declared target alone', () => {
    // The lines explain `goals.target_amount`; they do not replace it, so no
    // backfill may touch the number the user typed.
    expect(source()).not.toContain('UPDATE "goals"');
  });

  it('removes a cost line with the goal it itemises', () => {
    const text = source();
    expect(text).toContain('FK_goal_items_goal');
    expect(text).toContain('REFERENCES "goals"("id") ON DELETE CASCADE');
  });

  it('adds the budget window without a default', () => {
    const text = source();
    expect(text).toContain('ADD COLUMN IF NOT EXISTS "starts_on" date');
    expect(text).toContain('ADD COLUMN IF NOT EXISTS "ends_on" date');
    expect(text).not.toContain('"starts_on" date NOT NULL');
  });

  it('replaces the unique key with two partial indexes', () => {
    const text = source();
    const up = text.slice(text.indexOf('public async up'), text.indexOf('public async down'));
    expect(up).toContain('DROP CONSTRAINT IF EXISTS "UQ_budgets_workspace_category_period"');
    // NULLs never collide in Postgres, so the unattached case needs its own
    // index or the old duplicate would quietly become legal again.
    expect(up).toContain('UQ_budgets_workspace_category_period_unlinked');
    expect(up).toContain('WHERE "goal_id" IS NULL');
    expect(up).toContain('UQ_budgets_workspace_category_period_goal');
    expect(up).toContain('WHERE "goal_id" IS NOT NULL');
  });

  it('never deletes budgets to restore the old constraint', () => {
    const down = source().slice(source().indexOf('public async down'));
    expect(down).not.toContain('DELETE FROM "budgets"');
  });
});
