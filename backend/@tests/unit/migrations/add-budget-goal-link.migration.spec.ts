import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddBudgetGoalLink migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1786260000000-AddBudgetGoalLink.ts',
  );

  const source = () => readFileSync(filePath, 'utf8');

  it('adds the column without a backfill, so existing budgets stay unattached', () => {
    expect(existsSync(filePath)).toBe(true);
    expect(source()).toContain('ADD COLUMN IF NOT EXISTS "goal_id" uuid');
    expect(source()).not.toContain('UPDATE "budgets"');
  });

  it('keeps a budget alive when its goal goes away', () => {
    const text = source();
    expect(text).toContain('FK_budgets_goal');
    expect(text).toContain('REFERENCES "goals"("id")');
    expect(text).toContain('ON DELETE SET NULL');
    expect(text).not.toContain('ON DELETE CASCADE');
  });

  it('indexes both the goal lookup and the spending aggregate', () => {
    const text = source();
    expect(text).toContain('IDX_budgets_workspace_goal');
    expect(text).toContain('IDX_transactions_workspace_category_date');
    expect(text).toContain('WHERE "is_duplicate" = false');
  });

  it('drops the index and constraint before the column they depend on', () => {
    const text = source();
    const down = text.slice(text.indexOf('public async down'));
    expect(down.indexOf('IDX_budgets_workspace_goal')).toBeLessThan(
      down.indexOf('FK_budgets_goal'),
    );
    expect(down.indexOf('FK_budgets_goal')).toBeLessThan(down.indexOf('DROP COLUMN'));
  });
});
