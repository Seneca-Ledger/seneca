import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records which step of the classification chain picked a transaction's
 * category and why, so the user can see "rule X" or "learned from Payee Y"
 * instead of guessing, and so re-classification can leave manual picks alone.
 */
export class AddTransactionCategorySource1786710000000 implements MigrationInterface {
  name = 'AddTransactionCategorySource1786710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD "category_source" varchar(16)
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD "category_reason" varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "category_reason"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "category_source"`);
  }
}
