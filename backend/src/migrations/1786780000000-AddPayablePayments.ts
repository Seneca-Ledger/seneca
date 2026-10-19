import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Money against a bill, one row per payment.
 *
 * A bill used to be settled by exactly one transaction of exactly the right
 * amount. Everything people actually do — underpaying, paying in instalments,
 * one wire covering four invoices, a processor keeping a fee — had nowhere to
 * go. The existing single links are backfilled as one full payment each, so
 * nothing already settled changes meaning.
 */
export class AddPayablePayments1786780000000 implements MigrationInterface {
  name = 'AddPayablePayments1786780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "payables_status_enum" ADD VALUE IF NOT EXISTS 'partially_paid'`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payable_payments" (
        "id"             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "payable_id"     uuid NOT NULL REFERENCES "payables"("id") ON DELETE CASCADE,
        "workspace_id"   uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
        "amount"         numeric(15,2) NOT NULL,
        "fee_amount"     numeric(15,2) NOT NULL DEFAULT 0,
        "paid_on"        date NOT NULL,
        "transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
        "comment"        text,
        "created_by_id"  uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at"     timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payable_payments_payable"
         ON "payable_payments" ("payable_id", "paid_on")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payable_payments_transaction"
         ON "payable_payments" ("transaction_id")`,
    );
    // One transaction may settle several bills, but never the same bill twice.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_payable_payments_payable_transaction"
         ON "payable_payments" ("payable_id", "transaction_id")
       WHERE "transaction_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "payables"
         ADD COLUMN IF NOT EXISTS "paid_amount" numeric(15,2) NOT NULL DEFAULT 0`,
    );

    // Everything already marked paid becomes one payment for its full amount,
    // dated when it was settled, so the derived status keeps saying 'paid'.
    await queryRunner.query(`
      INSERT INTO "payable_payments"
        ("payable_id", "workspace_id", "amount", "paid_on", "transaction_id", "created_by_id")
      SELECT p."id",
             p."workspace_id",
             p."amount",
             COALESCE(p."paid_at"::date, p."due_date", p."created_at"::date),
             p."linked_transaction_id",
             p."created_by_id"
        FROM "payables" p
       WHERE p."status" = 'paid'
         AND p."deleted_at" IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM "payable_payments" pp WHERE pp."payable_id" = p."id"
         )
    `);
    await queryRunner.query(`
      UPDATE "payables" p
         SET "paid_amount" = COALESCE((
               SELECT SUM(pp."amount") FROM "payable_payments" pp WHERE pp."payable_id" = p."id"
             ), 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payables" DROP COLUMN IF EXISTS "paid_amount"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payable_payments"`);
    // Enum values cannot be removed safely.
  }
}
