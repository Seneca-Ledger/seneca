import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A file can print several accounts. Each becomes its own statement: the
 * upload keeps the first account, and every other account gets a statement
 * pointing back at the upload, with its place in the file. Deleting the upload
 * leaves those statements in place.
 */
export class AddStatementSourceAccount1787440000000 implements MigrationInterface {
  name = 'AddStatementSourceAccount1787440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "statements"
      ADD COLUMN IF NOT EXISTS "source_statement_id" UUID,
      ADD COLUMN IF NOT EXISTS "source_account_index" SMALLINT
    `);
    await queryRunner.query(`
      ALTER TABLE "statements" DROP CONSTRAINT IF EXISTS "FK_statements_source_statement"
    `);
    await queryRunner.query(`
      ALTER TABLE "statements" ADD CONSTRAINT "FK_statements_source_statement"
      FOREIGN KEY ("source_statement_id") REFERENCES "statements"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_statements_source_statement"
      ON "statements" ("source_statement_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_statements_source_statement"`);
    await queryRunner.query(`
      ALTER TABLE "statements" DROP CONSTRAINT IF EXISTS "FK_statements_source_statement"
    `);
    await queryRunner.query(`
      ALTER TABLE "statements"
      DROP COLUMN IF EXISTS "source_account_index",
      DROP COLUMN IF EXISTS "source_statement_id"
    `);
  }
}
