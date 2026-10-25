import { AddCategorySource1763500000000 } from '@/migrations/1763500000000-AddCategorySource';
import type { QueryRunner } from 'typeorm';

describe('AddCategorySource1763500000000', () => {
  it('uses literal values for category source migration SQL', async () => {
    const migration = new AddCategorySource1763500000000();
    const query = vi.fn().mockResolvedValue(undefined);
    const queryRunner = { query } as unknown as QueryRunner;

    await migration.up(queryRunner);

    expect(query).toHaveBeenNthCalledWith(
      1,
      'ALTER TABLE "categories" ADD COLUMN "source" character varying NOT NULL DEFAULT \'user\'',
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      'UPDATE "categories" SET "source" = \'system\' WHERE "is_system" = true',
    );
  });
});
