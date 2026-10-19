import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * An incoming row can point at the expense it pays back. A full repayment is
 * also written as a `reimbursement` pair (see transfer_pair_id), so neither
 * row counts as spend or income; a partial one only keeps the link.
 */
export class AddTransactionReimbursement1786720000000 implements MigrationInterface {
  name = 'AddTransactionReimbursement1786720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD "transfer_pair_kind" varchar(16)
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD "reimbursement_of_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_reimbursement_of"
      FOREIGN KEY ("reimbursement_of_id") REFERENCES "transactions"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transactions_reimbursement_of"
      ON "transactions" ("reimbursement_of_id")
      WHERE "reimbursement_of_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_reimbursement_of"`);
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_reimbursement_of"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "reimbursement_of_id"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "transfer_pair_kind"`);
  }
}
