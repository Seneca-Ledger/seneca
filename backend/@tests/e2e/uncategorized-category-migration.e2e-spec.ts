jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { UnifyUncategorizedCategory1786810000000 } from '../../src/migrations/1786810000000-UnifyUncategorizedCategory';
import { AppModule } from '../../src/app.module';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** Duplicate Russian fallbacks merge into one 'Uncategorized', references and all. */
describe('Migration: one Uncategorized category per workspace and type (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `uncat-${Date.now()}@example.com`;
  let owner: E2eAccount;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Uncat Owner');
  });

  afterAll(async () => {
    if (dataSource) await deleteUserByEmail(dataSource, email);
    await app.close();
  });

  const insertCategory = async (name: string, createdAt: string, parentId: string | null = null) =>
    (
      await dataSource.query(
        `INSERT INTO categories (name, type, workspace_id, user_id, parent_id, created_at)
         VALUES ($1, 'expense', $2, $3, $4, $5) RETURNING id`,
        [name, owner.workspaceId, owner.userId, parentId, createdAt],
      )
    )[0].id as string;
  const insertBudget = (categoryId: string, period: string) =>
    dataSource.query(
      `INSERT INTO budgets (workspace_id, category_id, name, limit_amount, period_type, current_period_start, currency)
       VALUES ($1, $2, $3, 100, $4, '2026-10-01', 'KZT')`,
      [owner.workspaceId, categoryId, `b-${categoryId.slice(0, 4)}-${period}`, period],
    );

  it('keeps the English one, moves rows, drops colliding budgets and renames nothing else', async () => {
    const kept = await insertCategory('Uncategorized', '2026-01-03');
    const first = await insertCategory('Без категории', '2026-01-01');
    const second = await insertCategory('Без категории', '2026-01-02');
    const child = await insertCategory('Child of a duplicate', '2026-01-04', second);

    const expense = await request(app.getHttpServer())
      .post('/statements/manual-expense')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .field('amount', '12')
      .field('currency', 'KZT')
      .field('merchant', 'Somewhere')
      .field('categoryId', first)
      .field('date', '2026-10-01')
      .expect(201);
    expect(expense.body).toBeDefined();

    await insertBudget(kept, 'monthly');
    await insertBudget(second, 'monthly'); // collides with kept's monthly budget
    await insertBudget(first, 'weekly'); // moves over
    await dataSource.query(
      `INSERT INTO report_schedules (workspace_id, user_id, template_id, format, cadence, next_run_at, category_ids)
       VALUES ($1, $2, 'expense-by-category', 'pdf', 'monthly', now(), $3::jsonb)`,
      [owner.workspaceId, owner.userId, JSON.stringify([first, second, kept])],
    );

    await new UnifyUncategorizedCategory1786810000000().up(dataSource.createQueryRunner());

    const fallbacks = await dataSource.query(
      `SELECT id, name FROM categories WHERE workspace_id = $1 AND type = 'expense'
         AND lower(name) IN ('uncategorized', 'без категории') AND parent_id IS NULL`,
      [owner.workspaceId],
    );
    expect(fallbacks).toEqual([{ id: kept, name: 'Uncategorized' }]);

    const moved = await dataSource.query(
      `SELECT count(*)::int AS n FROM transactions WHERE workspace_id = $1 AND category_id = $2`,
      [owner.workspaceId, kept],
    );
    expect(moved[0].n).toBe(1);

    const budgets = await dataSource.query(
      'SELECT category_id, period_type FROM budgets WHERE workspace_id = $1 ORDER BY period_type::text',
      [owner.workspaceId],
    );
    expect(budgets).toEqual([
      { category_id: kept, period_type: 'monthly' },
      { category_id: kept, period_type: 'weekly' },
    ]);

    const [{ parent_id }] = await dataSource.query('SELECT parent_id FROM categories WHERE id = $1', [child]);
    expect(parent_id).toBe(kept);

    const [{ category_ids }] = await dataSource.query(
      'SELECT category_ids FROM report_schedules WHERE workspace_id = $1',
      [owner.workspaceId],
    );
    expect(category_ids).toEqual([kept]);
  });

  it('refuses a second Uncategorized of the same type afterwards', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO categories (name, type, workspace_id, user_id) VALUES ('Uncategorized', 'expense', $1, $2)`,
        [owner.workspaceId, owner.userId],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
