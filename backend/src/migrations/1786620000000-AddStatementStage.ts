import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Review-workflow stage of a statement (Submit → Approve → Pay). Until now the
 * frontend kept it in each browser's localStorage, so a statement approved on
 * one device still sat in Submit everywhere else. Every existing row starts in
 * 'submit'; the frontend pushes its old local stages once after this ships.
 */
export class AddStatementStage1786620000000 implements MigrationInterface {
  name = 'AddStatementStage1786620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "statements_stage_enum" AS ENUM ('submit', 'approve', 'pay');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE "statements"
        ADD COLUMN IF NOT EXISTS "stage" "statements_stage_enum" NOT NULL DEFAULT 'submit'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "statements" DROP COLUMN IF EXISTS "stage"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "statements_stage_enum"`);
  }
}
