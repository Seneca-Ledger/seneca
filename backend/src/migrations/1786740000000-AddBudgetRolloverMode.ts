import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBudgetRolloverMode1786740000000 implements MigrationInterface {
  name = 'AddBudgetRolloverMode1786740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "budgets_rollover_mode_enum" AS ENUM ('none', 'carry', 'refill');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "budgets"
      ADD COLUMN IF NOT EXISTS "rollover_mode" "budgets_rollover_mode_enum" NOT NULL DEFAULT 'none'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "budgets" DROP COLUMN IF EXISTS "rollover_mode"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "budgets_rollover_mode_enum"`);
  }
}
