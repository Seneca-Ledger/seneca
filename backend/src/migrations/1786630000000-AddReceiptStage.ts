import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Review-workflow stage for receipts, the same Submit → Approve flow statements
 * got in AddStatementStage1786620000000. Receipts listed on the Submit page can
 * then be moved in bulk alongside statements. Every existing row starts in
 * 'submit', where the list has always shown receipts.
 */
export class AddReceiptStage1786630000000 implements MigrationInterface {
  name = 'AddReceiptStage1786630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "receipts_stage_enum" AS ENUM ('submit', 'approve', 'pay');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE "receipts"
        ADD COLUMN IF NOT EXISTS "stage" "receipts_stage_enum" NOT NULL DEFAULT 'submit'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "receipts" DROP COLUMN IF EXISTS "stage"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "receipts_stage_enum"`);
  }
}
