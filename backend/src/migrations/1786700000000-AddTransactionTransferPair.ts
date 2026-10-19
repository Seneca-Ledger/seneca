import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two legs of a transfer between the user's own accounts share
 * `transfer_pair_id`. Aggregates skip paired rows the way they skip
 * duplicates, so moving money to a savings account stops counting as spend.
 */
export class AddTransactionTransferPair1786700000000 implements MigrationInterface {
  name = 'AddTransactionTransferPair1786700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD "transfer_pair_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD "transfer_pair_source" varchar(10)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_workspace_transfer_pair"
      ON "transactions" ("workspace_id", "transfer_pair_id")
      WHERE "transfer_pair_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_workspace_transfer_pair"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "transfer_pair_source"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "transfer_pair_id"`);
  }
}
